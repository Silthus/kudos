import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEmails, onForEveryone } from "../../testing/flags";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";

const now = new Date("2026-10-21T10:00:00Z");
const ann = { user: "U_ANN", name: "Ann Quill", email: "ann@example.com" };
const bea = { user: "U_BEA", name: "Bea Marsh", email: "bea@example.com" };

type Person = typeof ann;

let postHog: FakePostHog;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  const slack = new FakeSlack().withMember(ann.user, slackProfileOf(ann)).withMember(bea.user, slackProfileOf(bea));
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await aTeammate(ann);
  await aTeammate(bea);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getAlbum says shareable URLs are on only for a member shareable-urls is on for", { timeout: 60_000 }, () => {
  test("with shareable-urls on, getAlbum answers shareableUrls", async () => {
    await serving(onForEveryone("album"), onForEveryone("shareable-urls"));

    expect(await albumOf(ann)).toHaveProperty("shareableUrls", true);
  });

  test("with shareable-urls off, getAlbum answers as before, without shareableUrls", async () => {
    await serving(onForEveryone("album"));

    expect(await albumOf(ann)).not.toHaveProperty("shareableUrls");
  });

  test("shareable-urls is decided for each member who reads", async () => {
    await serving(onForEveryone("album"), onForEmails("shareable-urls", bea.email));

    expect(await albumOf(ann)).not.toHaveProperty("shareableUrls");
    expect(await albumOf(bea)).toHaveProperty("shareableUrls", true);
  });
});

async function serving(...definitions: FlagDefinition[]) {
  await flagsFromPostHog(t, postHog, onForEveryone("website"), ...definitions);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

async function albumOf(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, person);
  const album = await asSignedIn.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`getAlbum answered ${album.kind}`);
  return album;
}

async function aTeammate(person: Person) {
  await memberChanged(t, "team_join", { id: person.user, ...slackProfileOf(person) });
  await settleInTimeOrder(t);
}

function slackProfileOf({ name, email }: Person) {
  return { profile: { display_name: name, email } };
}
