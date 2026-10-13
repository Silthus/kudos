import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, flagsKey, postHogHost, projectToken, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { components, internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import { exposed, flag, flagSeamCheck, type Flag } from "./flags";

const now = new Date("2026-10-13T10:00:00Z");

const boardFlag = { key: "everyone-board", subject: "member", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
const layoutFlag = {
  key: "board-layout",
  subject: "workspace",
  safeDefault: "control",
  values: ["control", "compact"],
} as const satisfies Flag<"control" | "compact">;

const everyone = (key: string): FlagDefinition => ({ key, filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
const inTheSandboxOnly = (key: string): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 }] },
});
const variantForEveryone = (key: string, variant: string): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [], rollout_percentage: 100 }], multivariate: { variants: [{ key: variant, rollout_percentage: 100 }] } },
});
const inACohort = (key: string): FlagDefinition => ({
  key,
  filters: { groups: [{ properties: [{ key: "id", type: "cohort", value: 7 }], rollout_percentage: 100 }] },
});

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, () => Promise.reject(new Error("no network in tests"))));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function aMember(t: Backend, user = "U_ALICE") {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

async function definitionsFromPostHog(t: Backend, ...definitions: FlagDefinition[]) {
  postHog.withFlags(...definitions);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
}

function readInMutation<V extends string | boolean>(t: Backend, read: Flag<V>, subject: MemberId | string) {
  return t.run((ctx) => flag(ctx, read, subject));
}

describe("O33: a flag answers its value for the subject", () => {
  test("a flag rolled out to everyone answers on for a member", async () => {
    const t = testBackend();
    const alice = await aMember(t);
    await definitionsFromPostHog(t, everyone("everyone-board"));

    expect(await readInMutation(t, boardFlag, alice)).toBe(true);
  });

  test("a variant flag answers its variant for the workspace", async () => {
    const t = testBackend();
    await definitionsFromPostHog(t, variantForEveryone("board-layout", "compact"));

    expect(await readInMutation(t, layoutFlag, "T1")).toBe("compact");
  });

  test("O34: a flag on in the sandbox only is on in the sandbox and answers its safe default in production", async () => {
    const t = testBackend();
    const alice = await aMember(t);
    await definitionsFromPostHog(t, inTheSandboxOnly("everyone-board"));

    expect(await readInMutation(t, boardFlag, alice)).toBe(true);
    vi.stubEnv("KUDOS_ENVIRONMENT", "production");
    expect(await readInMutation(t, boardFlag, alice)).toBe(false);
  });
});

type CannotBeEvaluated = { condition: string; reads: (t: Backend, alice: MemberId) => Promise<Array<[answer: unknown, safeDefault: unknown]>> };

const cannotBeEvaluated: CannotBeEvaluated[] = [
  {
    condition: "without the flags key, even when PostHog turned the flag on",
    reads: async (t, alice) => {
      await definitionsFromPostHog(t, everyone("everyone-board"), variantForEveryone("board-layout", "compact"));
      vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
      return [
        [await readInMutation(t, boardFlag, alice), false],
        [await readInMutation(t, layoutFlag, "T1"), "control"],
      ];
    },
  },
  {
    condition: "before any definitions are cached",
    reads: async (t, alice) => [[await readInMutation(t, boardFlag, alice), false]],
  },
  {
    condition: "for a flag PostHog doesn't have",
    reads: async (t, alice) => {
      await definitionsFromPostHog(t, everyone("another-flag"));
      return [[await readInMutation(t, boardFlag, alice), false]];
    },
  },
  {
    condition: "for a value the flag doesn't declare",
    reads: async (t, alice) => {
      await definitionsFromPostHog(t, variantForEveryone("board-layout", "purple"), variantForEveryone("everyone-board", "on"));
      return [
        [await readInMutation(t, layoutFlag, "T1"), "control"],
        [await readInMutation(t, boardFlag, alice), false],
      ];
    },
  },
  {
    condition: "O34: for a cohort condition local evaluation can't answer",
    reads: async (t, alice) => {
      await definitionsFromPostHog(t, inACohort("everyone-board"));
      return [[await readInMutation(t, boardFlag, alice), false]];
    },
  },
  {
    condition: "O34: when the environment isn't set, for a flag that targets it",
    reads: async (t, alice) => {
      await definitionsFromPostHog(t, inTheSandboxOnly("everyone-board"));
      vi.stubEnv("KUDOS_ENVIRONMENT", "");
      return [[await readInMutation(t, boardFlag, alice), false]];
    },
  },
  {
    condition: "in a query, for a member who has no analytics ID yet, and the query creates none",
    reads: async (t, alice) => {
      await definitionsFromPostHog(t, everyone(flagSeamCheck.key));
      return [
        [await t.query(internal.analytics.flags.seamCheck, { member: alice }), false],
        [await t.run((ctx) => ctx.db.query("analyticsIds").collect()), []],
      ];
    },
  },
];

describe("O31 O33 O34", () => {
  test("a flag answers its safe default whenever it can't be evaluated", async () => {
    for (const { condition, reads } of cannotBeEvaluated) {
      vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
      vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
      const t = testBackend();
      const alice = await aMember(t);
      for (const [answer, safeDefault] of await reads(t, alice)) expect(answer, condition).toEqual(safeDefault);
    }
  });

  test("in a query, a flag answers for a member once a mutation gave them an analytics ID", async () => {
    const t = testBackend();
    const alice = await aMember(t);
    await definitionsFromPostHog(t, everyone(flagSeamCheck.key));

    await readInMutation(t, flagSeamCheck, alice);

    expect(await t.query(internal.analytics.flags.seamCheck, { member: alice })).toBe(true);
  });
});

describe("O36: exposure", () => {
  test("sends $feature_flag_called once per member, flag and value, under the member's analytics ID", async () => {
    const t = testBackend();
    const alice = await aMember(t);
    const bob = await aMember(t, "U_BOB");

    await t.run((ctx) => exposed(ctx, boardFlag, alice, true));
    await t.run((ctx) => exposed(ctx, boardFlag, alice, true));
    await t.run((ctx) => exposed(ctx, boardFlag, alice, false));
    await t.run((ctx) => exposed(ctx, boardFlag, bob, true));
    await settle(t);

    const exposures = postHog.events().map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties }));
    const analyticsIdOf = (member: MemberId) =>
      t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
    const shared = { environment: "sandbox", workspace_key: expect.any(String), taxonomy_version: 1 };
    expect(exposures).toEqual([
      { event: "$feature_flag_called", distinct_id: await analyticsIdOf(alice), properties: { ...shared, $feature_flag: "everyone-board", $feature_flag_response: true, locally_evaluated: true } },
      { event: "$feature_flag_called", distinct_id: await analyticsIdOf(alice), properties: { ...shared, $feature_flag: "everyone-board", $feature_flag_response: false, locally_evaluated: true } },
      { event: "$feature_flag_called", distinct_id: await analyticsIdOf(bob), properties: { ...shared, $feature_flag: "everyone-board", $feature_flag_response: true, locally_evaluated: true } },
    ]);
  });

  test("a flag is evaluated on the same analytics ID its exposure is sent under", async () => {
    const t = testBackend();
    const alice = await aMember(t);
    await definitionsFromPostHog(t, everyone("everyone-board"));

    await t.run(async (ctx) => exposed(ctx, boardFlag, alice, await flag(ctx, boardFlag, alice)));
    await settle(t);

    const analyticsIds = await t.run((ctx) => ctx.db.query("analyticsIds").collect());
    expect(analyticsIds).toHaveLength(1);
    expect(postHog.events().map((event) => event.distinct_id)).toEqual([analyticsIds[0]?.analyticsId]);
  });

  test("with capture off nothing is sent, and the first exposure after capture comes on still is", async () => {
    const t = testBackend();
    const alice = await aMember(t);
    vi.stubEnv("KUDOS_ENVIRONMENT", "");

    await t.run((ctx) => exposed(ctx, boardFlag, alice, true));
    await settle(t);
    expect(postHog.events()).toEqual([]);

    vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
    await t.run((ctx) => exposed(ctx, boardFlag, alice, true));
    await settle(t);
    expect(postHog.events().map((event) => event.event)).toEqual(["$feature_flag_called"]);
  });
});
