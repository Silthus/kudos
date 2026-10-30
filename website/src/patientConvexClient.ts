import { ConvexReactClient, type AuthTokenFetcher } from "convex/react";
import isNetworkError from "is-network-error";

const firstPauseMs = 1_000;
const longestPauseMs = 60_000;

export class PatientConvexClient extends ConvexReactClient {
  private patience = new AbortController();

  override setAuth(...[fetchToken, ...callbacks]: Parameters<ConvexReactClient["setAuth"]>) {
    super.setAuth(fetchedOnceTheNetworkAnswers(fetchToken, this.renewedPatience()), ...callbacks);
  }

  override clearAuth() {
    this.patience.abort();
    super.clearAuth();
  }

  override async close() {
    this.patience.abort();
    return super.close();
  }

  private renewedPatience() {
    this.patience.abort();
    this.patience = new AbortController();
    return this.patience.signal;
  }
}

function fetchedOnceTheNetworkAnswers(fetchToken: AuthTokenFetcher, patience: AbortSignal): AuthTokenFetcher {
  return async (args) => {
    for (let pauseMs = firstPauseMs; ; pauseMs = Math.min(pauseMs * 2, longestPauseMs)) {
      try {
        return await fetchToken(args);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        await backOnlineOrAfter(pauseMs, patience);
        if (patience.aborted) return null;
      }
    }
  };
}

function backOnlineOrAfter(pauseMs: number, patience: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (patience.aborted) return resolve();
    const tryAgain = () => {
      clearTimeout(pause);
      window.removeEventListener("online", tryAgain);
      patience.removeEventListener("abort", tryAgain);
      resolve();
    };
    const pause = setTimeout(tryAgain, pauseMs);
    window.addEventListener("online", tryAgain);
    patience.addEventListener("abort", tryAgain);
  });
}
