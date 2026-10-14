import { v, type Infer } from "convex/values";
import { perkValidator } from "./tree";

export const refusalValidator = v.union(
  v.literal("tree-locked"),
  v.literal("tree-ready"),
  v.literal("owned"),
  v.literal("below-row"),
  v.literal("needs-prerequisite"),
  v.literal("no-skill-points"),
);

export type Refusal = Infer<typeof refusalValidator>;

export const purchaseOutcomeValidator = v.union(
  v.object({ kind: v.literal("bought"), perk: perkValidator }),
  v.object({ kind: v.literal("refused"), perk: perkValidator, reason: refusalValidator }),
);

export type PurchaseOutcome = Infer<typeof purchaseOutcomeValidator>;
