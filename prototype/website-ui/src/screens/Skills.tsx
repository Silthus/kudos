// PROTOTYPE skill tree: perks grouped by branch, with the selected perk's details and buy action beside them.
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useEffect, useState } from "react";
import { me, perks } from "../data/mock";
import type { Perk } from "../data/types";
import { HedgehogGardener, PageHeader } from "../ui";
import { PerkAction, PerkFacts } from "./skills/PerkDetails";
import { PerkList } from "./skills/PerkList";
import { branchName, perkName, type PerkFilter } from "./skills/perks";

const filters: Array<[PerkFilter, string]> = [
  ["all", "All"],
  ["can-buy", "Can buy"],
  ["owned", "Owned"],
];

export function Skills({ param }: { param?: string }) {
  const wide = useWide();
  const [filter, setFilter] = useState<PerkFilter>("all");
  const [selectedId, setSelectedId] = useState(() => perks.find((p) => p.id === param)?.id ?? perks.find((p) => p.state.kind === "available")?.id);
  const [drawerOpen, setDrawerOpen] = useState(() => perks.some((p) => p.id === param));
  const selected = perks.find((p) => p.id === selectedId);

  const select = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Skill tree"
        hog={HedgehogGardener}
        description={
          <>
            Perks make every thank-you count for a little more. You have <span className="font-medium text-foreground">{me.skillPointsUnspent} skill points</span> to spend, {me.coins} coins, and you're level {me.level}.
          </>
        }
        actions={
          <ToggleGroup variant="outline" size="sm" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as PerkFilter)} aria-label="Filter perks">
            {filters.map(([id, label]) => (
              <ToggleGroupItem key={id} value={id}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <PerkList filter={filter} selected={wide || drawerOpen ? selectedId : undefined} onSelect={select} />
        {wide && selected && <PerkCard key={selected.id} perk={selected} />}
      </div>
      {!wide && selected && <PerkDrawer key={selected.id} perk={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />}
    </>
  );
}

const subtitle = (perk: Perk) => (perk.requires ? `${branchName(perk)} · upgrade of ${perkName(perk.requires)}` : branchName(perk));

function PerkCard({ perk }: { perk: Perk }) {
  return (
    <Card size="sm" className="lg:sticky lg:top-8">
      <CardHeader>
        <CardTitle>{perk.name}</CardTitle>
        <CardDescription>{subtitle(perk)}</CardDescription>
      </CardHeader>
      <CardContent>
        <PerkFacts perk={perk} />
      </CardContent>
      <CardFooter className="flex-col items-stretch">
        <PerkAction perk={perk} />
      </CardFooter>
    </Card>
  );
}

function PerkDrawer({ perk, open, onOpenChange }: { perk: Perk; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{perk.name}</DrawerTitle>
          <DrawerDescription>{subtitle(perk)}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <PerkFacts perk={perk} />
        </div>
        <DrawerFooter>
          <PerkAction perk={perk} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const wideQuery = "(min-width: 1024px)";

function useWide() {
  const [wide, setWide] = useState(() => matchMedia(wideQuery).matches);
  useEffect(() => {
    const query = matchMedia(wideQuery);
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}
