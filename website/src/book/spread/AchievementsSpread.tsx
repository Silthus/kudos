import { useId } from "react";
import { AppLink } from "../../AppLink";
import type { LadderCard } from "../../shell";
import { QuietBar } from "../Bar";
import { chaptersOf, type CategoryId } from "../categories";
import { dateWords, tierWords } from "../dates";
import { Ladder } from "../Ladder";
import { LadderEmblem } from "../LadderEmblem";
import { Medal } from "../Medal";
import { closestNextOf, recentlyEarned, tiersEarned } from "../progress";
import { ChapterLabel, Page, PageHeading, row, selectedRow } from "./Page";
import { spreadHrefOf } from "./spreads";

type AchievementsProps = { ladders: LadderCard[]; category: CategoryId | "all"; timeZone: string; chapter: number; firstPage: number };

export function AchievementsSpread({ ladders, category, timeZone, chapter, firstPage }: AchievementsProps) {
  const chapters = chaptersOf(ladders);
  const current = chapters.find((entry) => entry.category.id === category);
  const closest = closestNextOf(ladders);
  const all = tiersEarned(ladders);
  const pageAt = current === undefined ? 0 : chapters.indexOf(current) + 1;
  return (
    <>
      <Page side="left" number={firstPage + pageAt * 2} label="Achievements contents">
        <ChapterLabel>{`Chapter ${chapter} · Achievements`}</ChapterLabel>
        <ol className="flex flex-col gap-1">
          <li>
            <AppLink href={spreadHrefOf({ kind: "achievements", category: "all" })} aria-current={category === "all" ? "page" : undefined} className={`${row} py-2 ${category === "all" ? selectedRow : ""}`}>
              <span className="w-7" />
              <span className="flex-1 text-sm">Recently earned</span>
              <span className="text-xs tabular-nums text-muted-foreground">{`${all.earned}/${all.total}`}</span>
            </AppLink>
          </li>
          {chapters.map((entry) => {
            const count = tiersEarned(entry.ladders);
            const here = entry.category.id === category;
            return (
              <li key={entry.category.id}>
                <AppLink href={spreadHrefOf({ kind: "achievements", category: entry.category.id })} aria-current={here ? "page" : undefined} className={`${row} py-2 ${here ? selectedRow : ""}`}>
                  <span aria-hidden="true" className="bk-crest-hover inline-flex w-7 justify-center">
                    <entry.category.Emblem size={28} />
                  </span>
                  <span className="w-28 text-sm">{entry.category.name}</span>
                  <span className="min-w-0 flex-1">
                    <QuietBar value={count.earned} max={count.total} />
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{`${count.earned}/${count.total}`}</span>
                </AppLink>
              </li>
            );
          })}
        </ol>
        {closest !== null && (
          <div className="bk-slot mt-2 flex items-center gap-3 p-3">
            <LadderEmblem ladder={closest.ladder.ladder} best={null} size={56} />
            <span className="flex min-w-0 flex-col">
              <span className="hud-label">Closest next</span>
              <span className="truncate text-sm font-medium">{`${closest.tier.name} · ${tierWords[closest.tier.tier]} ${closest.ladder.name}`}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{`${closest.toGo} to go`}</span>
            </span>
          </div>
        )}
      </Page>
      <Page side="right" number={firstPage + 1 + pageAt * 2} label={current === undefined ? "Recently earned tiers" : `${current.category.name} ladders`}>
        {current === undefined ? <RecentlyEarned ladders={ladders} timeZone={timeZone} /> : <CategoryLadders chapter={current} timeZone={timeZone} />}
      </Page>
    </>
  );
}

function RecentlyEarned({ ladders, timeZone }: { ladders: LadderCard[]; timeZone: string }) {
  const headingId = useId();
  const recent = recentlyEarned(ladders).slice(0, 6);
  return (
    <>
      <PageHeading id={headingId}>Recently earned</PageHeading>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tier earned yet. Your first one is waiting in these ladders.</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {recent.map(({ ladder, tier }) => (
            <li key={`${ladder.ladder}:${tier.tier}`} className="flex items-center gap-3 rounded-md px-2 py-1.5">
              <LadderEmblem ladder={ladder.ladder} best={tier.tier} size={56} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{tier.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Medal tier={tier.tier} earned size={16} />
                  {`${tierWords[tier.tier]} · ${ladder.name} · ${dateWords(tier.earnedAt, timeZone)}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CategoryLadders({ chapter: { category, ladders }, timeZone }: { chapter: ReturnType<typeof chaptersOf>[number]; timeZone: string }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <PageHeading>{category.name}</PageHeading>
        {category.blurb !== null && <p className="text-xs text-muted-foreground">{category.blurb}</p>}
      </div>
      <div className="flex flex-col gap-3">
        {ladders.map((ladder) => (
          <Ladder key={ladder.ladder} ladder={ladder} timeZone={timeZone} compact />
        ))}
      </div>
    </>
  );
}
