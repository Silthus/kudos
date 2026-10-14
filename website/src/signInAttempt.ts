import { useEffect, useRef, useState } from "react";
import { withoutTheSignInEntry } from "./route";
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
  const [asked, setAsked] = useState(signInAskedInTheAddress);
  const [leaving, setLeaving] = useState(false);
  const answered = useRef(false);
  const signInAnswers = state.kind === "closed" || state.kind === "signed-out";

  useEffect(() => {
    if (!asked || answered.current || state.kind === "loading" || state.kind === "connecting") return;
    answered.current = true;
    dropTheSignInAsk();
    setAsked(false);
    if (!signInAnswers) return;
    setLeaving(true);
    signIn();
  }, [asked, state.kind, signInAnswers, signIn]);

  useEffect(() => {
    const comeBack = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener("pageshow", comeBack);
    return () => window.removeEventListener("pageshow", comeBack);
  }, []);

  return leaving || (asked && signInAnswers);
}

function signInAskedInTheAddress() {
  return withoutTheSignInEntry(window.location.pathname) !== window.location.pathname;
}

function dropTheSignInAsk() {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", withoutTheSignInEntry(pathname) + search);
}
