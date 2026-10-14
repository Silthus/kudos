import { Crate } from "../crates/Crate";
import { PageTitle } from "../PageTitle";
import type { FeatureCard } from "../shell";

export function ReadyPage({ card }: { card: FeatureCard }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6 py-10">
      <PageTitle tab={card.name}>{card.name}</PageTitle>
      <Crate card={card} heading="h2" open="primary" artWidth={128} />
    </section>
  );
}
