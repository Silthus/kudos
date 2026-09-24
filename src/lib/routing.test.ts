import { describe, expect, test } from "vitest";
import { appScreen, signInRedirect } from "./routing";

const loading = { isLoading: true, isAuthenticated: false };
const signedOut = { isLoading: false, isAuthenticated: false };
const signedIn = { isLoading: false, isAuthenticated: true };

describe("appScreen", () => {
  test("waits while the session is still being restored, whatever the viewer query said", () => {
    // The race behind deep links landing on /me: an unauthenticated viewer answer before the token loads.
    expect(appScreen(loading, { status: "signedOut" })).toBe("loading");
    expect(appScreen(loading, undefined)).toBe("loading");
  });

  test("a visitor without a session is signed out", () => {
    expect(appScreen(signedOut, undefined)).toBe("signedOut");
  });

  test("waits for the viewer once the session is confirmed", () => {
    expect(appScreen(signedIn, undefined)).toBe("loading");
  });

  test("a session the backend doesn't recognise offers sign-in instead of waiting forever", () => {
    expect(appScreen(signedIn, { status: "signedOut" })).toBe("signedOut");
  });

  test("a confirmed session shows what the viewer says", () => {
    expect(appScreen(signedIn, { status: "ready" })).toBe("ready");
    expect(appScreen(signedIn, { status: "notInstalled" })).toBe("notInstalled");
  });
});

const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

describe("signInRedirect", () => {
  test("comes back to the requested page with its query and fragment", () => {
    expect(signInRedirect(at("/leaderboard", "?period=year"))).toBe("/leaderboard?period=year");
    expect(signInRedirect(at("/compare", "?vs=teammate&who=abc&period=quarter"))).toBe("/compare?vs=teammate&who=abc&period=quarter");
    expect(signInRedirect(at("/admin", "?tab=store"))).toBe("/admin?tab=store");
    expect(signInRedirect(at("/store", "", "#my-requests"))).toBe("/store#my-requests");
  });

  test("keeps the query exactly as it was written", () => {
    expect(signInRedirect(at("/compare", "?who=Ana%20Lima&vs=teammate"))).toBe("/compare?who=Ana%20Lima&vs=teammate");
  });

  test("the landing page leads to the dashboard", () => {
    expect(signInRedirect(at("/"))).toBe("/me");
    expect(signInRedirect(at("/", "?installed=Acme"))).toBe("/me");
  });

  test("never carries a spent sign-in code back into the app", () => {
    expect(signInRedirect(at("/compare", "?code=123&period=year"))).toBe("/compare?period=year");
    expect(signInRedirect(at("/discoveries", "?code=123"))).toBe("/discoveries");
  });

  test("anything but a plain path falls back to the dashboard", () => {
    expect(signInRedirect(at("//evil.example/x"))).toBe("/me");
    expect(signInRedirect(at("evil.example"))).toBe("/me");
  });
});
