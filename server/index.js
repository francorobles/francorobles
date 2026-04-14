import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "blogs.json");
const isProduction =
  process.argv.includes("--production") || process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);

const app = express();
app.use(express.json({ limit: "1mb" }));

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readPosts() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const posts = JSON.parse(raw);
  return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function writePosts(posts) {
  await ensureDataFile();
  await fs.writeFile(dataFile, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

function createSlug(title, posts) {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled";
  let slug = base;
  let suffix = 2;

  while (posts.some((post) => post.id === slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function estimateReadTime(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min read`;
}

function sanitizePost(input, posts) {
  const title = String(input.title || "").trim();
  const excerpt = String(input.excerpt || "").trim();
  const body = String(input.body || "").trim();
  const author = String(input.author || "Franco Robles").trim();
  const category = String(input.category || "Journal").trim();

  if (!title || !excerpt || !body) {
    const error = new Error("Title, excerpt, and body are required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: createSlug(title, posts),
    title,
    excerpt,
    body,
    author,
    category,
    createdAt: new Date().toISOString(),
    image: posts.length % 2 === 0 ? "/assets/resume/blog-1.jpg" : "/assets/resume/blog-2.jpg",
    readTime: estimateReadTime(body)
  };
}

function serializeState(state) {
  return JSON.stringify(state).replace(/</g, "\\u003c");
}

app.get("/api/posts", async (_req, res, next) => {
  try {
    res.json(await readPosts());
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts", async (req, res, next) => {
  try {
    const posts = await readPosts();
    const post = sanitizePost(req.body, posts);
    const nextPosts = [post, ...posts];
    await writePosts(nextPosts);
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

let vite;
if (isProduction) {
  app.use(
    express.static(path.resolve(root, "dist/client"), {
      index: false
    })
  );
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    appType: "custom",
    server: {
      middlewareMode: true
    }
  });
  app.use(vite.middlewares);
}

app.use(async (req, res, next) => {
  if (req.originalUrl.startsWith("/api/")) {
    next();
    return;
  }

  try {
    const url = req.originalUrl;
    const initialPosts = await readPosts();
    let template;
    let render;

    if (isProduction) {
      template = await fs.readFile(path.resolve(root, "dist/client/index.html"), "utf8");
      const serverEntry = pathToFileURL(
        path.resolve(root, "dist/server/entry-server.js")
      ).href;
      render = (await import(serverEntry)).render;
    } else {
      template = await fs.readFile(path.resolve(root, "index.html"), "utf8");
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/entry-server.jsx")).render;
    }

    const appHtml = render(url, { posts: initialPosts });
    const html = template
      .replace("<!--app-html-->", appHtml)
      .replace(
        "<!--initial-state-->",
        `<script>window.__INITIAL_STATE__=${serializeState({
          posts: initialPosts
        })}</script>`
      );

    res.status(200).set({ "Content-Type": "text/html" }).send(html);
  } catch (error) {
    if (vite) {
      vite.ssrFixStacktrace(error);
    }
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? "Something went wrong." : error.message
  });
});

app.listen(port, () => {
  const mode = isProduction ? "production" : "development";
  console.log(`React SSR blog studio running in ${mode} at http://localhost:${port}`);
});
