import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, publishedHomeBlocks, publishedViews, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, switchWebsite } from "../../testing/website";
import { catalogue, hoggieNamed, rarityLabel } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import { recordReward } from "../progression/progression";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const juno = "U_JUNO";
const crateStoreFlags = ["xp-levels", "unlocks", "achievements", "coins", "collection", "crate-store"];
const levelSix = 1000;
const hoggiesLine = "section: Hoggies: 0 of 151 · every crate you open drops one.";
const buyLine = "section: A crate drops one hoggie when you open it. [button: Buy a crate · 50 🪙]";
const siteUrl = "https://kudos-site.test";

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withMember(juno);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function junoWith(coins: number) {
  await switchWebsite(t, postHog, false, ...crateStoreFlags.filter((flag) => flag !== "collection"));
  await bookShippedBeforeAnyoneJoined(t);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  const member = await aMember(t, juno);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: levelSix, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  await opens(t, member, "book");
  await opens(t, member, "coins");
  if (coins > 0) await t.run((ctx) => recordReward(ctx, "T1", { member, key: `test:earned:${coins}`, xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
  await switchWebsite(t, postHog, false, ...crateStoreFlags);
  await openHome();
  return member;
}

async function openTheWebsite() {
  vi.stubEnv("SITE_URL", siteUrl);
  await switchWebsite(t, postHog, true, ...crateStoreFlags);
  await openHome();
}

async function send(body: string, init?: { contentType: string }) {
  const response = await t.fetch(init === undefined ? "/slack/events" : "/slack/interactivity", await signedRequest(body, init));
  await settleInTimeOrder(t);
  return response;
}

function openHome() {
  return send(appHomeOpened(juno));
}

function click(action = buttonInHome(slack, juno, "Buy a crate · 50 🪙")) {
  return send(blockActions(juno, action), form);
}

function linesAfter(line: string, count: number) {
  const home = publishedHome(slack, juno);
  return home.slice(home.indexOf(line), home.indexOf(line) + count);
}

function coinsOf(member: MemberId) {
  return t.run((ctx) => balanceOf(ctx, member));
}

async function lastFoundLineFor(member: MemberId, crate: string) {
  const { hoggie, rarity } = await drawOf({ secret: "", member, crate, version: catalogue.version });
  return `section: Hoggies: 1 of 151 · last found: ${hoggieNamed(hoggie)!.name} (${rarityLabel(rarity)})`;
}

describe("CL29: App Home sells a crate for 50 🪙 under the hoggies line", { timeout: 30_000 }, () => {
  test("the hoggies line is followed by Buy a crate · 50 🪙, which asks before it runs and names the next crate", async () => {
    await junoWith(100);

    expect(linesAfter(hoggiesLine, 2)).toEqual([hoggiesLine, buyLine]);
    const button = publishedHomeBlocks(slack, juno).find((block) => block.accessory?.text?.text === "Buy a crate · 50 🪙")!.accessory!;
    expect(button).toMatchObject({
      value: JSON.stringify({ type: "buyCrate", next: 1 }),
      accessibility_label: "Buy a crate for 50 coins",
      confirm: {
        title: { type: "plain_text", text: "Buy a crate for 50 🪙?" },
        text: { type: "plain_text", text: "Coins are never refunded." },
        confirm: { type: "plain_text", text: "Buy" },
        deny: { type: "plain_text", text: "Cancel" },
      },
    });
  });

  test("a double click on Buy, two clicks with two trigger IDs, buys one crate, which waits to open", async () => {
    const member = await junoWith(120);
    const buy = buttonInHome(slack, juno, "Buy a crate · 50 🪙");

    await click(buy);
    await click(buy);

    expect(await coinsOf(member)).toBe(70);
    expect(publishedHome(slack, juno)).toEqual(expect.arrayContaining(["section: *Waiting to open*", "section: A crate you bought [button: Open]"]));
    expect(buttonInHome(slack, juno, "Buy a crate · 50 🪙")).toMatchObject({ value: JSON.stringify({ type: "buyCrate", next: 2 }) });
  });

  test("Open on a bought crate drops its hoggie, which the hoggies line names, and the crate stops waiting", async () => {
    const member = await junoWith(50);
    await click();

    await click(buttonInHome(slack, juno, "Open"));

    const home = publishedHome(slack, juno);
    expect(home).toContain(await lastFoundLineFor(member, "bought:1"));
    expect(home).not.toContain("section: *Waiting to open*");
  });

  test("two bought crates wait on one line, 2 crates you bought, whose Open opens the oldest", async () => {
    const member = await junoWith(100);
    await click();
    await click();

    expect(publishedHome(slack, juno)).toContain("section: 2 crates you bought [button: Open]");
    await click(buttonInHome(slack, juno, "Open"));

    const home = publishedHome(slack, juno);
    expect(home).toContain(await lastFoundLineFor(member, "bought:1"));
    expect(home).toContain("section: A crate you bought [button: Open]");
  });

  test("Buy with 20 🪙 shows You need 30 more 🪙. under the offer, buys nothing, and the line is gone at the next publish", async () => {
    const member = await junoWith(20);

    await click();

    expect(linesAfter(buyLine, 2)).toEqual([buyLine, "context: You need 30 more 🪙."]);
    expect(await coinsOf(member)).toBe(20);
    await openHome();
    expect(publishedHome(slack, juno)).not.toContain("context: You need 30 more 🪙.");
  });

  test("a stale Buy shows nothing new", async () => {
    const member = await junoWith(200);
    await click();
    const home = publishedHome(slack, juno);

    await click(staleButtonOf({ type: "buyCrate", next: 3 }));

    expect(publishedHome(slack, juno)).toEqual(home);
    expect(await coinsOf(member)).toBe(150);
  });

  test("with crate-store off, App Home offers no crate, and a bought crate still waits and opens", async () => {
    const member = await junoWith(50);
    await click();
    await switchWebsite(t, postHog, false, ...crateStoreFlags.filter((flag) => flag !== "crate-store"));
    await openHome();

    expect(publishedHome(slack, juno).join("\n")).not.toContain("Buy a crate");
    await click(buttonInHome(slack, juno, "Open"));
    expect(publishedHome(slack, juno)).toContain(await lastFoundLineFor(member, "bought:1"));
  });
});

describe("each crate's Open in Slack links to the page where it opens while the website is open", { timeout: 30_000 }, () => {
  test("the crates a member bought link their Open to the oldest one on the Collection page, and a click on it opens nothing and publishes App Home no more", async () => {
    const member = await junoWith(100);
    await click();
    await click();
    await openTheWebsite();
    const crates = `section: 2 crates you bought [link: Open ${siteUrl}/book/collection?crate=bought%3A1]`;
    const published = publishedViews(slack, juno).length;

    expect(publishedHome(slack, juno)).toContain(crates);
    expect(accessoryBeside("2 crates you bought")).toEqual({
      type: "button",
      text: { type: "plain_text", text: "Open" },
      url: `${siteUrl}/book/collection?crate=bought%3A1`,
      action_id: "website-link:bought:1",
      accessibility_label: "Open a crate you bought on HedgeHug's Collection page",
    });
    const response = await click(buttonInHome(slack, juno, "Open"));
    expect(response.status).toBe(200);
    expect(publishedViews(slack, juno)).toHaveLength(published);
    await openHome();
    expect(publishedHome(slack, juno)).toEqual(expect.arrayContaining([crates, `${hoggiesLine} [link: View ${siteUrl}/book/collection]`]));
    expect(await coinsOf(member)).toBe(0);
  });

  test("where the Collection page isn't open to the member, the crates they bought keep the Open that opens the oldest in Slack", async () => {
    const member = await junoWith(50);
    await click();
    vi.stubEnv("SITE_URL", siteUrl);
    await switchWebsite(t, postHog, true, ...crateStoreFlags.filter((flag) => flag !== "achievements"));
    await openHome();

    expect(publishedHome(slack, juno)).toContain("section: A crate you bought [button: Open]");
    await click(buttonInHome(slack, juno, "Open"));
    expect(publishedHome(slack, juno)).not.toContain("section: A crate you bought [button: Open]");
    expect(await t.run((ctx) => ctx.db.query("drops").collect())).toMatchObject([{ member, crate: "bought:1" }]);
  });
});

describe("the crate store's Buy in Slack links to the Collection page while the website is open", { timeout: 30_000 }, () => {
  test("Buy a crate · 50 🪙 links to the crate store on the Collection page with no confirmation, and a click on it buys nothing and publishes App Home no more", async () => {
    const member = await junoWith(100);
    await openTheWebsite();
    const published = publishedViews(slack, juno).length;

    expect(linesAfter(`${hoggiesLine} [link: View ${siteUrl}/book/collection]`, 2)).toEqual([
      `${hoggiesLine} [link: View ${siteUrl}/book/collection]`,
      `section: A crate drops one hoggie when you open it. [link: Buy a crate · 50 🪙 ${siteUrl}/book/collection?crate=store]`,
    ]);
    expect(accessoryBeside("A crate drops one hoggie")).toEqual({
      type: "button",
      text: { type: "plain_text", text: "Buy a crate · 50 🪙" },
      url: `${siteUrl}/book/collection?crate=store`,
      action_id: "website-link:crate-store",
      accessibility_label: "Buy a crate for 50 coins on HedgeHug's Collection page",
    });
    const response = await click();
    expect(response.status).toBe(200);
    expect(publishedViews(slack, juno)).toHaveLength(published);
    await openHome();
    expect(publishedHome(slack, juno).join("\n")).not.toContain("you bought");
    expect(await coinsOf(member)).toBe(100);
  });
});

function accessoryBeside(text: string) {
  return publishedHomeBlocks(slack, juno).find((block) => block.text?.text.startsWith(text))?.accessory;
}
