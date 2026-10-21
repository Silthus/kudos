import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEveryone, onInTheSandboxOnly, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { linkSharedEvent, type LinkSharedOptions } from "../../testing/slackMessages";
import type { LadderId, TierId } from "../achievements/ladders";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-21T10:00:00Z");
const site = "https://hedgehug.example";
const previewsFlag = "link-previews";
const everyFlag = ["xp-levels", "unlocks", "achievements", previewsFlag];
const levelThreeXp = 150;
const junoFace = "https://res.cloudinary.com/posthog/juno.png";
const bramPicture = "https://avatars.slack-edge.com/bram.png";
const kettleCrest = "https://res.cloudinary.com/posthog/kettle-works.png";

const people = {
  U_JUNO: { profile: { display_name: "Juno Park" } },
  U_BRAM: { profile: { display_name: "Bram Ode", image_192: bramPicture } },
  U_BOT: { is_bot: true },
};

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", `${site}/`);
  slack = new FakeSlack();
  for (const [user, options] of Object.entries(people)) slack.withMember(user, options);
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LP78 LP79: a person or team link pasted into Slack unfolds into its card", { timeout: 30_000 }, () => {
  test("a person link unfolds into their face, name, teams, level and best medals, linked to the page", async () => {
    const t = await workspace();
    const juno = await memberOf(t, "U_JUNO");
    const url = `${site}/book#people/${juno}`;

    await shared(t, [url], { user: "U_BRAM" });

    expect(slack.callsTo("chat.unfurl")).toEqual([
      {
        channel: "C_GENERAL",
        ts: "1760349800.000100",
        unfurls: {
          [url]: {
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: `*<${url}|Juno Park>*\nLevel 3 · Kettle Works, Lanterns\n🥇 Pillar · 🥉 First Thanks` },
                accessory: { type: "image", image_url: junoFace, alt_text: "Juno Park" },
              },
              { type: "context", elements: [{ type: "mrkdwn", text: "HedgeHug album · person page" }] },
            ],
          },
        },
      },
    ]);
  });

  test("anyone's link unfolds, the sharer's own included, and a person without a company face shows their Slack picture", async () => {
    const t = await workspace();
    const bram = await memberOf(t, "U_BRAM");
    const url = `${site}/book#people/${bram}`;

    await shared(t, [url], { user: "U_BRAM" });

    expect(cardOf(url)).toEqual({
      type: "section",
      text: { type: "mrkdwn", text: `*<${url}|Bram Ode>*\nLevel 1` },
      accessory: { type: "image", image_url: bramPicture, alt_text: "Bram Ode" },
    });
  });

  test("a team link unfolds into its crest, name and size", async () => {
    const t = await workspace();
    const url = `${site}/book#teams/kettle-works`;

    await shared(t, [url]);

    expect(slack.callsTo("chat.unfurl")[0]!.unfurls).toEqual({
      [url]: {
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*<${url}|Kettle Works>*\n3 people` },
            accessory: { type: "image", image_url: kettleCrest, alt_text: "Kettle Works" },
          },
          { type: "context", elements: [{ type: "mrkdwn", text: "HedgeHug album · team page" }] },
        ],
      },
    });
  });

  test("a team without a crest picture and a name Slack would read as markup unfold as plain text", async () => {
    const t = await workspace();
    await t.run((ctx) => ctx.db.insert("companyTeams", { team: "angle-brackets", name: "<Ops & *Co*>", leads: [], people: [9], asOf: 0 }));
    const url = `${site}/book#teams/angle-brackets`;

    await shared(t, [url]);

    expect(cardOf(url)).toEqual({ type: "section", text: { type: "mrkdwn", text: `*<${url}|&lt;Ops &amp; *Co*&gt;>*\n1 person` } });
  });

  test("several links in one message unfold together in one call, and a link the composer is still drafting unfolds by its unfurl ID", async () => {
    const t = await workspace();
    const juno = `${site}/book#people/${await memberOf(t, "U_JUNO")}`;
    const team = `${site}/book#teams/lanterns`;

    await shared(t, [juno, team], { source: "composer", unfurlId: "C123456.7890.U_BRAM" });

    expect(slack.callsTo("chat.unfurl")).toEqual([{ unfurl_id: "C123456.7890.U_BRAM", source: "composer", unfurls: { [juno]: expect.anything(), [team]: expect.anything() } }]);
  });

  test("Slack holding the unfold back for a while gets it again once the wait is over", async () => {
    const t = await workspace();
    slack.answering("chat.unfurl", rateLimitedFor(20));

    await shared(t, [`${site}/book#teams/lanterns`]);

    expect(slack.callsTo("chat.unfurl")).toHaveLength(2);
  });

  test("Slack refusing the unfold is logged by its code and not retried", async () => {
    const t = await workspace();
    slack.answering("chat.unfurl", slackError("missing_scope"));

    await shared(t, [`${site}/book#teams/lanterns`]);

    expect(slack.callsTo("chat.unfurl")).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith("link previews: chat.unfurl failed: missing_scope");
  });

  test("Slack delivering the same event twice unfolds it once", async () => {
    const t = await workspace();
    const url = `${site}/book#teams/lanterns`;

    await shared(t, [url], { eventId: "Ev_SAME" });
    await shared(t, [url], { eventId: "Ev_SAME" });

    expect(slack.callsTo("chat.unfurl")).toHaveLength(1);
  });
});

describe("LP80: only a HedgeHug person or team page unfolds", { timeout: 30_000 }, () => {
  test.each([
    ["another site", "https://elsewhere.example/book#teams/lanterns"],
    ["a page that isn't a person or a team", `${site}/book#hoggies`],
    ["the leaderboard", `${site}/leaderboard`],
    ["a team nobody has", `${site}/book#teams/nobody`],
    ["a person ID that isn't one", `${site}/book#people/not-an-id`],
  ])("%s gets no card", async (_, url) => {
    const t = await workspace();

    await shared(t, [url]);

    expect(slack.callsTo("chat.unfurl")).toEqual([]);
  });

  test("a bot's page and a person of another workspace get no card, and a message mixing them with a team link unfolds only the team", async () => {
    const t = await workspace();
    await memberChanged(t, "team_join", { id: "U_BOT", is_bot: true });
    await settle(t);
    const bot = `${site}/book#people/${await memberOf(t, "U_BOT")}`;
    const outsider = `${site}/book#people/${await outsiderOf(t)}`;
    const team = `${site}/book#teams/lanterns`;

    await shared(t, [bot, outsider, team]);

    expect(Object.keys(slack.callsTo("chat.unfurl")[0]!.unfurls as object)).toEqual([team]);
  });

  test("a link shared in another workspace gets no card", async () => {
    const t = await workspace();

    await shared(t, [`${site}/book#teams/lanterns`], { team: "T_OTHER" });

    expect(slack.callsTo("chat.unfurl")).toEqual([]);
  });
});

describe("LP81: a card shows only what the page shows every member", { timeout: 30_000 }, () => {
  test("a card names no counts between the sharer and the person, no XP and no kudos totals, whoever shares it", async () => {
    const t = await workspace();
    const url = `${site}/book#people/${await memberOf(t, "U_JUNO")}`;

    await shared(t, [url], { user: "U_JUNO" });
    const ownShare = JSON.stringify(slack.callsTo("chat.unfurl")[0]!.unfurls);
    slack.calls.length = 0;
    await shared(t, [url], { user: "U_BRAM" });

    expect(JSON.stringify(slack.callsTo("chat.unfurl")[0]!.unfurls)).toBe(ownShare);
    expect(ownShare).not.toMatch(/\b(XP|kudos|hugs?)\b/i);
  });
});

describe("LP82: link previews are behind link-previews", { timeout: 30_000 }, () => {
  test("while the flag is off for the sharer, a person or team link gets no card and the app makes no Slack call", async () => {
    const t = await workspace({ flags: withPreviews(offForEveryone(previewsFlag)) });
    const callsBefore = slack.calls.length;

    await shared(t, [`${site}/book#people/${await memberOf(t, "U_JUNO")}`, `${site}/book#teams/lanterns`]);

    expect(slack.calls.slice(callsBefore)).toEqual([]);
  });

  test("the sandbox-only flag unfolds in the sandbox", async () => {
    const t = await workspace({ flags: withPreviews(onInTheSandboxOnly(previewsFlag)) });

    await shared(t, [`${site}/book#teams/lanterns`]);

    expect(slack.callsTo("chat.unfurl")).toHaveLength(1);
  });

  test("the sandbox-only flag unfolds nothing in production", async () => {
    vi.stubEnv("KUDOS_ENVIRONMENT", "production");
    const t = await workspace({ flags: withPreviews(onInTheSandboxOnly(previewsFlag)) });

    await shared(t, [`${site}/book#teams/lanterns`]);

    expect(slack.callsTo("chat.unfurl")).toEqual([]);
  });

  test("a sharer the directory doesn't know yet follows the workspace decision", async () => {
    const t = await workspace();

    await shared(t, [`${site}/book#teams/lanterns`], { user: "U_STRANGER" });

    expect(slack.callsTo("chat.unfurl")).toHaveLength(1);
  });
});

function withPreviews(previews: FlagDefinition) {
  return [...everyFlag.filter((flag) => flag !== previewsFlag).map(onForEveryone), previews];
}

type WorkspaceSetup = { flags?: FlagDefinition[] };

async function workspace({ flags = everyFlag.map(onForEveryone) }: WorkspaceSetup = {}) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  await bookShippedBeforeAnyoneJoined(t);
  for (const user of ["U_JUNO", "U_BRAM"] as const) {
    await memberChanged(t, "team_join", { id: user, ...people[user] });
    await settle(t);
  }
  const [juno, bram] = [await memberOf(t, "U_JUNO"), await memberOf(t, "U_BRAM")];
  await t.run(async (ctx) => {
    await ctx.db.insert("companyTeams", { team: "kettle-works", name: "Kettle Works", crestImage: kettleCrest, leads: [], people: [1, 2, 3], asOf: 0 });
    await ctx.db.insert("companyTeams", { team: "lanterns", name: "Lanterns", crestImage: "https://res.cloudinary.com/posthog/lanterns.png", leads: [], people: [1], asOf: 0 });
    for (const member of [juno, bram]) {
      const stored = await ctx.db
        .query("companyFaces")
        .withIndex("by_member", (q) => q.eq("workspace", "T1").eq("member", member))
        .collect();
      for (const row of stored) await ctx.db.delete(row._id);
    }
    await ctx.db.insert("companyFaces", { workspace: "T1", member: juno, face: { image: junoFace, colour: "#f4c430" }, profile: 1 });
    await ctx.db.insert("companyFaces", { workspace: "T1", member: bram, face: null });
    await ctx.db.insert("memberProgress", { member: juno, xp: levelThreeXp, pointsSpent: 0 });
  });
  await earned(t, juno, "generosity", "bronze");
  await earned(t, juno, "dependability", "bronze", "silver", "gold");
  slack.calls.length = 0;
  return t;
}

async function shared(t: Backend, urls: string[], options: LinkSharedOptions = {}) {
  const response = await t.fetch("/slack/events", await signedRequest(linkSharedEvent(urls, { user: "U_BRAM", ...options })));
  expect(response.status).toBe(200);
  await settle(t);
}

function cardOf(url: string) {
  const unfurls = slack.callsTo("chat.unfurl")[0]!.unfurls as Record<string, { blocks: unknown[] }>;
  return unfurls[url]!.blocks[0];
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

function outsiderOf(t: Backend): Promise<MemberId> {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T_OTHER", user: "U_OUT", kind: "member", name: "Outsider" }));
}

async function earned(t: Backend, member: MemberId, ladder: LadderId, ...tiers: TierId[]) {
  await t.run(async (ctx) => {
    for (const tier of tiers) {
      const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: `${ladder}-${tier}`, giver: member, recipient: member, kudos: 1, day: "2026-10-20", at: Date.now() });
      await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: Date.now(), award, catalogueVersion: "1", rewards: [] });
    }
  });
}
