import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom } from "../../testing/fakePostHogCom";
import { FakeSlack, httpStatus, networkFailure, type ScriptedAnswer } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite, type SignInIdentity } from "../../testing/website";
import { api, internal } from "../_generated/api";

const wren = { user: "U_WREN", name: "Wren Halloway", image: "https://avatars.slack-edge.com/wren.png" };
const wrenOnTheTeamPage = { id: 1, firstName: "Wren", lastName: "Halloway", colour: "lilac", cutout: aCutout("wren") };
const oriel = { id: 2, firstName: "Oriel", lastName: "Pemberton", colour: "teal", cutout: aCutout("oriel") };
const wrensFace = { kind: "company-profile", image: "https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/wren.png", colour: "#8567FF" };

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
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage, oriel] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
  });

  test("a member matches whatever the case, accents and spacing of either name", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...wrenOnTheTeamPage, firstName: "Wrén", lastName: " HALLOWAY " }] });
    await syncCompanyProfiles();

    expect(await faceOf({ ...wren, name: "wren   Hallowày" })).toEqual(wrensFace);
  });

  test("a member signed in without a full name matches by their given and family names", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf({ user: wren.user, givenName: "Wren", familyName: "Halloway" })).toEqual(wrensFace);
  });

  test("a person listed on two teams is one company profile", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] }, { slug: "growth", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
  });

  test("a profile without a colour sits on posthog.com's neutral tan", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...wrenOnTheTeamPage, colour: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ ...wrensFace, colour: "#EEEFE9" });
  });

  test("a profile on a team without a slug is still a face", async () => {
    postHogCom.withTeams({ slug: null, profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
  });

  test("every page of the team pages is read", async () => {
    postHogCom.pagedBy(1).withTeams({ slug: "analytics", profiles: [] }, { slug: "growth", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
  });
});

describe("WS21 V19 V21: without exactly one company profile the face falls back", () => {
  test("two company profiles with the member's name fall back to the Slack picture", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage, { ...wrenOnTheTeamPage, id: 2, cutout: aCutout("another-wren") }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image });
  });

  test("no company profile with the member's name falls back to the Slack picture, then initials", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [oriel] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image });
    expect(await faceOf({ user: "U_WREN_TOO", name: "Wren Halloway" })).toEqual({ kind: "initials", initials: "WH" });
  });

  test("two people with the member's name fall back even when only one of them has a cutout", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage, { ...wrenOnTheTeamPage, id: 2, cutout: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image });
  });

  test("a profile whose cutout isn't a Cloudinary PNG is no face", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...wrenOnTheTeamPage, cutout: "https://elsewhere.example/wren.png" }, { ...oriel, cutout: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image });
  });

  test("a profile gone from posthog.com no longer matches after the next good read", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();
    postHogCom.withTeams({ slug: "analytics", profiles: [oriel] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image });
  });
});

describe("WS22: a failed posthog.com read keeps the previous profiles", () => {
  const unreadable = {
    "an error status": [httpStatus(503), "unreachable"],
    "a network failure": [networkFailure, "unreachable"],
    "a body that isn't JSON": [() => new Response("<html>maintenance</html>", { status: 200 }), "malformed"],
    "a team without its profiles": [() => Response.json({ data: [{ id: 1, attributes: { slug: "analytics" } }], meta: { pagination: { page: 1, pageCount: 1 } } }), "malformed"],
    "a profile without a last name": [
      () => Response.json({ data: [{ id: 1, attributes: { slug: "analytics", profiles: { data: [{ id: 3, attributes: { firstName: "Oriel" } }] } } }], meta: { pagination: { page: 1, pageCount: 1 } } }),
      "malformed",
    ],
    "no pagination": [() => Response.json({ data: [] }), "malformed"],
    "no profiles at all": [() => Response.json({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }), "empty"],
  } satisfies Record<string, [ScriptedAnswer, string]>;

  test.each(Object.entries(unreadable))("a read that answers %s keeps the previous profiles and logs a fixed code", async (_, [answer, reason]) => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.withTeams().answersPage(1, answer);

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
    expect(warn).toHaveBeenCalledWith("companyProfiles.read_failed", { reason });
  });

  const inconsistentLaterPages = {
    "declares fewer pages than the first": (asPostHogComWould: () => Response) => withPagination(asPostHogComWould, { page: 2, pageCount: 2 }),
    "answers as the first page again": (asPostHogComWould: () => Response) => withPagination(asPostHogComWould, { page: 1, pageCount: 3 }),
  } satisfies Record<string, ScriptedAnswer>;

  test.each(Object.entries(inconsistentLaterPages))("a later page that %s keeps the previous profiles as malformed", async (_, answer) => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.pagedBy(1).withTeams({ slug: "growth", profiles: [oriel] }, { slug: "design", profiles: [] }, { slug: "analytics", profiles: [] }).answersPage(2, answer);

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
    expect(warn).toHaveBeenCalledWith("companyProfiles.read_failed", { reason: "malformed" });
  });

  test("a read that fails on a later page keeps the previous profiles", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.pagedBy(1).withTeams({ slug: "growth", profiles: [] }, { slug: "analytics", profiles: [] }).answersPage(2, httpStatus(500));

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
  });
});

async function withPagination(asPostHogComWould: () => Response, pagination: { page: number; pageCount: number }) {
  const body = await asPostHogComWould().json();
  return Response.json({ ...body, meta: { pagination } });
}
