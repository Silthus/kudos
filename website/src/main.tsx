import "@fontsource-variable/inter";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./Root";

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root element.");

createRoot(root).render(
  <StrictMode>
    <Root fixture={import.meta.env.VITE_SHELL_FIXTURE} convexUrl={import.meta.env.VITE_CONVEX_URL} />
  </StrictMode>,
);
