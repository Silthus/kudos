import { OpenButton, useFeatureCrate } from "../crates/Crate";
import { CrateArt } from "../crates/CrateArt";
import { hogOf, isOrAre, sentenceOf } from "../features";
import { crateTargetAttributes } from "../linkTarget";
import { PageTitle } from "../PageTitle";
import type { FeatureCard, MemberProfile } from "../shell";

export function ReadyPage({ card, member }: { card: FeatureCard; member: MemberProfile }) {
  const crate = useFeatureCrate(card);
  const Hog = hogOf(card.feature);
  return (
    <section className="hud-panel mx-auto w-full max-w-3xl overflow-hidden rounded-xl border shadow-sm" {...crateTargetAttributes(card.feature)}>
      <div className="night-band flex flex-col items-center gap-3 px-4 pb-10 pt-10 text-center md:pb-12 md:pt-14">
        <PageTitle tab={card.name} size="headline">{`${card.name} ${isOrAre(card.feature)} ready`}</PageTitle>
        <p className="night-band-quiet max-w-md text-balance text-base">{sentenceOf(card.feature, member)}</p>
        <div className="mt-6 cursor-pointer" onClick={crate.open}>
          <CrateArt phase="closed" width={200} Hog={Hog} nudge={crate.nudge} />
        </div>
        {crate.failure !== undefined && <p className="text-sm font-medium">{crate.failure}</p>}
        <OpenButton crate={crate} variant="primary" size="lg" className="mt-2 h-11 px-6 text-base" />
      </div>
    </section>
  );
}
