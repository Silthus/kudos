// PROTOTYPE (#625): a desk object picked up and held large in the middle: kiosk, medal box, letters, league table, settings clipboard.
import type { CSSProperties, ReactNode } from "react";
import { HedgehogMoney } from "../../hoggies";
import type { Message } from "../../shell";
import { MemberFace } from "../art";
import type { World } from "../world";

export function Zoomed({ label, className, onPutDown, children }: { label: string; className: string; onPutDown: () => void; children: ReactNode }) {
  return (
    <div className="v5-zoom" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="v5-zoom-scrim" aria-label="Put it back on the desk" onClick={onPutDown} />
      <div className={`v5-zoom-object ${className}`}>
        {children}
        <button type="button" className="v5-zoom-close" onClick={onPutDown} aria-label="Put it back on the desk">
          ×
        </button>
      </div>
    </div>
  );
}

export function Kiosk({ world, onBuy, onOpenNewest }: { world: World; onBuy: () => void; onOpenNewest: (() => void) | null }) {
  const short = world.coins < world.store.price;
  return (
    <div className="v5-kiosk">
      <div className="v5-kiosk-awning" />
      <h2 className="v5-zoom-title">The kiosk</h2>
      <div className="v5-kiosk-row">
        <div className="v5-kiosk-jar">
          <HedgehogMoney size={110} />
          <span>
            <strong>{world.coins}</strong> coins in your jar
          </span>
        </div>
        <div className="v5-kiosk-offer">
          <span className="v5-pack v5-pack-bought v5-kiosk-pack" aria-hidden="true">
            <span className="v5-pack-brand">HedgeHug</span>
            <span className="v5-pack-kind">Kiosk</span>
            <span className="v5-pack-mark">?</span>
          </span>
          <p>One sticker pack: a hoggie, some XP and some coins.</p>
          <button type="button" className="v5-buy-button" disabled={short} onClick={onBuy}>
            Buy a pack · {world.store.price} coins
          </button>
          {short && <p className="v5-print-small">You need {world.store.price - world.coins} more coins.</p>}
          {onOpenNewest !== null && (
            <button type="button" className="v5-link-button" onClick={onOpenNewest}>
              Open the newest pack now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Medals({ world }: { world: World }) {
  return (
    <div className="v5-medals">
      <h2 className="v5-zoom-title">Medal box</h2>
      <ul className="v5-medal-rows">
        {world.achievements.map((ladder) => (
          <li key={ladder.ladder} className="v5-medal-row">
            <span className="v5-medal-row-name">
              {ladder.name}
              <span className="v5-print-small">
                {ladder.count} {ladder.counts}
              </span>
            </span>
            <span className="v5-medal-row-tiers">
              {ladder.tiers.map((tier) => (
                <span key={tier.tier} className={`v5-medal v5-medal-big v5-medal-${tier.tier} ${tier.earnedAt === null ? "v5-medal-unearned" : ""}`} title={`${tier.name}: ${tier.at}`}>
                  <span>{tier.earnedAt === null ? tier.at : "★"}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function textOf(message: Message) {
  if (message.kind === "unavailable") return "Message not available";
  return message.segments
    .map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "person") return `@${segment.name}`;
      if (segment.kind === "emoji") return segment.unicode ?? `:${segment.name}:`;
      if (segment.kind === "link") return segment.label ?? segment.url;
      if (segment.kind === "group") return `@${segment.handle}`;
      return " ";
    })
    .join("");
}

const dayOf = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export function Letters({ world }: { world: World }) {
  return (
    <div className="v5-letters-open">
      <h2 className="v5-zoom-title">Letters and notes</h2>
      <div className="v5-letters-columns">
        <section>
          <h3 className="v5-letters-heading">Thanks you got</h3>
          {world.received.map((entry) => (
            <Letter key={entry.key} face={entry.giver.face} who={`From ${entry.giver.name}`} at={entry.at} text={textOf(entry.message)} tilt={-1} />
          ))}
        </section>
        <section>
          <h3 className="v5-letters-heading">Thanks you gave</h3>
          {world.given.map((entry) => (
            <Letter key={entry.key} face={entry.recipients[0]?.face ?? world.me.face} who={`To ${entry.recipients.map(({ name }) => name).join(", ")}`} at={entry.at} text={textOf(entry.message)} tilt={1} />
          ))}
        </section>
      </div>
    </div>
  );
}

function Letter({ face, who, at, text, tilt }: { face: World["me"]["face"]; who: string; at: number; text: string; tilt: number }) {
  return (
    <article className="v5-letter-card" style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <header>
        <MemberFace face={face} className="v5-letter-face" />
        <span className="v5-letter-who">{who}</span>
        <span className="v5-print-small">{dayOf(at)}</span>
      </header>
      <p>{text}</p>
    </article>
  );
}

export function League({ world }: { world: World }) {
  return (
    <div className="v5-league-big">
      <h2 className="v5-zoom-title">League table · this week</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Teammate</th>
            <th>Kudos</th>
          </tr>
        </thead>
        <tbody>
          {world.board.map((row) => (
            <tr key={row.position} className={row.you ? "v5-league-you" : ""}>
              <td>{row.rank}</td>
              <td>
                <span className="v5-league-person">
                  <MemberFace face={row.face} className="v5-league-face" />
                  {row.name}
                  {row.you && <span className="v5-you-tag">you</span>}
                </span>
              </td>
              <td>{row.kudos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SettingsClipboard({ todaysPage }: { todaysPage: ReactNode }) {
  return (
    <div className="v5-clipboard">
      <span className="v5-clipboard-clip" />
      <div className="v5-clipboard-paper">{todaysPage}</div>
    </div>
  );
}
