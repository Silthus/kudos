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
          <span key={i} className="mx-0.5 inline-flex -translate-y-px items-center rounded-md border border-line-strong bg-panel-3 px-1.5 py-px font-mono text-[0.78em] text-muted">
            {LABELS[m[1]] ?? m[1]}
          </span>
        );
      })}
    </>
  );
}
