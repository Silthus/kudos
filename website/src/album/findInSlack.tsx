import { createContext, useCallback, useContext, useState, type MouseEvent, type ReactNode } from "react";
import type { SlackEmojiMatchesRead } from "../emojiWizardReads";
import type { ShellActions } from "../shell";
import type { AlbumEmoji } from "./answer";
import { AddToSlackButton } from "./AddToSlackButton";
import { SlackEmojiWizard, type WizardPick } from "./SlackEmojiWizard";
import "./emoji.css";

type HeldEmoji = Pick<AlbumEmoji, "id" | "kind" | "name" | "picture" | "from">;

type OpenWizard = (emoji: HeldEmoji, opener: HTMLElement) => void;

const EmojiWizardContext = createContext<OpenWizard | null>(null);

type Open = { emoji: HeldEmoji; opener: HTMLElement; fallback: HTMLElement | null };

type HostProps = { on: boolean; emojiPage: string | null; useSlackEmojiMatches: SlackEmojiMatchesRead; mapMyEmoji: ShellActions["mapMyEmoji"]; children: ReactNode };

export function EmojiWizardHost({ on, emojiPage, useSlackEmojiMatches, mapMyEmoji, children }: HostProps) {
  const [open, setOpen] = useState<Open | null>(null);
  const openWizard = useCallback<OpenWizard>((emoji, opener) => setOpen({ emoji, opener, fallback: opener.closest<HTMLElement>('[role="region"], [role="dialog"], section, main') }), []);
  const close = () => {
    if (open !== null) giveFocusBack(open.opener, open.fallback);
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

export function FindInSlackWhileOn({ emoji }: { emoji: HeldEmoji & Pick<AlbumEmoji, "inSlack"> }) {
  const openWizard = useContext(EmojiWizardContext);
  if (openWizard === null || emoji.inSlack) return null;
  return <FindInSlackButton name={emoji.name} onClick={(opener) => openWizard(emoji, opener)} />;
}

export function FindInSlackButton({ name, onClick }: { name: string; onClick: (opener: HTMLElement) => void }) {
  const open = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick(event.currentTarget);
  };
  return (
    <button type="button" className="al-add-to-slack-button ph-no-capture" aria-label={`Find :${name}: in Slack`} onClick={open}>
      Find in Slack
    </button>
  );
}

export function giveFocusBack(opener: HTMLElement, fallback: HTMLElement | null) {
  if (opener.isConnected) return opener.focus();
  if (fallback === null || !fallback.isConnected) return;
  if (!fallback.hasAttribute("tabindex")) fallback.setAttribute("tabindex", "-1");
  fallback.focus();
}

export function pickOf(reply: { kind: string }): WizardPick {
  if (reply.kind === "mapped") return "mapped";
  return reply.kind === "refused" ? "refused" : "unreachable";
}
