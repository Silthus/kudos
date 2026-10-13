// PROTOTYPE: the Kudos website (product name HedgeHug), round 2: one layout on @posthog/quill.
import { useEffect, useState } from "react";
import { Layout, useTheme } from "./Layout";
import { NavContext, go, useHashRoute } from "./nav";
import { screens } from "./screens";
import { SignIn } from "./SignIn";

export function App() {
  const route = useHashRoute();
  const [dark, toggle] = useTheme();
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem("kudos-signed-in") !== "no");
  const setSigned = (v: boolean) => {
    sessionStorage.setItem("kudos-signed-in", v ? "yes" : "no");
    setSignedIn(v);
  };
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
        <Layout current={current?.id ?? "profile"} dark={dark} toggle={toggle}>
          {current && <current.Component param={param} />}
        </Layout>
      )}
    </NavContext.Provider>
  );
}
