// PROTOTYPE: three shells for the Kudos website (product name HedgeHug), switchable via ?shell= and the floating bar.
// Screens are shared across shells; each shell owns layout and navigation only.
import { useEffect, useState } from "react";
import { Switcher, useTheme, type Variant } from "./chrome";
import { NavContext, go, useHashRoute } from "./nav";
import { screens } from "./screens";
import { SignIn } from "./SignIn";
import { DesktopShell } from "./shells/DesktopShell";
import { AppShell } from "./shells/AppShell";
import { NotebookShell } from "./shells/NotebookShell";
import type { ShellProps } from "./shells/types";

const variants: Array<Variant & { Shell: (p: ShellProps) => React.ReactNode }> = [
  { key: "A", name: "Desktop (posthog.com)", Shell: DesktopShell },
  { key: "B", name: "App (sidebar)", Shell: AppShell },
  { key: "C", name: "Notebook (one page)", Shell: NotebookShell },
];

function useShell(): [string, (k: string) => void] {
  const [shell, setShell] = useState(() => new URLSearchParams(location.search).get("shell") ?? "A");
  const set = (k: string) => {
    const url = new URL(location.href);
    url.searchParams.set("shell", k);
    history.replaceState(null, "", url);
    setShell(k);
  };
  return [shell, set];
}

export function App() {
  const route = useHashRoute();
  const [dark, toggle] = useTheme();
  const [shell, setShell] = useShell();
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem("kudos-signed-in") !== "no");
  const setSigned = (v: boolean) => {
    sessionStorage.setItem("kudos-signed-in", v ? "yes" : "no");
    setSignedIn(v);
  };
  const variant = variants.find((v) => v.key === shell) ?? variants[0];
  const needsSignIn = route.screen === "signin" || !signedIn;
  const current = route.screen === "signin" ? undefined : screens.find((s) => s.id === route.screen);
  const param = route.screen === "signin" ? undefined : route.param;
  const pageName = needsSignIn ? "Sign in" : (current?.label ?? "Profile");
  useEffect(() => {
    document.title = `HedgeHug · ${pageName}`;
  }, [pageName]);

  return (
    <NavContext.Provider value={{ go, signedIn, setSignedIn: setSigned }}>
      {needsSignIn ? (
        <SignIn dark={dark} toggle={toggle} next={route.screen === "signin" ? route.next : `${route.screen}${param ? `/${param}` : ""}`} />
      ) : (
        <variant.Shell current={current?.id ?? "profile"} dark={dark} toggle={toggle}>
          {current && <current.Component param={param} />}
        </variant.Shell>
      )}
      <Switcher variants={variants} current={variant.key} onChange={setShell} />
    </NavContext.Provider>
  );
}
