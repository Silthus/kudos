import { useConvexAuth, useQuery } from "convex/react";
import { Navigate, Route, Routes } from "react-router";
import { api } from "../convex/_generated/api";
import { AppShell } from "./components/AppShell";
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
import { Store } from "./pages/Store";
import { Analytics } from "./pages/Analytics";
import { Admin } from "./pages/Admin";
import { Playground } from "./pages/Playground";
import { Setup } from "./pages/Setup";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-float text-5xl" aria-label="Loading">🌮</div>
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
        <Route element={<AppShell />}>
          <Route path="/me" element={<Me />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/discoveries" element={<Discoveries />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/skills" element={<Skills />} />
          {/* The menu shows the Store from level 3; the page exists while the game is on and shows its own locked state. */}
          {(viewer.workspace.storeEnabled || viewer.workspace.gameEnabled) && <Route path="/store" element={<Store />} />}
          <Route path="/analytics" element={<Analytics />} />
          {viewer.member.isAdmin && <Route path="/admin" element={<Admin />} />}
          {viewer.workspace.isDemo && <Route path="/playground" element={<Playground />} />}
        </Route>
        <Route path="*" element={<Navigate to="/me" replace />} />
      </Routes>
    </ViewerContext.Provider>
  );
}
