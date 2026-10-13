import type { ComponentType } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogWizard } from "@posthog/brand/hoggies";
import { IconLock } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";

type Hoggie = ComponentType<{ size?: number; title?: string; className?: string }>;

const lockedFeatures: { name: string; sentence: string; Hog: Hoggie }[] = [
  { name: "Quests", sentence: "Weekly quests of your own, and one your group takes on together.", Hog: HedgehogOrganized },
  { name: "Leaderboard", sentence: "See where you and your group stand.", Hog: HedgehogStar },
  { name: "Sticker book and achievements", sentence: "Stickers from colleagues you thanked or who thanked you, and the achievements you collect.", Hog: HedgehogReading },
  { name: "Skill tree", sentence: "Perks you choose with skill points.", Hog: HedgehogWizard },
  { name: "Coins", sentence: "Coins you spend on hedgehogs and kudos emoji.", Hog: HedgehogMoney },
  { name: "Hedgehogs", sentence: "Hedgehogs to collect, and one to pick as your avatar.", Hog: HedgehogExplorer },
];

export function LockedFeatures() {
  return (
    <section aria-labelledby="still-locked-title" className="flex flex-col gap-3">
      <h2 id="still-locked-title" className="hud-label">
        Still locked
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lockedFeatures.map((feature) => (
          <LockedCard key={feature.name} {...feature} />
        ))}
      </div>
    </section>
  );
}

function LockedCard({ name, sentence, Hog }: { name: string; sentence: string; Hog: Hoggie }) {
  return (
    <article>
      <Card size="sm" className="h-full">
        <CardContent className="flex items-center gap-3">
          <span aria-hidden="true" className="shrink-0">
            <Hog size={48} title="" className="opacity-40 grayscale" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-medium">{name}</h3>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <IconLock aria-hidden="true" className="size-3" />
              Locked
            </span>
            <p className="text-xs text-muted-foreground">{sentence}</p>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
