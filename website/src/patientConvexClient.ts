import { ConvexReactClient, type AuthTokenFetcher } from "convex/react";
import isNetworkError from "is-network-error";

const firstPauseMs = 1_000;
const longestPauseMs = 60_000;

export class PatientConvexClient extends ConvexReactClient {
  override setAuth(...[fetchToken, ...callbacks]: Parameters<ConvexReactClient["setAuth"]>) {
    super.setAuth(fetchedOnceTheNetworkAnswers(fetchToken), ...callbacks);
  }
}

function fetchedOnceTheNetworkAnswers(fetchToken: AuthTokenFetcher): AuthTokenFetcher {
  return async (args) => {
    for (let pauseMs = firstPauseMs; ; pauseMs = Math.min(pauseMs * 2, longestPauseMs)) {
      try {
        return await fetchToken(args);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        await backOnlineOrAfter(pauseMs);
      }
    }
  };
}

function backOnlineOrAfter(pauseMs: number) {
  return new Promise<void>((resolve) => {
    const tryAgain = () => {
      clearTimeout(pause);
      window.removeEventListener("online", tryAgain);
      resolve();
    };
    const pause = setTimeout(tryAgain, pauseMs);
    window.addEventListener("online", tryAgain);
  });
}
