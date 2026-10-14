import { useEffect, useRef, useState } from "react";
import { signInAsk } from "../../convex/website/routes";
import type { ShellState } from "./shell";

const storageKey = "hedgehug.signInStarted";

export function rememberSignInStarted() {
  try {
    sessionStorage.setItem(storageKey, "true");
  } catch {
    return;
  }
}

function signInStarted() {
  try {
    return sessionStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

export function forgetSignInStarted() {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    return;
  }
}

export function useSignInOutcome(state: ShellState): ShellState {
  const [returnedFromSignIn, setReturnedFromSignIn] = useState(signInStarted);
  const [unfinished, setUnfinished] = useState(false);

  useEffect(() => {
    if (state.kind === "loading" || state.kind === "connecting") return;
    if (state.kind !== "signed-out") setUnfinished(false);
    if (!returnedFromSignIn) return;
    forgetSignInStarted();
    setReturnedFromSignIn(false);
    setUnfinished(state.kind === "signed-out");
  }, [returnedFromSignIn, state.kind]);

  const signedOut = state.kind === "signed-out";
  return signedOut && (unfinished || returnedFromSignIn) ? { kind: "sign-in-unfinished" } : state;
}

export function useSignInWhenAsked(state: ShellState, signIn: () => void): boolean {
  const [asked] = useState(signInAskedInTheAddress);
  const answered = useRef(false);
  const takingToSlack = asked && (state.kind === "closed" || state.kind === "signed-out");

  useEffect(() => {
    if (!asked || answered.current || state.kind === "loading" || state.kind === "connecting") return;
    answered.current = true;
    dropTheSignInAsk();
    if (takingToSlack) signIn();
  }, [asked, state.kind, takingToSlack, signIn]);

  return takingToSlack;
}

function signInAskedInTheAddress() {
  return new URLSearchParams(window.location.search).has(signInAsk);
}

function dropTheSignInAsk() {
  const address = new URL(window.location.href);
  address.searchParams.delete(signInAsk);
  window.history.replaceState(null, "", address.pathname + address.search);
}
