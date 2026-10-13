import "@fontsource-variable/inter";
import "./index.css";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LiveShell } from "./LiveApp";
import { builtShell, fixtureActions } from "./shell";

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root element.");

createRoot(root).render(<StrictMode>{chosenShell()}</StrictMode>);

function chosenShell() {
  const fixture: string | undefined = import.meta.env.VITE_SHELL_FIXTURE;
  const convexUrl: string | undefined = import.meta.env.VITE_CONVEX_URL;
  if (fixture || !convexUrl) return <App visitor={builtShell(fixture)} actions={fixtureActions} />;
  return <LiveShell client={new ConvexReactClient(convexUrl)} />;
}
