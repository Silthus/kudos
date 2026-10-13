// PROTOTYPE perk list: one flush card per branch, upgrades indented under their base perk.
import { IconCheck, IconCornerDownRight, IconLock } from "@posthog/icons";
import { Badge as Tag, Card, CardContent, CardDescription, CardHeader, CardTitle, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@posthog/quill";
import { Fragment } from "react";
import { branches } from "../../data/mock";
import type { Perk, PerkState } from "../../data/types";
import { rowsFor, shortState, type PerkFilter } from "./perks";

export function PerkList({ filter, selected, onSelect }: { filter: PerkFilter; selected?: string; onSelect: (id: string) => void }) {
  const sections = branches.map((branch) => ({ branch, rows: rowsFor(branch, filter) })).filter((s) => s.rows.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ branch, rows }) => (
        <Card key={branch.id} size="sm" flush>
          <CardHeader>
            <CardTitle>{branch.name}</CardTitle>
            <CardDescription>{branch.blurb}</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup combined>
              {rows.map(({ perk, indented }, i) => (
                <Fragment key={perk.id}>
                  {i > 0 && <ItemSeparator className="my-0" />}
                  <PerkRow perk={perk} indented={indented} selected={perk.id === selected} onSelect={() => onSelect(perk.id)} />
                </Fragment>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PerkRow({ perk, indented, selected, onSelect }: { perk: Perk; indented: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <Item
      size="sm"
      render={<button type="button" />}
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex-nowrap rounded-none text-left ${selected ? "bg-fill-selected" : "hover:bg-fill-hover"}`}
    >
      {indented && <IconCornerDownRight className="ml-1 size-4 shrink-0 self-start text-muted-foreground" aria-label="Upgrade of the perk above" />}
      <ItemContent className="min-w-0">
        <ItemTitle>{perk.name}</ItemTitle>
        <ItemDescription className="line-clamp-1">{perk.effect}</ItemDescription>
      </ItemContent>
      <ItemActions className="shrink-0">
        <PerkStateLabel state={perk.state} />
      </ItemActions>
    </Item>
  );
}

export function PerkStateLabel({ state }: { state: PerkState }) {
  if (state.kind === "owned")
    return (
      <Tag variant="success">
        <IconCheck />
        Owned
      </Tag>
    );
  if (state.kind === "available") return <Tag variant="info">Can buy</Tag>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <IconLock className="size-3.5" />
      {shortState(state)}
    </span>
  );
}
