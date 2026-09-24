import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, EyeOff, Hash, Pencil, SendHorizontal, Terminal } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { Avatar, Button, Card, Eyebrow, PageHeader, RarityBadge } from "@/components/ui";
import { useWorkspaceToday } from "@/lib/period";
import { CATEGORY_LABEL, RARITY_META, type Rarity } from "@/lib/rarity";
import { useViewer } from "@/lib/viewer";
import { GainLines } from "@/components/game";

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
  /** On the bot's reply to your kudos: what it earned ("+20 XP · new connection +10"). */
  earnings?: string;
  /** Your kudos attempt as sent (Slack format), so you can edit it like in Slack. */
  sent?: { messageTs: string; slackText: string };
  edited?: boolean;
};

type AttemptReply = { outcome: Outcome; guidance: string | null } | null;

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
  { label: "Forget the mention", build: (e: string) => `${e} great job on the launch everyone` },
];

function renderSlackText(text: string, glyph: string, emojiName: string): ReactNode[] {
  const parts = text.split(new RegExp(`(@[A-ZÀ-Ý][\\p{L}]+ [A-ZÀ-Ý][\\p{L}]+|:${emojiName}:)`, "gu"));
  return parts.map((p, i) => {
    if (p === `:${emojiName}:`) return <span key={i}>{glyph}</span>;
    if (p.startsWith("@")) return <span key={i} className="rounded bg-[#1d9bd1]/20 px-1 text-[#6cc7f5]">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

export function Playground() {
  const viewer = useViewer();
  const teammates = useQuery(api.demo.teammates) ?? [];
  const status = useQuery(api.me.today, { today: useWorkspaceToday() });
  const send = useMutation(api.demo.simulateMessage);
  const edit = useMutation(api.demo.simulateEdit);
  const react = useMutation(api.demo.simulateReaction);
  const allowance = useMutation(api.demo.simulateAllowanceCheck);
  const refill = useMutation(api.demo.refillAllowance);
  const { emojiGlyph: glyph, emojiName } = viewer.workspace;
  const emojiCode = `:${emojiName}:`;

  const [text, setText] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>(() => CHANNEL_POSTS.map((p, i) => ({ ...p, mine: false, at: Date.now() - (3 - i) * 600_000 })));
  const [bot, setBot] = useState<(BotMessage & { at: number })[]>([]);
  const [reacted, setReacted] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(
    () => (mention ? teammates.filter((t) => t.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6) : []),
    [mention, teammates],
  );

  /**
   * Like Slack: your reply to a kudos you gave shows only to you, right where you gave it (with what
   * it earned while the game is on); everything else is a DM on the right.
   */
  const pushBot = (messages: BotMessage[]) => {
    const isReply = (m: BotMessage) => m.toMe && m.category === "giver_success";
    const replies = messages.filter(isReply);
    if (replies.length > 0) {
      setFeed((f) => [
        ...f,
        ...replies.map((m) => ({ id: m._id, author: "Kudos", slackUserId: "", text: m.text, mine: false, at: Date.now(), ephemeral: true, earnings: m.earnings })),
      ]);
    }
    const dms = messages.filter((m) => !isReply(m));
    setBot((prev) => [...dms.map((m) => ({ ...m, at: Date.now() })), ...prev].slice(0, 30));
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
    setFeed((f) => [...f, { id, author: viewer.member.name, slackUserId: viewer.member.slackUserId, text: trimmed.replaceAll(glyph, emojiCode), mine: true, at: Date.now() }]);
    setText("");
    setMention(null);
    const res = await send({ text: slackText, channelName: "general" });
    if (res.status === "no_kudos") setHint(`No kudos in that one. Mention someone and add ${glyph} (or ${emojiCode}).`);
    else setHint(null);
    if (res.attempt) setFeed((f) => f.map((m) => (m.id === id ? { ...m, sent: { messageTs: res.attempt!.messageTs, slackText } } : m)));
    showAttempt(id, res.attempt);
    pushBot(res.messages);
  };

  /** Like Slack: the bot reacts on the message, and replies only to you when there's something to fix. */
  const showAttempt = (id: string, attempt: AttemptReply) => {
    if (!attempt) return;
    setFeed((f) => [
      ...f.map((m) => (m.id === id ? { ...m, outcome: attempt.outcome } : m)),
      ...(attempt.guidance
        ? [{ id: crypto.randomUUID(), author: "Kudos", slackUserId: "", text: attempt.guidance, mine: false, at: Date.now(), ephemeral: true }]
        : []),
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
      if (e.key === "ArrowDown") { e.preventDefault(); setMention({ ...mention, index: (mention.index + 1) % suggestions.length }); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMention({ ...mention, index: (mention.index - 1 + suggestions.length) % suggestions.length }); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(suggestions[mention.index].name); return; }
      if (e.key === "Escape") { setMention(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Demo · runs the real kudos engine"
        title="Slack playground"
        subtitle={`Post in #general like you would in Slack. Mention teammates and add ${glyph} to give kudos, or react to a message. The Kudos bot reacts on your message (${glyph} given, ⏳ over the allowance, ❌ not valid), and you can fix a failed one by editing it. Replies show up on the right, and everything flows into your dashboard live.`}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="flex min-h-[640px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-1.5 font-display text-base font-semibold">
              <Hash className="h-4 w-4 text-muted" /> general
            </div>
            {status && (
              <div className="flex items-center gap-2 text-sm text-muted">
                {status.remaining < status.limit && (
                  <button onClick={() => void refill({})} className="rounded-md px-1.5 py-0.5 text-xs text-saffron hover:bg-saffron/10" title="The demo user is shared by all visitors">
                    Refill
                  </button>
                )}
                <span className="hidden sm:inline">Left today</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: status.limit }).map((_, i) => (
                    <motion.span key={i} animate={{ opacity: i < status.remaining ? 1 : 0.2, scale: i < status.remaining ? 1 : 0.85 }} className={clsx(i >= status.remaining && "grayscale")}>
                      {glyph}
                    </motion.span>
                  ))}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            <AnimatePresence initial={false}>
              {feed.map((m) => m.ephemeral ? (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-xl bg-panel-2/40 px-2 py-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-saffron/20">{glyph}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs text-faint">
                      <EyeOff className="h-3 w-3" /> Only visible to you
                    </div>
                    <div className="text-sm">
                      <b className="font-semibold">Kudos</b>{" "}
                      <span className="rounded bg-panel-3 px-1 py-px align-middle text-[10px] font-semibold text-muted">APP</span>{" "}
                      <span className="text-xs text-faint">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-[15px] leading-relaxed text-cream/90">{m.text}</p>
                    {m.earnings && <p className="mt-0.5 text-sm font-semibold text-saffron">{m.earnings}</p>}
                  </div>
                </motion.div>
              ) : (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group flex gap-3 rounded-xl px-2 py-2 hover:bg-panel-2/50">
                  <Avatar name={m.author} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <b className="font-semibold">{m.author}</b>{" "}
                      <span className="text-xs text-faint">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {editing?.id === m.id ? (
                      <div className="mt-1 rounded-xl border border-saffron/50 bg-ink/70 p-2">
                        <textarea
                          autoFocus
                          value={editing.draft}
                          onChange={(e) => setEditing({ id: m.id, draft: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditing(null);
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(m); }
                          }}
                          rows={2}
                          aria-label="Edit message"
                          className="w-full resize-none bg-transparent px-1 text-[15px] outline-none"
                        />
                        <div className="mt-1 flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                          <Button size="sm" variant="primary" onClick={() => void saveEdit(m)} disabled={!editing.draft.trim()}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[15px] leading-relaxed text-cream/90">
                        {renderSlackText(m.text, glyph, emojiName)}
                        {m.edited && <span className="ml-1 text-xs text-faint">(edited)</span>}
                      </p>
                    )}
                    {m.outcome && (
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        title={`Kudos bot: ${REACTIONS[m.outcome].label}`}
                        aria-label={`Kudos bot reacted: ${REACTIONS[m.outcome].label}`}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line-strong bg-panel-2 px-2 py-0.5 text-xs"
                      >
                        {REACTIONS[m.outcome].glyph ?? glyph} <span className="tabular text-muted">1</span>
                      </motion.span>
                    )}
                    {m.sent && editing?.id !== m.id && (
                      // Like Slack, every message can be edited; a failed attempt is fixed that way, so it's always offered.
                      <button
                        onClick={() => setEditing({ id: m.id, draft: m.text.replaceAll(emojiCode, glyph) })}
                        className={clsx(
                          "ml-2 inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-xs text-muted transition hover:text-cream",
                          m.outcome === "given" && "opacity-60 hover:opacity-100 focus:opacity-100",
                        )}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                    {!m.mine && (
                      <div className="mt-1.5">
                        <button
                          disabled={reacted.has(m.id)}
                          onClick={async () => {
                            setReacted((s) => new Set(s).add(m.id));
                            const res = await react({ authorSlackUserId: m.slackUserId, messageText: m.text, messageKey: m.id });
                            if (res.status === "already_reacted") setHint("You already reacted to that message today.");
                            pushBot(res.messages);
                          }}
                          className={clsx(
                            "rounded-full border px-2 py-0.5 text-xs transition",
                            reacted.has(m.id) ? "border-[#1d9bd1]/60 bg-[#1d9bd1]/15" : "border-line-strong text-muted opacity-70 hover:opacity-100 group-hover:opacity-100",
                          )}
                        >
                          {glyph} {reacted.has(m.id) ? "1" : "React"}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="border-t border-line p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex.label} onClick={() => { setText(ex.build(glyph)); inputRef.current?.focus(); }} className="rounded-full border border-line-strong bg-panel-2 px-3 py-1 text-xs text-muted hover:text-cream">
                  {ex.label}
                </button>
              ))}
              <button
                onClick={async () => pushBot((await allowance({})).messages)}
                className="flex items-center gap-1 rounded-full border border-line-strong bg-panel-2 px-3 py-1 font-mono text-xs text-muted hover:text-cream"
              >
                <Terminal className="h-3 w-3" /> /kudos me
              </button>
            </div>
            <div className="relative">
              <AnimatePresence>
                {mention && suggestions.length > 0 && (
                  <motion.ul initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-full left-0 z-10 mb-2 w-72 overflow-hidden rounded-xl border border-line-strong bg-panel-2 p-1 shadow-2xl">
                    {suggestions.map((s, i) => (
                      <li key={s.slackUserId}>
                        <button onMouseDown={(e) => { e.preventDefault(); pick(s.name); }} className={clsx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === mention.index && "bg-panel-3")}>
                          <Avatar name={s.name} size={24} />
                          <span className="font-medium">{s.name}</span>
                          <span className="truncate text-xs text-faint">{s.title}</span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
              <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-ink/70 p-2 focus-within:border-saffron/50">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={onKey}
                  rows={2}
                  placeholder={`Message #general · try "@Priya Raman ${glyph} thanks!"`}
                  className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-faint"
                  aria-label="Message"
                />
                <button onClick={() => { setText((t) => `${t}@`); setMention({ query: "", index: 0 }); inputRef.current?.focus(); }} className="rounded-lg p-2 text-faint hover:text-cream" aria-label="Mention someone">
                  <AtSign className="h-4 w-4" />
                </button>
                <button onClick={() => { setText((t) => `${t}${glyph}`); inputRef.current?.focus(); }} className="rounded-lg p-2 text-lg hover:bg-panel-3" aria-label={`Add ${emojiName}`}>
                  {glyph}
                </button>
                <Button variant="primary" size="sm" onClick={() => void submit()} disabled={!text.trim()} aria-label="Send">
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {hint && <p className="mt-2 text-xs text-saffron">{hint}</p>}
          </div>
        </Card>

        <Card className="flex min-h-[640px] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-saffron/20">{glyph}</span>
            <div>
              <div className="font-display text-base font-semibold">
                Kudos <span className="ml-1 rounded bg-panel-3 px-1 py-px align-middle text-[10px] font-semibold text-muted">APP</span>
              </div>
              <div className="text-xs text-faint">Direct messages & ephemeral replies</div>
            </div>
            {status && (
              <div className="ml-auto text-right">
                <Eyebrow>Collected</Eyebrow>
                <div className="font-display text-lg font-semibold tabular">
                  {status.discovered}<span className="text-sm text-muted">/{status.total}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {bot.length === 0 && (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                <div>
                  <div className="mb-2 text-4xl">🎲</div>
                  Bot replies appear here. Each one rolls a rarity.
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {bot.map((m) => {
                const meta = RARITY_META[m.rarity as Rarity];
                return (
                  <motion.div
                    key={m._id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: -12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", bounce: m.rarity === "legendary" || m.rarity === "epic" ? 0.55 : 0.25 }}
                    className={clsx("relative rounded-2xl bg-ink/60 p-4 ring-1 ring-inset", meta.ring, meta.glow)}
                  >
                    {m.isNewDiscovery && (m.rarity === "legendary" || m.rarity === "epic" || m.rarity === "rare") && <Burst color={meta.color} />}
                    <div className="mb-1.5 text-[11px] text-faint">
                      {m.toMe ? "To you" : `To ${m.to} (they'll get this DM)`} · {gainsOnly(m) ? (m.gainLabel ?? "Level up") : (CATEGORY_LABEL[m.category] ?? m.category)}
                    </div>
                    <p className="text-[15px] leading-relaxed whitespace-pre-line">{m.text}</p>
                    <GainLines lines={m.gains} />
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      {!gainsOnly(m) && <RarityBadge rarity={m.rarity as Rarity} size="xs" />}
                      {m.isNewDiscovery && <span className="text-xs font-medium whitespace-nowrap text-saffron">✨ New discovery!</span>}
                      {m.questProgress && (
                        <span className="text-xs whitespace-nowrap text-muted">
                          {m.questProgress.completed} of {m.questProgress.available} quests this week
                        </span>
                      )}
                      {m.questProgress?.sweep && (
                        <span className="rounded-full bg-up/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-up">Clean sweep 🧹</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Burst({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
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
