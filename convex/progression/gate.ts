import { v, type Infer } from "convex/values";
import type { Annotations } from "../engine/messageEvent";
import type { ParseHook } from "../parser/parser";

const ruleVersion = 1;
const wordsToBeThoughtful = 5;

export const gateDecisionValidator = v.object({ version: v.number(), thoughtful: v.boolean() });

export type GateDecision = Infer<typeof gateDecisionValidator>;

export const thoughtfulKudos: ParseHook = {
  name: "thoughtful kudos",
  annotate: ({ text }) => {
    const words = wordsIn(text);
    return { gate: { version: ruleVersion, thoughtful: words >= wordsToBeThoughtful, words } };
  },
};

export function gateDecisionOf(annotations: Annotations): GateDecision | null {
  const gate = annotations.gate;
  if (typeof gate !== "object" || typeof gate.version !== "number" || typeof gate.thoughtful !== "boolean") return null;
  return { version: gate.version, thoughtful: gate.thoughtful };
}

function wordsIn(text: string) {
  return text.split(/\s+/).filter((run) => /[\p{L}\p{N}]/u.test(run)).length;
}
