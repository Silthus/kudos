import { describe, expect, test } from "vitest";
import {
  COSMETICS,
  EMOJI_VARIANTS,
  kudosEmojiNames,
  ownedVariants,
  readKudosEmoji,
  SUPER_KUDOS,
  superKudosCelebration,
  superKudosPerMonth,
  superKudosVerdict,
  variantShortcode,
} from "./cosmetics";

/** Cosmetics and Super kudos (#98, #55 §G5, §G7 Herald): the pure rules. */

describe("the kudos emoji a message carries, for one giver", () => {
  test("counts the workspace emoji, skin tones included, as before", () => {
    expect(readKudosEmoji("<@UBEN> :taco: :taco::skin-tone-3: thanks", "taco", [])).toEqual({ amount: 2, variant: null, superEmoji: 0 });
  });

  test("counts a variant the giver owns as the kudos emoji, and remembers it", () => {
    expect(readKudosEmoji("<@UBEN> :taco-golden: :taco: great work", "taco", ["golden"])).toEqual({ amount: 2, variant: "golden", superEmoji: 0 });
  });

  test("ignores a variant the giver doesn't own: it's only an emoji for them", () => {
    expect(readKudosEmoji("<@UBEN> :taco-golden: great work", "taco", [])).toEqual({ amount: 0, variant: null, superEmoji: 0 });
    expect(readKudosEmoji("<@UBEN> :taco-golden: :taco: great work", "taco", ["rainbow"])).toEqual({ amount: 1, variant: null, superEmoji: 0 });
  });

  test("the Super kudos emoji gives the usual amount for everyone, owner of the skill or not", () => {
    expect(readKudosEmoji("<@UBEN> :taco-super: thanks", "taco", [])).toEqual({ amount: 1, variant: null, superEmoji: 1 });
    expect(readKudosEmoji("<@UBEN> :taco-super: :taco: thanks", "taco", [])).toEqual({ amount: 2, variant: null, superEmoji: 1 });
  });

  test("a workspace emoji with regex characters in its name is matched literally", () => {
    expect(readKudosEmoji(":a+b: :a+b-golden: :aab:", "a+b", ["golden"])).toEqual({ amount: 2, variant: "golden", superEmoji: 0 });
  });

  test("every shortcode the workspace's admins upload: the Super kudos emoji and each variant", () => {
    expect(kudosEmojiNames("taco")).toEqual(["taco", "taco-super", ...EMOJI_VARIANTS.map((v) => `taco-${v.suffix}`)]);
    expect(variantShortcode("taco", "golden")).toBe(":taco-golden:");
  });
});

describe("which emoji variants a member owns", () => {
  test("bought in the Store, or granted by each rank of Signature emoji", () => {
    const store = EMOJI_VARIANTS.filter((v) => v.source.kind === "store");
    const skill = EMOJI_VARIANTS.filter((v) => v.source.kind === "skill");
    expect(store.length).toBeGreaterThan(0);
    expect(skill).toHaveLength(2);
    expect(ownedVariants({}, [])).toEqual([]);
    expect(ownedVariants({ emoji_variants: 1 }, [])).toEqual([skill[0].suffix]);
    expect(ownedVariants({ emoji_variants: 2 }, [store[0].item!])).toEqual([store[0].suffix, skill[0].suffix, skill[1].suffix]);
  });
});

describe("the cosmetic catalog", () => {
  test("frames, banners and stickers, each an art slot with a placeholder until the art pass (#101)", () => {
    for (const slot of ["frame", "banner", "sticker"] as const) expect(COSMETICS.filter((c) => c.slot === slot).length).toBeGreaterThanOrEqual(2);
    for (const c of COSMETICS) {
      expect(c.price).toBeGreaterThan(0);
      expect(c.art.slot).toMatch(/^[a-z-]+$/);
      expect(c.art.colors.length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set([...COSMETICS.map((c) => c.key), ...EMOJI_VARIANTS.flatMap((v) => (v.item ? [v.item] : []))]).size).toBe(
      COSMETICS.length + EMOJI_VARIANTS.filter((v) => v.item).length,
    );
  });
});

describe("the Super kudos celebration text", () => {
  test("in Slack: bold title and the note quoted; on the web: plain, the note exactly as written (review #9)", () => {
    expect(superKudosCelebration("<@UANA>", "for the *huge* rewrite", "slack")).toBe(
      "🌟 *A Super kudos from <@UANA>!* Each Herald only has one or two a month, and they chose you.\n> for the *huge* rewrite",
    );
    expect(superKudosCelebration("Ana", "for the *huge* rewrite", "web")).toBe(
      "🌟 A Super kudos from Ana! Each Herald only has one or two a month, and they chose you.\nfor the *huge* rewrite",
    );
  });
});

describe("Super kudos", () => {
  test("one a month with the skill, two with Encore, none without", () => {
    expect(superKudosPerMonth({})).toBe(0);
    expect(superKudosPerMonth({ emoji_variants: 1, super_kudos: 1 })).toBe(1);
    expect(superKudosPerMonth({ emoji_variants: 1, super_kudos: 1, encore: 1 })).toBe(2);
  });

  const ok = { perMonth: 1, usedThisMonth: 0, people: 1, noteWords: SUPER_KUDOS.minNoteWords, sameReceiverThisQuarter: false };

  test("is a Super kudos with the skill, a use left, one person and a 12+ word note", () => {
    expect(superKudosVerdict(ok)).toEqual({ ok: true });
  });

  test("otherwise it's a normal kudos, and the giver hears why", () => {
    expect(superKudosVerdict({ ...ok, perMonth: 0 })).toEqual({ ok: false, reason: "no_skill" });
    expect(superKudosVerdict({ ...ok, usedThisMonth: 1 })).toEqual({ ok: false, reason: "used_up" });
    expect(superKudosVerdict({ ...ok, people: 2 })).toEqual({ ok: false, reason: "one_person" });
    expect(superKudosVerdict({ ...ok, noteWords: 11 })).toEqual({ ok: false, reason: "short_note" });
    expect(superKudosVerdict({ ...ok, noteWords: undefined })).toEqual({ ok: false, reason: "short_note" });
    expect(superKudosVerdict({ ...ok, sameReceiverThisQuarter: true })).toEqual({ ok: false, reason: "same_quarter" });
  });
});
