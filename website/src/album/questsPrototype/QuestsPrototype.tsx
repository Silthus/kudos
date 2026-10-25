// PROTOTYPE (Silthus/personal#172): where the quests prototype mounts in the album, plus the floating switcher. Never merge.
// Round 2: B's panel and profile checklist with C's journey and A's copy; the switcher compares how Getting started and the first quests relate (?gs=merge|replace|coexist).
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import { useEffect, useState, type ReactNode } from "react";
import { forgetTheFold, modeKeys, prototypeOn, setPrototypeState, usePrototypeState } from "./prototypeState";
import { questsShownIn, type QuestPhase, type StartedMode } from "./questsFixture";
import { ProfileQuests, QuestsPanel } from "./QuestsPanel";
import "./questsPrototype.css";

const modeLabels: Record<StartedMode, string> = {
  merge: "Merge: Getting started becomes the journey (recommended)",
  replace: "Replace: first quests replace Getting started",
  coexist: "Coexist: Getting started strip beside first quests",
};

const usageFlags = "muscle memory: page content under the panel · channel shift: Slack DM";

function useQuests() {
  const { mode, phase, folded } = usePrototypeState();
  return { mode, folded, quests: questsShownIn(phase, mode) };
}

function firstNameOf(name: string) {
  return name.split(" ")[0] ?? name;
}

export function PrototypeProfileQuests({ name }: { name: string }) {
  const { mode, quests } = useQuests();
  return prototypeOn ? <ProfileQuests quests={quests} mode={mode} firstName={firstNameOf(name)} /> : null;
}

export function PrototypeGettingStarted({ children }: { children: ReactNode }) {
  const { mode, quests } = useQuests();
  if (!prototypeOn) return children;
  return mode === "coexist" && quests.phase === "onboarding" ? children : null;
}

export function PrototypeEveryPage({ name, onOwnProfile }: { name: string; onOwnProfile: boolean }) {
  const { mode, folded, quests } = useQuests();
  const [peekOnProfile, setPeekOnProfile] = useState(false);
  if (!prototypeOn) return null;
  const shownFolded = onOwnProfile ? !peekOnProfile : folded;
  const unfold = () => (onOwnProfile ? setPeekOnProfile(true) : setPrototypeState({ folded: false }));
  const fold = () => (onOwnProfile ? setPeekOnProfile(false) : setPrototypeState({ folded: true }));
  return (
    <>
      <QuestsPanel quests={quests} mode={mode} firstName={firstNameOf(name)} folded={shownFolded} onUnfold={unfold} onFold={fold} />
      <PrototypeSwitcher />
    </>
  );
}

function PrototypeSwitcher() {
  const { mode, phase } = usePrototypeState();
  const step = (by: number) => setPrototypeState({ mode: modeKeys[(modeKeys.indexOf(mode) + by + modeKeys.length) % modeKeys.length] });
  useArrowKeys(step);
  return (
    <div className="qp-switcher" role="toolbar" aria-label="Prototype variants">
      <button type="button" className="qp-switch-arrow" aria-label="Previous variant" onClick={() => step(-1)}>
        <IconChevronLeft />
      </button>
      <span className="qp-switch-label">
        <strong>B · {modeLabels[mode]}</strong>
        <span>{usageFlags}</span>
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
      <button type="button" className="qp-switch-phase" onClick={forgetTheFold} title="Forget the remembered fold, as for a first visit">
        First visit
      </button>
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
