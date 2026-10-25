// PROTOTYPE (Silthus/personal#172): where each quests variant mounts in the album, plus the floating switcher. Never merge.
// Round 1: three variants of quests on the website, switchable via ?variant=A|B|C and ?phase=onboarding|weekly, on page D and every album page.
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import { useEffect } from "react";
import { prototypeOn, setPrototypeState, usePrototypeState, variantKeys, type VariantKey } from "./prototypeState";
import { questsShownIn, type QuestPhase } from "./questsFixture";
import { ProfileQuestsA, TopBarQuestsLink } from "./VariantA";
import { FloatingQuestsPanel, ProfileQuestsB } from "./VariantB";
import { ProfileQuestsC, SidebarQuestsDock } from "./VariantC";
import "./questsPrototype.css";

const variantLabels: Record<VariantKey, { name: string; flags: string }> = {
  A: { name: "Top-bar link + modal", flags: "muscle memory: top bar · channel shift: Slack DM" },
  B: { name: "Floating panel", flags: "muscle memory: page content under the panel · channel shift: Slack DM" },
  C: { name: "Sidebar dock", flags: "muscle memory: sidebar team list · channel shift: Slack DM" },
};

function useQuests() {
  const { variant, phase } = usePrototypeState();
  return { variant, quests: questsShownIn(phase) };
}

export function PrototypeProfileQuests() {
  const { variant, quests } = useQuests();
  if (!prototypeOn) return null;
  if (variant === "A") return <ProfileQuestsA quests={quests} />;
  if (variant === "B") return <ProfileQuestsB quests={quests} />;
  return <ProfileQuestsC quests={quests} />;
}

export function PrototypeTopBarQuests() {
  const { variant, quests } = useQuests();
  return prototypeOn && variant === "A" ? <TopBarQuestsLink quests={quests} /> : null;
}

export function PrototypeSidebarQuests() {
  const { variant, quests } = useQuests();
  return prototypeOn && variant === "C" ? <SidebarQuestsDock quests={quests} /> : null;
}

export function PrototypeEveryPage() {
  const { variant, quests } = useQuests();
  if (!prototypeOn) return null;
  return (
    <>
      {variant === "B" && <FloatingQuestsPanel quests={quests} />}
      <PrototypeSwitcher />
    </>
  );
}

function PrototypeSwitcher() {
  const { variant, phase } = usePrototypeState();
  const step = (by: number) => setPrototypeState({ variant: variantKeys[(variantKeys.indexOf(variant) + by + variantKeys.length) % variantKeys.length] });
  useArrowKeys(step);
  const label = variantLabels[variant];
  return (
    <div className="qp-switcher" role="toolbar" aria-label="Prototype variants">
      <button type="button" className="qp-switch-arrow" aria-label="Previous variant" onClick={() => step(-1)}>
        <IconChevronLeft />
      </button>
      <span className="qp-switch-label">
        <strong>
          {variant} ({label.name})
        </strong>
        <span>{label.flags}</span>
      </span>
      <button type="button" className="qp-switch-arrow" aria-label="Next variant" onClick={() => step(1)}>
        <IconChevronRight />
      </button>
      <span className="qp-switch-rule" aria-hidden="true" />
      {(["onboarding", "weekly"] as QuestPhase[]).map((shown) => (
        <button key={shown} type="button" className="qp-switch-phase" aria-pressed={phase === shown} onClick={() => setPrototypeState({ phase: shown })}>
          {shown === "onboarding" ? "Newcomer" : "Weekly"}
        </button>
      ))}
    </div>
  );
}

function useArrowKeys(step: (by: number) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], dialog")) return;
      step(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);
}
