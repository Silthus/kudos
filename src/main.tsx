import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { MotionConfig } from "motion/react";
import "./index.css";
import { App } from "./App";
import { startTheme } from "./lib/theme";

// The pre-paint script in index.html already painted the theme; from here on it follows the OS, other tabs and the switch.
startTheme();

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
);
