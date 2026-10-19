import type { AlbumProfile, ProfileRead, ProfileShown } from "./answer";

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");

const kindWords = "Thank you for reviewing my first PR so kindly, I learned a lot from your comments.";

const face = (initials: string) => ({ kind: "initials", initials }) as const;

const noted: AlbumProfile = {
  kind: "profile",
  note: { giver: { person: "ines-okafor", name: "Ines Okafor", face: face("IO") }, message: { kind: "text", segments: [{ kind: "text", text: kindWords }], edited: false }, permalink: "https://example.slack.com/archives/C1/p2", at: now - day },
  newest: [
    { person: "perrin-holt", name: "Perrin Holt", face: face("PH"), at: now - 2 * day },
    { person: "wren-alder", name: "Wren Alder", face: face("WA"), at: now - 4 * day },
    { person: "fen-marlowe", name: "Fen Marlowe", face: face("FM"), at: now - 6 * day },
  ],
};

const quiet: AlbumProfile = { kind: "profile", note: null, newest: [] };

export const profileFixtures = { noted, quiet } satisfies Record<string, AlbumProfile>;


export function fixedProfile(answer: ProfileShown): ProfileRead {
  return (asking) => (asking ? answer : undefined);
}
