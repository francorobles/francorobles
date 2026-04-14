import React, { useMemo, useState } from "react";

const navItems = [
  { href: "#studio", label: "Studio", icon: "S" },
  { href: "#posts", label: "Posts", icon: "P" },
  { href: "#process", label: "Process", icon: "W" },
  { href: "#contact", label: "Contact", icon: "C" }
];

const emptyForm = {
  title: "",
  excerpt: "",
  body: "",
  category: "Journal",
  author: "Franco Robles"
};

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function BlogCard({ post, featured = false }) {
  return (
    <article className={`blog-card ${featured ? "blog-card-featured" : ""}`}>
      <a className="blog-card-image" href={`#${post.id}`} aria-label={post.title}>
        <img src={post.image} alt="" />
      </a>
      <div className="blog-card-body">
        <p className="eyebrow">{post.category}</p>
        <h3 id={post.id}>{post.title}</h3>
        <p>{post.excerpt}</p>
        <div className="blog-meta">
          <span>{formatDate(post.createdAt)}</span>
          <span>{post.readTime}</span>
        </div>
      </div>
    </article>
  );
}

function FloatingNav() {
  return (
    <header className="floating-nav" aria-label="Primary">
      <nav>
        {navItems.map((item) => (
          <a key={item.href} href={item.href} aria-label={item.label}>
            <span aria-hidden="true">{item.icon}</span>
            <strong>{item.label}</strong>
          </a>
        ))}
      </nav>
    </header>
  );
}

function Composer({ onCreate }) {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: "saving", message: "Publishing draft..." });

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "The post could not be saved.");
      }

      onCreate(payload);
      setForm(emptyForm);
      setStatus({ type: "success", message: "Post published." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-heading">
        <p className="eyebrow">Write</p>
        <h2>Create a Blog</h2>
      </div>
      <label>
        Title
        <input
          name="title"
          value={form.title}
          onChange={updateField}
          placeholder="What are you thinking through?"
          required
        />
      </label>
      <label>
        Excerpt
        <input
          name="excerpt"
          value={form.excerpt}
          onChange={updateField}
          placeholder="One clean sentence for the card."
          required
        />
      </label>
      <div className="composer-row">
        <label>
          Category
          <input name="category" value={form.category} onChange={updateField} />
        </label>
        <label>
          Author
          <input name="author" value={form.author} onChange={updateField} />
        </label>
      </div>
      <label>
        Body
        <textarea
          name="body"
          value={form.body}
          onChange={updateField}
          placeholder="Draft the post here."
          rows="7"
          required
        />
      </label>
      <div className="composer-actions">
        <button type="submit" disabled={status.type === "saving"}>
          {status.type === "saving" ? "Publishing" : "Publish Post"}
        </button>
        <span className={`form-status form-status-${status.type}`}>
          {status.message}
        </span>
      </div>
    </form>
  );
}

function App({ initialPosts = [] }) {
  const [posts, setPosts] = useState(initialPosts);
  const featuredPosts = useMemo(() => posts.slice(0, 2), [posts]);
  const timelinePosts = useMemo(() => posts.slice(0, 4), [posts]);

  function addPost(post) {
    setPosts((current) => [post, ...current]);
    window.requestAnimationFrame(() => {
      document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <>
      <FloatingNav />
      <main>
        <section id="studio" className="section studio-section">
          <div className="studio-bg" aria-hidden="true" />
          <div className="container studio-grid">
            <div className="profile-panel">
              <img
                className="profile-image"
                src="/assets/resume/me.jpg"
                alt="Profile portrait"
              />
              <div>
                <p className="eyebrow">React SSR</p>
                <h1>Resume Blog Studio</h1>
                <p className="lead">
                  Draft, publish, and read posts in a Porto-inspired dark resume
                  space.
                </p>
                <div className="quick-links" aria-label="Quick actions">
                  <a href="#posts">Read posts</a>
                  <a href="#process">Workflow</a>
                </div>
              </div>
            </div>
            <Composer onCreate={addPost} />
          </div>
        </section>

        <section id="posts" className="section posts-section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Published</p>
              <h2>My Blog</h2>
            </div>
            <div className="blog-grid">
              {featuredPosts.map((post, index) => (
                <BlogCard key={post.id} post={post} featured={index === 0} />
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="section process-section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Workflow</p>
              <h2>Editorial Timeline</h2>
            </div>
            <div className="timeline">
              {timelinePosts.map((post) => (
                <article className="timeline-entry" key={post.id}>
                  <div className="timeline-date">
                    <span>{formatDate(post.createdAt)}</span>
                    <strong>{post.category}</strong>
                  </div>
                  <div className="timeline-copy">
                    <h3>{post.title}</h3>
                    <p>{post.body}</p>
                  </div>
                </article>
              ))}
              <div className="timeline-bar" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section id="contact" className="section contact-section">
          <div className="container contact-grid">
            <div>
              <p className="eyebrow">Hello</p>
              <h2>Keep the Draft Moving</h2>
            </div>
            <div className="contact-actions">
              <a href="mailto:me@domain.com">me@domain.com</a>
              <a href="#studio">Create another post</a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
