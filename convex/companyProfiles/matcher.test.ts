import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPageProfile } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";
import { companyProfilesIn } from "./matcher";

const now = new Date("2026-10-16T10:00:00Z");
const minute = 60 * 1000;
const teamPages = "team-pages";

const wrenProfile = { id: 1, firstName: "Wren", lastName: "Halloway", colour: "lilac", cutout: aCutout("wren"), role: "Product Engineer" };
const orielProfile = { id: 2, firstName: "Oriel", lastName: "Pemberton", colour: "teal", cutout: aCutout("oriel") };
const samanthaProfile = { id: 3, firstName: "Samantha", lastName: "Okafor", colour: "orange", cutout: aCutout("samantha"), role: "  Team Lead  " };
const tamsinProfile = { id: 4, firstName: "Tamsin", lastName: "Vale", colour: null, cutout: null };

const cutoutOf = (file: string) => `https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/${file}.png`;

const wrenChoice = { profile: 1, name: "Wren Halloway", role: "Product Engineer", teams: ["Analytics"], face: { image: cutoutOf("wren"), colour: "#8567FF" } };
const orielChoice = { profile: 2, name: "Oriel Pemberton", role: null, teams: ["Analytics", "Growth"], face: { image: cutoutOf("oriel"), colour: "#29DBBB" } };
const samanthaChoice = { profile: 3, name: "Samantha Okafor", role: "Team Lead", teams: ["Growth"], face: { image: cutoutOf("samantha"), colour: "#EB9D2A" } };
const tamsinChoice = { profile: 4, name: "Tamsin Vale", role: null, teams: ["Analytics"], face: null };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  const slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await onPostHogCom(wrenProfile, orielProfile, samanthaProfile, tamsinProfile);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}

async function onPostHogCom(...people: TeamPageProfile[]) {
  const onGrowth = ({ id }: TeamPageProfile) => id === 2 || id === 3;
  const onAnalytics = ({ id }: TeamPageProfile) => id !== 3;
  postHogCom.withTeams({ slug: "analytics", name: "Analytics", profiles: people.filter(onAnalytics) }, { slug: "growth", name: "Growth", profiles: people.filter(onGrowth) });
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
}

function teamPagesOn() {
  return switchWebsite(t, postHog, true, teamPages);
}

function teamPagesOff() {
  return switchWebsite(t, postHog, true);
}

async function aTeammate(user: string, name: string, { admin = false } = {}) {
  const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: 0, name, realName: name, admin }));
  const { asSignedIn } = await aSignedInSession(t, { user, name });
  const caller = asSignedIn;
  return {
    member,
    user,
    settings: () => caller.query(api.website.settings.getSettings, {}),
    sections: async () => (await t.query(internal.website.link.frontDoorLinksOf, { workspace: "T1", user }))?.sections,
    linkTeammate: (key: string, profile: number | "none" | null) => caller.mutation(api.website.commands.linkCompanyProfile, { member: key, profile }),
    face: async () => {
      const profile = await caller.query(api.website.profile.getMyProfile, {});
      return profile.kind === "member" ? profile.face : profile;
    },
    link: (profile: number | null) => caller.mutation(api.website.commands.linkMyCompanyProfile, { profile }),
    leave: () => t.run((ctx) => ctx.db.patch(member, { kind: "not-a-member" })),
    rejoin: () => t.run((ctx) => ctx.db.patch(member, { kind: "member" })),
  };
}

async function companyProfileOf(teammate: { settings: () => Promise<unknown> }) {
  const settings = (await teammate.settings()) as { companyProfile?: { mine: { profile: number } | null; by: string | null } };
  return { profile: settings.companyProfile?.mine?.profile ?? null, by: settings.companyProfile?.by ?? null };
}

async function matches() {
  return t.run(async (ctx) => {
    const { matches } = await companyProfilesIn(ctx, "T1");
    return [...matches.entries()].map(([member, { profile, by }]) => ({ member, profile: profile?.profile ?? null, by }));
  });
}

function anAdminLink(member: MemberId, profile: number | null, setBy: MemberId) {
  return t.run((ctx) => ctx.db.insert("companyProfileLinks", { workspace: "T1", member, profile, by: "admin", setBy, at: Date.now() }));
}

function anOwnLink(member: MemberId, profile: number) {
  return t.run((ctx) => ctx.db.insert("companyProfileLinks", { workspace: "T1", member, profile, by: "self", setBy: member, at: Date.now() }));
}

function links() {
  return t.run((ctx) => ctx.db.query("companyProfileLinks").collect());
}

function teamPagesExposures() {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === teamPages).map(({ member, value }) => ({ member, value })));
}

function later() {
  vi.setSystemTime(Date.now() + minute);
}

describe("CV17: a profile is matched to at most one member, links first", { timeout: 60_000 }, () => {
  test("a member and a profile that are each the only one of their name match by name", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wrén  HALLOWAY");

    expect(await companyProfileOf(wren)).toEqual({ profile: 1, by: "name" });
  });

  test("two members of one name match neither of them to the profile of that name", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const otherWren = await aTeammate("U_WREN_TOO", "Wren Halloway");

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
    expect(await companyProfileOf(otherWren)).toEqual({ profile: null, by: null });
  });

  test("two profiles of one name match neither of them to the member of that name", async () => {
    await onPostHogCom(wrenProfile, { ...wrenProfile, id: 5, cutout: aCutout("another-wren") }, orielProfile);
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
  });

  test("a self link matches an unmatched member", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await sam.link(3)).toEqual({ kind: "linked" });

    expect(await companyProfileOf(sam)).toEqual({ profile: 3, by: "self" });
  });

  test("an admin link beats a self link and a name match", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(2);
    const oriel = await aTeammate("U_ORIEL", "Oriel Pemberton");
    const admin = await aTeammate("U_ADMIN", "Ada Admin");
    await anAdminLink(admin.member, 2, admin.member);

    expect(await companyProfileOf(admin)).toEqual({ profile: 2, by: "admin" });
    expect(await companyProfileOf(sam)).toEqual({ profile: null, by: null });
    expect(await companyProfileOf(oriel)).toEqual({ profile: null, by: null });
    expect(await matches()).toEqual([{ member: admin.member, profile: 2, by: "admin" }]);
  });

  test("a name match never takes a profile an admin link gives to another member", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const oriel = await aTeammate("U_ORIEL", "Oriel Pemberton");
    await anAdminLink(oriel.member, 1, oriel.member);

    expect(await companyProfileOf(oriel)).toEqual({ profile: 1, by: "admin" });
    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
  });

  test("an admin link to no profile unmatches a member the name match would match", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    await anAdminLink(wren.member, null, wren.member);

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: "admin" });
    expect(await matches()).toEqual([{ member: wren.member, profile: null, by: "admin" }]);
  });

  test("a name match never takes a profile another member's self link holds", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(1);
    const wren = await aTeammate("U_WREN", "Wren Halloway");

    expect(await companyProfileOf(sam)).toEqual({ profile: 1, by: "self" });
    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
  });

  test("where two self links name one profile, the earlier holds it and the later member is unmatched", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    const sammy = await aTeammate("U_SAMMY", "Sammy Okafor");
    await sam.link(3);
    await sam.leave();
    later();
    expect(await sammy.link(3)).toEqual({ kind: "linked" });
    await sam.rejoin();

    expect(await companyProfileOf(sam)).toEqual({ profile: 3, by: "self" });
    expect(await companyProfileOf(sammy)).toEqual({ profile: null, by: null });
    expect(await matches()).toEqual([{ member: sam.member, profile: 3, by: "self" }]);
  });

  test("a returning member's old self link doesn't take a profile an admin link now gives to someone else", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    const sammy = await aTeammate("U_SAMMY", "Sammy Okafor");
    await sam.link(3);
    await sam.leave();
    later();
    await anAdminLink(sammy.member, 3, sammy.member);
    await sam.rejoin();

    expect(await companyProfileOf(sammy)).toEqual({ profile: 3, by: "admin" });
    expect(await companyProfileOf(sam)).toEqual({ profile: null, by: null });
  });

  test("the links of a member who left hold nothing while they are away", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(1);
    await sam.leave();
    const wren = await aTeammate("U_WREN", "Wren Halloway");

    expect(await companyProfileOf(wren)).toEqual({ profile: 1, by: "name" });
    expect(await matches()).toEqual([{ member: wren.member, profile: 1, by: "name" }]);
  });

  test("a self link to a profile gone from posthog.com holds nothing until the profile returns", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    await onPostHogCom(wrenProfile, orielProfile, tamsinProfile);

    expect(await companyProfileOf(sam)).toEqual({ profile: null, by: null });

    await onPostHogCom(wrenProfile, orielProfile, samanthaProfile, tamsinProfile);

    expect(await companyProfileOf(sam)).toEqual({ profile: 3, by: "self" });
  });
  test("a later own link that an earlier one holds leaves its member unmatched, even where their name would match", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    later();
    await anOwnLink(wren.member, 3);

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
    expect(await matches()).toEqual([{ member: sam.member, profile: 3, by: "self" }]);
  });

  test("an own link to a profile gone from posthog.com leaves its member unmatched, even where their name would match", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    await anOwnLink(wren.member, 3);
    await onPostHogCom(wrenProfile, orielProfile, tamsinProfile);

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
  });

  test("a member's admin link beats their own link, to another profile or to none", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    await anAdminLink(sam.member, 4, sam.member);

    expect(await matches()).toEqual([{ member: sam.member, profile: 4, by: "admin" }]);

    await t.run(async (ctx) => {
      for (const link of await ctx.db.query("companyProfileLinks").collect()) if (link.by === "admin") await ctx.db.patch(link._id, { profile: null });
    });

    expect(await matches()).toEqual([{ member: sam.member, profile: null, by: "admin" }]);
  });

  test("an admin link to a profile gone from posthog.com leaves its member unmatched by the admin's decision", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    await anAdminLink(wren.member, 3, wren.member);
    await onPostHogCom(wrenProfile, orielProfile, tamsinProfile);

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: "admin" });
  });
});

describe("CV19: This is me on posthog.com", () => {
  test("while team-pages is on, Settings offers every profile no other member holds, by name, with its role, teams and face", async () => {
    await teamPagesOn();
    await aTeammate("U_ORIEL", "Oriel Pemberton");
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await sam.settings()).toEqual({
      kind: "settings",
      board: null,
      messages: null,
      group: null,
      companyProfile: { mine: null, by: null, choices: [samanthaChoice, tamsinChoice, wrenChoice] },
    });
  });

  test("a matched member's Settings show their own profile, still among the choices", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");

    expect(await wren.settings()).toMatchObject({ companyProfile: { mine: wrenChoice, by: "name", choices: [orielChoice, samanthaChoice, tamsinChoice, wrenChoice] } });
  });

  test("a member changes their self link, and clearing it leaves them unmatched", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(1);
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });

    expect(await sam.link(4)).toEqual({ kind: "linked" });
    expect(await companyProfileOf(sam)).toEqual({ profile: 4, by: "self" });
    expect(await companyProfileOf(wren)).toEqual({ profile: 1, by: "name" });

    expect(await sam.link(null)).toEqual({ kind: "linked" });
    expect(await companyProfileOf(sam)).toEqual({ profile: null, by: null });
    expect(await links()).toEqual([]);
  });

  test("clearing a self link returns a member to their own name match", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Samantha Okafor");
    await anOwnLink(sam.member, 4);
    expect(await companyProfileOf(sam)).toEqual({ profile: 4, by: "self" });

    expect(await sam.link(null)).toEqual({ kind: "linked" });

    expect(await companyProfileOf(sam)).toEqual({ profile: 3, by: "name" });
  });

  test("a member the name match already matches is refused as matched, and nothing is written", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");

    expect(await wren.link(4)).toEqual({ kind: "refused", reason: "matched" });
    expect(await wren.link(null)).toEqual({ kind: "refused", reason: "matched" });

    expect(await links()).toEqual([]);
  });

  test("a member an admin link decides is refused as matched, even where the admin chose none", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await anAdminLink(sam.member, null, sam.member);

    expect(await sam.link(3)).toEqual({ kind: "refused", reason: "matched" });
    expect(await links()).toHaveLength(1);
  });

  test("a profile another member holds is refused as taken, and nothing is written", async () => {
    await teamPagesOn();
    await aTeammate("U_WREN", "Wren Halloway");
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await sam.link(1)).toEqual({ kind: "refused", reason: "taken" });
    expect(await links()).toEqual([]);
  });

  test("a profile not in the current copy is refused as unknown, and nothing is written", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await sam.link(99)).toEqual({ kind: "refused", reason: "unknown" });
    expect(await links()).toEqual([]);
  });

  test("a repeat with the same profile changes nothing", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    const linked = await links();
    later();

    expect(await sam.link(3)).toEqual({ kind: "linked" });

    expect(await links()).toEqual(linked);
  });

  test("the command decides team-pages with exposure, and the Settings read without", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.settings();
    expect(await teamPagesExposures()).toEqual([]);

    await sam.link(3);

    expect(await teamPagesExposures()).toEqual([{ member: sam.member, value: true }]);
  });

  test("while team-pages is off, Settings equal main's and the command refuses, writing no link", async () => {
    await teamPagesOff();
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await sam.settings()).toEqual({ kind: "not-found" });
    expect(await sam.link(3)).toEqual({ kind: "refused", reason: null });
    expect(await links()).toEqual([]);
    expect(await teamPagesExposures()).toEqual([{ member: sam.member, value: false }]);
  });
  test("a member can always clear their own link, even where an admin link decides them", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    await anAdminLink(sam.member, null, sam.member);

    expect(await sam.link(null)).toEqual({ kind: "linked" });

    expect((await links()).map(({ by }) => by)).toEqual(["admin"]);
  });

  test("a member whose own link holds nothing can clear it, and their name match comes back", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    later();
    await anOwnLink(wren.member, 3);

    expect(await wren.link(null)).toEqual({ kind: "linked" });

    expect(await companyProfileOf(wren)).toEqual({ profile: 1, by: "name" });
  });
});

describe("CV21: faces follow the matcher", () => {
  const samanthasFace = { kind: "company-profile", image: cutoutOf("samantha"), colour: "#EB9D2A", initials: "SO" };
  const slackless = { kind: "initials", initials: "SO" };

  test("while team-pages is on, a member's face follows their self link", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    expect(await sam.face()).toEqual(slackless);

    await sam.link(3);

    expect(await sam.face()).toEqual(samanthasFace);
  });

  test("while team-pages is on, two members of one name show neither the face of that name", async () => {
    await teamPagesOn();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    await aTeammate("U_WREN_TOO", "Wren Halloway");

    expect(await wren.face()).toEqual({ kind: "initials", initials: "WH" });
  });

  test("while team-pages is off, the face ignores links and keeps the name-only path", async () => {
    await teamPagesOn();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    await aTeammate("U_WREN_TOO", "Wren Halloway");
    await anAdminLink(wren.member, null, wren.member);
    await teamPagesOff();

    expect(await sam.face()).toEqual(slackless);
    expect(await wren.face()).toEqual({ kind: "company-profile", image: cutoutOf("wren"), colour: "#8567FF", initials: "WH" });
  });
});

describe("CV20: the admin override", () => {
  type Teammate = Awaited<ReturnType<typeof aTeammate>>;

  const keyOf = (admin: Teammate, member: { member: MemberId }) => seenKeyOf(admin.member, `member:${member.member}`);

  function anAdmin() {
    return aTeammate("U_ADMIN", "Ada Admin", { admin: true });
  }

  async function adminPartOf(admin: Teammate) {
    const settings = (await admin.settings()) as { admin?: unknown };
    return settings.admin;
  }

  test("an admin's Settings list every current member and every profile, by name, with who holds it and how it matched", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    const oriel = await aTeammate("U_ORIEL", "Oriel Pemberton");
    expect(await admin.linkTeammate(await keyOf(admin, oriel), "none")).toEqual({ kind: "linked" });
    const tamsin = await aTeammate("U_TAMSIN", "Tamsin Vale");
    await tamsin.leave();

    expect(await adminPartOf(admin)).toEqual({
      members: [
        { key: await keyOf(admin, admin), name: "Ada Admin", profile: null, by: null },
        { key: await keyOf(admin, oriel), name: "Oriel Pemberton", profile: null, by: "admin" },
        { key: await keyOf(admin, sam), name: "Sam Okafor", profile: 3, by: "self" },
        { key: await keyOf(admin, wren), name: "Wren Halloway", profile: 1, by: "name" },
      ],
      profiles: [
        { ...orielChoice, heldBy: null, by: null },
        { ...samanthaChoice, heldBy: await keyOf(admin, sam), by: "self" },
        { ...tamsinChoice, heldBy: null, by: null },
        { ...wrenChoice, heldBy: await keyOf(admin, wren), by: "name" },
      ],
    });
  });

  test("Settings' sections list the admin part for an admin while team-pages is on, and never for anyone else", async () => {
    vi.stubEnv("SITE_URL", "https://kudos-site.test");
    await teamPagesOn();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await admin.sections()).toContain("admin");
    expect(await sam.sections()).not.toContain("admin");
    expect(await sam.settings()).not.toHaveProperty("admin");

    await teamPagesOff();

    expect(await admin.sections()).not.toContain("admin");
  });

  test("while team-pages is off, an admin's Settings equal main's and the command refuses, writing no link", async () => {
    await teamPagesOff();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await admin.settings()).toEqual({ kind: "not-found" });
    expect(await admin.linkTeammate(await keyOf(admin, sam), 3)).toEqual({ kind: "refused", reason: null });
    expect(await links()).toEqual([]);
  });

  test("an admin link beats a self link and a name match", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);

    expect(await admin.linkTeammate(await keyOf(admin, sam), 1)).toEqual({ kind: "linked" });

    expect(await companyProfileOf(sam)).toEqual({ profile: 1, by: "admin" });
    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: null });
  });

  test("an admin's none unmatches a name match", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const wren = await aTeammate("U_WREN", "Wren Halloway");

    expect(await admin.linkTeammate(await keyOf(admin, wren), "none")).toEqual({ kind: "linked" });

    expect(await companyProfileOf(wren)).toEqual({ profile: null, by: "admin" });
    expect(await links()).toMatchObject([{ member: wren.member, profile: null, by: "admin", setBy: admin.member }]);
  });

  test("clearing the admin link returns a member to their self link or their name match", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);
    await admin.linkTeammate(await keyOf(admin, wren), "none");
    await admin.linkTeammate(await keyOf(admin, sam), 4);

    expect(await admin.linkTeammate(await keyOf(admin, wren), null)).toEqual({ kind: "linked" });
    expect(await admin.linkTeammate(await keyOf(admin, sam), null)).toEqual({ kind: "linked" });

    expect(await companyProfileOf(wren)).toEqual({ profile: 1, by: "name" });
    expect(await companyProfileOf(sam)).toEqual({ profile: 3, by: "self" });
    expect((await links()).map(({ by }) => by)).toEqual(["self"]);
  });

  test("moving a profile from one member to another leaves it held once, and deletes the other admin link to it", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    const sammy = await aTeammate("U_SAMMY", "Sammy Okafor");
    await admin.linkTeammate(await keyOf(admin, sam), 3);
    later();

    expect(await admin.linkTeammate(await keyOf(admin, sammy), 3)).toEqual({ kind: "linked" });

    expect(await companyProfileOf(sammy)).toEqual({ profile: 3, by: "admin" });
    expect(await companyProfileOf(sam)).toEqual({ profile: null, by: null });
    expect(await links()).toMatchObject([{ member: sammy.member, profile: 3, by: "admin", setBy: admin.member }]);
  });

  test("moving a profile a name match or a self link holds leaves it held once", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const oriel = await aTeammate("U_ORIEL", "Oriel Pemberton");
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await sam.link(3);

    await admin.linkTeammate(await keyOf(admin, oriel), 1);
    await admin.linkTeammate(await keyOf(admin, wren), 3);

    expect(await matches()).toEqual(
      expect.arrayContaining([
        { member: oriel.member, profile: 1, by: "admin" },
        { member: wren.member, profile: 3, by: "admin" },
      ]),
    );
    expect(await matches()).toHaveLength(2);
  });

  test("a repeat writes nothing", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await admin.linkTeammate(await keyOf(admin, sam), 3);
    const linked = await links();
    later();

    expect(await admin.linkTeammate(await keyOf(admin, sam), 3)).toEqual({ kind: "linked" });

    expect(await links()).toEqual(linked);
  });

  test("a non-admin's call, a key from another workspace, a former member's key and an unknown profile refuse and write nothing", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    const wren = await aTeammate("U_WREN", "Wren Halloway");
    const tamsin = await aTeammate("U_TAMSIN", "Tamsin Vale");
    await tamsin.leave();
    const elsewhere = await t.run((ctx) => ctx.db.insert("members", { workspace: "T2", user: "U_ELSEWHERE", kind: "member", asOf: 0, name: "Ellis Where" }));

    expect(await sam.linkTeammate(await keyOf(sam, wren), 3)).toEqual({ kind: "refused", reason: "not-admin" });
    expect(await admin.linkTeammate(await keyOf(admin, { member: elsewhere }), 3)).toEqual({ kind: "refused", reason: "unknown" });
    expect(await admin.linkTeammate(await keyOf(admin, tamsin), 4)).toEqual({ kind: "refused", reason: "unknown" });
    expect(await admin.linkTeammate("not-a-key", 3)).toEqual({ kind: "refused", reason: "unknown" });
    expect(await admin.linkTeammate(await keyOf(admin, sam), 99)).toEqual({ kind: "refused", reason: "unknown" });

    expect(await links()).toEqual([]);
  });

  test("a key is the admin's own: another member's key for the same teammate names nobody", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");

    expect(await admin.linkTeammate(await keyOf(sam, sam), 3)).toEqual({ kind: "refused", reason: "unknown" });
    expect(await links()).toEqual([]);
  });

  test("the command decides team-pages with exposure, and the admin part without", async () => {
    await teamPagesOn();
    const admin = await anAdmin();
    const sam = await aTeammate("U_SAM", "Sam Okafor");
    await admin.settings();
    await admin.sections();
    expect(await teamPagesExposures()).toEqual([]);

    await admin.linkTeammate(await keyOf(admin, sam), 3);

    expect(await teamPagesExposures()).toEqual([{ member: admin.member, value: true }]);
  });
});
