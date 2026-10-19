import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { signInEntry, urlOf, type Page } from "./routes";

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
    { page: { page: "quests" }, link: `${siteUrl}/` },
    { page: { page: "skillTree" }, link: `${siteUrl}/` },
    { page: { page: "book" }, link: `${siteUrl}/` },
    { page: { page: "bookEarned" }, link: `${siteUrl}/book#milestones` },
    { page: { page: "bookCollection" }, link: `${siteUrl}/book#hoggies` },
    { page: { page: "settings" }, link: `${siteUrl}/settings` },
  ])("AL67: $page.page links to SITE_URL plus the album address it lands on: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each<{ page: Page; link: string }>([
    { page: { page: "leaderboard", period: "month" }, link: `${siteUrl}/leaderboard` },
    { page: { page: "leaderboard", period: "all" }, link: `${siteUrl}/leaderboard` },
    { page: { page: "skillTree", perk: "spark" }, link: `${siteUrl}/` },
    { page: { page: "skillTree", crate: "skillTree" }, link: `${siteUrl}/` },
    { page: { page: "quests", quest: 2 }, link: `${siteUrl}/` },
    { page: { page: "quests", crate: "quests" }, link: `${siteUrl}/` },
    { page: { page: "leaderboard", period: "week", crate: "leaderboard" }, link: `${siteUrl}/leaderboard` },
    { page: { page: "leaderboard", period: "month", crate: "leaderboard" }, link: `${siteUrl}/leaderboard` },
    { page: { page: "book", crate: "book" }, link: `${siteUrl}/` },
    { page: { page: "home", crate: "journey" }, link: `${siteUrl}/` },
    { page: { page: "home", panel: "inventory" }, link: `${siteUrl}/` },
    { page: { page: "quests", crate: { kind: "weekly", week: "2026-10-05", slot: 2 } }, link: `${siteUrl}/` },
    { page: { page: "bookCollection", crate: { kind: "bought", n: 2 } }, link: `${siteUrl}/book#hoggies` },
    { page: { page: "bookCollection", crate: "store" }, link: `${siteUrl}/book#hoggies` },
    { page: { page: "bookEarned", crate: "book" }, link: `${siteUrl}/book#milestones` },
    { page: { page: "quests", crate: { kind: "group", week: "2026-10-05" } }, link: `${siteUrl}/` },
  ])("AL67: a link carries no crate, quest, perk, panel or period, which the album has nowhere to land: $page → $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each<{ page: Page; link: string }>([
    { page: { page: "settings", section: "visibility" }, link: `${siteUrl}/settings?section=visibility` },
    { page: { page: "settings", section: "messages" }, link: `${siteUrl}/settings?section=messages` },
    { page: { page: "settings", section: "group" }, link: `${siteUrl}/settings?section=group` },
  ])("#531: a link to a settings section carries its target: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each<{ page: Page; link: string }>([
    { page: { page: "home" }, link: `${siteUrl}/sign-in/` },
    { page: { page: "bookEarned" }, link: `${siteUrl}/sign-in/book#milestones` },
    { page: { page: "settings", section: "messages" }, link: `${siteUrl}/sign-in/settings?section=messages` },
  ])("AL67: on the sign-in entry a link is that entry plus the album address: $link", ({ page, link }) => {
    expect(urlOf(`${siteUrl}${signInEntry}`, page)).toBe(link);
  });
});
