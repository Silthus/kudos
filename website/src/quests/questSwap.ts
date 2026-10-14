import { useEffect, useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { QuestSlot, ShellActions, SwapReply } from "../shell";

export const swapMessages = { refused: "That quest couldn't be swapped.", unreachable: attemptMessages.unreachable } as const;

type SwapLine = { slot: number; text: string };

export type QuestSwap = { sending: number | undefined; announcement: string; lineFor(slot: number): string | undefined; swap(slot: QuestSlot): void };

export function useQuestSwap(swapQuest: ShellActions["swapQuest"], slots: QuestSlot[]): QuestSwap {
  const [sending, setSending] = useState<number>();
  const [line, setLine] = useState<SwapLine>();
  const [landing, setLanding] = useState<number>();
  const [announcement, setAnnouncement] = useState("");

  const landed = landing === undefined ? undefined : slots.find(({ slot, swapped }) => slot === landing && swapped);
  useEffect(() => {
    if (landed === undefined) return;
    setLanding(undefined);
    setAnnouncement(`Swapped. Your new quest: ${landed.goal}.`);
    headingOf(landed.slot)?.focus();
  }, [landed]);

  const answered = (slot: number, reply: SwapReply) => {
    if (reply.kind === "swapped") setLanding(slot);
    if (reply.kind === "refused") setLine({ slot, text: swapMessages.refused });
  };

  const send = async ({ slot, quest }: QuestSlot) => {
    setSending(slot);
    setLine(undefined);
    setAnnouncement("");
    try {
      answered(slot, await swapQuest(quest));
    } catch {
      setLine({ slot, text: swapMessages.unreachable });
    } finally {
      setSending(undefined);
    }
  };

  return {
    sending,
    announcement,
    lineFor: (slot) => (line?.slot === slot ? line.text : undefined),
    swap: (slot) => {
      if (sending === undefined) void send(slot);
    },
  };
}

function headingOf(slot: number) {
  return document.querySelector<HTMLElement>(`main [data-quest-target="${slot}"] h2`);
}
