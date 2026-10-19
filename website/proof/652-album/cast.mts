export type Person = { id: string; first: string; last: string; profile: number; picture?: string };

const cast = process.env.KUDOS_CAST ?? "";

export const giver: Person = { id: `U0PRF652GVR${cast}`, first: "Rosalind", last: `Hartwell${cast}`, profile: 965_201 };

export const hyped: Person = { id: `U0PRF652HYP${cast}`, first: "Caspian", last: `Thorne${cast}`, profile: 965_202, picture: "https://avatars.slack-edge.com/2026-10-19/proof-652-caspian_192.png" };

export const inSlackTeam = { slug: `proof-652-inslack${cast.toLowerCase()}`, name: process.env.KUDOS_SLACK_EMOJI_TEAM ?? "Piggy" };

export const notInSlackTeam = { slug: `proof-652-lanternfolk${cast.toLowerCase()}`, name: `Lanternfolk ${cast}`.trim() };

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
