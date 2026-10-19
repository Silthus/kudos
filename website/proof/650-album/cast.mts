export type Person = { id: string; first: string; last: string; profile: number };

const cast = process.env.KUDOS_CAST ?? "";

export const team = { slug: `proof-650-quillwrights${cast.toLowerCase()}`, name: `Quillwrights ${cast}`.trim() };

export const giver: Person = { id: `U0PRF650GVR${cast}`, first: "Marlow", last: `Pennyfeather${cast}`, profile: 965_001 };

export const teammates: Person[] = [
  { id: `U0PRF650OTB${cast}`, first: "Ottoline", last: `Brackwater${cast}`, profile: 965_002 },
  { id: `U0PRF650TBQ${cast}`, first: "Tiberius", last: `Quenby${cast}`, profile: 965_003 },
];

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
