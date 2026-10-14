import type { MySkillTree } from "./shell";

export type SkillTreeShown = MySkillTree | { kind: "connecting" } | { kind: "broken" };

export type SkillTreeRead = (asking: boolean) => SkillTreeShown | undefined;
