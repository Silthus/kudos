import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace } from "../../testing/website";
import { internal } from "../_generated/api";
import { catalogue } from "../album/hoggies/catalogue";
import { companyTeamsOf } from "./teams";

const wren = { id: 11, firstName: "Wren", lastName: "Halloway", colour: "lilac", cutout: aCutout("wren"), role: "Product Engineer" };
const oriel = { id: 12, firstName: "Oriel", lastName: "Pemberton", colour: "teal", cutout: aCutout("oriel"), role: "Designer" };
const tamsin = { id: 13, firstName: "Tamsin", lastName: "Quayle", colour: "red", cutout: aCutout("tamsin"), role: "Team Lead" };
const lanternCrest = "https://res.cloudinary.com/posthog-test/image/upload/v1/lantern_crest.png";
const lanternCrestSized = "https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/lantern_crest.png";
const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", crest: lanternCrest, leads: [tamsin.id], profiles: [tamsin, wren, oriel] };
const kites: TeamPage = { slug: "kites", name: "Kites", crest: null, leads: [oriel.id, wren.id], profiles: [oriel, wren] };
const monday = Date.UTC(2026, 9, 12, 6);
const hourMs = 60 * 60 * 1000;

let postHogCom: FakePostHogCom;
let t: Backend;

beforeEach(() => {
  aDeploymentForWorkspace();
  postHogCom = new FakePostHogCom();
  vi.stubGlobal("fetch", routedFetch(new FakePostHog(), (input) => postHogCom.fetch(input)));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function syncCompanyProfiles() {
  return t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
}

function companyTeams() {
  return t.run((ctx) => companyTeamsOf(ctx));
}

function companyProfiles() {
  return t.run(async (ctx) => (await ctx.db.query("companyProfiles").collect()).map(({ profile, firstName, teams, role }) => ({ profile, firstName, teams, role })));
}

describe("CV14: a company profile keeps its posthog.com ID, every team it is on and its role", () => {
  test("a person on two teams keeps both, in posthog.com's order, with their ID and role", async () => {
    postHogCom.withTeams(lanterns, kites);
    await syncCompanyProfiles();

    expect(await companyProfiles()).toEqual([
      { profile: tamsin.id, firstName: "Tamsin", teams: ["lanterns"], role: "Team Lead" },
      { profile: wren.id, firstName: "Wren", teams: ["lanterns", "kites"], role: "Product Engineer" },
      { profile: oriel.id, firstName: "Oriel", teams: ["lanterns", "kites"], role: "Designer" },
    ]);
  });

  test("a role is trimmed, and a blank or missing role is absent", async () => {
    postHogCom.withTeams({ ...kites, profiles: [{ ...oriel, role: "  Designer \n" }, { ...wren, role: "   " }, { ...tamsin, role: null }] });
    await syncCompanyProfiles();

    expect(await companyProfiles()).toEqual([
      { profile: oriel.id, firstName: "Oriel", teams: ["kites"], role: "Designer" },
      { profile: wren.id, firstName: "Wren", teams: ["kites"], role: undefined },
      { profile: tamsin.id, firstName: "Tamsin", teams: ["kites"], role: undefined },
    ]);
  });
});

describe("CV15: the sync keeps every company team with its name, crest, leads and people", () => {
  test("every team keeps its people and leads in posthog.com's order", async () => {
    postHogCom.withTeams(lanterns, kites);
    await syncCompanyProfiles();

    expect(await companyTeams()).toEqual([
      { team: "lanterns", name: "Lanterns", crest: { kind: "image", url: lanternCrestSized }, leads: [tamsin.id], people: [tamsin.id, wren.id, oriel.id] },
      { team: "kites", name: "Kites", crest: null, leads: [oriel.id, wren.id], people: [oriel.id, wren.id] },
    ]);
  });

  test("a team without a slug or a name is skipped, and its people are still kept as profiles on their other teams", async () => {
    postHogCom.withTeams({ ...lanterns, slug: null }, { ...kites, name: null }, { slug: "ferns", name: "Ferns", profiles: [wren] }, { slug: "moths", name: "  ", profiles: [tamsin] }, { slug: " ", name: "Wisps", profiles: [oriel] });
    await syncCompanyProfiles();

    expect(await companyTeams()).toEqual([{ team: "ferns", name: "Ferns", crest: null, leads: [], people: [wren.id] }]);
    expect(await companyProfiles()).toEqual([
      { profile: tamsin.id, firstName: "Tamsin", teams: [], role: "Team Lead" },
      { profile: wren.id, firstName: "Wren", teams: ["ferns"], role: "Product Engineer" },
      { profile: oriel.id, firstName: "Oriel", teams: [], role: "Designer" },
    ]);
  });

  test("a crest that isn't a Cloudinary image is dropped", async () => {
    postHogCom.withTeams({ ...lanterns, crest: "https://elsewhere.example/lantern_crest.png" }, { ...kites, crest: "https://res.cloudinary.com/posthog-test/image/upload/v1/kites.svg" });
    await syncCompanyProfiles();

    expect((await companyTeams()).map(({ crest }) => crest)).toEqual([null, null]);
  });

  test("a team gone from posthog.com is gone after the next good read", async () => {
    postHogCom.withTeams(lanterns, kites);
    await syncCompanyProfiles();
    postHogCom.withTeams(kites);
    await syncCompanyProfiles();

    expect((await companyTeams()).map(({ team }) => team)).toEqual(["kites"]);
  });

  test("an older sync that finishes after a newer one can't put its copy over the newer one", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: monday });
    postHogCom.withTeams(lanterns);
    const olderRead = aHeldAnswer();
    postHogCom.answersPage(1, olderRead.answer);
    const olderSync = syncCompanyProfiles();
    await olderRead.asked;

    vi.setSystemTime(monday + hourMs);
    postHogCom.withTeams(kites).answersPage(1, (asPostHogComWould) => asPostHogComWould());
    await syncCompanyProfiles();
    olderRead.release();
    await olderSync;

    expect((await companyTeams()).map(({ team }) => team)).toEqual(["kites"]);
    expect((await companyProfiles()).map(({ firstName }) => firstName)).toEqual(["Oriel", "Wren"]);
  });
});

describe("CV16: a company team's crest art", () => {
  const catalogueCrest = catalogue.crests[0]!.crest;

  test("a team whose slug names a catalogue crest draws that crest, even with its own crest image", async () => {
    postHogCom.withTeams({ ...lanterns, slug: catalogueCrest });
    await syncCompanyProfiles();

    expect((await companyTeams())[0]?.crest).toEqual({ kind: "crest", slug: catalogueCrest });
  });

  test("a team the catalogue has no crest for draws its posthog.com crest image, else nothing", async () => {
    postHogCom.withTeams(lanterns, kites);
    await syncCompanyProfiles();

    expect((await companyTeams()).map(({ crest }) => crest)).toEqual([{ kind: "image", url: lanternCrestSized }, null]);
  });
});

function aHeldAnswer() {
  let release!: () => void;
  let wasAsked!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const asked = new Promise<void>((resolve) => (wasAsked = resolve));
  return {
    asked,
    release,
    answer: async (asPostHogComWould: () => Response) => {
      const answer = asPostHogComWould();
      wasAsked();
      await released;
      return answer;
    },
  };
}
