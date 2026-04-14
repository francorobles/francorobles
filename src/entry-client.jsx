import React from "react";
import { hydrateRoot } from "react-dom/client";
import App from "./App.jsx";
import "./main.css";

const initialState = window.__INITIAL_STATE__ || { posts: [] };

hydrateRoot(
  document.getElementById("root"),
  <App initialPosts={initialState.posts || []} />
);
