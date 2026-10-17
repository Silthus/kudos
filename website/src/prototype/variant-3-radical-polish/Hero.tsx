// PROTOTYPE (#625): the one Home hero: level, XP to the next level, and what it opens. Never merge to main.
import { IconExternal } from "@posthog/icons";
import { HedgehogClimber } from "../../hoggies";
import { MemberFace } from "../art";
import type { World } from "../world";
import { LevelBar } from "./motion";
import { useStage } from "./stage";
import { opensAt } from "./words";

const number = new Intl.NumberFormat("en-GB");

export function Hero({ world, chatUrl }: { world: World; chatUrl: string }) {
  const { shownLevel: level } = useStage();
  const { me } = world;
  return (
    <section className="v3-hero" aria-labelledby="v3-hero-title">
      <div className="v3-hero-who">
        <span className="v3-hero-face">
          <MemberFace face={me.face} className="v3-hero-face-img" />
        </span>
        <div>
          <p className="v3-eyebrow">Level</p>
          <p className="v3-hero-level v3-num" key={level.level}>
            {level.level}
          </p>
        </div>
      </div>
      <div className="v3-hero-climb">
        <h1 id="v3-hero-title" className="v3-hero-name" tabIndex={-1}>
          {me.name}
        </h1>
        <div className="v3-hero-xp">
          <span>
            <strong className="v3-num">{number.format(level.xp)}</strong> XP
          </span>
          <span>
            <strong className="v3-num">{number.format(level.toNext)} XP</strong> to level {level.level + 1}
          </span>
        </div>
        <LevelBar level={level} size="lg" label={`${level.toNext} XP to level ${level.level + 1}`} />
        <p className="v3-hero-next">
          <span className="v3-hero-next-label">{`Level ${level.level + 1} opens`}</span> {opensAt(level.level + 1)}
        </p>
        <div className="v3-hero-foot">
          <a className="v3-button v3-button-primary" href={chatUrl} target="_blank" rel="noreferrer">
            Thank someone in Slack
            <IconExternal className="v3-link-icon" />
          </a>
          <span className="v3-hero-allowance">
            <Allowance left={me.allowance.left} base={me.allowance.base} />
            {`${me.allowance.left} of ${me.allowance.base} kudos left today`}
          </span>
          <span className="v3-hero-week">{`This week you gave ${me.thisWeek.given} and received ${me.thisWeek.received}`}</span>
        </div>
      </div>
      <HedgehogClimber size={190} className="v3-hero-art" />
    </section>
  );
}

function Allowance({ left, base }: { left: number; base: number }) {
  return (
    <span className="v3-allowance" aria-hidden="true">
      {Array.from({ length: base }, (_, slot) => (
        <span key={slot} className="v3-allowance-dot" data-left={slot < left || undefined} />
      ))}
    </span>
  );
}
