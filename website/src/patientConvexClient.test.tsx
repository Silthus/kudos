import { ConvexReactClient, type AuthTokenFetcher } from "convex/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatientConvexClient } from "./patientConvexClient";

const forced = { forceRefreshToken: true };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function offline() {
  return new TypeError("Failed to fetch");
}

function tokenFetcherHandedToConvex(fetchToken: AuthTokenFetcher): AuthTokenFetcher {
  const setAuth = vi.spyOn(ConvexReactClient.prototype, "setAuth").mockImplementation(() => {});
  new PatientConvexClient("https://happy-hog-123.convex.cloud").setAuth(fetchToken);
  return setAuth.mock.calls[0]![0];
}

describe("a token refresh that fails on the network waits for the network instead of failing", () => {
  it("answers with the refreshed token once the browser is back online", async () => {
    const fetchToken = vi.fn<AuthTokenFetcher>().mockRejectedValueOnce(offline()).mockResolvedValueOnce("fresh-jwt");

    const token = tokenFetcherHandedToConvex(fetchToken)(forced);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchToken).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("online"));

    await expect(token).resolves.toBe("fresh-jwt");
    expect(fetchToken).toHaveBeenNthCalledWith(2, forced);
  });

  it("without an online event tries again after a pause that doubles, up to a minute", async () => {
    const fetchToken = vi.fn<AuthTokenFetcher>().mockRejectedValue(offline());

    void tokenFetcherHandedToConvex(fetchToken)(forced);
    const triesAfter = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      return fetchToken.mock.calls.length;
    };

    expect(await triesAfter(0)).toBe(1);
    expect(await triesAfter(1_000)).toBe(2);
    expect(await triesAfter(2_000)).toBe(3);
    expect(await triesAfter(4_000 + 8_000 + 16_000 + 32_000)).toBe(7);
    expect(await triesAfter(59_999)).toBe(7);
    expect(await triesAfter(1)).toBe(8);
  });

  it("still fails at once on an error that isn't the network's", async () => {
    const broken = new TypeError("Cannot read properties of undefined (reading 'token')");
    const fetchToken = vi.fn<AuthTokenFetcher>().mockRejectedValue(broken);

    await expect(tokenFetcherHandedToConvex(fetchToken)(forced)).rejects.toBe(broken);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
});
