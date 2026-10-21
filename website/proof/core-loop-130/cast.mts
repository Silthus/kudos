export type Person = { id: string; first: string; last: string; profile: number };

const take = process.env.KUDOS_CAST ?? "A";

const takes: Record<string, { team: string; thanked: [string, string]; giver: [string, string] }> = {
  A: { team: "Lanternwrights", thanked: ["Sable", "Ashgrove"], giver: ["Rook", "Tamberlane"] },
  B: { team: "Lamplighters", thanked: ["Juno", "Pellward"], giver: ["Corin", "Wilderby"] },
};

const chosen = takes[take]!;
const suffix = take === "A" ? "" : take;

export const team = { slug: `proof-130-${chosen.team.toLowerCase()}`, name: chosen.team };

export const thanked: Person = { id: `U0PRF130OWN${suffix}`, first: chosen.thanked[0], last: chosen.thanked[1], profile: 966_130_01 + (take.charCodeAt(0) - 65) * 10 };

export const giver: Person = { id: `U0PRF130TMT${suffix}`, first: chosen.giver[0], last: chosen.giver[1], profile: 966_130_02 + (take.charCodeAt(0) - 65) * 10 };

export const cast = [thanked, giver];

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
