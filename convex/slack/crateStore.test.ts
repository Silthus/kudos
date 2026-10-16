import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, publishedHomeBlocks, staleButtonOf } from "../../testing/slackInteractions";
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

async function send(body: string, init?: { contentType: string }) {
  await t.fetch(init === undefined ? "/slack/events" : "/slack/interactivity", await signedRequest(body, init));
  await settleInTimeOrder(t);
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
