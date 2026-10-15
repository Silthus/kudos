export type CrateKind = "weekly" | "journey" | "unlock";

export type CrateKey = `${CrateKind}:${string}`;

export function crateKindOf(crate: string): string {
  return crate.slice(0, crate.indexOf(":"));
}
