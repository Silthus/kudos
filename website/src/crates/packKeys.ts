import { crateTargetIn, type CrateTarget } from "../../../convex/website/routes";
import type { Feature } from "../shell";
import type { ReadyCrate } from "./readyCrates";

export function packKeyOf(crate: ReadyCrate): string {
  if (crate.kind === "feature") return `unlock:${crate.card.feature}`;
  if (crate.kind === "bought") return crate.crate;
  const { quest } = crate;
  if (quest.kind === "journey") return `journey:${quest.step}`;
  if (quest.kind === "weekly") return `weekly:${quest.week}:${quest.slot}`;
  return `group:${quest.group}:${quest.week}`;
}

export function featureOfPackKey(crate: string): Feature | undefined {
  const [kind, feature] = crate.split(":");
  return kind === "unlock" ? (feature as Feature) : undefined;
}

export function crateTargetOfKey(crate: string): CrateTarget | undefined {
  const [kind, ...rest] = crate.split(":");
  if (kind === "journey") return "journey";
  if (kind === "unlock") return crateTargetIn(rest.join(":"));
  if (kind === "group") return { kind: "group", week: rest.at(-1)! };
  return crateTargetIn(crate);
}
