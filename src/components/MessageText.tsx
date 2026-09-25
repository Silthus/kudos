import { Fragment } from "react";

const LABELS: Record<string, string> = {
  giver: "giver",
  recipients: "recipients",
  amount: "amount",
  emoji: "emoji",
  remaining: "left today",
  limit: "daily limit",
  channel: "#channel",
  user: "you",
  requested: "requested",
  quest: "quest",
};

/** Renders a message template with its {placeholders} as quiet inline chips. */
export function MessageText({ text, emoji }: { text: string; emoji: string }) {
  const parts = text.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{(\w+)\}$/);
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        if (m[1] === "emoji") return <span key={i}>{emoji}</span>;
        return (
          <span key={i} className="mx-0.5 inline-flex -translate-y-px items-center border border-bark/60 bg-parchment-deep px-1.5 py-px tabular text-[0.78em] text-ink/75">
            {LABELS[m[1]] ?? m[1]}
          </span>
        );
      })}
    </>
  );
}
