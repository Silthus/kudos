import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";

const alice = { user: "U_ALICE", name: "Alice Marchetti" };

let postHog: FakePostHog;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z") });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack().withMember(alice.user, { real_name: alice.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => slack.fetch(input, init)));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 1_000, hugBudget: 50 }));
  await aMember(t, alice.user);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function albumOfAlice() {
  const { asSignedIn } = await aSignedInSession(t, alice);
  return asSignedIn.query(api.website.album.getAlbum, {});
}

describe("HH83 HH89: getAlbum tells the Book whether book-next is on for the member", { timeout: 60_000 }, () => {
  test("says bookNext while book-next is on", async () => {
    await switchWebsite(t, postHog, true, "album", "book-next");

    expect(await albumOfAlice()).toMatchObject({ kind: "album", bookNext: true });
  });

  test("leaves bookNext out while book-next is off", async () => {
    await switchWebsite(t, postHog, true, "album");

    const album = await albumOfAlice();
    expect(album).toMatchObject({ kind: "album" });
    expect(album).not.toHaveProperty("bookNext");
  });
});
