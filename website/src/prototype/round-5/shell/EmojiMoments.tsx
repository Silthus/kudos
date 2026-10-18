// PROTOTYPE (#625, round 6): emoji moments: each emoji you unlock pops into the centre with why you got it, then flies into the top-bar emoji button. They queue, and never interrupt packs, a put-in or the team sticker unlock. Never merge to main.
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { useAlbum, type Album, type Emoji } from "../../round-3/album";
import { packsHash, useHash } from "../address";
import { ConfettiBurst } from "./Celebration";
import { EmojiArt } from "./EmojiArt";
import { owedOf, usageWords, whyOf } from "./emojis";
import { boxOf, fly, type Box } from "./Flights";
import { usePuttingIn } from "./trayState";
import "./emoji.css";

const settleMs = 650;

const bigSize = 148;

type Phase = "shown" | "flying";

export function EmojiMoments() {
  const { album, actions } = useAlbum();
  const busy = useBusy();
  const [playing, setPlaying] = useState<Emoji | null>(null);
  const next = owedOf(album)[0] ?? null;
  useEffect(() => {
    if (playing !== null || busy || next === null) return;
    const timer = window.setTimeout(() => setPlaying(next), settleMs);
    return () => window.clearTimeout(timer);
  }, [playing, busy, next]);
  if (playing === null) return null;
  const done = () => {
    actions.markEmojisSeen([playing.id]);
    setPlaying(null);
  };
  return <Moment key={playing.id} album={album} emoji={playing} onDone={done} />;
}

function useBusy() {
  const packsOpen = useHash() === packsHash;
  const puttingIn = usePuttingIn() !== null;
  const teamMoment = useTeamMomentPlaying();
  return packsOpen || puttingIn || teamMoment;
}

function watchTeamMoment(onChange: () => void) {
  const watcher = new MutationObserver(onChange);
  watcher.observe(document.body, { attributes: true, attributeFilter: ["data-r6-moment"] });
  return () => watcher.disconnect();
}

function useTeamMomentPlaying() {
  return useSyncExternalStore(watchTeamMoment, () => document.body.dataset.r6Moment !== undefined);
}

function Moment({ album, emoji, onDone }: { album: Album; emoji: Emoji; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("shown");
  const art = useRef<HTMLSpanElement>(null);
  const take = () => {
    if (phase === "flying") return;
    const from = art.current === null ? null : boxOf(art.current);
    setPhase("flying");
    void flyIntoTheButton(album, emoji, from).then(onDone);
  };
  useEscapeTo(take);
  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => event.target === event.currentTarget && take();
  return (
    <div className="r6s-moment" data-phase={phase} role="dialog" aria-modal="true" aria-label={`New emoji, ${emoji.name}`} onClick={onBackdrop}>
      <div className="r6s-moment-card">
        <span className="r6s-moment-kicker">New emoji unlocked</span>
        <span className="r6s-moment-art">
          <span className="r6s-moment-rays" aria-hidden="true" />
          <span className="r6s-moment-glow" aria-hidden="true" />
          <ConfettiBurst kind="modest" seed={emoji.id.length * 131} />
          <span ref={art} className="r6s-moment-art-spot">
            <EmojiArt album={album} emoji={emoji} size={bigSize} />
          </span>
        </span>
        <p className="r6s-moment-name">{emoji.name}</p>
        <p className="r6s-moment-label">{emoji.label}</p>
        <p className="r6s-moment-why">{whyOf(album, emoji)}</p>
        <p className="r6s-moment-use">{usageWords}</p>
        <button type="button" className="r6s-moment-take" onClick={take} autoFocus>
          Add to my emojis
        </button>
      </div>
    </div>
  );
}

function useEscapeTo(then: () => void) {
  const latest = useRef(then);
  latest.current = then;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && latest.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function emojiButtonBox(): Box {
  const glyph = document.querySelector(".r5 .r6s-emoji-glyph");
  return glyph !== null && glyph.getClientRects().length > 0 ? boxOf(glyph) : { left: window.innerWidth - 120, top: 18, width: 22, height: 22 };
}

async function flyIntoTheButton(album: Album, emoji: Emoji, from: Box | null) {
  if (from === null) return;
  await fly({ content: <EmojiArt album={album} emoji={emoji} size={bigSize} />, width: bigSize, height: bigSize, from, to: emojiButtonBox(), arc: 120, durationMs: 900, spin: 12, peak: 0, landing: { colour: "#F7A501", sparkles: 9, press: "sticker" } });
}
