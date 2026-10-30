import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const mondayPathFlags = ["xp-levels", "monday-quest"];

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function onTheMondayPath() {
  return switchWebsite(t, postHog, true, ...mondayPathFlags);
}

async function signedIn(person = juno) {
  await aMember(t, person.user);
  const { asSignedIn } = await aSession(t, person, { endsIn: 30 * 24 * 60 * 60 * 1000 });
  return { asSignedIn };
}

describe("website reads pass one guard", () => {
  test("getQuests reads closed while the website flag is off, even on the Monday path", async () => {
    await onTheMondayPath();
    const { asSignedIn } = await signedIn();
    await switchWebsite(t, postHog, false, ...mondayPathFlags);

    expect(await asSignedIn.query(api.website.quests.getQuests, {})).toEqual({ kind: "closed" });
  });

  test("getQuests reads signed out without a session", async () => {
    await onTheMondayPath();

    expect(await t.query(api.website.quests.getQuests, {})).toEqual({ kind: "signed-out" });
  });

  test("getQuests reads not-a-member for a former member with a live session", async () => {
    await onTheMondayPath();
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await asSignedIn.query(api.website.quests.getQuests, {})).toEqual({ kind: "not-a-member" });
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await onTheMondayPath();
    const { asSignedIn } = await signedIn();
    const withAnotherMember = { user: rowan.user } as unknown as Record<string, never>;

    await expect(asSignedIn.query(api.website.quests.getQuests, withAnotherMember)).rejects.toThrow(/user/);
  });
});
