import "@fontsource-variable/inter";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { builtShell } from "./shell";

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root element.");

createRoot(root).render(
  <StrictMode>
    <App shell={builtShell(import.meta.env.VITE_SHELL_FIXTURE)} />
  </StrictMode>,
);
