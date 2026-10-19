export type Person = { id: string; first: string; last: string; profile: number };

const cast = process.env.KUDOS_CAST ?? "";

export const team = { slug: `proof-661-lamplighters${cast.toLowerCase()}`, name: `Lamplighters ${cast}`.trim() };

export const giver: Person = { id: `U0PRF661GVR${cast}`, first: "Rosalind", last: `Thackeray${cast}`, profile: 966_101 };

export const teammates: Person[] = [
  { id: `U0PRF661FNW${cast}`, first: "Fenwick", last: `Ashdown${cast}`, profile: 966_102 },
  { id: `U0PRF661MRB${cast}`, first: "Marigold", last: `Brightwater${cast}`, profile: 966_103 },
  { id: `U0PRF661CSP${cast}`, first: "Caspian", last: `Holloway${cast}`, profile: 966_104 },
];

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
