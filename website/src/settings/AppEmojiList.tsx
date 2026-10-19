import { Button } from "@posthog/quill";
import { useState } from "react";
import type { AppEmoji, AppEmojis } from "../../../convex/website/emojiWizard";
import { pickOf } from "../album/findInSlack";
import { SlackEmojiWizard } from "../album/SlackEmojiWizard";
import type { AppEmojisRead, SlackEmojiMatchesRead } from "../emojiWizardReads";
import { Panel } from "../home/Panel";
import type { ShellActions } from "../shell";

type MapSlackEmoji = ShellActions["mapSlackEmoji"];

type Tab = "not-mapped" | "mapped";

type Open = { emoji: AppEmoji; opener: HTMLElement };

type Reads = { useAppEmojis: AppEmojisRead; useSlackEmojiMatches: SlackEmojiMatchesRead; mapSlackEmoji: MapSlackEmoji };

const sectionId = "app-emojis";

const sectionLabel = "App emojis in Slack";

const emojisShownAtMost = 50;

export function AppEmojiSection({ useAppEmojis, ...reads }: Reads) {
  const answer = useAppEmojis(true);
  if (answer === undefined || answer.kind === "connecting") return null;
  if (answer.kind === "broken")
    return (
      <Panel id={sectionId} label={sectionLabel}>
        <p className="text-sm text-muted-foreground">The app emojis didn't load. Try again in a moment.</p>
      </Panel>
    );
  if (answer.kind !== "app-emojis") return null;
  return <AppEmojiList answer={answer} {...reads} />;
}

function AppEmojiList({ answer: { emojis, emojiPage }, useSlackEmojiMatches, mapSlackEmoji }: { answer: AppEmojis } & Omit<Reads, "useAppEmojis">) {
  const [tab, setTab] = useState<Tab>("not-mapped");
  const [shown, setShown] = useState(emojisShownAtMost);
  const [open, setOpen] = useState<Open | null>(null);
  const notMapped = emojis.filter(({ slack }) => slack === null);
  const mapped = emojis.filter(({ slack }) => slack !== null);
  const listed = tab === "not-mapped" ? notMapped : mapped;
  const choose = (next: Tab) => {
    setTab(next);
    setShown(emojisShownAtMost);
  };
  const close = () => {
    if (open?.opener.isConnected) open.opener.focus();
    setOpen(null);
  };
  return (
    <Panel id={sectionId} label={sectionLabel}>
      <p className="text-sm text-muted-foreground">Every emoji members can earn, most held first. Find each one's Slack emoji so everyone who has it can use it in Slack. Members map the ones they hold too; you can change theirs or undo it.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "not-mapped" ? "primary" : "outline"} size="sm" aria-pressed={tab === "not-mapped"} onClick={() => choose("not-mapped")}>
          {`Not mapped · ${notMapped.length}`}
        </Button>
        <Button variant={tab === "mapped" ? "primary" : "outline"} size="sm" aria-pressed={tab === "mapped"} onClick={() => choose("mapped")}>
          {`Mapped · ${mapped.length}`}
        </Button>
      </div>
      {listed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tab === "not-mapped" ? "Every app emoji has its Slack emoji." : "No app emoji has a Slack emoji yet."}</p>
      ) : (
        <ul aria-label={tab === "not-mapped" ? "Not mapped emojis" : "Mapped emojis"} className="ph-no-capture max-h-[36rem] divide-y overflow-y-auto rounded-lg border">
          {listed.slice(0, shown).map((emoji) => (
            <AppEmojiRow key={emoji.key} emoji={emoji} onFind={(opener) => setOpen({ emoji, opener })} mapSlackEmoji={mapSlackEmoji} />
          ))}
        </ul>
      )}
      {listed.length > shown && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setShown(shown + emojisShownAtMost)}>
            {`Show ${Math.min(listed.length - shown, emojisShownAtMost)} more`}
          </Button>
        </div>
      )}
      {open !== null && <SlackEmojiWizard emoji={open.emoji} whose="the" takesAnyEmoji emojiPage={emojiPage} useSlackEmojiMatches={useSlackEmojiMatches} pick={async (slackEmoji) => pickOf(await mapSlackEmoji(slackEmoji, open.emoji.place))} onClose={close} />}
    </Panel>
  );
}

function AppEmojiRow({ emoji, onFind, mapSlackEmoji }: { emoji: AppEmoji; onFind: (opener: HTMLElement) => void; mapSlackEmoji: MapSlackEmoji }) {
  const { name, picture, slack } = emoji;
  const [undo, setUndo] = useState<"idle" | "undoing" | "refused">("idle");
  const memberSetIt = slack?.setBy?.by === "member" ? slack.setBy.name : null;
  const undoIt = async () => {
    setUndo("undoing");
    setUndo(pickOf(await mapSlackEmoji(name, { kind: "unmapped" })) === "mapped" ? "idle" : "refused");
  };
  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={slack?.image ?? picture} alt="" loading="lazy" className="size-7 shrink-0 object-contain" />
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-sm font-semibold">{`:${name}:`}</h3>
            <p className="text-xs text-muted-foreground">{wordsOf(emoji)}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" aria-label={slack === null ? `Find :${name}: in Slack` : `Change :${name}:'s Slack emoji`} onClick={(event) => onFind(event.currentTarget)}>
            {slack === null ? "Find in Slack" : "Change"}
          </Button>
          {memberSetIt !== null && (
            <Button variant="outline" size="sm" aria-label={`Undo ${memberSetIt}'s mapping of :${name}:`} disabled={undo === "undoing"} onClick={() => void undoIt()}>
              Undo
            </Button>
          )}
        </div>
      </div>
      {undo === "refused" && (
        <p role="alert" className="text-xs text-muted-foreground">
          That didn't undo. Reload the page to see where it stands.
        </p>
      )}
    </li>
  );
}

function wordsOf({ kind, from, holders, slack }: AppEmoji): string {
  return [whatEarnsIt(kind, from), holdersWords(holders), ...(slack === null ? [] : [setByWords(slack.setBy)])].join(" · ");
}

function whatEarnsIt(kind: AppEmoji["kind"], from: string): string {
  if (kind === "team") return `${from} team`;
  if (kind === "hype") return `${from}'s hype`;
  if (kind === "milestone") return `${from} medal`;
  return from;
}

function holdersWords(holders: number): string {
  if (holders === 0) return "nobody yet";
  return holders === 1 ? "1 holds it" : `${holders} hold it`;
}

function setByWords(setBy: NonNullable<AppEmoji["slack"]>["setBy"]): string {
  if (setBy === null) return "same name in Slack";
  return setBy.by === "maintainer" ? "set by you" : `set by ${setBy.name}`;
}
