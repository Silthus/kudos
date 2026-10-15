import { questCrateHomeAttributes } from "../crates/moments";
import { questCrateOf } from "../crates/readyCrates";
import { Done, RewardCrate } from "../crates/RewardCrate";
import { Coins, rewardWords } from "../quests/QuestReward";
import type { JourneyStep } from "../shell";

export function JourneyPanel({ journey }: { journey: JourneyStep[] | null }) {
  if (journey === null || journey.length === 0) return null;
  return (
    <section aria-labelledby="journey-title" className="hud-panel relative flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 id="journey-title" className="hud-label">
        Journey
      </h2>
      <ol className="flex flex-col divide-y">
        {journey.map((step) => (
          <StepItem key={step.step} {...step} />
        ))}
      </ol>
    </section>
  );
}

function StepItem(step: JourneyStep) {
  const { goal, hint, reward, state, seen } = step;
  const crate = questCrateOf(step);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" {...questCrateHomeAttributes(seen)}>
      <h3 className={`text-sm font-medium ${state === "opened" ? "text-muted-foreground" : ""}`}>{goal}</h3>
      {state === "active" && (
        <>
          {hint !== null && <p className="text-xs text-muted-foreground">{hint}</p>}
          <p className="text-xs font-medium tabular-nums">
            {`Pays ${reward.xp} XP`}
            {reward.coins !== undefined && (
              <>
                {" · "}
                <Coins coins={reward.coins} />
              </>
            )}
          </p>
        </>
      )}
      {crate !== undefined && <RewardCrate crate={crate} open="outline" />}
      {state === "opened" && <Done>{`You earned ${rewardWords(reward)}`}</Done>}
    </li>
  );
}
