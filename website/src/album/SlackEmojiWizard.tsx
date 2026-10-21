import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { SlackEmojiMatch } from "../../../convex/album/emojiWizard";
import type { SlackEmojiMatchesRead, SlackEmojiMatchesShown } from "../emojiWizardReads";
import type { AlbumEmoji } from "./answer";
import { AddToSlackButton } from "./AddToSlackButton";
import { EmojiPicture } from "./EmojiPicture";
import { keepFocusIn } from "./focusTrap";
import "./wizard.css";

export type WizardEmoji = Pick<AlbumEmoji, "kind" | "name" | "picture" | "from">;

export type MappingPick = "mapped" | "refused" | "unreachable";

export type WizardPick = MappingPick | { refused: string };

export type InUse = "takes" | "skips" | "asks";

export type SlackEmojiWizardProps = {
  emoji: WizardEmoji;
  whose: "your" | "the";
  inUse: InUse;
  changes: boolean;
  named?: string;
  emojiPage: string | null;
  useSlackEmojiMatches: SlackEmojiMatchesRead;
  pick: (slackEmoji: string) => Promise<WizardPick>;
  onClose: () => void;
};

type Step = { kind: "picking" } | { kind: "saving"; name: string } | { kind: "mapped"; name: string } | { kind: "refused"; why: string | null } | { kind: "unreachable" };

const searchSettlesMs = 250;

export function SlackEmojiWizard({ emoji, whose, inUse, changes, named, emojiPage, useSlackEmojiMatches, pick, onClose }: SlackEmojiWizardProps) {
  const title = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<Step>({ kind: "picking" });
  const settledSearch = useSettled(search.trim());
  const matches = useSlackEmojiMatches(emoji.name, settledSearch);
  const words = named ?? `${whose} ${wordsOf(emoji)}`;
  useEffect(() => searchField.current?.focus(), []);
  const answered = (next: Step) => {
    setStep(next);
    if (next.kind !== "mapped") searchField.current?.focus();
  };
  const choose = (name: string) => {
    if (step.kind === "saving") return;
    setStep({ kind: "saving", name });
    pick(name).then(
      (answer) => answered(stepAfter(answer, name)),
      () => answered({ kind: "unreachable" }),
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
    if (event.key === "Tab") keepFocusIn(dialog.current, event);
  };
  return (
    <div className="al-wizard-backdrop" onPointerDown={(event) => closeOnTheBackdrop(event, onClose)}>
      <div ref={dialog} className="al-wizard ph-no-capture" role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={onKeyDown}>
        <header className="al-wizard-head">
          <EmojiPicture emoji={emoji} size={40} />
          <div className="al-wizard-words">
            <h2 id={title} className="al-wizard-title">{`${changes ? "Change" : "Find"} ${named ?? `:${emoji.name}:`} in Slack`}</h2>
            <p className="al-wizard-hint">{`Pick the Slack emoji that is ${words}. Everyone who has it can use it in Slack at once.`}</p>
          </div>
          <button type="button" className="al-wizard-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        {step.kind === "mapped" ? (
          <Mapped said={`Done. :${step.name}: is ${words} in Slack now.`} onClose={onClose} />
        ) : (
          <>
            <label className="al-wizard-search">
              Search Slack's emojis
              <input ref={searchField} type="search" value={search} placeholder={`:${emoji.name}:`} onChange={(event) => setSearch(event.target.value)} />
            </label>
            {(step.kind === "refused" || step.kind === "unreachable") && (
              <p role="alert" className="al-wizard-problem">
                {step.kind === "refused" ? (step.why ?? refusalWordsOf(whose)) : "Couldn't reach HedgeHug. Try again."}
              </p>
            )}
            <Matches emoji={emoji} matches={matches} search={settledSearch} inUse={inUse} saving={step.kind === "saving" ? step.name : null} emojiPage={emojiPage} onPick={choose} />
          </>
        )}
      </div>
    </div>
  );
}

function stepAfter(answer: WizardPick, name: string): Step {
  if (answer === "mapped") return { kind: "mapped", name };
  if (answer === "unreachable") return { kind: "unreachable" };
  return { kind: "refused", why: answer === "refused" ? null : answer.refused };
}

function refusalWordsOf(whose: SlackEmojiWizardProps["whose"]) {
  if (whose === "the") return "That didn't save. The Slack emoji may be gone from Slack, or only the workspace maintainer can map emojis. Pick another one.";
  return "That didn't save. It may be mapped already, or the maintainer set this one. Pick another one.";
}

function closeOnTheBackdrop(event: PointerEvent<HTMLDivElement>, onClose: () => void) {
  event.stopPropagation();
  if (event.target === event.currentTarget) onClose();
}

function Mapped({ said, onClose }: { said: string; onClose: () => void }) {
  const done = useRef<HTMLButtonElement>(null);
  const saidId = useId();
  useEffect(() => done.current?.focus(), []);
  return (
    <div className="al-wizard-done">
      <p id={saidId} role="status">
        {said}
      </p>
      <button ref={done} type="button" className="al-add-to-slack-button" aria-describedby={saidId} onClick={onClose}>
        Done
      </button>
    </div>
  );
}

type MatchesProps = { emoji: WizardEmoji; matches: SlackEmojiMatchesShown | undefined; search: string; inUse: InUse; saving: string | null; emojiPage: string | null; onPick: (name: string) => void };

function Matches({ emoji, matches, search, inUse, saving, emojiPage, onPick }: MatchesProps) {
  if (matches === undefined || matches.kind === "connecting") return <p className="al-wizard-quiet">Looking in Slack…</p>;
  if (matches.kind !== "matches") return <p className="al-wizard-quiet">Slack's emojis didn't load. Try again in a moment.</p>;
  const pickable = (match: SlackEmojiMatch) => (inUse === "skips" ? match.free : match.name !== emoji.name);
  if (matches.matches.length === 0) return <NoneFound emoji={emoji} said={search === "" ? `No Slack emoji has a name like :${emoji.name}:. Search for one, or add this one to Slack under its name.` : `No Slack emoji found for “${search}”. Add this one to Slack under its name.`} emojiPage={emojiPage} />;
  return (
    <>
      <p className="al-wizard-quiet">{search === "" ? "Closest names in Slack" : "Found in Slack"}</p>
      <ul className="al-wizard-matches" aria-label="Slack emojis">
        {matches.matches.map((match) => (
          <li key={match.name}>
            <button type="button" className="al-wizard-match" aria-label={matchLabelOf(match, emoji.name)} title={`:${match.name}:`} disabled={!pickable(match)} aria-disabled={saving !== null || undefined} onClick={() => onPick(match.name)}>
              <img src={match.image} alt="" width={28} height={28} loading="lazy" decoding="async" />
              <code>{saving === match.name ? "Saving…" : `:${match.name}:`}</code>
              {!match.free && <span className="al-wizard-in-use">{match.name === emoji.name ? "Current" : "In use"}</span>}
            </button>
          </li>
        ))}
      </ul>
      {inUse === "takes" && matches.matches.some((match) => !match.free && match.name !== emoji.name) && <p className="al-wizard-quiet">Picking one in use gives it to this emoji: an earned emoji that had it moves to a free name, and a random drop or a held-back name stops being one.</p>}
      {!matches.matches.some((match) => pickable(match) || match.name === emoji.name) && <NoneFound emoji={emoji} said={`Every Slack emoji found${search === "" ? "" : ` for “${search}”`} is in use. Add this one to Slack under its name.`} emojiPage={emojiPage} />}
    </>
  );
}

function matchLabelOf(match: SlackEmojiMatch, current: string) {
  if (match.free) return `Map to :${match.name}:`;
  return match.name === current ? `Map to :${match.name}:, current` : `Map to :${match.name}:, in use`;
}

function NoneFound({ emoji, said, emojiPage }: { emoji: WizardEmoji; said: string; emojiPage: string | null }) {
  return (
    <div className="al-wizard-none">
      <p>{said}</p>
      <AddToSlackButton emoji={emoji} emojiPage={emojiPage} />
    </div>
  );
}

function wordsOf({ kind, from }: WizardEmoji): string {
  if (kind === "team") return `${from} team emoji`;
  if (kind === "hype") return `hype emoji for ${from}`;
  if (kind === "milestone") return `${from} medal emoji`;
  return `${from} emoji`;
}

function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), searchSettlesMs);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}
