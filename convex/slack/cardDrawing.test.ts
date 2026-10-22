import { afterEach, describe, expect, test, vi } from "vitest";
import { testBackend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import { cardPictureOf, cardSize } from "./cardDrawing";
import { cardKeyOf, type PlayerCard } from "./playerCard";

const site = "https://hedgehug.example";

const richMember: PlayerCard = {
  name: "Wren Alder",
  face: "https://res.cloudinary.com/posthog/wren.png",
  level: { level: 8, xp: 2310, share: 0.62 },
  team: { name: "Kettle Works", crest: "https://res.cloudinary.com/posthog/kettle-works.png" },
  place: { rank: 1, tied: false, thoughtful: 7 },
  hoggies: { found: 64, total: 151 },
  people: 24,
  emojis: 7,
  medals: 4,
  rarest: { name: "Wizard", rarity: "legendary", picture: `${site}/share/wizard.png` },
};

const quietMember: PlayerCard = { name: "Ivo Fenn", face: null, level: { level: 1, xp: 0, share: 0 }, team: null, place: null, hoggies: { found: 0, total: 151 }, people: 0, emojis: 0, medals: 0, rarest: null };

const noArt = { face: null, crest: null, rarest: null };

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LP93: the player card is drawn as a PNG", { timeout: 60_000 }, () => {
  test.each([
    ["a rich member", richMember],
    ["a quiet member", quietMember],
  ])("%s's card is a 1200×630 PNG small enough for Slack to fetch", async (_, card) => {
    const png = await cardPictureOf(card, noArt);

    expect([...png.subarray(0, 8)]).toEqual(pngSignature);
    expect(dimensionsOf(png)).toEqual(cardSize);
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
});

describe("LP95: a card's key is a hash of its facts", () => {
  test("the same facts give the same key", async () => {
    expect(await cardKeyOf({ ...richMember })).toBe(await cardKeyOf(richMember));
    expect(await cardKeyOf(richMember)).toMatch(/^[0-9a-f]{64}$/);
  });

  test.each<[string, Partial<PlayerCard>]>([
    ["name", { name: "Wren A." }],
    ["face", { face: null }],
    ["level", { level: { level: 8, xp: 2311, share: 0.62 } }],
    ["team", { team: null }],
    ["place", { place: { rank: 2, tied: false, thoughtful: 7 } }],
    ["hoggies", { hoggies: { found: 65, total: 151 } }],
    ["people", { people: 25 }],
    ["emojis", { emojis: 8 }],
    ["medals", { medals: 5 }],
    ["rarest", { rarest: null }],
  ])("a changed %s gives a new key", async (_, change) => {
    expect(await cardKeyOf({ ...richMember, ...change })).not.toBe(await cardKeyOf(richMember));
  });
});

function dimensionsOf(png: Uint8Array) {
  const header = new DataView(png.buffer, png.byteOffset + 16, 8);
  return { width: header.getUint32(0), height: header.getUint32(4) };
}
