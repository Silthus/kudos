export type Person = { id: string; first: string; last: string; profile: number };

export const team = { slug: "proof-119-burrowkeepers", name: "Burrowkeepers" };

export const owner: Person = { id: "U0PRF119OWN", first: "Odalys", last: "Fernhill", profile: 966_119_01 };

export const viewer: Person = { id: "U0PRF119VWR", first: "Tobiah", last: "Quarrie", profile: 966_119_02 };

export const teammate: Person = { id: "U0PRF119TMT", first: "Wren", last: "Calloway", profile: 966_119_03 };

export const cast = [owner, viewer, teammate];

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
