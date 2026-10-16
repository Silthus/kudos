import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import type { Page } from "./routes";

const siteUrl = "https://kudos-site.test";

beforeEach(() => {
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function linkTo(page: Page) {
  const postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  const t = await testBackendServing(postHog, onForEveryone("website"));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return t.query(internal.website.link.websiteLinkOf, { workspace: "T1", page });
}

describe("SW11: one function builds every website link", () => {
  test.each<{ page: Page; link: string }>([
    { page: { page: "home" }, link: `${siteUrl}/` },
    { page: { page: "leaderboard", period: "week" }, link: `${siteUrl}/leaderboard` },
    { page: { page: "leaderboard", period: "month" }, link: `${siteUrl}/leaderboard?period=month` },
    { page: { page: "leaderboard", period: "all" }, link: `${siteUrl}/leaderboard?period=all` },
    { page: { page: "quests" }, link: `${siteUrl}/quests` },
    { page: { page: "skillTree" }, link: `${siteUrl}/skills` },
    { page: { page: "book" }, link: `${siteUrl}/book` },
    { page: { page: "bookEarned" }, link: `${siteUrl}/book/earned` },
    { page: { page: "bookCollection" }, link: `${siteUrl}/book/collection` },
  ])("a listed page links to SITE_URL plus its route: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each<{ page: Page; link: string }>([
    { page: { page: "skillTree", perk: "spark" }, link: `${siteUrl}/skills?perk=spark` },
    { page: { page: "skillTree", crate: "skillTree" }, link: `${siteUrl}/skills?crate=skillTree` },
    { page: { page: "quests", crate: "quests" }, link: `${siteUrl}/quests?crate=quests` },
    { page: { page: "leaderboard", period: "week", crate: "leaderboard" }, link: `${siteUrl}/leaderboard?crate=leaderboard` },
    { page: { page: "leaderboard", period: "month", crate: "leaderboard" }, link: `${siteUrl}/leaderboard?period=month&crate=leaderboard` },
    { page: { page: "book", crate: "book" }, link: `${siteUrl}/book?crate=book` },
    { page: { page: "home", crate: "journey" }, link: `${siteUrl}/?crate=journey` },
    { page: { page: "quests", crate: { kind: "weekly", week: "2026-10-05", slot: 2 } }, link: `${siteUrl}/quests?crate=weekly%3A2026-10-05%3A2` },
    { page: { page: "bookCollection", crate: { kind: "bought", n: 2 } }, link: `${siteUrl}/book/collection?crate=bought%3A2` },
    { page: { page: "bookCollection", crate: "store" }, link: `${siteUrl}/book/collection?crate=store` },
    { page: { page: "quests", crate: { kind: "group", week: "2026-10-05" } }, link: `${siteUrl}/quests?crate=group%3A2026-10-05` },
  ])("#435: a link to a perk or a ready crate carries its target: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each<{ page: Page; link: string }>([
    { page: { page: "home", panel: "inventory" }, link: `${siteUrl}/?panel=inventory` },
    { page: { page: "settings" }, link: `${siteUrl}/settings` },
    { page: { page: "settings", section: "visibility" }, link: `${siteUrl}/settings?section=visibility` },
    { page: { page: "settings", section: "messages" }, link: `${siteUrl}/settings?section=messages` },
    { page: { page: "settings", section: "group" }, link: `${siteUrl}/settings?section=group` },
  ])("#531: a link to the inventory panel or a settings section carries its target: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each([1.5, 0, -1, Number.NaN, 1e21])("#469: a bought crate whose number is %s, which the router would drop, links to the Collection with no target", async (n) => {
    expect(await linkTo({ page: "bookCollection", crate: { kind: "bought", n } })).toBe(`${siteUrl}/book/collection`);
  });
});
