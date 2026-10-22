import { afterEach, describe, expect, test, vi } from "vitest";
import { testBackend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import { cardPictureOf } from "./cardDrawing";
import { cardKeyOf, type DrawnCard } from "./playerCard";

const site = "https://hedgehug.example";

const richMember: DrawnCard = {
  name: "Wren Alder",
  face: { picture: "https://res.cloudinary.com/posthog/wren.png", initials: "WA" },
  level: { level: 8, xp: 2310, share: 0.62 },
  team: { name: "Kettle Works", crest: "https://res.cloudinary.com/posthog/kettle-works.png" },
  place: { rank: 1, tied: false, thoughtful: 7 },
  hoggies: { found: 64, total: 151, rarest: { name: "Wizard", rarity: "legendary", picture: `${site}/share/wizard.png`, foundAt: Date.UTC(2026, 9, 3) } },
  people: { held: 24, newest: [{ picture: null, initials: "IF" }, { picture: null, initials: "BO" }, { picture: null, initials: "JP" }] },
  emojis: { count: 7, pictures: [`${site}/emoji/team-kettle-works.png`] },
  medals: { count: 4, best: ["gold", "silver", "bronze"] },
};

const quietMember: DrawnCard = {
  name: "Ivo Fenn",
  face: { picture: null, initials: "IF" },
  level: { level: 1, xp: 0, share: 0 },
  team: null,
  place: null,
  hoggies: { found: 0, total: 151, rarest: null },
  people: { held: 0, newest: [] },
  emojis: { count: 0, pictures: [] },
  medals: { count: 0, best: [] },
};

const noArt = { face: null, crest: null, rarest: null, people: [], emojis: [] };

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LP99: the player card is drawn as a PNG", { timeout: 60_000 }, () => {
  test.each([
    ["a rich member", richMember],
    ["a quiet member", quietMember],
    ["a member whose hoggies are hidden", { ...richMember, hoggies: null }],
  ])("%s's card is a 1200×630 PNG small enough for Slack to fetch", async (_, card) => {
    const png = await cardPictureOf(card, noArt);

    expect([...png.subarray(0, 8)]).toEqual(pngSignature);
    expect(dimensionsOf(png)).toEqual({ width: 1200, height: 630 });
    expect(png.byteLength).toBeGreaterThan(10_000);
    expect(png.byteLength).toBeLessThan(1_000_000);
  });

  test("a drawn card is stored under its key, and the same key keeps the first picture", async () => {
    vi.stubGlobal("fetch", async () => new Response("not found", { status: 404 }));
    const t = testBackend();
    const key = await cardKeyOf(richMember);

    const first = await t.action(internal.slack.cardDrawing.drawn, { card: richMember, key });
    const again = await t.action(internal.slack.cardDrawing.drawn, { card: richMember, key });

    const stored = await t.run(async (ctx) => ({ rows: await ctx.db.query("cardPictures").collect(), files: await ctx.db.system.query("_storage").collect() }));
    expect(stored.rows.map((row) => row.key)).toEqual([key]);
    expect(stored.files).toHaveLength(1);
    expect(again).toBe(first);
    expect(await t.query(internal.slack.cardPictures.pictureAt, { key })).toBe(first);
  });

  test("a picture drawn while its art was briefly unreachable is shown but not kept, so the next share draws it again", async () => {
    vi.stubGlobal("fetch", async () => new Response("try later", { status: 503 }));
    const t = testBackend();
    const key = await cardKeyOf(richMember);

    const shown = await t.action(internal.slack.cardDrawing.drawn, { card: richMember, key });
    await t.action(internal.slack.cardDrawing.drawn, { card: richMember, key });

    const stored = await t.run(async (ctx) => ({ rows: await ctx.db.query("cardPictures").collect(), files: await ctx.db.system.query("_storage").collect() }));
    expect(shown).toMatch(/^https:/);
    expect(stored.rows).toEqual([]);
    expect(stored.files).toHaveLength(2);
    expect(await t.query(internal.slack.cardPictures.pictureAt, { key })).toBeNull();
  });
});

describe("LP101: a card's key is a hash of its facts", () => {
  test("the same facts give the same key", async () => {
    expect(await cardKeyOf({ ...richMember })).toBe(await cardKeyOf(richMember));
    expect(await cardKeyOf(richMember)).toMatch(/^[0-9a-f]{64}$/);
  });

  test.each<[string, Partial<DrawnCard>]>([
    ["name", { name: "Wren A." }],
    ["face", { face: { picture: null, initials: "WA" } }],
    ["level", { level: { level: 8, xp: 2311, share: 0.62 } }],
    ["team", { team: null }],
    ["place", { place: { rank: 2, tied: false, thoughtful: 7 } }],
    ["hoggies", { hoggies: { ...richMember.hoggies!, found: 65 } }],
    ["rarest", { hoggies: { ...richMember.hoggies!, rarest: null } }],
    ["people", { people: { ...richMember.people, held: 25 } }],
    ["newest faces", { people: { ...richMember.people, newest: richMember.people.newest.slice(1) } }],
    ["emojis", { emojis: { ...richMember.emojis, count: 8 } }],
    ["medals", { medals: { count: 5, best: ["gold", "silver", "bronze"] } }],
    ["best medals", { medals: { count: 4, best: ["diamond", "silver", "bronze"] } }],
  ])("a changed %s gives a new key", async (_, change) => {
    expect(await cardKeyOf({ ...richMember, ...change })).not.toBe(await cardKeyOf(richMember));
  });
});

function dimensionsOf(png: Uint8Array) {
  const header = new DataView(png.buffer, png.byteOffset + 16, 8);
  return { width: header.getUint32(0), height: header.getUint32(4) };
}
