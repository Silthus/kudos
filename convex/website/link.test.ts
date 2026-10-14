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
  ])("a listed page links to SITE_URL plus its route: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });
});
