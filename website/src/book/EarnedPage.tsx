import { HedgehogStampApproved } from "@posthog/brand/hoggies";
import { Arrow } from "../Arrow";
import { buttonVariants } from "@posthog/quill";
import { useEffect, useState, type ReactNode } from "react";
import { AppLink } from "../AppLink";
import { hasSeen, markSeen } from "../crates/seen";
import { PageTitle } from "../PageTitle";
import type { LadderCard } from "../shell";
import { SlackLink } from "../SlackLink";
import { bookHref } from "./categories";
import { tierWords } from "./dates";
import { Medal } from "./Medal";
import { newestEarned, type Shelved } from "./progress";
import { listOf, rewardsAreYours, RewardGains } from "./Rewards";
import "./earned.css";

export function EarnedPage({ ladders, chatUrl }: { ladders: LadderCard[]; chatUrl: string }) {
  const earned = newestEarned(ladders);
  if (earned.length === 0) return <NothingEarnedYet />;
  return <EarnedMoment key={earned.map(({ tier }) => tier.seen).join(" ")} earned={earned} chatUrl={chatUrl} />;
}

function EarnedMoment({ earned, chatUrl }: { earned: Shelved[]; chatUrl: string }) {
  const fresh = useFirstShowing(earned);
  const ladderNames = listOf(earned.map(({ ladder }) => ladder.name));
  return (
    <article data-moment={fresh ? "fresh" : "seen"} className="hud-panel mx-auto w-full max-w-3xl overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <section className="lemon-band px-5 pb-8 pt-6 md:px-10 md:pb-10 md:pt-8">
        <span className="hud-label">{`${earned.length === 1 ? "Achievement" : "Achievements"} · ${ladderNames}`}</span>
        <div className="mt-4 flex items-end gap-4">
          <div className="earned-headline min-w-0 flex-1">
            <PageTitle tab="Achievement" size="headline">{`You earned ${listOf(earned.map(({ tier }) => tier.name))}`}</PageTitle>
          </div>
          <span aria-hidden="true" className="earned-hog shrink-0">
            <HedgehogStampApproved size={200} title="" className="h-auto w-20 sm:w-28 md:w-36" />
          </span>
        </div>
        <ul aria-label="Tiers earned" className="mt-8 flex flex-wrap items-start justify-center gap-x-10 gap-y-6">
          {earned.map((entry) => (
            <EarnedTier key={`${entry.ladder.ladder}-${entry.tier.tier}`} entry={entry} />
          ))}
        </ul>
      </section>
      <div className="flex flex-col gap-5 p-5 md:p-8">
        <p className="earned-line text-sm md:text-base">{earned.map(sentenceOf).join(" ")}</p>
        <Actions>
          <SlackLink chatUrl={chatUrl} variant="outline" size="default">
            Back to Slack
          </SlackLink>
        </Actions>
      </div>
    </article>
  );
}

function EarnedTier({ entry: { ladder, tier } }: { entry: Shelved }) {
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <span className="earned-plaque grid size-28 place-items-center rounded-[28px] sm:size-32">
        <span className="earned-stamp inline-flex">
          <Medal tier={tier.tier} earned size={84} />
        </span>
      </span>
      <span className="text-sm font-semibold">{`${tierWords[tier.tier]} · ${ladder.name}`}</span>
      {tier.rewards.length > 0 && (
        <span className="earned-reward flex flex-wrap justify-center gap-2">
          <RewardGains rewards={tier.rewards} className="earned-pill rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums" />
        </span>
      )}
    </li>
  );
}

function NothingEarnedYet() {
  return (
    <section className="hud-panel mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-lg border bg-card px-5 py-10 text-center shadow-sm">
      <PageTitle tab="Achievement" size="headline">
        No tiers earned yet
      </PageTitle>
      <p className="max-w-md text-balance text-sm text-muted-foreground">Your first tier is waiting in the Book.</p>
      <Actions />
    </section>
  );
}

function Actions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
      {children}
      <AppLink href={bookHref("overview")} className={`group ${buttonVariants({ variant: "primary" })} sm:ml-auto`}>
        See achievements
        <Arrow className="size-4" />
      </AppLink>
    </div>
  );
}

function sentenceOf({ ladder, tier }: Shelved) {
  const counted = `${tier.at} ${ladder.counts}.`;
  return tier.rewards.length === 0 ? counted : `${counted} ${rewardsAreYours(tier.rewards)}`;
}

function useFirstShowing(earned: Shelved[]) {
  const keys = earned.flatMap(({ tier }) => tier.seen ?? []).join(" ");
  const [fresh] = useState(() => keys.split(" ").some((key) => !hasSeen(key)));
  useEffect(() => keys.split(" ").forEach(markSeen), [keys]);
  return fresh;
}
