// Variant E public profile card: what every teammate sees, the hedgehog, name, group, level and best achievement tiers, and a note on what always stays with the member.
import { ladders, me } from "../../data/mock";
import type { Tier } from "../../data/types";
import { TierMedal } from "../../ui";
import { useGearAtLevel } from "./gear-level";
import { Panel } from "./hud";
import { useUnlocked } from "./unlocks";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

const bestTiers = ladders
  .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
  .filter((t): t is Tier => t !== undefined)
  .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
  .slice(0, 4);

const listed = (words: string[]) => `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

export function ProfileCardPanel() {
  const g = useGearAtLevel();
  const privateThings = ["XP", g.coinsOpen && "coins", g.skillsOpen && "perks", "kudos counts"].filter((w): w is string => Boolean(w));
  return (
    <Panel label="What teammates see" action={<span className="text-[11px] text-muted-foreground">Public</span>}>
      <div className="flex flex-col gap-3">
        <ProfileCard />
        <p className="text-xs text-muted-foreground">Everyone can see this card. Your {listed(privateThings)} stay with you.</p>
      </div>
    </Panel>
  );
}

function ProfileCard() {
  const { hog, level } = useGearAtLevel();
  const bookOpen = useUnlocked("book");
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-gradient-to-br from-card to-muted p-3 shadow-md">
      <span key={hog.id} className="hud-pop flex shrink-0">
        <hog.Art size={80} title={hog.name} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="hud-display truncate text-lg font-bold leading-tight">{me.name}</span>
          <span className="hud-display shrink-0 text-sm font-bold leading-none">Lv {level}</span>
        </div>
        <span className="truncate text-xs text-muted-foreground">{me.primaryGroup.name}</span>
        {bookOpen && (
          <span className="mt-1.5 flex gap-1" aria-label="Best achievement tiers">
            {bestTiers.map((t, i) => (
              <TierMedal key={i} tier={t} earned size={18} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
