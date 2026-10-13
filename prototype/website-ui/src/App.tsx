// PROTOTYPE: the Kudos website (product name HedgeHug), round 3: variants on top of the round-2 Quill base.
import { useEffect, useState } from "react";
import { Layout, useTheme } from "./Layout";
import { NavContext, go, useHashRoute } from "./nav";
import { screens } from "./screens";
import { SignIn } from "./SignIn";
import { Switcher, useVariant } from "./Switcher";
import { variants } from "./variants";

export function App() {
  const route = useHashRoute();
  const [dark, toggle] = useTheme();
  const [variant, setVariant] = useVariant(variants);
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem("kudos-signed-in") !== "no");
  const setSigned = (v: boolean) => {
    sessionStorage.setItem("kudos-signed-in", v ? "yes" : "no");
    setSignedIn(v);
  };
  const needsSignIn = route.screen === "signin" || !signedIn;
  const current = route.screen === "signin" ? undefined : screens.find((s) => s.id === route.screen);
  const param = route.screen === "signin" ? undefined : route.param;
  const VariantLayout = variant.Layout ?? Layout;
  const Screen = current ? (variant.screens[current.id] ?? current.Component) : undefined;
  const pageName = needsSignIn ? "Sign in" : (current?.label ?? "Profile");
  useEffect(() => {
    document.title = `HedgeHug · ${pageName}`;
  }, [pageName]);

  return (
    <NavContext.Provider value={{ go, signedIn, setSignedIn: setSigned }}>
      {needsSignIn ? (
        <SignIn dark={dark} toggle={toggle} next={route.screen === "signin" ? route.next : `${route.screen}${param ? `/${param}` : ""}`} />
      ) : (
        <VariantLayout current={current?.id ?? "profile"} dark={dark} toggle={toggle}>
          {Screen && <Screen key={`${variant.key}-${current?.id}`} param={param} />}
        </VariantLayout>
      )}
      <Switcher variants={variants} current={variant} screen={current?.id ?? "profile"} onChange={setVariant} />
    </NavContext.Provider>
  );
}
