export type Person = { id: string; first: string; last: string };

export const forger: Person = { id: "U0PRFFORGE1", first: "Marlo", last: "Thistlewood" };

export const nameOf = ({ first, last }: Person) => `${first} ${last}`;
