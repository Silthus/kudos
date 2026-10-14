import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend } from "../../testing/slackBackend";
import { unlockPathShownIn } from "./launch";

type Switch = "on" | "off";

beforeEach(() => {
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("unlockPathShownIn: the unlock path shows where xp-levels is on and unlocks apply", () => {
  test.each<[string, boolean, { xpLevels: Switch; unlocks: Switch; launched: boolean }]>([
    ["xp-levels and unlocks on, unlocks launched", true, { xpLevels: "on", unlocks: "on", launched: true }],
    ["xp-levels off", false, { xpLevels: "off", unlocks: "on", launched: true }],
    ["unlocks turned off after its launch", false, { xpLevels: "on", unlocks: "off", launched: true }],
    ["unlocks on but not launched yet", false, { xpLevels: "on", unlocks: "on", launched: false }],
    ["both off and never launched", false, { xpLevels: "off", unlocks: "off", launched: false }],
  ])("with %s, it answers %s", async (_, shown, { xpLevels, unlocks, launched }) => {
    const postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks");
    const t = await flagsLoaded(testBackend());
    if (launched) await unlocksShippedBeforeAnyoneJoined(t);
    await flagsFromPostHog(t, postHog, switched("xp-levels", xpLevels), switched("unlocks", unlocks));

    expect(await t.run((ctx) => unlockPathShownIn(ctx, "T1"))).toBe(shown);
  });
});

function switched(key: string, value: Switch) {
  return (value === "on" ? onForEveryone : offForEveryone)(key);
}
