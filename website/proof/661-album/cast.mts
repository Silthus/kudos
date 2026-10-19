export type Person = { id: string; first: string; last: string; profile: number };

const cast = process.env.KUDOS_CAST ?? "";

const firstProfile = 966_101 + 10 * Math.max(0, "ABCDEFGHIJ".indexOf(cast));

export const team = { slug: `proof-661-lamplighters${cast.toLowerCase()}`, name: `Lamplighters ${cast}`.trim() };

export const giver: Person = { id: `U0PRF661GVR${cast}`, first: "Rosalind", last: `Thackeray${cast}`, profile: firstProfile };

export const teammates: Person[] = [
  { id: `U0PRF661FNW${cast}`, first: "Fenwick", last: `Ashdown${cast}`, profile: firstProfile + 1 },
  { id: `U0PRF661MRB${cast}`, first: "Marigold", last: `Brightwater${cast}`, profile: firstProfile + 2 },
  { id: `U0PRF661CSP${cast}`, first: "Caspian", last: `Holloway${cast}`, profile: firstProfile + 3 },
];

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
