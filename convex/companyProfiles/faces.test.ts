import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom } from "../../testing/fakePostHogCom";
import { FakeSlack, httpStatus, networkFailure, type ScriptedAnswer } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite, type SignInIdentity } from "../../testing/website";
import { api, internal } from "../_generated/api";

const ada = { user: "U_ADA", name: "Ada Lovelace", image: "https://avatars.slack-edge.com/ada.png" };
const adaOnTheTeamPage = { id: 1, firstName: "Ada", lastName: "Lovelace", colour: "lilac", cutout: aCutout("ada") };
const adasFace = { kind: "company-profile", image: "https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/ada.png", colour: "#8567FF" };

let postHogCom: FakePostHogCom;
let t: Backend;

beforeEach(async () => {
  aDeploymentForWorkspace();
  const postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  const slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await switchWebsite(t, postHog, true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}

function syncCompanyProfiles() {
  return t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
}

async function faceOf(identity: SignInIdentity) {
  await aMember(t, identity.user);
  const { asSignedIn } = await aSession(t, identity);
  const profile = await asSignedIn.query(api.website.profile.getMyProfile, {});
  return profile.kind === "member" ? profile.face : profile;
}

describe("WS21 V19 V21: a member's face is their company profile cutout on its colour", () => {
  test("a member whose Slack real name matches exactly one company profile reads its cutout on its colour", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage, { id: 2, firstName: "Grace", lastName: "Hopper", colour: "teal", cutout: aCutout("grace") }] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual(adasFace);
  });

  test("a member matches whatever the case, accents and spacing of either name", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...adaOnTheTeamPage, firstName: "Adá", lastName: " LOVELACE " }] });
    await syncCompanyProfiles();

    expect(await faceOf({ ...ada, name: "ada   Lovélace" })).toEqual(adasFace);
  });

  test("a member signed in without a full name matches by their given and family names", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf({ user: ada.user, givenName: "Ada", familyName: "Lovelace" })).toEqual(adasFace);
  });

  test("a person listed on two teams is one company profile", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage] }, { slug: "growth", profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual(adasFace);
  });

  test("a profile without a colour sits on posthog.com's neutral tan", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...adaOnTheTeamPage, colour: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual({ ...adasFace, colour: "#EEEFE9" });
  });

  test("a profile on a team without a slug is still a face", async () => {
    postHogCom.withTeams({ slug: null, profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual(adasFace);
  });

  test("every page of the team pages is read", async () => {
    postHogCom.pagedBy(1).withTeams({ slug: "analytics", profiles: [] }, { slug: "growth", profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual(adasFace);
  });
});

describe("WS21 V19 V21: without exactly one company profile the face falls back", () => {
  test("two company profiles with the member's name fall back to the Slack picture", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage, { ...adaOnTheTeamPage, id: 2, cutout: aCutout("another-ada") }] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual({ kind: "slack", image: ada.image });
  });

  test("no company profile with the member's name falls back to the Slack picture, then initials", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ id: 2, firstName: "Grace", lastName: "Hopper", colour: "teal", cutout: aCutout("grace") }] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual({ kind: "slack", image: ada.image });
    expect(await faceOf({ user: "U_ADA_TOO", name: "Ada Lovelace" })).toEqual({ kind: "initials", initials: "AL" });
  });

  test("a profile whose cutout isn't a Cloudinary PNG is no face", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...adaOnTheTeamPage, cutout: "https://elsewhere.example/ada.png" }, { ...adaOnTheTeamPage, id: 2, firstName: "Grace", cutout: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual({ kind: "slack", image: ada.image });
  });

  test("a profile gone from posthog.com no longer matches after the next good read", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();
    postHogCom.withTeams({ slug: "analytics", profiles: [{ id: 2, firstName: "Grace", lastName: "Hopper", colour: "teal", cutout: aCutout("grace") }] });
    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual({ kind: "slack", image: ada.image });
  });
});

describe("WS22: a failed posthog.com read keeps the previous profiles", () => {
  const unreadable = {
    "an error status": [httpStatus(503), "unreachable"],
    "a network failure": [networkFailure, "unreachable"],
    "a body that isn't JSON": [() => new Response("<html>maintenance</html>", { status: 200 }), "malformed"],
    "a team without its profiles": [() => Response.json({ data: [{ id: 1, attributes: { slug: "analytics" } }], meta: { pagination: { page: 1, pageCount: 1 } } }), "malformed"],
    "a profile without a last name": [
      () => Response.json({ data: [{ id: 1, attributes: { slug: "analytics", profiles: { data: [{ id: 3, attributes: { firstName: "Grace" } }] } } }], meta: { pagination: { page: 1, pageCount: 1 } } }),
      "malformed",
    ],
    "no pagination": [() => Response.json({ data: [] }), "malformed"],
    "no profiles at all": [() => Response.json({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }), "empty"],
  } satisfies Record<string, [ScriptedAnswer, string]>;

  test.each(Object.entries(unreadable))("a read that answers %s keeps the previous profiles and logs a fixed code", async (_, [answer, reason]) => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.withTeams().answersPage(1, answer);

    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual(adasFace);
    expect(warn).toHaveBeenCalledWith("companyProfiles.read_failed", { reason });
  });

  test("a read that fails on a later page keeps the previous profiles", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [adaOnTheTeamPage] });
    await syncCompanyProfiles();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.pagedBy(1).withTeams({ slug: "growth", profiles: [] }, { slug: "analytics", profiles: [] }).answersPage(2, httpStatus(500));

    await syncCompanyProfiles();

    expect(await faceOf(ada)).toEqual(adasFace);
  });
});
