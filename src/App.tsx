import { useConvexAuth, useQuery } from "convex/react";
import { Navigate, Route, Routes } from "react-router";
import { api } from "../convex/_generated/api";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "./components/ui";
import { useLinkedWorkspace } from "./lib/linkedWorkspace";
import { appScreen } from "./lib/routing";
import { ViewerContext } from "./lib/viewer";
import { Landing } from "./pages/Landing";
import { NotInstalled } from "./pages/NotInstalled";
import { Me } from "./pages/Me";
import { Leaderboard } from "./pages/Leaderboard";
import { Compare } from "./pages/compare/Compare";
import { Discoveries } from "./pages/Discoveries";
import { Quests } from "./pages/Quests";
import { Skills } from "./pages/Skills";
import { Garden, GardenOf } from "./pages/Garden";
import { Store } from "./pages/Store";
import { Analytics } from "./pages/Analytics";
import { Admin } from "./pages/Admin";
import { Playground } from "./pages/Playground";
import { Setup } from "./pages/Setup";
import { HogFrame } from "./world/Hog";
import { WorldShell } from "./world/WorldShell";

/** While the session and the viewer load: your hedgehog, still, on the dusk sky. */
function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-dusk">
      <div className="flex flex-col items-center gap-2">
        <HogFrame scale={2} />
        <p role="status" className="font-display text-2xl text-cream">
          Loading the garden…
        </p>
      </div>
    </div>
  );
}

/** The world itself failed (a page failing shows in its window instead): say so, on the sky. */
function WorldFailed() {
  return (
    <div className="grid min-h-dvh place-items-center bg-dusk p-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-2xl font-medium text-cream">Something went wrong</h1>
        <p className="mt-2 text-sm text-cream/80">The garden couldn't load. Reload to try again.</p>
        <Button className="mt-6" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}

export function App() {
  const auth = useConvexAuth();
  // Asked only once the backend holds the session: an earlier answer would read as signed out.
  const viewer = useQuery(api.session.viewer, auth.isAuthenticated ? {} : "skip");
  const screen = appScreen(auth, viewer);
  const followingLink = useLinkedWorkspace(screen === "ready" && viewer?.status === "ready" ? viewer : null);
  if (screen === "loading" || followingLink) return <Splash />;

  if (screen === "signedOut" || viewer?.status !== "ready") {
    // Rendered at the requested URL, so signing in (or a session that was only refreshing) comes back to it.
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={viewer?.status === "notInstalled" ? <NotInstalled name={viewer.name} /> : <Landing />} />
      </Routes>
    );
  }

  return (
    <ViewerContext.Provider value={viewer}>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        {/* The world: `/` is the map, every page opens as a window at its place. */}
        <Route
          element={
            <ErrorBoundary fallback={<WorldFailed />}>
              <WorldShell />
            </ErrorBoundary>
          }
        >
          <Route index element={null} />
          <Route path="/me" element={<Me />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/discoveries" element={<Discoveries />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/garden" element={<Garden />} />
          <Route path="/garden/:memberId" element={<GardenOf />} />
          {/* The menu shows the Store from level 3; the page exists while the game is on and shows its own locked state. */}
          {(viewer.workspace.storeEnabled || viewer.workspace.gameEnabled) && <Route path="/store" element={<Store />} />}
          <Route path="/analytics" element={<Analytics />} />
          {viewer.member.isAdmin && <Route path="/admin" element={<Admin />} />}
          {viewer.workspace.isDemo && <Route path="/playground" element={<Playground />} />}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ViewerContext.Provider>
  );
}
