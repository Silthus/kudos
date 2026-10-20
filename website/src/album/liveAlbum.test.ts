import { describe, expect, it } from "vitest";
import type { AlbumRead as GetAlbumAnswer } from "../../../convex/website/album";
import { albumOf } from "./liveAlbum";

const answeredBefore736 = {
  kind: "album",
  me: { name: "Odalys Penhallow", face: { kind: "initials", initials: "OP" }, person: "member-1" },
  level: { level: 2, xp: 55, startsAt: 20, nextAt: 100 },
  teams: [],
  people: [],
  morePeople: false,
  packs: [],
  morePacks: false,
  tray: [],
  moreTray: false,
  milestones: [],
  emojis: [],
  moreEmojis: false,
  sharedEmojis: null,
  emojiPage: null,
  emojiWizard: true,
} as unknown as GetAlbumAnswer;

describe("#736: getAlbum answers from either side of the deploy", () => {
  it("an answer from a backend before emojiInPlace reads as in-place mapping off, so every page answers as before", () => {
    expect(albumOf(answeredBefore736)).toMatchObject({ kind: "album", emojiWizard: true, emojiInPlace: null });
  });

  it("an answer that carries emojiInPlace keeps it", () => {
    expect(albumOf({ ...answeredBefore736, emojiInPlace: "member" } as GetAlbumAnswer)).toMatchObject({ emojiInPlace: "member" });
  });
});
