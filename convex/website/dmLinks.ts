import type { QueryCtx } from "../_generated/server";
import type { OnboardingStep } from "../quests/onboarding";
import type { MemberId } from "../workspace/directory";
import { websiteOriginFor } from "./link";
import { signInEntry } from "./routes";

export type DmLinks = { book: string; quests: string; questsHow: (step: OnboardingStep) => string };

export async function dmLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<DmLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  if (origin === null) return null;
  if (origin.endsWith(signInEntry)) return { book: origin, quests: origin, questsHow: () => origin };
  const quests = `${origin}/book#me/quests`;
  return { book: `${origin}/book`, quests, questsHow: (step) => `${quests}/${step}` };
}
