import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, EyeOff, Hash, Pencil, SendHorizontal, Terminal } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { Avatar, Button, RarityBadge, Segmented } from "@/components/ui";
import { workspaceClockNow } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { CATEGORY_LABEL, RARITY_META, type Rarity } from "@/lib/rarity";
import { useViewer } from "@/lib/viewer";
import { Earnings, GainLines, LevelUpHoggie } from "@/components/game";
import { SpreePost } from "@/components/SpreePost";
import type { Id } from "../../convex/_generated/dataModel";
import { SUPER_SUFFIX, variantBySuffix } from "../../convex/lib/cosmetics";
import { isSimulatorWorkspace, shownSimulator } from "@/world/simulator";
import { SimulatorClock } from "@/world/SimulatorClock";
import { SimulatorTab } from "./SimulatorTab";

/**
 * The sandbox (#133): a Slack terminal standing in the sand, running the real kudos engine against
 * the shared demo workspace. You post in #general; the Kudos bot reacts on your message, replies
 * only to you where you gave, and its DMs pile up beside the terminal as a stack of envelopes. The
 * terminal is a mock of Slack, so it keeps Slack's look and emoji (`data-user-text`); the copy
 * round it is the world's. The demo controls stand in the sand as small signs.
 *
 * Two pixel tabs (#144): the Playground, and the Simulator (`?tab=simulator`), where you start your
 * own private simulator. Inside a simulator the Playground gives there, as it does in the demo.
 */

type BotMessage = {
  _id: string;
  to: string;
  toMe: boolean;
  category: string;
  rarity: string;
  text: string;
  isNewDiscovery: boolean;
  questProgress?: { completed: number; available: number; sweep: boolean };
  /** Your reply while the game is on: what the kudos earned. */
  earnings?: string;
  /** What its member gained in this kudos, riding along in their kudos DM. */
  gains?: string[];
  /** A DM with gains: what it's about ("Level up", "New discovery", ...). */
  gainLabel?: string;
  /** A Super kudos (#98): the receiver's celebration, or your note on what your Super kudos emoji did. */
  superKudos?: { kind: "celebration" | "sent" | "howto"; text: string };
};
type Outcome = "given" | "limit" | "invalid";

/** A DM of game gains alone (a level-up, a new message discovered, ...): no rolled message, no rarity. */
const gainsOnly = (m: BotMessage) => m.category === "gains" || m.category === "level_up";
type FeedItem = {
  id: string;
  author: string;
  slackUserId: string;
  text: string;
  mine: boolean;
  at: number;
  /** The Kudos bot's reaction on a kudos attempt. */
  outcome?: Outcome;
  /** An ephemeral reply from the Kudos bot, only visible to you. */
  ephemeral?: boolean;
  /** On the bot's reply to your kudos: what it earned ("+20 XP, new connection +10"). */
  earnings?: string;
  /** On the bot's reply to your kudos: what your Super kudos emoji did (#98). */
  superNote?: string;
  /** The bot confirmed a Super kudos with the Super kudos emoji. */
  superReaction?: boolean;
  /** Your kudos attempt as sent (Slack format), so you can edit it like in Slack. */
  sent?: { messageTs: string; slackText: string };
  edited?: boolean;
  /** The bot's public reply in a kudos' thread (a spree reached a tier). */
  threadReply?: boolean;
};

type AttemptReply = { outcome: Outcome; reaction?: string; guidance: string | null } | null;

/** What the bot's reaction on your message means (the kudos emoji itself for "given"). */
const REACTIONS: Record<Outcome, { glyph?: string; label: string }> = {
  given: { label: "Kudos given" },
  limit: { glyph: "⏳", label: "Over today's allowance, nothing was sent" },
  invalid: { glyph: "❌", label: "Not a valid kudos, nothing was sent" },
};

const CHANNEL_POSTS: Omit<FeedItem, "at" | "mine">[] = [
  { id: "p1", author: "Priya Raman", slackUserId: "UDEMOPRIYA", text: "Shipped the new onboarding flow 🚀 conversion is up 12% in the first hour" },
  { id: "p2", author: "Freya Lindqvist", slackUserId: "UDEMOFREYA", text: "Customer just renewed for 3 more years and specifically called out our support team 💛" },
  { id: "p3", author: "Samir Haddad", slackUserId: "UDEMOSAMIR", text: "Incident resolved. Root cause was a stale DNS entry. Postmortem doc incoming." },
];

const EXAMPLES = [
  { label: "Thank two people", build: (e: string) => `@Priya Raman @Jonas Weber ${e}${e} the release went out without a single hiccup` },
  { label: "One for Lena", build: (e: string) => `@Lena Hoffmann ${e} thanks for organising the offsite!` },
  { label: "Try yourself", build: (e: string) => `@Alex Rivera ${e} I deserve this` },
  { label: "Over the limit", build: (e: string) => `@Samir Haddad @Aiko Tanaka ${e.repeat(3)} heroes of the week` },
];

/** The kudos emoji with a colour ring: a variant (#98) or the Super kudos emoji, as its art slot's colours. */
function EmojiChip({ glyph, colors, label }: { glyph: string; colors: string[]; label: string }) {
  return (
    <span title={label} className="mx-px inline-grid h-6 w-6 place-items-center rounded-full align-middle text-sm" style={{ background: `linear-gradient(135deg, ${colors.join(", ")})` }}>
      {glyph}
    </span>
  );
}

const SUPER_COLORS = ["#fde68a", "#f7a501", "#f54e00"];

function variantChip(p: string, glyph: string, emojiName: string, key: number): ReactNode | null {
  const suffix = p.slice(emojiName.length + 2, -1);
  if (suffix === SUPER_SUFFIX) return <EmojiChip key={key} glyph={glyph} colors={SUPER_COLORS} label={p} />;
  const variant = variantBySuffix(suffix);
  return variant ? <EmojiChip key={key} glyph={glyph} colors={variant.art.colors} label={p} /> : null;
}

function renderSlackText(text: string, glyph: string, emojiName: string): ReactNode[] {
  const escaped = emojiName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(@[A-ZÀ-Ý][\\p{L}]+ [A-ZÀ-Ý][\\p{L}]+|:${escaped}(?:-[a-z]+)?:)`, "gu"));
  return parts.map((p, i) => {
    if (p === `:${emojiName}:`) return <span key={i}>{glyph}</span>;
    if (p.startsWith(`:${emojiName}-`) && p.endsWith(":")) return variantChip(p, glyph, emojiName, i) ?? <span key={i}>{p}</span>;
    if (p.startsWith("@")) return <span key={i} className="bg-[#1d9bd1]/15 px-0.5 text-[#1264a3]">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Slack's small grey "APP" tag after a bot's name. */
function AppTag({ children = "APP" }: { children?: ReactNode }) {
  return <span className="bg-ink/10 px-1 py-px align-middle text-[10px] font-semibold text-ink/75">{children}</span>;
}

/** The Kudos bot's square avatar: the workspace's kudos emoji on lantern. */
function BotAvatar({ glyph }: { glyph: string }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center bg-lantern">{glyph}</span>;
}

type Tab = "playground" | "simulator";

export function Playground() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "simulator" ? "simulator" : "playground";
  return (
    <div className="space-y-5">
      <Segmented<Tab>
        label="Sandbox"
        value={tab}
        onChange={(t) => setParams(t === "simulator" ? { tab: t } : {}, { replace: true })}
        options={[
          { value: "playground", label: "Playground" },
          { value: "simulator", label: "Simulator" },
        ]}
      />
      {/* A new workspace (the simulator started or stopped) is a new channel: its feed starts again. */}
      {tab === "simulator" ? <SimulatorTab /> : <Sandbox key={viewer.workspace._id} />}
    </div>
  );
}

function Sandbox() {
  const viewer = useViewer();
  // Known at once from your workspaces (a cold load never offers the shared demo's reset); the clock waits for the state.
  const inSimulator = viewer.workspaces.some((w) => w.current && isSimulatorWorkspace(w));
  const simulator = shownSimulator(useQuery(api.simulator.state, {}));
  const teammates = useQuery(api.demo.teammates) ?? [];
  const today = useWorkspaceToday();
  const status = useQuery(api.me.today, { today });
  // A teammate's thoughtful kudos, 4 of 5 joined: one click on the bot's reaction reaches the tier (#94).
  const spree = useQuery(api.demo.spreePost, { today });
  const openSpree = useMutation(api.demo.openSpree);
  const joinSpree = useMutation(api.demo.simulateSpreeJoin);
  useEffect(() => {
    if (viewer.workspace.spreesEnabled) void openSpree({});
  }, [openSpree, viewer.workspace.spreesEnabled]);
  const send = useMutation(api.demo.simulateMessage);
  const cosmetics = useQuery(api.cosmetics.mine, { today });
  // Your own kudos-emoji variants and the Super kudos emoji (#98), to add like the kudos emoji.
  const extraEmoji = [...(cosmetics?.emoji.filter((e) => e.suffix !== null).map((e) => e.shortcode) ?? []), ...(cosmetics?.superKudos ? [cosmetics.superKudos.shortcode] : [])];
  const edit = useMutation(api.demo.simulateEdit);
  const react = useMutation(api.demo.simulateReaction);
  const allowance = useMutation(api.demo.simulateAllowanceCheck);
  const { emojiGlyph: glyph, emojiName } = viewer.workspace;
  const emojiCode = `:${emojiName}:`;

  const [text, setText] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>(() => CHANNEL_POSTS.map((p, i) => ({ ...p, mine: false, at: workspaceClockNow() - (3 - i) * 600_000 })));
  const [bot, setBot] = useState<(BotMessage & { at: number })[]>([]);
  const [reacted, setReacted] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [newDms, setNewDms] = useState(0);
  const dmsRef = useRef<HTMLElement>(null);

  // Like Slack, the channel follows the newest message once you've posted; on arrival it starts at
  // the top, so the teammate's spree above the posts is in view.
  const shownFeed = useRef(feed.length);
  useEffect(() => {
    const el = feedRef.current;
    if (!el || feed.length === shownFeed.current) return;
    shownFeed.current = feed.length;
    el.scrollTop = el.scrollHeight;
  }, [feed.length]);

  const suggestions = useMemo(
    () => (mention ? teammates.filter((t) => t.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6) : []),
    [mention, teammates],
  );

  /**
   * Like Slack: your reply to a kudos you gave shows only to you, right where you gave it (with what
   * it earned while the game is on); everything else is a DM, an envelope on the stack.
   */
  const pushBot = (messages: BotMessage[]) => {
    const isReply = (m: BotMessage) => m.toMe && m.category === "giver_success";
    const replies = messages.filter(isReply);
    if (replies.length > 0) {
      setFeed((f) => [
        ...f,
        ...replies.map((m) => ({ id: m._id, author: "Kudos", slackUserId: "", text: m.text, mine: false, at: workspaceClockNow(), ephemeral: true, earnings: m.earnings, superNote: m.superKudos?.text })),
      ]);
    }
    const dms = messages.filter((m) => !isReply(m));
    setBot((prev) => [...dms.map((m) => ({ ...m, at: workspaceClockNow() })), ...prev].slice(0, 30));
    setNewDms(dms.length);
  };

  const toSlack = (raw: string) => {
    let out = raw.replaceAll(glyph, emojiCode);
    for (const t of [...teammates].sort((a, b) => b.name.length - a.name.length)) {
      out = out.replaceAll(`@${t.name}`, `<@${t.slackUserId}>`);
    }
    return out;
  };

  const submit = async (raw = text) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const slackText = toSlack(trimmed);
    const id = crypto.randomUUID();
    setFeed((f) => [...f, { id, author: viewer.member.name, slackUserId: viewer.member.slackUserId, text: trimmed.replaceAll(glyph, emojiCode), mine: true, at: workspaceClockNow() }]);
    setText("");
    setMention(null);
    const res = await send({ text: slackText, channelName: "general" });
    // Nothing given and nothing for the bot to answer: the emoji alone was chat (#168).
    if (res.status === "no_kudos" || (res.status === "invalid" && !res.attempt)) setHint(`No kudos in that one. Mention someone and add ${glyph} (or ${emojiCode}).`);
    else setHint(null);
    if (res.attempt) setFeed((f) => f.map((m) => (m.id === id ? { ...m, sent: { messageTs: res.attempt!.messageTs, slackText } } : m)));
    showAttempt(id, res.attempt);
    pushBot(res.messages);
  };

  /** Like Slack: the bot reacts on the message, and replies only to you when there's something to fix. */
  const showAttempt = (id: string, attempt: AttemptReply) => {
    if (!attempt) return;
    const superReaction = attempt.reaction === `${emojiName}-${SUPER_SUFFIX}`;
    setFeed((f) => [
      ...f.map((m) => (m.id === id ? { ...m, outcome: attempt.outcome, superReaction } : m)),
      ...(attempt.guidance ? [{ id: crypto.randomUUID(), author: "Kudos", slackUserId: "", text: attempt.guidance, mine: false, at: workspaceClockNow(), ephemeral: true }] : []),
    ]);
  };

  const saveEdit = async (m: FeedItem) => {
    const raw = editing?.draft.trim();
    setEditing(null);
    if (!raw || !m.sent) return;
    const slackText = toSlack(raw);
    if (slackText === m.sent.slackText) return;
    let res;
    try {
      res = await edit({ messageTs: m.sent.messageTs, previousText: m.sent.slackText, text: slackText, channelName: "general" });
    } catch (e) {
      setHint(e instanceof ConvexError ? String(e.data) : "That edit didn't go through. Try again.");
      return;
    }
    // Like Slack, the message shows the edit either way; only a failed attempt is judged again.
    setFeed((f) => f.map((x) => (x.id === m.id ? { ...x, text: raw.replaceAll(glyph, emojiCode), sent: { ...m.sent!, slackText }, edited: true } : x)));
    setHint(res.status === "no_change" && m.outcome !== "given" ? `No ${glyph} in the edit, so there was nothing to send.` : null);
    showAttempt(m.id, res.attempt);
    pushBot(res.messages);
  };

  /** Join on the spree's prompt: your reply shows where you joined, the tier's reply in the thread, the DMs on the stack. */
  const onJoinSpree = async (attemptId: string) => {
    const res = await joinSpree({ attemptId: attemptId as Id<"kudosAttempts"> });
    const now = workspaceClockNow();
    setFeed((f) => [
      ...f,
      { id: crypto.randomUUID(), author: "Kudos", slackUserId: "", text: res.text, mine: false, at: now, ephemeral: true },
      ...(res.thread ? [{ id: crypto.randomUUID(), author: "Kudos", slackUserId: "", text: res.thread, mine: false, at: now, threadReply: true }] : []),
    ]);
    pushBot(res.messages);
  };

  const onChange = (value: string) => {
    setText(value);
    const caret = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = before.match(/@([\p{L}]*(?: [\p{L}]*)?)$/u);
    setMention(m ? { query: m[1], index: 0 } : null);
  };

  const pick = (name: string) => {
    const caret = inputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}]*(?: [\p{L}]*)?)$/u, `@${name} `);
    setText(before + text.slice(caret));
    setMention(null);
    inputRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention({ ...mention, index: (mention.index + 1) % suggestions.length });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention({ ...mention, index: (mention.index - 1 + suggestions.length) % suggestions.length });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[mention.index].name);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const insert = (piece: string) => {
    setText((t) => `${t}${piece}`);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/80">
        The sandbox runs the real kudos engine on {inSimulator ? "your simulator" : "the demo workspace"}. Post in #general as you would in Slack: mention teammates and add the kudos emoji to give, react to
        a post, or fix a failed kudos by editing it. The bot's DMs land on the stack of envelopes, and everything flows into the world.
      </p>

      <DemoSigns status={status} inSimulator={inSimulator} onRefilled={() => viewer.workspace.spreesEnabled && void openSpree({})} />
      {/* The window covers the HUD's clock: the days move on from here too (#144). */}
      {simulator && <SimulatorClock simulator={simulator} inWindow />}

      <div className="grid grid-cols-1 gap-6 @min-[540px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div data-sand className="min-w-0">
          <section data-slack-terminal data-user-text aria-label="Slack, #general" className="pixel-frame flex h-[min(580px,78dvh)] flex-col bg-cream [color-scheme:light]">
            <header className="flex items-center justify-between gap-3 bg-[#3f0e40] px-3 py-2.5 text-cream">
              <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold">
                <Hash className="h-4 w-4 shrink-0" aria-hidden /> general
              </span>
              {status && (
                <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 text-xs">
                  Left today
                  <span className="flex flex-wrap gap-0.5" role="img" aria-label={`${status.remaining} of ${status.limit} kudos left today`}>
                    {Array.from({ length: status.limit }).map((_, i) => (
                      <span key={i} className={clsx(i >= status.remaining && "opacity-25 grayscale")}>
                        {glyph}
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </header>

            <div ref={feedRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto bg-cream px-1.5 py-3 text-ink">
              {spree && <SpreePost spree={spree} glyph={glyph} onJoin={onJoinSpree} />}
              <AnimatePresence initial={false}>
                {feed.map((m) =>
                  m.ephemeral ? (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="flex gap-2.5 bg-ink/5 px-2 py-2 shadow-[inset_3px_0_0_0_var(--color-lantern)]"
                    >
                      <BotAvatar glyph={glyph} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs text-ink/70">
                          <EyeOff className="h-3 w-3" aria-hidden /> Only visible to you
                        </div>
                        <div className="text-sm">
                          <b className="font-bold">Kudos</b> <AppTag /> <span className="text-xs text-ink/70">{clock(m.at)}</span>
                        </div>
                        <p className="text-[15px] leading-relaxed text-ink">{m.text}</p>
                        {m.earnings && <Earnings text={m.earnings} />}
                        {m.superNote && <p className="mt-1 text-sm text-ink">{m.superNote}</p>}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, ease: "easeOut" }} className="group flex gap-2.5 px-2 py-2 hover:bg-ink/5">
                      {m.threadReply ? <BotAvatar glyph={glyph} /> : <Avatar name={m.author} size={36} />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <b className="font-bold">{m.author}</b> {m.threadReply && <AppTag>APP, replied in the thread</AppTag>} <span className="text-xs text-ink/70">{clock(m.at)}</span>
                        </div>
                        {editing?.id === m.id ? (
                          <div className="mt-1 bg-white p-2 shadow-[inset_0_0_0_2px_#1264a3]">
                            <textarea
                              autoFocus
                              value={editing.draft}
                              onChange={(e) => setEditing({ id: m.id, draft: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditing(null);
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  void saveEdit(m);
                                }
                              }}
                              rows={2}
                              aria-label="Edit message"
                              className="w-full resize-none bg-transparent px-1 text-[15px] text-ink"
                            />
                            <div className="mt-1 flex justify-end gap-3">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                Cancel
                              </Button>
                              <Button size="sm" variant="primary" onClick={() => void saveEdit(m)} disabled={!editing.draft.trim()}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[15px] leading-relaxed break-words text-ink">
                            {renderSlackText(m.text, glyph, emojiName)}
                            {m.edited && <span className="ml-1 text-xs text-ink/70">(edited)</span>}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {m.outcome && (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.12, ease: "easeOut" }}
                              role="img"
                              title={`Kudos bot: ${REACTIONS[m.outcome].label}`}
                              aria-label={`Kudos bot reacted: ${REACTIONS[m.outcome].label}`}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[#1d9bd1]/60 bg-[#1d9bd1]/10 px-2 py-0.5 text-xs"
                            >
                              {m.superReaction ? <EmojiChip glyph={glyph} colors={SUPER_COLORS} label={`:${emojiName}-${SUPER_SUFFIX}:`} /> : (REACTIONS[m.outcome].glyph ?? glyph)}{" "}
                              <span className="tabular text-ink/75">1</span>
                            </motion.span>
                          )}
                          {m.sent && editing?.id !== m.id && (
                            // Like Slack, every message can be edited; a failed attempt is fixed that way, so it's always offered.
                            <button
                              onClick={() => setEditing({ id: m.id, draft: m.text.replaceAll(emojiCode, glyph) })}
                              className={clsx(
                                "mt-1.5 inline-flex items-center gap-1 rounded-full border border-ink/25 px-2 py-0.5 text-xs text-ink/75 hover:text-ink",
                                m.outcome === "given" && "opacity-60 hover:opacity-100 focus:opacity-100",
                              )}
                            >
                              <Pencil className="h-3 w-3" aria-hidden /> Edit
                            </button>
                          )}
                          {!m.mine && !m.threadReply && (
                            <button
                              disabled={reacted.has(m.id)}
                              aria-label={reacted.has(m.id) ? `You reacted to ${m.author}'s message` : `React to ${m.author}'s message with ${emojiCode}`}
                              onClick={async () => {
                                setReacted((s) => new Set(s).add(m.id));
                                const res = await react({ authorSlackUserId: m.slackUserId, messageText: m.text, messageKey: m.id });
                                if (res.status === "already_reacted") setHint("You already reacted to that message today.");
                                pushBot(res.messages);
                              }}
                              className={clsx(
                                "mt-1.5 rounded-full border px-2 py-0.5 text-xs",
                                reacted.has(m.id) ? "border-[#1d9bd1]/60 bg-[#1d9bd1]/10" : "border-ink/25 text-ink/75 hover:text-ink",
                              )}
                            >
                              {glyph} {reacted.has(m.id) ? "1" : "React"}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ),
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-ink/15 bg-cream p-3 text-ink">
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => {
                      setText(ex.build(glyph));
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-ink/25 bg-white px-2.5 py-1 text-xs text-ink/80 hover:text-ink"
                  >
                    {ex.label}
                  </button>
                ))}
                <button
                  onClick={async () => pushBot((await allowance({})).messages)}
                  className="flex items-center gap-1 rounded-full border border-ink/25 bg-white px-2.5 py-1 tabular text-xs text-ink/80 hover:text-ink"
                >
                  <Terminal className="h-3 w-3" aria-hidden /> /kudos me
                </button>
              </div>
              <div className="relative">
                <AnimatePresence>
                  {mention && suggestions.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="absolute bottom-full left-0 z-10 mb-2 w-full max-w-72 bg-white p-1 shadow-[inset_0_0_0_1px_var(--color-ink),3px_3px_0_0_var(--color-dusk-deep)]"
                    >
                      {suggestions.map((s, i) => (
                        <li key={s.slackUserId}>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pick(s.name);
                            }}
                            className={clsx("flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm", i === mention.index && "bg-[#1264a3] text-white")}
                          >
                            <Avatar name={s.name} size={24} />
                            <span className="font-medium">{s.name}</span>
                            <span className="truncate text-xs opacity-75">{s.title}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
                <div className="bg-white p-1.5 shadow-[inset_0_0_0_1px_var(--color-ink)]">
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKey}
                    rows={2}
                    placeholder={`Message #general, try "@Priya Raman ${glyph} thanks!"`}
                    className="block min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] text-ink placeholder:text-ink/60"
                    aria-label="Message"
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      onClick={() => {
                        insert("@");
                        setMention({ query: "", index: 0 });
                      }}
                      className="p-2 text-ink/70 hover:text-ink"
                      aria-label="Mention someone"
                    >
                      <AtSign className="h-4 w-4" />
                    </button>
                    <button onClick={() => insert(glyph)} className="p-2 text-lg hover:bg-ink/10" aria-label={`Add ${emojiName}`}>
                      {glyph}
                    </button>
                    {extraEmoji.map((code) => (
                      <button key={code} onClick={() => insert(` ${code} `)} className="p-1 hover:bg-ink/10" aria-label={`Add ${code}`}>
                        {variantChip(code, glyph, emojiName, 0)}
                      </button>
                    ))}
                    <button
                      onClick={() => void submit()}
                      disabled={!text.trim()}
                      aria-label="Send"
                      className="ml-auto grid h-8 w-8 shrink-0 place-items-center bg-[#007a5a] text-white disabled:bg-ink/15 disabled:text-ink/50"
                    >
                      <SendHorizontal className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
              {/* Always there, so a screen reader announces a new hint. */}
              <p data-hint role="status" className="text-xs font-semibold text-ember-deep empty:hidden [&:not(:empty)]:mt-2">
                {hint}
              </p>
            </div>
          </section>
          {newDms > 0 && (
            // On a narrow window the envelopes stack below the terminal: say they came, and take you there.
            <button
              data-new-dms
              onClick={() => {
                setNewDms(0);
                dmsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
              className="pixel-btn mt-4 h-9 w-full px-3 text-sm font-semibold @min-[540px]:hidden"
            >
              {newDms === 1 ? "1 new DM below" : `${newDms} new DMs below`}
            </button>
          )}
          {/* The terminal's two legs, standing in a heap of sand. */}
          <div aria-hidden className="flex justify-around px-10 pt-1">
            <span className="block h-3 w-2 bg-bark" />
            <span className="block h-3 w-2 bg-bark" />
          </div>
          <div aria-hidden className="h-3 bg-parchment-deep shadow-[inset_0_-2px_0_0_var(--color-soil)]" />
        </div>

        <Envelopes ref={dmsRef} messages={bot} status={status} />
      </div>
    </div>
  );
}

/**
 * The demo controls, as small wooden signs in the sand: the demo user is shared by every visitor,
 * so anyone can refill today's kudos or hand back what visitors bought; an admin can reset the demo.
 */
function DemoSigns({ status, inSimulator, onRefilled }: { status: { remaining: number; limit: number } | undefined; inSimulator: boolean; onRefilled: () => void }) {
  const viewer = useViewer();
  const refill = useMutation(api.demo.refillAllowance);
  const handBack = useMutation(api.demo.handBackRewards);
  const reset = useMutation(api.demo.resetDemo);
  const [busy, setBusy] = useState<"refill" | "handBack" | "reset" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);
  const run = (what: "refill" | "handBack" | "reset", action: () => Promise<unknown>) => {
    setBusy(what);
    setNote(null);
    action()
      // The reset runs on its own for about a minute after it's scheduled.
      .then(() => what === "reset" && setNote({ text: "The demo is resetting. Reload the page in a minute.", failed: false }))
      .catch(() => setNote({ text: "That didn't go through. Try again in a moment.", failed: true }))
      .finally(() => setBusy(null));
  };
  const full = !!status && status.remaining >= status.limit;
  return (
    <div data-demo-signs className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <SignButton
        disabled={busy !== null || full}
        title={full ? "You have all of today's kudos." : "The demo user is shared by every visitor: this takes back the kudos given today, so you can give them again."}
        onClick={() => run("refill", () => refill({}).then(onRefilled))}
      >
        {busy === "refill" ? "Refilling…" : "Refill my kudos"}
      </SignButton>
      <SignButton
        disabled={busy !== null}
        title="The demo user is shared by every visitor: this returns the game items and rewards visitors bought. The seeded history stays."
        onClick={() => run("handBack", () => handBack({}))}
      >
        {busy === "handBack" ? "Handing back…" : "Hand back what I bought"}
      </SignButton>
      {/* The shared demo's reset: refused inside a simulator (the Simulator tab restarts yours). */}
      {viewer.member.isAdmin &&
        !inSimulator &&
        (confirming ? (
          <span className="flex flex-wrap items-center gap-3 text-sm text-ink">
            Reset the whole demo for everyone? It takes about a minute.
            <SignButton
              onClick={() => {
                setConfirming(false);
                run("reset", () => reset({}));
              }}
            >
              Yes, reset everything
            </SignButton>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </span>
        ) : (
          <SignButton disabled={busy !== null} onClick={() => setConfirming(true)}>
            {busy === "reset" ? "Resetting the demo…" : "Reset the demo"}
          </SignButton>
        ))}
      {note && (
        <p role={note.failed ? "alert" : "status"} className={clsx("basis-full text-sm font-semibold", note.failed ? "text-ember-deep" : "text-hedge-deep")}>
          {note.text}
        </p>
      )}
    </div>
  );
}

/** A small wooden sign on a post: a bark board with cream letters. */
function SignButton({ children, ...rest }: ComponentProps<"button">) {
  return (
    <span className="inline-flex flex-col items-center">
      <button
        {...rest}
        className="bg-bark px-3 py-1.5 font-display text-sm font-medium text-cream shadow-[inset_0_0_0_2px_var(--color-soil),2px_2px_0_0_var(--color-dusk-deep)] hover:bg-soil disabled:opacity-50"
      >
        {children}
      </button>
      <span aria-hidden className="block h-2 w-1.5 bg-bark" />
    </span>
  );
}

/** A pixel envelope, its wax seal in the message's rarity colour. */
function EnvelopeIcon({ seal }: { seal: string }) {
  return (
    <svg viewBox="0 0 16 12" width={32} height={24} shapeRendering="crispEdges" aria-hidden className="pixels shrink-0">
      <rect x="0" y="0" width="16" height="12" fill="#3a2a22" />
      <rect x="1" y="1" width="14" height="10" fill="#efe3c4" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i} fill="#d9c79c">
          <rect x={i} y={i} width="1" height="1" />
          <rect x={15 - i} y={i} width="1" height="1" />
        </g>
      ))}
      <rect x="6" y="6" width="4" height="3" fill={seal} />
      <rect x="6" y="6" width="4" height="1" fill="#161226" fillOpacity="0.3" />
    </svg>
  );
}

/** The bot's DMs, newest on top: a stack of envelopes, each opened to its message. */
function Envelopes({ messages, status, ref }: { messages: (BotMessage & { at: number })[]; status: { discovered: number; total: number } | undefined; ref?: Ref<HTMLElement> }) {
  const titleId = useId();
  return (
    <section ref={ref} aria-labelledby={titleId} className="min-w-0 scroll-mt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-3 border-b-2 border-parchment-deep pb-2">
        <h2 id={titleId} className="font-display text-xl font-medium leading-7 text-ink">
          Your DMs
        </h2>
        {status && (
          <span className="text-sm text-ink/75">
            Collected <b className="font-display text-lg font-medium tabular text-ink">{status.discovered}</b> of {status.total}
          </span>
        )}
      </div>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <EnvelopeIcon seal="#d9c79c" />
          <p className="max-w-56 text-sm text-ink/75">The bot's DMs land here as envelopes. Every reply rolls a rarity.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const rolled = !gainsOnly(m);
              const meta = RARITY_META[m.rarity as Rarity] ?? RARITY_META.common;
              const seal = rolled ? meta.color : "var(--color-hedge)";
              return (
                <motion.li
                  key={m._id}
                  data-envelope
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  // Clips the discovery confetti, which would otherwise scroll the window sideways.
                  className="pixel-note relative flow-root overflow-hidden p-3 pt-4"
                >
                  {m.isNewDiscovery && (m.rarity === "legendary" || m.rarity === "epic" || m.rarity === "rare") && <Burst color={meta.color} />}
                  <span aria-hidden className="absolute inset-x-0 top-0 block h-1" style={{ background: seal }} />
                  <div className="flex items-center gap-2.5">
                    <EnvelopeIcon seal={seal} />
                    <div className="min-w-0 text-xs leading-4 text-ink/75">
                      <div className="font-semibold text-ink">{m.toMe ? "To you" : `To ${m.to}`}</div>
                      <div>
                        {gainsOnly(m) ? (m.gainLabel ?? "Level up") : (CATEGORY_LABEL[m.category] ?? m.category)}
                        {!m.toMe && `. ${m.to.split(" ")[0]} gets this DM.`}
                      </div>
                    </div>
                  </div>
                  <div data-user-text className="mt-2.5">
                    {m.superKudos?.kind === "celebration" && (
                      <p data-super-kudos className="mb-2 bg-lantern/15 px-3 py-2 text-sm font-medium whitespace-pre-line text-soil shadow-[inset_0_0_0_1px_var(--color-lantern)]">
                        {m.superKudos.text}
                      </p>
                    )}
                    <LevelUpHoggie label={m.gainLabel} category={m.category} />
                    <p className="text-[15px] leading-relaxed whitespace-pre-line break-words text-ink">{m.text}</p>
                    <GainLines lines={m.gains} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {rolled && <RarityBadge rarity={m.rarity as Rarity} size="xs" />}
                    {m.isNewDiscovery && <span className="text-xs font-semibold whitespace-nowrap text-soil">New discovery</span>}
                    {m.questProgress && (
                      <span className="text-xs whitespace-nowrap text-ink/75">
                        {m.questProgress.completed} of {m.questProgress.available} quests this week
                      </span>
                    )}
                    {m.questProgress?.sweep && <span className="bg-hedge px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-cream">Clean sweep</span>}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

/** A one-off burst of pixel confetti in the rarity's colour, for a Rare or rarer new discovery. */
function Burst({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5"
            style={{ background: color }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * 140, y: Math.sin(angle) * 70, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}
