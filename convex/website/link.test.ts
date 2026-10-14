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

async function linkTo(page: Page, { flags = ["website"], workspace = "T1" }: { flags?: string[]; workspace?: string } = {}) {
  const postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  const t = await testBackendServing(postHog, ...flags.map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return t.query(internal.website.link.websiteLinkOf, { workspace, page });
}

describe("SW11: one function builds every website link", () => {
  test.each<{ page: Page; link: string }>([
    { page: { page: "home" }, link: `${siteUrl}/` },
    { page: { page: "leaderboard", period: "week" }, link: `${siteUrl}/leaderboard` },
    { page: { page: "leaderboard", period: "month" }, link: `${siteUrl}/leaderboard?period=month` },
    { page: { page: "leaderboard", period: "all" }, link: `${siteUrl}/leaderboard?period=all` },
  ])("a listed page links to SITE_URL plus its route: $link", async ({ page, link }) => {
    expect(await linkTo(page)).toBe(link);
  });

  test.each<Page>([{ page: "quests" }, { page: "skillTree" }, { page: "book" }])("the unlisted $page page links to Home", async (page) => {
    expect(await linkTo(page)).toBe(`${siteUrl}/`);
  });

  test("a SITE_URL ending in a slash keeps one slash before the route", async () => {
    vi.stubEnv("SITE_URL", `${siteUrl}/`);

    expect(await linkTo({ page: "leaderboard", period: "month" })).toBe(`${siteUrl}/leaderboard?period=month`);
  });

  test.each([
    { condition: "while the website flag is off", flags: [] },
    { condition: "while SITE_URL is unset", env: { SITE_URL: " " } },
    { condition: "for a workspace that isn't the sign-in workspace", workspace: "T_OTHER" },
  ])("$condition, there is no link", async ({ env = {}, ...closed }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

    expect(await linkTo({ page: "leaderboard", period: "week" }, closed)).toBeNull();
  });
});
