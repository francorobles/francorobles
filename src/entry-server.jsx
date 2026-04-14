import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App.jsx";
import "./main.css";

export function render(_url, initialState = { posts: [] }) {
  return renderToString(<App initialPosts={initialState.posts || []} />);
}
