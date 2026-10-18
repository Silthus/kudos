// PROTOTYPE (#625, round 4): one setting of the activity page kept in the address hash, replaced in place so the back button leaves the page. Never merge to main.
import { useCallback, useEffect, useReducer } from "react";

function hashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function replaceHash(params: URLSearchParams) {
  const hash = params.toString();
  const address = window.location.pathname + window.location.search + (hash === "" ? "" : `#${hash}`);
  window.history.replaceState(window.history.state, "", address);
}

export function useHashParam<Value extends string>(name: string, values: readonly Value[], fallback: Value): [Value, (value: Value) => void] {
  const [, rerender] = useReducer((seen: number) => seen + 1, 0);
  useEffect(() => {
    window.addEventListener("hashchange", rerender);
    window.addEventListener("popstate", rerender);
    return () => {
      window.removeEventListener("hashchange", rerender);
      window.removeEventListener("popstate", rerender);
    };
  }, []);
  const asked = hashParams().get(name);
  const value = values.find((known) => known === asked) ?? fallback;
  const choose = useCallback(
    (next: Value) => {
      const params = hashParams();
      if (next === fallback) params.delete(name);
      else params.set(name, next);
      replaceHash(params);
      rerender();
    },
    [name, fallback],
  );
  return [value, choose];
}
