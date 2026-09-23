import { useQuery } from "convex/react";
import { Navigate, Route, Routes } from "react-router";
import { api } from "../convex/_generated/api";
import { AppShell } from "./components/AppShell";
import { ViewerContext } from "./lib/viewer";
import { Landing } from "./pages/Landing";
import { NotInstalled } from "./pages/NotInstalled";
import { Me } from "./pages/Me";
import { Leaderboard } from "./pages/Leaderboard";
import { Discoveries } from "./pages/Discoveries";
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
  const viewer = useQuery(api.session.viewer);
  if (viewer === undefined) return <Splash />;

  if (viewer.status !== "ready") {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/" element={viewer.status === "notInstalled" ? <NotInstalled name={viewer.name} /> : <Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
          <Route path="/discoveries" element={<Discoveries />} />
          {viewer.workspace.storeEnabled && <Route path="/store" element={<Store />} />}
          <Route path="/analytics" element={<Analytics />} />
          {viewer.member.isAdmin && <Route path="/admin" element={<Admin />} />}
          {viewer.workspace.isDemo && <Route path="/playground" element={<Playground />} />}
        </Route>
        <Route path="*" element={<Navigate to="/me" replace />} />
      </Routes>
    </ViewerContext.Provider>
  );
}
