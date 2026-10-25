import type { QueryCtx } from "../_generated/server";
import type { OnboardingStep } from "../quests/onboarding";
import { websiteOriginFor } from "../website/link";
import type { MemberId } from "../workspace/directory";

export type DmLinks = { book: string; quests: string; questsHow: (step: OnboardingStep) => string };

export async function dmLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<DmLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  if (origin === null) return null;
  const quests = `${origin}/book#me/quests`;
  return { book: `${origin}/book`, quests, questsHow: (step) => `${quests}/${step}` };
}
