import { Card, CardContent } from "@posthog/quill";
import { useState } from "react";
import { PageTitle } from "../PageTitle";
import type { PerkNode, SkillTreeAnswer, TreeRow } from "../shell";
import { PerkDetailsDrawer, PerkDetailsPanel, type SelectedPerk } from "../skills/PerkDetails";
import { PerkTree } from "../skills/PerkTree";
import { pointsToSpend } from "../skills/perkWords";
import { useWideScreen } from "../skills/useWideScreen";
import { YourPerks } from "../skills/YourPerks";

type Tree = Extract<SkillTreeAnswer, { kind: "tree" }>;

export function SkillTreePage({ tree }: { tree: Tree }) {
  const wide = useWideScreen();
  const [chosen, setChosen] = useState<PerkNode["perk"]>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selected = selectedIn(tree.rows, chosen);
  const select = (perk: PerkNode["perk"]) => {
    setChosen(perk);
    setDrawerOpen(true);
  };
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="hud-label">Skill tree</span>
        <PageTitle tab="Skill tree">Perks</PageTitle>
        <p className="text-sm text-muted-foreground">{pointsToSpend(tree.skillPoints)}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {selected && <PerkTree rows={tree.rows} selected={selected.perk.perk} onSelect={select} />}
          <YourPerks rows={tree.rows} />
        </div>
        <div className="flex flex-col gap-6">
          {wide && selected && <PerkDetailsPanel {...selected} chatUrl={tree.chatUrl} />}
          <HowPerksWork />
        </div>
      </div>
      {!wide && selected && <PerkDetailsDrawer {...selected} chatUrl={tree.chatUrl} open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

function selectedIn(rows: TreeRow[], chosen: PerkNode["perk"] | undefined): SelectedPerk | undefined {
  const shown = rows.flatMap(({ level, perks }) => perks.map((perk) => ({ perk, level })));
  return shown.find(({ perk }) => perk.perk === chosen) ?? shown.find(({ perk }) => perk.state === "available") ?? shown[0];
}

function HowPerksWork() {
  return (
    <section aria-labelledby="how-perks-work-title">
      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          <h2 id="how-perks-work-title" className="hud-label">
            How perks work
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Perks give bonus XP when you thank someone and say why. Bonuses count when your message has 5 or more words besides mentions and emoji. Every level from 5 on gives one skill point. A spent skill point never comes back, and there's no respec.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
