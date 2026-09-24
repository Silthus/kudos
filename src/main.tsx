import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { MotionConfig } from "motion/react";
import "./index.css";
import { App } from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

/**
 * Convex Auth strips the one-time `code` from the URL after Slack sign-in. Doing that through the
 * router keeps its location in step; a bare `history.replaceState` would leave the spent code
 * there for the next `setSearchParams` to write back.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ConvexAuthProvider client={convex} replaceURL={(url) => navigate(url, { replace: true })}>
      {children}
    </ConvexAuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
