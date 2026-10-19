export type Person = { id: string; first: string; last: string; profile: number };

const cast = process.env.KUDOS_CAST ?? "";

const firstProfile = 969_601 + 10 * Math.max(0, "ABCDEFGHIJ".indexOf(cast));

export const team = { slug: `proof-696-beacons${cast.toLowerCase()}`, name: `Beacons ${cast}`.trim() };

export const giver: Person = { id: `U0PRF696GVR${cast}`, first: "Odalys", last: `Penhallow${cast}`, profile: firstProfile };

export const teammates: Person[] = [
  { id: `U0PRF696TMB${cast}`, first: "Tobias", last: `Merriweather${cast}`, profile: firstProfile + 1 },
  { id: `U0PRF696WRN${cast}`, first: "Wren", last: `Ashcombe${cast}`, profile: firstProfile + 2 },
];

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
