import { Button, Switch } from "@posthog/quill";
import { useId, useRef, useState, type FormEvent } from "react";
import { Panel } from "./Panel";
import type { ShellActions, WeeklyPostChannelReply, WeeklyPostReply, WeeklyPostSetting } from "../shell";
import { switchLook } from "./MessageSettingRow";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type WeeklyPostProps = { setting: WeeklyPostSetting; setWeeklyPost: ShellActions["setWeeklyPost"]; pickWeeklyPostChannel: ShellActions["pickWeeklyPostChannel"] };

type ChannelPick = NonNullable<WeeklyPostSetting["channelPick"]>;

type ChannelCheck = NonNullable<ChannelPick["check"]>;

const postNamed: Record<WeeklyPostSetting["posts"], string> = { groups: "last week's top groups", topKudos: "last week's top kudos" };

const landedLines = { on: "Switched on. The next one goes out on Monday at 9:00.", off: "Switched off. Nothing goes out until it's switched on again." };

const announcementChannel = "the announcement channel";

export function WeeklyPost({ setting, setWeeklyPost, pickWeeklyPostChannel }: WeeklyPostProps) {
  const { on, timeZone, posts, channelLink, cantPost, channelPick } = setting;
  const picked = channelPick?.picked ?? null;
  const { pending, settled, choose } = useSentChoice(on, async (asked: boolean) => answerOf(await setWeeklyPost(asked)));
  return (
    <Panel id="weekly-post" label="Weekly post">
      <p className="text-sm break-words text-muted-foreground">
        Every Monday at 9:00, {timeZone.replaceAll("_", " ")} time, I {on ? "post" : "can post"} {postNamed[posts]} in <PostChannel link={channelLink} picked={picked} />.
      </p>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold sm:max-w-sm">
        Post it every Monday
        <Switch size="sm" className={`${switchLook} shrink-0`} checked={on} disabled={pending} onCheckedChange={(asked) => void choose(asked)} />
      </label>
      <StatusLine line={lineAfter(settled, on ? landedLines.on : landedLines.off)} />
      {cantPost && <p className="text-sm break-words text-muted-foreground">{cantPostLineOf(channelPick)}</p>}
      {channelPick !== undefined && <ChannelPicker pick={channelPick} pickWeeklyPostChannel={pickWeeklyPostChannel} />}
    </Panel>
  );
}

function PostChannel({ link, picked }: { link: string | null; picked: string | null }) {
  const name = channelNameOf(picked);
  if (link === null) return <>{name}</>;
  return (
    <a href={link} target="_blank" rel="noreferrer" className="ph-no-capture font-medium text-foreground underline underline-offset-2">
      {name}
    </a>
  );
}

function cantPostLineOf(channelPick: ChannelPick | undefined) {
  if (channelPick === undefined) return "I can't post in the announcement channel. Add me to it, or ask a workspace admin to pick another channel in App Home's Admin tab.";
  if (channelPick.picked === null) return "I can't post in the announcement channel. Add me to it, or pick another channel below.";
  return `I can't post in ${channelNameOf(channelPick.picked)}. Pick another channel below.`;
}

function channelNameOf(picked: string | null) {
  return picked === null ? announcementChannel : `#${picked}`;
}

type ChannelPickerProps = { pick: ChannelPick; pickWeeklyPostChannel: ShellActions["pickWeeklyPostChannel"] };

const checkLines: Record<Exclude<ChannelCheck, "picked">, string> = {
  checking: "Checking the channel…",
  private: "That channel is private. I only post in public channels, since the post quotes public kudos.",
  shared: "That channel is shared with another organization. I only post in this workspace's own channels, since the post quotes kudos.",
  customer: "That's a customer channel. I stay out of customer channels, since the post quotes kudos.",
  "not-found": "I couldn't find that channel in this workspace. Check the link and try again.",
  archived: "That channel is archived. Pick another one.",
  failed: "Slack didn't answer about that channel. Try again.",
};

const notAChannelLinkLine = "That isn't a link to a Slack channel. Copy it from the channel in Slack.";

function ChannelPicker({ pick, pickWeeklyPostChannel }: ChannelPickerProps) {
  const [link, setLink] = useState("");
  const { pending, attempt, send } = useSentPick(pick, pickWeeklyPostChannel);
  const [clearedFor, setClearedFor] = useState(0);
  if (attempt !== null && attempt.id !== clearedFor && hasLanded(attempt, pick) && pick.check === "picked") {
    setClearedFor(attempt.id);
    if (link === attempt.link) setLink("");
  }
  const id = useId();
  const hintId = `${id}-hint`;
  const sendable = !pending && link.trim() !== "";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sendable) await send(link);
  };
  return (
    <form aria-label="Weekly post channel" onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 sm:max-w-sm">
      <label htmlFor={id} className="text-sm font-medium">
        Post it in another channel
      </label>
      <input id={id} aria-describedby={hintId} type="text" inputMode="url" autoComplete="off" spellCheck={false} readOnly={pending} value={link} onChange={(event) => setLink(event.target.value)} className={inputClass} />
      <p id={hintId} className="text-xs text-muted-foreground">
        In Slack, right-click a public channel and pick Copy, then Copy link. Paste it here.
      </p>
      <div>
        <Button type="submit" variant="primary" disabled={!sendable}>
          Use this channel
        </Button>
      </div>
      <StatusLine line={lineOf(attempt, pick)} />
    </form>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-muted-foreground bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type Attempt = { id: number; link: string; before: number; answer: PickAnswer | null };

type PickAnswer = { kind: "checking"; pick: number } | { kind: "refused"; line: string } | { kind: "unreachable" };

function useSentPick(pick: ChannelPick, pickWeeklyPostChannel: ShellActions["pickWeeklyPostChannel"]) {
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const attempts = useRef(0);
  const latestSentPick = useRef(0);

  const send = async (link: string) => {
    if (pending) return;
    setPending(true);
    attempts.current += 1;
    const sent = { id: attempts.current, link, before: Math.max(pick.pick, latestSentPick.current) };
    setAttempt({ ...sent, answer: null });
    try {
      const answer = pickAnswerOf(await pickWeeklyPostChannel(link));
      if (answer.kind === "checking") latestSentPick.current = Math.max(latestSentPick.current, answer.pick);
      setAttempt({ ...sent, answer });
    } catch {
      setAttempt({ ...sent, answer: { kind: "unreachable" } });
    } finally {
      setPending(false);
    }
  };

  return { pending, attempt, send };
}

function hasLanded({ before, answer }: Attempt, read: ChannelPick) {
  if (answer?.kind === "refused") return false;
  return answer?.kind === "checking" ? read.pick >= answer.pick : read.pick > before;
}

function pickAnswerOf(reply: WeeklyPostChannelReply): PickAnswer {
  if (reply.kind === "checking") return reply;
  if (reply.kind === "refused") return { kind: "refused", line: reply.reason === "not-a-channel-link" ? notAChannelLinkLine : lineAfter("refused", "") };
  return { kind: "refused", line: "" };
}

function lineOf(attempt: Attempt | null, read: ChannelPick): string {
  if (attempt === null) return "";
  if (hasLanded(attempt, read) && read.check !== null) return read.check === "picked" ? `Picked ${channelNameOf(read.picked)}.` : checkLines[read.check];
  if (attempt.answer?.kind === "refused") return attempt.answer.line;
  if (attempt.answer?.kind === "unreachable") return lineAfter("unreachable", "");
  return checkLines.checking;
}

function answerOf(reply: WeeklyPostReply): Answer {
  if (reply.kind === "set") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}
