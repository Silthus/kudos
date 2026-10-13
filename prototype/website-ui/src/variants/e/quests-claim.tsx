// Variant E quest claim: the reward crate opening in place of a finished quest, its rewards flying up into the HUD before the quest shows as claimed.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./hud";
import { RewardCrate, type Rewards } from "./unlock-reward";
import type { Reward } from "./quests-data";

const revealMs = 2300;
const flightMs = 750;

export const crateRewards = (reward: Reward, coinsOpen: boolean): Rewards => ({
  xp: reward.xp,
  coins: coinsOpen ? reward.coins : undefined,
  emoji: reward.item?.kind === "emoji" ? reward.item.emoji : undefined,
  hedgehog: reward.item?.kind === "hedgehog" ? reward.item.name : undefined,
});

export function ClaimCrate({ goal, rewards, onClaimed }: { goal: string; rewards: Rewards; onClaimed: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const latestOnClaimed = useRef(onClaimed);
  latestOnClaimed.current = onClaimed;

  useEffect(() => {
    if (!opened) return;
    const fly = setTimeout(() => !reduced && stage.current && flyToHud(stage.current), revealMs);
    const done = setTimeout(() => latestOnClaimed.current(), revealMs + (reduced ? 0 : flightMs));
    return () => {
      clearTimeout(fly);
      clearTimeout(done);
    };
  }, [opened, reduced]);

  return (
    <div ref={stage} className="hud-fade flex flex-col items-center gap-1 py-2 text-center">
      <span className="hud-label">{opened ? "Rewards on the way" : "Your reward crate"}</span>
      <RewardCrate rewards={rewards} name={`Rewards for: ${goal}`} width={150} dropIn autoFocus onOpened={() => setOpened(true)} />
    </div>
  );
}

function hudTarget(text: string) {
  const header = document.querySelector("header");
  const coins = header?.querySelector<HTMLElement>('[title*="coins"]');
  const avatar = header?.querySelector<HTMLElement>('a[href="#/profile"][title]');
  return (text.includes("coins") && coins) || avatar || null;
}

function flyToHud(stage: HTMLElement) {
  const chips = stage.querySelectorAll<HTMLElement>("[aria-live] > span");
  chips.forEach((chip, i) => {
    const target = hudTarget(chip.textContent ?? "");
    if (!target) return;
    const from = chip.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const ghost = chip.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, margin: "0", zIndex: "60", pointerEvents: "none", animation: "none" });
    document.body.appendChild(ghost);
    chip.style.visibility = "hidden";
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const flight = ghost.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.55 - 40}px) scale(0.9)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.2 },
      ],
      { duration: flightMs - 150, delay: i * 90, easing: "cubic-bezier(.5,0,.7,1)", fill: "both" },
    );
    flight.onfinish = () => {
      ghost.remove();
      target.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
    };
  });
}
