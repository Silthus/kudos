import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { SlackEmojiMatchesRead } from "../emojiWizardReads";
import type { ShellActions } from "../shell";
import type { AlbumEmoji } from "./answer";
import { AddToSlackButton } from "./AddToSlackButton";
import { SlackEmojiWizard, type WizardPick } from "./SlackEmojiWizard";
import "./emoji.css";

type HeldEmoji = Pick<AlbumEmoji, "id" | "kind" | "name" | "picture" | "from">;

type OpenWizard = (emoji: HeldEmoji, opener: HTMLElement) => void;

const EmojiWizardContext = createContext<OpenWizard | null>(null);

type Open = { emoji: HeldEmoji; opener: HTMLElement };

type HostProps = { on: boolean; emojiPage: string | null; useSlackEmojiMatches: SlackEmojiMatchesRead; mapMyEmoji: ShellActions["mapMyEmoji"]; children: ReactNode };

export function EmojiWizardHost({ on, emojiPage, useSlackEmojiMatches, mapMyEmoji, children }: HostProps) {
  const [open, setOpen] = useState<Open | null>(null);
  const openWizard = useCallback<OpenWizard>((emoji, opener) => setOpen({ emoji, opener }), []);
  const close = () => {
    if (open?.opener.isConnected) open.opener.focus();
    setOpen(null);
  };
  return (
    <EmojiWizardContext value={on ? openWizard : null}>
      {children}
      {on && open !== null && <SlackEmojiWizard emoji={open.emoji} whose="your" takesAnyEmoji={false} emojiPage={emojiPage} useSlackEmojiMatches={useSlackEmojiMatches} pick={async (slackEmoji) => pickOf(await mapMyEmoji(open.emoji.id, slackEmoji))} onClose={close} />}
    </EmojiWizardContext>
  );
}

export function useEmojiWizardOn(): boolean {
  return useContext(EmojiWizardContext) !== null;
}

export function NotInSlack({ emoji, emojiPage }: { emoji: HeldEmoji; emojiPage: string | null }) {
  const openWizard = useContext(EmojiWizardContext);
  if (openWizard === null) return <AddToSlackButton emoji={emoji} emojiPage={emojiPage} />;
  return <FindInSlackButton name={emoji.name} onClick={(opener) => openWizard(emoji, opener)} />;
}

export function FindInSlackButton({ name, onClick }: { name: string; onClick: (opener: HTMLElement) => void }) {
  return (
    <button type="button" className="al-add-to-slack-button ph-no-capture" aria-label={`Find :${name}: in Slack`} onClick={(event) => onClick(event.currentTarget)}>
      Find in Slack
    </button>
  );
}

export function pickOf(reply: { kind: string }): WizardPick {
  if (reply.kind === "mapped") return "mapped";
  return reply.kind === "refused" ? "refused" : "unreachable";
}
