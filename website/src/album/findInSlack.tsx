import { createContext, useCallback, useContext, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { SlackEmojiMatchesRead } from "../emojiWizardReads";
import type { ShellActions } from "../shell";
import type { AlbumEmoji } from "./answer";
import { AddToSlackButton } from "./AddToSlackButton";
import { SlackEmojiWizard, type WizardPick } from "./SlackEmojiWizard";
import "./emoji.css";

type HeldEmoji = Pick<AlbumEmoji, "id" | "kind" | "name" | "picture" | "from">;

type OpenWizard = (emoji: HeldEmoji, opener: HTMLElement) => void;

type EmojiWizard = { open: OpenWizard; emojis: AlbumEmoji[] };

const EmojiWizardContext = createContext<EmojiWizard | null>(null);

type Open = { emoji: HeldEmoji; opener: HTMLElement; fallback: HTMLElement | null };

type HostProps = { on: boolean; emojis: AlbumEmoji[]; emojiPage: string | null; useSlackEmojiMatches: SlackEmojiMatchesRead; mapMyEmoji: ShellActions["mapMyEmoji"]; children: ReactNode };

export function EmojiWizardHost({ on, emojis, emojiPage, useSlackEmojiMatches, mapMyEmoji, children }: HostProps) {
  const [open, setOpen] = useState<Open | null>(null);
  const openWizard = useCallback<OpenWizard>((emoji, opener) => setOpen({ emoji, opener, fallback: opener.closest<HTMLElement>('[role="region"], [role="dialog"], section, main') }), []);
  const wizard = useMemo(() => ({ open: openWizard, emojis }), [openWizard, emojis]);
  const close = () => {
    if (open !== null) giveFocusBack(open.opener, open.fallback);
    setOpen(null);
  };
  return (
    <EmojiWizardContext value={on ? wizard : null}>
      {children}
      {on && open !== null && <SlackEmojiWizard emoji={open.emoji} whose="your" takesAnyEmoji={false} emojiPage={emojiPage} useSlackEmojiMatches={useSlackEmojiMatches} pick={async (slackEmoji) => pickOf(await mapMyEmoji(open.emoji.id, slackEmoji))} onClose={close} />}
    </EmojiWizardContext>
  );
}

export function useEmojiWizardOn(): boolean {
  return useContext(EmojiWizardContext) !== null;
}

type ShownEmoji = HeldEmoji & Pick<AlbumEmoji, "inSlack">;

export function useLiveEmoji<Shown extends ShownEmoji>(emoji: Shown): Shown;
export function useLiveEmoji<Shown extends ShownEmoji>(emoji: Shown | null): Shown | null;
export function useLiveEmoji<Shown extends ShownEmoji>(emoji: Shown | null): Shown | null {
  const wizard = useContext(EmojiWizardContext);
  const live = emoji === null ? undefined : wizard?.emojis.find(({ id }) => id === emoji.id);
  return emoji === null || live === undefined ? emoji : { ...emoji, name: live.name, picture: live.picture, inSlack: live.inSlack };
}

export function NotInSlack({ emoji, emojiPage }: { emoji: HeldEmoji; emojiPage: string | null }) {
  const wizard = useContext(EmojiWizardContext);
  if (wizard === null) return <AddToSlackButton emoji={emoji} emojiPage={emojiPage} />;
  return <FindInSlackButton name={emoji.name} onClick={(opener) => wizard.open(emoji, opener)} />;
}

export function FindInSlackWhileOn({ emoji }: { emoji: ShownEmoji }) {
  const wizard = useContext(EmojiWizardContext);
  const live = useLiveEmoji(emoji);
  if (wizard === null || live.inSlack) return null;
  return <FindInSlackButton name={live.name} onClick={(opener) => wizard.open(live, opener)} />;
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
