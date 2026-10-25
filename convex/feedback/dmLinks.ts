import type { QueryCtx } from "../_generated/server";
import type { OnboardingStep } from "../quests/onboarding";
import { websiteOrigin, websiteOriginFor } from "../website/link";
import { signInEntry } from "../website/routes";
import type { MemberId } from "../workspace/directory";

export type DmLinks = { book: string; quests: string };

export async function dmLinksOf(ctx: QueryCtx, workspace: string): Promise<DmLinks | null> {
  const origin = await websiteOrigin(ctx, workspace);
  return origin === null ? null : { book: `${origin}/book`, quests: `${origin}/book#me` };
}

export type WelcomeLinks = DmLinks & { questsHow: (step: OnboardingStep) => string };

export async function welcomeLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<WelcomeLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  if (origin === null) return null;
  if (origin.endsWith(signInEntry)) return { book: origin, quests: origin, questsHow: () => origin };
  const quests = `${origin}/book#me/quests`;
  return { book: `${origin}/book`, quests, questsHow: (step) => `${quests}/${step}` };
}
