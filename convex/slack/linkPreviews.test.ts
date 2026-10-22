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
                text: { type: "mrkdwn", text: `*<${url}|Juno Park>*\nLevel 3 · Kettle Works, Lanterns\n🥇 Pillar · 🥉 First Thanks`, verbatim: true },
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
      text: { type: "mrkdwn", text: `*<${url}|Bram Ode>*\nLevel 1`, verbatim: true },
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
            text: { type: "mrkdwn", text: `*<${url}|Kettle Works>*\n3 people`, verbatim: true },
            accessory: { type: "image", image_url: kettleCrest, alt_text: "Kettle Works" },
          },
          { type: "context", elements: [{ type: "mrkdwn", text: "HedgeHug album · team page" }] },
        ],
      },
    });
  });

  test("a team without a crest picture unfolds without one, and a name with a mention or Slack's brackets is escaped and read verbatim, so it neither links nor notifies", async () => {
    const t = await workspace();
    await t.run((ctx) => ctx.db.insert("companyTeams", { team: "angle-brackets", name: "<!here> Ops & @channel", leads: [], people: [9], asOf: 0 }));
    const url = `${site}/book#teams/angle-brackets`;

    await shared(t, [url]);

    expect(cardOf(url)).toEqual({ type: "section", text: { type: "mrkdwn", text: `*<${url}|&lt;!here&gt; Ops &amp; @channel>*\n1 person`, verbatim: true } });
  });

  test("a team with the catalogue's own crest still shows its posthog.com crest picture", async () => {
    const t = await workspace();
    await t.run((ctx) => ctx.db.insert("companyTeams", { team: "people-ops", name: "People & Ops", crestImage: "https://res.cloudinary.com/posthog/people-ops.png", leads: [], people: [4, 5], asOf: 0 }));
    const url = `${site}/book#teams/people-ops`;

    await shared(t, [url]);

    expect(cardOf(url)).toMatchObject({ accessory: { type: "image", image_url: "https://res.cloudinary.com/posthog/people-ops.png", alt_text: "People & Ops" } });
  });

  test("several links in one message unfold together in one call", async () => {
    const t = await workspace();
    const juno = `${site}/book#people/${await memberOf(t, "U_JUNO")}`;
    const team = `${site}/book#teams/lanterns`;

    await shared(t, [juno, team]);

    expect(slack.callsTo("chat.unfurl")).toEqual([{ channel: "C_GENERAL", ts: "1760349800.000100", unfurls: { [juno]: expect.anything(), [team]: expect.anything() } }]);
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

  test("a link still in the composer gets no card, since Slack doesn't say yet where it will be posted", async () => {
    const t = await workspace();

    await shared(t, [`${site}/book#teams/lanterns`], { source: "composer", unfurlId: "C123456.7890.U_BRAM" });

    expect(slack.callsTo("chat.unfurl")).toEqual([]);
  });

  test("a link posted in a channel shared with another organization gets no card", async () => {
    const t = await workspace();

    await shared(t, [`${site}/book#people/${await memberOf(t, "U_JUNO")}`, `${site}/book#teams/lanterns`], { externallyShared: true });

    expect(slack.callsTo("chat.unfurl")).toEqual([]);
  });

  test.each([
    ["an unshared channel", { name: "general" }, 1],
    ["a channel shared with another organization", { name: "general", kind: "shared" as const }, 0],
    ["a channel whose sharing is pending", { name: "general", kind: "pending-shared" as const }, 0],
  ])("where Slack doesn't say whether the channel is shared, the app asks, and a link in %s unfolds only if it isn't", async (_, channel, unfolds) => {
    const t = await workspace();
    slack.withChannel("C_GENERAL", channel);

    await shared(t, [`${site}/book#teams/lanterns`], { externallyShared: "unsaid" });

    expect(slack.callsTo("chat.unfurl")).toHaveLength(unfolds);
  });

  test("where Slack doesn't say whether the channel is shared and won't answer, the link gets no card", async () => {
    const t = await workspace();

    await shared(t, [`${site}/book#teams/lanterns`], { externallyShared: "unsaid" });

    expect(slack.callsTo("conversations.info")).toEqual([{ channel: "C_GENERAL" }]);
    expect(slack.callsTo("chat.unfurl")).toEqual([]);
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
    await shared(t, [`${site}/book#teams/lanterns`], { externallyShared: "unsaid" });

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

const richFlag = "rich-link-cards";
const richFlags = [...everyFlag, "collection", richFlag];
const madeAt = `<!date^${now.getTime() / 1000}^{date_short}|2026-10-21>`;
const asOf = `HedgeHug album · person page · as of ${madeAt}`;
const teamAsOf = `HedgeHug album · team page · as of ${madeAt}`;

describe("LP84: while rich-link-cards is on, a person card shows the level bar, the stats and the rarest hoggies", { timeout: 30_000 }, () => {
  test("a person link unfolds into the level bar, their four strongest stats and their rarest hoggies' pictures, dated", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const [juno, bram] = [await memberOf(t, "U_JUNO"), await memberOf(t, "U_BRAM")];
    await thanked(t, { [juno]: 12, [bram]: 5 });
    await found(t, juno, "asleep", "wizard", "angel");
    await collected(t, juno, bram);
    const url = `${site}/book#people/${juno}`;

    await shared(t, [url]);

    expect(blocksOf(url)).toEqual([
      {
        type: "section",
        text: { type: "mrkdwn", text: `*<${url}|Juno Park>*\nKettle Works, Lanterns\n*Level 3 → 4*  🟧🟧⬜⬜⬜⬜⬜⬜⬜⬜\n🥇 Pillar · 🥉 First Thanks`, verbatim: true },
        accessory: { type: "image", image_url: junoFace, alt_text: "Juno Park" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "🏆 *No. 1* on the all-time leaderboard" },
          { type: "mrkdwn", text: "💛 *12* thoughtful kudos given" },
          { type: "mrkdwn", text: "🦔 *3* of 151 hoggies found" },
          { type: "mrkdwn", text: "📒 *1* person in their album" },
        ],
      },
      {
        type: "context",
        elements: [hoggiePicture("wizard", "Wizard"), hoggiePicture("angel", "Angel"), hoggiePicture("asleep", "Asleep"), { type: "mrkdwn", text: "Rarest find: *Wizard* · 🟧 Legendary" }],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: asOf }] },
    ]);
  });

  test("the rarest hoggies stop at nine pictures, rarest first", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const juno = await memberOf(t, "U_JUNO");
    await found(t, juno, "asleep", "ball", "banana", "beaker", "burger", "card", "cereal", "angel", "evel", "wizard", "rocket");
    const url = `${site}/book#people/${juno}`;

    await shared(t, [url]);

    const pictures = blocksOf(url)[2] as { elements: Array<{ type: string; alt_text?: string }> };
    expect(pictures.elements.filter(({ type }) => type === "image").map(({ alt_text }) => alt_text)).toEqual(["Wizard", "Rocket", "Angel", "Evel", "Asleep", "Ball", "Banana", "Beaker", "Burger"]);
  });

  test("a stat at zero is left out, and a tied place says so", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const [juno, bram] = [await memberOf(t, "U_JUNO"), await memberOf(t, "U_BRAM")];
    await thanked(t, { [juno]: 4, [bram]: 4 });
    const url = `${site}/book#people/${juno}`;

    await shared(t, [url]);

    expect(blocksOf(url)[1]).toEqual({
      type: "section",
      fields: [
        { type: "mrkdwn", text: "🏆 *No. 1, tied* on the all-time leaderboard" },
        { type: "mrkdwn", text: "💛 *4* thoughtful kudos given" },
      ],
    });
  });

  test("a member with nothing to brag about yet gets a friendly line, not a row of zeros", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const url = `${site}/book#people/${await memberOf(t, "U_BRAM")}`;

    await shared(t, [url]);

    expect(blocksOf(url)).toEqual([
      { type: "section", text: { type: "mrkdwn", text: `*<${url}|Bram Ode>*\n*Level 1 → 2*  ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜\n🌱 Just getting started. Their first thanks and finds show up here.`, verbatim: true }, accessory: { type: "image", image_url: bramPicture, alt_text: "Bram Ode" } },
      { type: "context", elements: [{ type: "mrkdwn", text: asOf }] },
    ]);
  });
});

describe("LP85: while rich-link-cards is on, a team card shows who said thanks, its place and its rarest hoggies", { timeout: 30_000 }, () => {
  test("a team link unfolds into the share of its people who said thanks, its all-time place, its thoughtful kudos and its people's rarest hoggies", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const [juno, bram] = [await memberOf(t, "U_JUNO"), await memberOf(t, "U_BRAM")];
    await matched(t, bram, 2);
    await thanked(t, { [juno]: 12, [bram]: 3 });
    await found(t, juno, "asleep", "angel");
    const url = `${site}/book#teams/kettle-works`;

    await shared(t, [url]);

    expect(blocksOf(url)).toEqual([
      {
        type: "section",
        text: { type: "mrkdwn", text: `*<${url}|Kettle Works>*\n3 people\n🟧🟧🟧🟧🟧🟧⬜⬜⬜⬜  *2 of 3* have said thanks`, verbatim: true },
        accessory: { type: "image", image_url: kettleCrest, alt_text: "Kettle Works" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "🏆 *No. 1* on the all-time team leaderboard" },
          { type: "mrkdwn", text: "💛 *15* thoughtful kudos given" },
        ],
      },
      { type: "context", elements: [hoggiePicture("angel", "Angel"), hoggiePicture("asleep", "Asleep"), { type: "mrkdwn", text: "Rarest find: *Angel* · 🟪 Epic" }] },
      { type: "context", elements: [{ type: "mrkdwn", text: teamAsOf }] },
    ]);
  });

  test("a team nobody on it has thanked yet gets a friendly line", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const url = `${site}/book#teams/kettle-works`;

    await shared(t, [url]);

    expect(blocksOf(url)).toEqual([
      {
        type: "section",
        text: { type: "mrkdwn", text: `*<${url}|Kettle Works>*\n3 people\n🌱 No thoughtful kudos yet. The first one puts Kettle Works on the board.`, verbatim: true },
        accessory: { type: "image", image_url: kettleCrest, alt_text: "Kettle Works" },
      },
      { type: "context", elements: [{ type: "mrkdwn", text: teamAsOf }] },
    ]);
  });
});

describe("LP84 LP85: a rich card stays within Convex's limits", { timeout: 120_000 }, () => {
  test("a message linking a big team, its people and their full collections unfolds every card under Convex's transaction limits", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone), transactionLimits: true });
    const people = await teamWithEveryHoggie(t, "big-team", 220);
    const links = [`${site}/book#teams/big-team`, ...people.slice(0, 3).map((person) => `${site}/book#people/${person}`)];

    await shared(t, links);

    expect(Object.keys(slack.callsTo("chat.unfurl")[0]!.unfurls as object)).toEqual(links);
  });
});

describe("LP86: a rich card shows only the leaderboard's facts and the person's own page, the same whoever shares it", { timeout: 30_000 }, () => {
  test("a member off the boards shows no place and no thoughtful kudos, and their team doesn't count them", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const juno = await memberOf(t, "U_JUNO");
    await thanked(t, { [juno]: 12 });
    await t.run((ctx) => ctx.db.insert("leaderboardSettings", { member: juno, visible: false }));
    const [person, team] = [`${site}/book#people/${juno}`, `${site}/book#teams/kettle-works`];

    await shared(t, [person, team]);

    expect(JSON.stringify(blocksOf(person))).not.toMatch(/leaderboard|thoughtful/);
    expect(JSON.stringify(blocksOf(person))).toMatch(/Level 3 → 4/);
    expect(JSON.stringify(blocksOf(team))).not.toMatch(/leaderboard|said thanks/);
    expect(JSON.stringify(blocksOf(team))).toMatch(/No thoughtful kudos yet/);
  });

  test("the card is the same whoever shares it, and names no XP, no kudos received and no hugs", async () => {
    const t = await workspace({ flags: richFlags.map(onForEveryone) });
    const juno = await memberOf(t, "U_JUNO");
    await thanked(t, { [juno]: 12 });
    await found(t, juno, "wizard");
    const url = `${site}/book#people/${juno}`;

    await shared(t, [url], { user: "U_JUNO" });
    const ownShare = JSON.stringify(blocksOf(url));
    slack.calls.length = 0;
    await shared(t, [url], { user: "U_BRAM" });

    expect(JSON.stringify(blocksOf(url))).toBe(ownShare);
    expect(ownShare).not.toMatch(/\bXP\b|received|\bhugs?\b/i);
  });

  test("hoggies stay off a card while collection is off for the person", async () => {
    const t = await workspace({ flags: richFlags.filter((flag) => flag !== "collection").map(onForEveryone) });
    const juno = await memberOf(t, "U_JUNO");
    await found(t, juno, "wizard");
    const url = `${site}/book#people/${juno}`;

    await shared(t, [url]);

    expect(JSON.stringify(blocksOf(url))).not.toMatch(/hoggie|Wizard/i);
    expect(JSON.stringify(blocksOf(url))).toMatch(/Level 3 → 4/);
  });
});

describe("LP88: rich link cards are behind rich-link-cards", { timeout: 30_000 }, () => {
  test("while the flag is off, a person and a team with everything to brag about unfold into today's card, byte for byte", async () => {
    const t = await workspace({ flags: richFlags.filter((flag) => flag !== richFlag).map(onForEveryone) });
    const juno = await memberOf(t, "U_JUNO");
    await thanked(t, { [juno]: 12 });
    await found(t, juno, "wizard");
    const [person, team] = [`${site}/book#people/${juno}`, `${site}/book#teams/kettle-works`];

    await shared(t, [person, team]);

    expect(slack.callsTo("chat.unfurl")[0]!.unfurls).toEqual({
      [person]: {
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `*<${person}|Juno Park>*\nLevel 3 · Kettle Works, Lanterns\n🥇 Pillar · 🥉 First Thanks`, verbatim: true }, accessory: { type: "image", image_url: junoFace, alt_text: "Juno Park" } },
          { type: "context", elements: [{ type: "mrkdwn", text: "HedgeHug album · person page" }] },
        ],
      },
      [team]: {
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `*<${team}|Kettle Works>*\n3 people`, verbatim: true }, accessory: { type: "image", image_url: kettleCrest, alt_text: "Kettle Works" } },
          { type: "context", elements: [{ type: "mrkdwn", text: "HedgeHug album · team page" }] },
        ],
      },
    });
  });

  test("the sandbox-only flag gives production today's card", async () => {
    vi.stubEnv("KUDOS_ENVIRONMENT", "production");
    const t = await workspace({ flags: [...richFlags.filter((flag) => flag !== richFlag).map(onForEveryone), onInTheSandboxOnly(richFlag)] });
    const url = `${site}/book#teams/kettle-works`;

    await shared(t, [url]);

    expect(blocksOf(url)).toHaveLength(2);
    expect(JSON.stringify(blocksOf(url))).not.toMatch(/as of/);
  });

  test("the sandbox-only flag gives the sandbox the rich card", async () => {
    const t = await workspace({ flags: [...richFlags.filter((flag) => flag !== richFlag).map(onForEveryone), onInTheSandboxOnly(richFlag)] });
    const url = `${site}/book#teams/kettle-works`;

    await shared(t, [url]);

    expect(JSON.stringify(blocksOf(url))).toMatch(/as of/);
  });
});

function withPreviews(previews: FlagDefinition) {
  return [...everyFlag.filter((flag) => flag !== previewsFlag).map(onForEveryone), previews];
}

type WorkspaceSetup = { flags?: FlagDefinition[]; transactionLimits?: boolean };

async function workspace({ flags = everyFlag.map(onForEveryone), transactionLimits = false }: WorkspaceSetup = {}) {
  const t = await flagsFromPostHog(testBackend({ transactionLimits }), postHog, ...flags);
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

function blocksOf(url: string): unknown[] {
  const unfurls = slack.callsTo("chat.unfurl")[0]!.unfurls as Record<string, { blocks: unknown[] }>;
  return unfurls[url]!.blocks;
}

function hoggiePicture(hoggie: string, name: string) {
  return { type: "image", image_url: `${site}/share/${hoggie}.png`, alt_text: name };
}

async function thanked(t: Backend, givers: Record<string, number>) {
  await t.run(async (ctx) => {
    for (const [giver, awards] of Object.entries(givers)) await ctx.db.insert("thoughtfulBoardTallies", { workspace: "T1", period: "all", giver: giver as MemberId, awards });
  });
}

async function found(t: Backend, member: MemberId, ...hoggies: string[]) {
  await t.run(async (ctx) => {
    for (const [index, hoggie] of hoggies.entries()) await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: Date.now() - index, firstN: index + 1 });
  });
}

async function matched(t: Backend, member: MemberId, profile: number) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("companyFaces")
      .withIndex("by_member", (q) => q.eq("workspace", "T1").eq("member", member))
      .unique();
    await ctx.db.patch(row!._id, { profile });
  });
}

async function teamWithEveryHoggie(t: Backend, team: string, size: number): Promise<MemberId[]> {
  const { catalogue } = await import("../hoggies/catalogue");
  const profiles = Array.from({ length: size }, (_, index) => 1000 + index);
  const people: MemberId[] = [];
  for (const profile of profiles) {
    people.push(
      await t.run(async (ctx) => {
        const member = await ctx.db.insert("members", { workspace: "T1", user: `U_TEAM${profile}`, kind: "member", name: `Teammate ${profile}` });
        await ctx.db.insert("companyFaces", { workspace: "T1", member, face: null, profile });
        await ctx.db.insert("thoughtfulBoardTallies", { workspace: "T1", period: "all", giver: member, awards: 1 });
        for (const [index, { hoggie }] of catalogue.hoggies.entries()) await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: index, firstN: index + 1 });
        return member;
      }),
    );
  }
  await t.run((ctx) => ctx.db.insert("companyTeams", { team, name: "Big Team", leads: [], people: profiles, asOf: 0 }));
  return people;
}

async function collected(t: Backend, member: MemberId, ...people: MemberId[]) {
  await t.run(async (ctx) => {
    for (const person of people) await ctx.db.insert("albumStickers", { member, person, from: "history", at: Date.now() });
  });
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
