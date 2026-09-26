import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { MotionProvider } from "./world/motion";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider client={convex}>
        <MotionProvider>
          <App />
        </MotionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
