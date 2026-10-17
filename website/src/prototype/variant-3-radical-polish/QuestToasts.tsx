// PROTOTYPE (#625): the "Quest complete" toast with a light confetti burst. Never merge to main.
import { IconX } from "@posthog/icons";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Quest } from "../world";
import { PackGlyph } from "./PackGlyph";
import { useStage } from "./stage";
import { questHeading, questTag, rewardWords } from "./words";

const confettiColours = ["#F54E00", "#F7A501", "#1D4AFF", "#1f8a3b", "#7c3aed", "#23251D"];

const confetti = Array.from({ length: 16 }, (_, piece) => {
  const angle = (piece / 16) * Math.PI * 2;
  const reach = 46 + (piece % 4) * 14;
  return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach * 0.7) - 10, colour: confettiColours[piece % confettiColours.length]!, turn: (piece * 47) % 360 };
});

export function useFinishedQuests(quests: Quest[]) {
  const states = useRef(new Map(quests.map(({ id, state }) => [id, state])));
  const [finished, setFinished] = useState<Quest[]>([]);
  useEffect(() => {
    const justFinished = quests.filter(({ id, state }) => state === "finished" && states.current.get(id) === "active");
    states.current = new Map(quests.map(({ id, state }) => [id, state]));
    if (justFinished.length > 0) setFinished((shown) => [...shown, ...justFinished]);
  }, [quests]);
  const dismiss = useCallback((id: string) => setFinished((shown) => shown.filter((quest) => quest.id !== id)), []);
  return { finished, dismiss };
}

export function QuestToasts({ finished, onDismiss }: { finished: Quest[]; onDismiss: (id: string) => void }) {
  return (
    <div className="v3-toasts" aria-live="polite">
      {finished.map((quest) => (
        <QuestToast key={quest.id} quest={quest} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function QuestToast({ quest, onDismiss }: { quest: Quest; onDismiss: (id: string) => void }) {
  const { openPack } = useStage();
  const dismiss = () => onDismiss(quest.id);
  useEffect(() => {
    const gone = setTimeout(() => onDismiss(quest.id), 6000);
    return () => clearTimeout(gone);
  }, [onDismiss, quest.id]);
  return (
    <div className="v3-toast" role="status">
      <span className="v3-confetti" aria-hidden="true">
        {confetti.map((piece, index) => (
          <span key={index} style={{ "--x": `${piece.x}px`, "--y": `${piece.y}px`, "--turn": `${piece.turn}deg`, background: piece.colour } as CSSProperties} />
        ))}
      </span>
      <PackGlyph size={34} />
      <div className="v3-toast-text">
        <p className="v3-toast-title">Quest complete</p>
        <p className="v3-toast-body">{`${questTag[quest.source]} · ${questHeading(quest)}`}</p>
        <p className="v3-toast-reward">{`${rewardWords(quest.reward)} · pack ready`}</p>
      </div>
      <button
        type="button"
        className="v3-button v3-button-primary v3-button-small"
        onClick={() => {
          dismiss();
          openPack(`pack:${quest.id}`, `${questTag[quest.source]} reward`);
        }}
      >
        Open
      </button>
      <button type="button" className="v3-toast-close" aria-label="Dismiss" onClick={dismiss}>
        <IconX className="v3-link-icon" />
      </button>
    </div>
  );
}
