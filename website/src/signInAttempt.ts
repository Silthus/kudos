import { useEffect, useState } from "react";
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

function forgetSignInStarted() {
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
    if (!returnedFromSignIn || state.kind === "loading") return;
    forgetSignInStarted();
    setReturnedFromSignIn(false);
    setUnfinished(state.kind === "signed-out");
  }, [returnedFromSignIn, state.kind]);

  const signedOut = state.kind === "signed-out";
  return signedOut && (unfinished || returnedFromSignIn) ? { kind: "sign-in-unfinished" } : state;
}
