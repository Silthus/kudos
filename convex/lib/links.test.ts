import { expect, test } from "vitest";
import { appLink } from "./links";

const SITE = "https://kudos.example";

test("a link from Slack names the workspace it was sent in", () => {
  expect(appLink(SITE, "T1", "/me")).toBe("https://kudos.example/me?ws=T1");
});

test("the workspace goes before the fragment, so the page still scrolls to it", () => {
  expect(appLink(SITE, "T1", "/store#my-requests")).toBe("https://kudos.example/store?ws=T1#my-requests");
});

test("keeps the page's own query", () => {
  expect(appLink(SITE, "T1", "/admin?tab=store")).toBe("https://kudos.example/admin?tab=store&ws=T1");
});

test("no link at all while the site's address isn't configured", () => {
  expect(appLink("", "T1", "/me")).toBeNull();
});
