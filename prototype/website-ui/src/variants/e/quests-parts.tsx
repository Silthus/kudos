// Variant E quest parts both quest surfaces share: the quest's hedgehog, its neutral progress bar with the count, and its reward line.
import { IconCheck } from "@posthog/icons";
import { CoinGlyph, useMounted } from "./hud";
import type { Quest, Reward } from "./quests-data";

export function QuestHog({ quest, size }: { quest: Quest; size: number }) {
  const { Hog } = quest.def;
  return (
    <span className="relative flex shrink-0 items-center justify-center rounded-xl bg-muted/60" style={{ width: size, height: size }}>
      <Hog size={Math.round(size * 0.86)} title="" className={quest.state === "claimed" ? "grayscale" : ""} />
      {quest.state === "claimed" && (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
          <IconCheck className="size-3" />
        </span>
      )}
    </span>
  );
}

export function QuestProgress({ quest, compact = false }: { quest: Quest; compact?: boolean }) {
  const mounted = useMounted();
  const { done, def } = quest;
  const percent = (done / def.target) * 100;
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${compact ? "h-1.5" : "h-2"} flex-1 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border`} role="progressbar" aria-label={def.goal} aria-valuenow={done} aria-valuemin={0} aria-valuemax={def.target}>
        <div className="hud-fill h-full rounded-full bg-foreground" style={{ width: `${mounted ? percent : 0}%` }} />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {done}/{def.target}
      </span>
    </div>
  );
}

export function RewardLine({ reward, coinsOpen }: { reward: Reward; coinsOpen: boolean }) {
  const { item } = reward;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground" aria-label="Reward">
      <span className="tabular-nums">+{reward.xp} XP</span>
      {coinsOpen && reward.coins && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CoinGlyph className="size-3.5" />
          {reward.coins}
        </span>
      )}
      {item?.kind === "emoji" && (
        <span className="inline-flex items-center gap-1">
          <span className="text-sm leading-none">{item.emoji}</span>
          New emoji
        </span>
      )}
      {item?.kind === "hedgehog" && (
        <span className="inline-flex items-center gap-1">
          <item.Art size={18} title="" />
          {item.name}
        </span>
      )}
    </span>
  );
}
