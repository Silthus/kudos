const packKinds = ["weekly", "journey", "group", "unlock", "bought", "thoughtful"] as const;

const droppingKinds = [...packKinds, "level"] as const;

export type CrateKind = (typeof droppingKinds)[number];

export type PackKind = (typeof packKinds)[number];

export type CrateKey = `${CrateKind}:${string}`;

export type PackKey = `${PackKind}:${string}`;

export function crateKindOf(crate: string): string {
  return crate.slice(0, crate.indexOf(":"));
}

export function dropsAHoggie(crate: string): crate is CrateKey {
  return (droppingKinds as readonly string[]).includes(crateKindOf(crate));
}

export function paysAPack(crate: CrateKey): crate is PackKey {
  return (packKinds as readonly string[]).includes(crateKindOf(crate));
}

export function kindOf(crate: CrateKey): CrateKind {
  return crateKindOf(crate) as CrateKind;
}

export function packKindOf(crate: PackKey): PackKind {
  return crateKindOf(crate) as PackKind;
}
