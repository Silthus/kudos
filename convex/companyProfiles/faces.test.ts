import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom } from "../../testing/fakePostHogCom";
import { FakeSlack, httpStatus, networkFailure, type ScriptedAnswer } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite, type SignInIdentity } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { countGiven } from "../leaderboard/totals";
import type { MemberId } from "../workspace/directory";
import { companyTeamsOf } from "./teams";

const wren = { user: "U_WREN", name: "Wren Halloway", image: "https://avatars.slack-edge.com/wren.png" };
const wrenOnTheTeamPage = { id: 1, firstName: "Wren", lastName: "Halloway", colour: "lilac", cutout: aCutout("wren") };
const oriel = { id: 2, firstName: "Oriel", lastName: "Pemberton", colour: "teal", cutout: aCutout("oriel") };
const analytics = { slug: "analytics", name: "Analytics", crest: aCutout("analytics_crest"), leads: [1], profiles: [wrenOnTheTeamPage] };
const analyticsKept = { team: "analytics", name: "Analytics", crest: { kind: "image", url: "https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/analytics_crest.png" }, leads: [1], people: [1] };
const wrensFace = { kind: "company-profile", image: "https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/wren.png", colour: "#8567FF", initials: "WH" };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;

beforeEach(async () => {
  aDeploymentForWorkspace();
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z") });
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  const slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await switchWebsite(t, postHog, true);
});

afterEach(() => {
  vi.useRealTimers();
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

function companyTeams() {
  return t.run((ctx) => companyTeamsOf(ctx));
}

async function faceOf(identity: SignInIdentity) {
  await aMember(t, identity.user);
  const { asSignedIn } = await aSession(t, identity);
  return asSignedIn.query(api.website.face.getMyFace, {});
}

async function givesOnTheBoards(member: MemberId) {
  const message = { workspace: "T1", conversation: "C1", message: "1" };
  const group = await t.run(async (ctx) => {
    const group = await ctx.db.insert("userGroups", { workspace: "T1", group: "S_ANTS", handle: "ants", name: "Ants", enabled: true, automatic: false, members: 1, asOf: 0, membersAsOf: 0 });
    await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [group], primary: group });
    await countGiven(ctx, { workspace: "T1", message, giver: member, awards: [{ giver: member, recipient: member, kudos: 1 }], day: "2026-10-13" });
    return group;
  });
  const event = { type: "awardsAttributed" as const, workspace: "T1", message, giver: member, group, kudos: 1, day: "2026-10-13", at: Date.parse("2026-10-13T09:00:00Z"), awards: [] };
  await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event });
}

describe("website reads pass one guard", () => {
  test("getMyFace reads signed out without a session", async () => {
    expect(await t.query(api.website.face.getMyFace, {})).toEqual({ kind: "signed-out" });
  });

  test("getMyFace reads closed while the website flag is off", async () => {
    await aMember(t, wren.user);
    const { asSignedIn } = await aSession(t, wren);
    await switchWebsite(t, postHog, false);

    expect(await asSignedIn.query(api.website.face.getMyFace, {})).toEqual({ kind: "closed" });
  });

  test("getMyFace reads not-a-member for a former member with a live session", async () => {
    await aMember(t, "U_GONE", "not-a-member");
    const { asSignedIn } = await aSession(t, { user: "U_GONE" });

    expect(await asSignedIn.query(api.website.face.getMyFace, {})).toEqual({ kind: "not-a-member" });
  });

  test("getMyFace rejects an argument that names another member", async () => {
    await aMember(t, wren.user);
    const { asSignedIn } = await aSession(t, wren);
    const withAnotherMember = { user: "U_OTHER" } as unknown as Record<string, never>;

    await expect(asSignedIn.query(api.website.face.getMyFace, withAnotherMember)).rejects.toThrow(/user/);
  });
});

describe("WS21 V19 V21: a member's face is their company profile cutout on its colour", () => {
  test("a member whose Slack real name matches exactly one company profile reads its cutout on its colour", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage, oriel] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
  });

  test("getMyProfile and the boards give the sign-in picture, so only getMyFace reads the company profiles", async () => {
    await switchWebsite(t, postHog, true, "everyone-board", "groups");
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage, oriel] });
    await syncCompanyProfiles();
    const member = await aMember(t, wren.user);
    await givesOnTheBoards(member);
    const { asSignedIn } = await aSession(t, wren);
    const signInPicture = { kind: "slack", image: wren.image, initials: "WH" };

    expect(await asSignedIn.query(api.website.face.getMyFace, {})).toEqual(wrensFace);
    expect(await asSignedIn.query(api.website.profile.getMyProfile, {})).toMatchObject({ kind: "member", face: signInPicture });
    expect(await asSignedIn.query(api.website.leaderboard.getLeaderboard, { period: "week" })).toMatchObject({ kind: "board", rows: [{ you: true, face: signInPicture }] });
    expect(await asSignedIn.query(api.website.groupBoards.getGroupBoards, { period: "week" })).toMatchObject({ kind: "boards", myGroup: { rows: [{ you: true, face: signInPicture }] } });
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

  test("a profile whose colour names no posthog.com colour, even an inherited one like constructor, sits on the neutral tan", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...wrenOnTheTeamPage, colour: "constructor" }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ ...wrensFace, colour: "#EEEFE9" });
  });

  test("a member's company profile face carries their initials for when its cutout fails to load", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toMatchObject({ kind: "company-profile", initials: "WH" });
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

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image, initials: "WH" });
  });

  test("no company profile with the member's name falls back to the Slack picture, then initials", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [oriel] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image, initials: "WH" });
    expect(await faceOf({ user: "U_WREN_TOO", name: "Wren Halloway" })).toEqual({ kind: "initials", initials: "WH" });
  });

  test("two people with the member's name fall back even when only one of them has a cutout", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage, { ...wrenOnTheTeamPage, id: 2, cutout: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image, initials: "WH" });
  });

  test("a profile whose cutout isn't a Cloudinary PNG is no face", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [{ ...wrenOnTheTeamPage, cutout: "https://elsewhere.example/wren.png" }, { ...oriel, cutout: null }] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image, initials: "WH" });
  });

  test("a profile gone from posthog.com no longer matches after the next good read", async () => {
    postHogCom.withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] });
    await syncCompanyProfiles();
    postHogCom.withTeams({ slug: "analytics", profiles: [oriel] });
    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual({ kind: "slack", image: wren.image, initials: "WH" });
  });
});

describe("WS22: a failed posthog.com read keeps the previous profiles", () => {
  const unreadable = {
    "an error status": [httpStatus(503), "unreachable"],
    "a network failure": [networkFailure, "unreachable"],
    "a body that isn't JSON": [() => new Response("<html>maintenance</html>", { status: 200 }), "malformed"],
    "a team without its profiles": [() => Response.json({ data: [{ id: 1, attributes: { slug: "analytics", leadProfiles: { data: [] } } }], meta: { pagination: { page: 1, pageCount: 1 } } }), "malformed"],
    "a profile without a last name": [
      () => Response.json({ data: [{ id: 1, attributes: { slug: "analytics", leadProfiles: { data: [] }, profiles: { data: [{ id: 3, attributes: { firstName: "Oriel" } }] } } }], meta: { pagination: { page: 1, pageCount: 1 } } }),
      "malformed",
    ],
    "a team whose name isn't text": [() => Response.json({ data: [{ id: 1, attributes: { slug: "analytics", name: 7, leadProfiles: { data: [] }, profiles: { data: [] } } }], meta: { pagination: { page: 1, pageCount: 1 } } }), "malformed"],
    "a team whose leads aren't profiles": [() => aTeamWithLeads({ data: ["Oriel"] }), "malformed"],
    "a team without its lead profiles": [() => aTeamWithLeads(undefined), "malformed"],
    "a team whose lead profiles hold no list": [() => aTeamWithLeads({ data: null }), "malformed"],
    "no pagination": [() => Response.json({ data: [] }), "malformed"],
    "no profiles at all": [() => Response.json({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }), "empty"],
  } satisfies Record<string, [ScriptedAnswer, string]>;

  test.each(Object.entries(unreadable))("a read that answers %s keeps the previous profiles and teams and logs a fixed code", async (_, [answer, reason]) => {
    postHogCom.withTeams(analytics);
    await syncCompanyProfiles();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.withTeams().answersPage(1, answer);

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
    expect(await companyTeams()).toEqual([analyticsKept]);
    expect(warn).toHaveBeenCalledWith("companyProfiles.read_failed", { reason });
  });

  const inconsistentLaterPages = {
    "declares fewer pages than the first": (asPostHogComWould: () => Response) => withPagination(asPostHogComWould, { page: 2, pageCount: 2 }),
    "answers as the first page again": (asPostHogComWould: () => Response) => withPagination(asPostHogComWould, { page: 1, pageCount: 3 }),
    "answers no teams": () => Response.json({ data: [], meta: { pagination: { page: 2, pageCount: 3 } } }),
  } satisfies Record<string, ScriptedAnswer>;

  test.each(Object.entries(inconsistentLaterPages))("a later page that %s keeps the previous profiles and teams as malformed", async (_, answer) => {
    postHogCom.withTeams(analytics);
    await syncCompanyProfiles();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.pagedBy(1).withTeams({ slug: "growth", profiles: [oriel] }, { slug: "design", profiles: [] }, { slug: "analytics", profiles: [] }).answersPage(2, answer);

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
    expect(await companyTeams()).toEqual([analyticsKept]);
    expect(warn).toHaveBeenCalledWith("companyProfiles.read_failed", { reason: "malformed" });
  });

  test("a first page that answers no teams but declares more pages keeps the previous profiles and teams as malformed", async () => {
    postHogCom.withTeams(analytics);
    await syncCompanyProfiles();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom
      .pagedBy(1)
      .withTeams({ slug: "analytics", profiles: [wrenOnTheTeamPage] }, { slug: "growth", profiles: [oriel] })
      .answersPage(1, () => Response.json({ data: [], meta: { pagination: { page: 1, pageCount: 2 } } }));

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
    expect(await companyTeams()).toEqual([analyticsKept]);
    expect(warn).toHaveBeenCalledWith("companyProfiles.read_failed", { reason: "malformed" });
  });

  test("a read that fails on a later page keeps the previous profiles and teams", async () => {
    postHogCom.withTeams(analytics);
    await syncCompanyProfiles();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    postHogCom.pagedBy(1).withTeams({ slug: "growth", profiles: [] }, { slug: "analytics", profiles: [] }).answersPage(2, httpStatus(500));

    await syncCompanyProfiles();

    expect(await faceOf(wren)).toEqual(wrensFace);
    expect(await companyTeams()).toEqual([analyticsKept]);
  });
});

async function withPagination(asPostHogComWould: () => Response, pagination: { page: number; pageCount: number }) {
  const body = await asPostHogComWould().json();
  return Response.json({ ...body, meta: { pagination } });
}

function aTeamWithLeads(leadProfiles: unknown) {
  const oriel = { id: 3, attributes: { firstName: "Oriel", lastName: "Pemberton", color: "teal", companyRole: null, avatar: { data: null } } };
  return Response.json({ data: [{ id: 1, attributes: { slug: "analytics", name: "Analytics", crest: { data: null }, leadProfiles, profiles: { data: [oriel] } } }], meta: { pagination: { page: 1, pageCount: 1 } } });
}
