// @vitest-environment happy-dom
import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import type { ConvexReactClient } from "convex/react";
import { expect, test, vi } from "vitest";

// Stands in for Convex Auth's code handling: on mount it asks to drop `code` from the URL.
let handlesCode: (() => boolean) | boolean | undefined;
vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: (props: { replaceURL: (url: string) => void; shouldHandleCode?: () => boolean; children: ReactNode }) => {
    handlesCode = props.shouldHandleCode;
    useEffect(() => {
      props.replaceURL("/compare?period=year");
    }, []);
    return props.children;
  },
}));

const { AuthProvider, oauthReturnPending } = await import("./auth");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const address = "http://127.0.0.1:3210";
const client = { url: address } as unknown as ConvexReactClient;

test("the spent sign-in code leaves the router's location too, not only the address bar", () => {
  let url = "";
  function Probe() {
    const { pathname, search } = useLocation();
    url = pathname + search;
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/compare?period=year&code=12345678"]}>
        <AuthProvider client={client}>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    ),
  );
  expect(url).toBe("/compare?period=year");
  act(() => root.unmount());
});

test("a `code` in the URL is only exchanged when this browser started a Slack sign-in", () => {
  // Convex Auth keeps the PKCE verifier, per deployment, from the redirect until the exchange.
  const storage = new Map<string, string>();
  const store = { getItem: (k: string) => storage.get(k) ?? null };
  expect(oauthReturnPending(store, address)).toBe(false);
  storage.set("__convexAuthOAuthVerifier_http1270013210", "verifier");
  expect(oauthReturnPending(store, address)).toBe(true);
  expect(oauthReturnPending(store, "https://other.convex.cloud")).toBe(false);
});

test("the provider leaves a stray code alone and exchanges the one it is waiting for", () => {
  const ask = handlesCode as () => boolean;
  window.localStorage.clear();
  expect(ask()).toBe(false);
  window.localStorage.setItem("__convexAuthOAuthVerifier_http1270013210", "verifier");
  expect(ask()).toBe(true);
  window.localStorage.clear();
});
