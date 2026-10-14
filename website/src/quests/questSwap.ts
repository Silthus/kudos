import { useEffect, useRef, useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { QuestSlot, ShellActions, SwapReply, WeeklyQuest } from "../shell";

export const swapMessages = { refused: "That quest couldn't be swapped.", unreachable: attemptMessages.unreachable } as const;

type SwapLine = { quest: WeeklyQuest; text: string };

export type QuestSwap = { sending: WeeklyQuest | undefined; announcement: string; lineFor(quest: WeeklyQuest): string | undefined; swap(slot: QuestSlot): void };

export function useQuestSwap(swapQuest: ShellActions["swapQuest"], slots: QuestSlot[]): QuestSwap {
  const pressed = useRef<Element | null>(null);
  const [sending, setSending] = useState<WeeklyQuest>();
  const [line, setLine] = useState<SwapLine>();
  const [landing, setLanding] = useState<WeeklyQuest>();
  const [announcement, setAnnouncement] = useState("");

  const landed = landing === undefined ? undefined : slots.find(({ quest, swapped }) => swapped && sameQuest(quest, landing));
  useEffect(() => {
    if (landed === undefined) return;
    setLanding(undefined);
    setLine(undefined);
    setAnnouncement(`Swapped. Your new quest: ${asSentence(landed.goal)}`);
    headingOf(landed.quest)?.focus();
  }, [landed]);

  useEffect(() => {
    if (line === undefined || pressed.current === null) return;
    const lost = !pressed.current.isConnected;
    pressed.current = null;
    if (lost) headingOf(line.quest)?.focus();
  });

  const say = (quest: WeeklyQuest, text: string) => {
    setLine({ quest, text });
    setAnnouncement(text);
  };

  const answered = (quest: WeeklyQuest, reply: SwapReply) => {
    if (reply.kind === "swapped") setLanding(quest);
    if (reply.kind === "refused") say(quest, swapMessages.refused);
  };

  const send = async ({ quest }: QuestSlot) => {
    pressed.current = document.activeElement;
    setSending(quest);
    setLine(undefined);
    setLanding(undefined);
    setAnnouncement("");
    try {
      answered(quest, await swapQuest(quest));
    } catch {
      say(quest, swapMessages.unreachable);
      setLanding(quest);
    } finally {
      setSending(undefined);
    }
  };

  return {
    sending,
    announcement,
    lineFor: (quest) => (line !== undefined && sameQuest(line.quest, quest) ? line.text : undefined),
    swap: (slot) => {
      if (sending === undefined) void send(slot);
    },
  };
}

export function sameQuest(one: WeeklyQuest, other: WeeklyQuest) {
  return one.week === other.week && one.slot === other.slot;
}

function asSentence(goal: string) {
  return goal.endsWith(".") ? goal : `${goal}.`;
}

function headingOf({ slot }: WeeklyQuest) {
  return document.querySelector<HTMLElement>(`main [data-quest-target="${slot}"] h2`);
}
