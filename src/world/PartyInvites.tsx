import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { TIER_WORD } from "../../convex/lib/ruinWords";
import type { RuinTier } from "../../convex/lib/tree";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { ruinPath } from "./places/ruins";
import { secondsLeft, useWorldNow } from "./worldNow";

/**
 * A party invite on your screen (#163, plan #152 S7), in the toasts' corner and in their parchment:
 * who asks you into which ruin, the seconds left to answer, Accept (you join, and the ruin's window
 * opens: you're standing at its entrance) and Decline. It stays until you answer or its minute is
 * up, never going by itself like a toast. The newest invite shows; the server refuses a stale one.
 */
export function PartyInvites() {
  const invites = useQuery(api.rpg.invites);
  const now = useWorldNow(true, 1000);
  const accept = useMutation(api.rpg.accept);
  const decline = useMutation(api.rpg.decline);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invite = (invites ?? []).filter((i) => secondsLeft(i.expiresAt, now) > 0).at(-1);
  if (!invite) return null;
  const answer = async (yes: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (yes) {
        await accept({ runId: invite.runId as Id<"expeditions"> });
        navigate(ruinPath(invite.ruinId));
      } else await decline({ runId: invite.runId as Id<"expeditions"> });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const left = secondsLeft(invite.expiresAt, now);
  return (
    <div data-toast="party" role="group" aria-label={`${invite.from} invites you to ${invite.ruinName}`} className="pixel-frame pointer-events-auto p-3 shadow-[inset_0_4px_0_0_var(--color-lantern)] pt-4">
      <p className="font-display text-base font-medium leading-6 text-ink">
        {invite.from} invites you to {invite.ruinName}
      </p>
      <p className="mt-0.5 text-sm text-ink/75">
        A party of {invite.size} at the {TIER_WORD[invite.tier as RuinTier]} ruins, a few steps from you. <span aria-live="off" className="tabular">{left === 1 ? "1 second" : `${left} seconds`}</span> to answer.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" size="sm" onClick={() => void answer(true)} disabled={busy}>
          Accept
        </Button>
        <Button size="sm" onClick={() => void answer(false)} disabled={busy}>
          Decline
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-ember-deep">
          {error}
        </p>
      )}
    </div>
  );
}
