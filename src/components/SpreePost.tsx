import { motion } from "motion/react";
import { EyeOff } from "lucide-react";
import { useState } from "react";
import { Avatar, Button } from "@/components/ui";

/** The playground's kudos spree (`api.demo.spreePost`, #94). */
export type Spree = {
  attemptId: string;
  author: string;
  text: string;
  at: number;
  joiners: number;
  tier: number;
  next: number | null;
  status: string;
  joined: boolean;
  /** Join / Not now, while you can join. */
  prompt: string | null;
  /** Why you can't join right now (no spree joins left), shown instead. */
  note?: string | null;
};

/** Where the spree stands, under the kudos. */
function progress(s: Spree) {
  if (s.status === "cancelled") return "Spree cancelled";
  const reached = s.tier > 0 ? `Spree of ${[5, 10, 20, 50, 100][s.tier - 1]}` : null;
  if (s.next === null || s.status !== "open") return reached ?? "Spree over";
  return reached ? `${reached} · ${s.joiners}/${s.next} for the next tier` : `Spree ${s.joiners}/${s.next}`;
}

/**
 * A teammate's thoughtful kudos with the Kudos bot's reaction on it. Like in Slack, clicking that
 * reaction offers Join / Not now, shown only to you.
 */
export function SpreePost({ spree, glyph, onJoin }: { spree: Spree; glyph: string; onJoin: (attemptId: string) => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const prompt = asking ? spree.prompt : null;
  const note = asking && !spree.prompt ? (spree.note ?? null) : null;
  const join = async () => {
    setBusy(true);
    try {
      await onJoin(spree.attemptId);
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };
  return (
    <div>
      <div className="group flex gap-3 px-2 py-2 hover:bg-parchment-deep/50">
        <Avatar name={spree.author} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-sm">
            <b className="font-semibold">{spree.author}</b>{" "}
            <span className="text-xs text-ink/70">{new Date(spree.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{spree.text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAsking((a) => !a)}
              aria-label={`Kudos bot reacted: ${progress(spree)}. Click to join the spree`}
              className="inline-flex items-center gap-1 rounded-full border border-[#1d9bd1]/60 bg-[#1d9bd1]/15 px-2 py-0.5 text-xs transition hover:bg-[#1d9bd1]/25"
            >
              {glyph} <span className="tabular text-ink/75">{spree.joiners + 1}</span>
            </button>
            <span className="rounded-full bg-lantern/10 px-2 py-0.5 text-xs font-medium text-soil">{progress(spree)}</span>
          </div>
        </div>
      </div>
      {note && (
        <div className="flex gap-3 bg-parchment-deep/50 px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center bg-lantern/20">{glyph}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-ink/70">
              <EyeOff className="h-3 w-3" /> Only visible to you
            </div>
            <p className="text-[15px] leading-relaxed text-ink">{note}</p>
          </div>
        </div>
      )}
      {prompt && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 bg-parchment-deep/50 px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center bg-lantern/20">{glyph}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-ink/70">
              <EyeOff className="h-3 w-3" /> Only visible to you
            </div>
            <p className="text-[15px] leading-relaxed text-ink">{prompt}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => void join()} disabled={busy}>
                Join
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
                Not now
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
