import type { PerkNode, PurchaseRefusal } from "../shell";

const ownedDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function skillPointsText(points: number) {
  return points === 1 ? "1 skill point" : `${points} skill points`;
}

export function pointsToSpend(points: number) {
  return points === 0 ? "No skill points to spend" : `${skillPointsText(points)} to spend`;
}

export function chipName(points: number) {
  return `${skillPointsText(points)} to spend`;
}

export function shortReasonOf({ reason, requires }: PerkNode, level: number) {
  if (reason === "level") return `Opens at level ${level}.`;
  if (reason === "requires") return `Needs ${requires} first.`;
  return "No skill points to spend.";
}

export function reasonOf(perk: PerkNode, level: number) {
  return perk.reason === "points" ? "No skill points to spend. Each level from 5 on gives one." : shortReasonOf(perk, level);
}

export function nodeNameOf(perk: PerkNode, level: number) {
  if (perk.state === "owned") return `${perk.name}. Owned.`;
  const state = perk.state === "available" ? "Can buy." : shortReasonOf(perk, level);
  return `${perk.name}. ${state} Costs ${skillPointsText(perk.cost.skillPoints)}.`;
}

export function ownedSince(ownedAt: number) {
  return `Owned since ${ownedDate.format(ownedAt)}`;
}

export function boughtText({ name }: PerkNode) {
  return `You bought ${name}.`;
}

export function refusedText(perk: PerkNode, level: number, reason: PurchaseRefusal | null) {
  const refused = "That couldn't be bought.";
  const why = refusalReasonOf(perk, level, reason);
  return why === undefined ? refused : `${refused} ${why}`;
}

export function refusalReasonOf(perk: PerkNode, level: number, reason: PurchaseRefusal | null) {
  if (reason === "owned") return `You already own ${perk.name}.`;
  if (reason === "level" || reason === "requires" || reason === "points") return shortReasonOf({ ...perk, reason }, level);
  return undefined;
}

export function ownedCountLine(owned: number, total: number) {
  return `${owned} of ${total} perks owned`;
}
