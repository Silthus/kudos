// PROTOTYPE (#625): the one inventory: hoggies, team stickers and packs in player-made tabs, sorted by drag and drop. Never merge to main.
import { useState, type CSSProperties, type DragEvent, type Dispatch, type SetStateAction } from "react";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, type World } from "../../world";
import { PackArt, RarityPill, packLook, shortDate } from "./bits";
import { everything, itemsOf, movedBefore, movedToTab, nameOf, shownIn, tabColours, tabIcons, tabMovedBefore, withTab, withoutTab, type Bag, type BagTab, type Item } from "./bag";

const itemType = "text/x-wm-item";

const tabType = "text/x-wm-tab";

type Props = {
  world: World;
  bag: Bag;
  setBag: Dispatch<SetStateAction<Bag>>;
  fresh: ReadonlySet<string>;
  onOpenPack: (id: string) => void;
  onOpenHoggie: (slug: string) => void;
  onOpenTeam: (team: string) => void;
};

export function Inventory({ world, bag, setBag, fresh, onOpenPack, onOpenHoggie, onOpenTeam }: Props) {
  const items = itemsOf(world);
  const [tab, setTab] = useState(everything);
  const [chosen, setChosen] = useState<string | null>(null);
  const [editing, setEditing] = useState<BagTab | "new" | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const activeTab = bag.tabs.find(({ id }) => id === tab) ?? bag.tabs[0]!;
  const shown = shownIn(bag, items, activeTab.id);
  const selected = items.find(({ key }) => key === chosen) ?? null;

  const primary = (item: Item) => {
    if (item.kind === "pack") onOpenPack(item.pack.id);
    else if (item.kind === "hoggie") onOpenHoggie(item.hoggie.hoggie);
    else onOpenTeam(item.team.team);
  };

  const dropOnTab = (event: DragEvent, id: string) => {
    event.preventDefault();
    setOver(null);
    const item = event.dataTransfer.getData(itemType);
    const movingTab = event.dataTransfer.getData(tabType);
    if (item !== "") setBag((current) => movedToTab(current, item, id));
    if (movingTab !== "") setBag((current) => tabMovedBefore(current, movingTab, id));
  };

  const dropOnItem = (event: DragEvent, before: string | null) => {
    const item = event.dataTransfer.getData(itemType);
    if (item === "") return;
    event.preventDefault();
    event.stopPropagation();
    setOver(null);
    setBag((current) => {
      const sorted = movedBefore(current, items, item, before);
      return activeTab.id === everything ? sorted : movedToTab(sorted, item, activeTab.id);
    });
  };

  const allowDrop = (event: DragEvent, target: string) => {
    if (![...event.dataTransfer.types].some((type) => type === itemType || type === tabType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(target);
  };

  return (
    <div className="wm-bag">
      <div className="wm-bag-tabs" role="tablist" aria-label="Inventory tabs">
        {bag.tabs.map((each) => {
          const count = shownIn(bag, items, each.id).length;
          return (
            <button
              key={each.id}
              type="button"
              role="tab"
              aria-selected={each.id === activeTab.id}
              className={`wm-bag-tab ${over === `tab:${each.id}` ? "wm-drop-over" : ""}`}
              style={{ "--wm-tab": each.colour } as CSSProperties}
              draggable={each.id !== everything}
              onDragStart={(event) => {
                event.dataTransfer.setData(tabType, each.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => allowDrop(event, `tab:${each.id}`)}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => dropOnTab(event, each.id)}
              onClick={() => setTab(each.id)}
              onDoubleClick={() => each.id !== everything && setEditing(each)}
              title={each.id === everything ? "Everything you hold" : `${each.name}: drop items here, drag to reorder, double-click to rename`}
            >
              <span className="wm-bag-tab-icon" aria-hidden="true">
                {each.icon}
              </span>
              {each.name}
              <span className="wm-bag-tab-count">{count}</span>
            </button>
          );
        })}
        <button type="button" className="wm-bag-tab wm-bag-tab-add" onClick={() => setEditing("new")} title="New tab" aria-label="New tab">
          +
        </button>
        {activeTab.id !== everything && (
          <span className="wm-bag-tab-tools">
            <button type="button" onClick={() => setEditing(activeTab)} title={`Rename ${activeTab.name}`} aria-label={`Rename ${activeTab.name}`}>
              ✎
            </button>
            <button
              type="button"
              onClick={() => {
                setBag((current) => withoutTab(current, activeTab.id));
                setTab(everything);
              }}
              title={`Delete ${activeTab.name} (its items go back to Everything)`}
              aria-label={`Delete ${activeTab.name}`}
            >
              🗑
            </button>
          </span>
        )}
      </div>
      {editing !== null && (
        <TabEditor
          tab={editing === "new" ? null : editing}
          onSave={(saved) => {
            setBag((current) => withTab(current, saved));
            setTab(saved.id);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="wm-bag-body">
        <div className={`wm-bag-grid ${over === "grid" ? "wm-drop-over" : ""}`} onDragOver={(event) => allowDrop(event, "grid")} onDragLeave={() => setOver(null)} onDrop={(event) => dropOnItem(event, null)}>
          {shown.map((item) => (
            <Cell key={item.key} item={item} fresh={isFresh(item, fresh)} chosen={item.key === chosen} over={over === item.key} onChoose={() => setChosen(item.key)} onUse={() => primary(item)} onDragOver={(event) => allowDrop(event, item.key)} onDrop={(event) => dropOnItem(event, item.key)} />
          ))}
          {shown.length === 0 && <p className="wm-bag-empty">Drag items onto this tab's name to sort them here.</p>}
        </div>
        <Details item={selected} bag={bag} onMove={(id) => selected !== null && setBag((current) => movedToTab(current, selected.key, id))} onUse={primary} />
      </div>
      <p className="wm-bag-help">Click an item to inspect it, double-click to use it. Drag items between cells or onto a tab; drag tabs to reorder them.</p>
    </div>
  );
}

function isFresh(item: Item, fresh: ReadonlySet<string>) {
  if (item.kind === "hoggie") return fresh.has(item.hoggie.hoggie);
  if (item.kind === "pack") return fresh.has(item.pack.id);
  return false;
}

type CellProps = { item: Item; fresh: boolean; chosen: boolean; over: boolean; onChoose: () => void; onUse: () => void; onDragOver: (event: DragEvent) => void; onDrop: (event: DragEvent) => void };

function Cell({ item, fresh, chosen, over, onChoose, onUse, onDragOver, onDrop }: CellProps) {
  const [width, height] = item.size;
  return (
    <button
      type="button"
      draggable
      className={`wm-item wm-item-${item.kind} ${chosen ? "wm-item-chosen" : ""} ${over ? "wm-drop-over" : ""} ${fresh ? "wm-item-fresh" : ""}`}
      style={{ gridColumn: `span ${width}`, gridRow: `span ${height}`, "--wm-glow": glowOf(item) } as CSSProperties}
      aria-label={`${nameOf(item)}, ${kindOf(item)}`}
      aria-pressed={chosen}
      onClick={onChoose}
      onDoubleClick={onUse}
      onDragStart={(event) => {
        event.dataTransfer.setData(itemType, item.key);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ItemArt item={item} />
      {item.kind === "hoggie" && item.hoggie.count > 1 && <span className="wm-item-corner">×{item.hoggie.count}</span>}
      {item.kind === "sticker" && item.person.lead && <span className="wm-item-lead">Lead</span>}
      {fresh && <span className="wm-item-new">NEW</span>}
    </button>
  );
}

function glowOf(item: Item) {
  if (item.kind === "hoggie") return rarityColour[item.hoggie.rarity];
  if (item.kind === "pack") return rarityColour[packLook[item.pack.kind].rarity];
  if (item.kind === "crest") return rarityColour.legendary;
  return item.person.lead ? rarityColour.rare : rarityColour.uncommon;
}

function kindOf(item: Item) {
  if (item.kind === "hoggie") return `${item.hoggie.rarity} hoggie`;
  if (item.kind === "pack") return "unopened pack";
  if (item.kind === "crest") return "team crest";
  return `${item.team.name} team sticker`;
}

function ItemArt({ item }: { item: Item }) {
  if (item.kind === "hoggie") return <HoggieArt slug={item.hoggie.hoggie} size={40} />;
  if (item.kind === "pack") return <PackArt kind={item.pack.kind} width={40} className="wm-item-pack" />;
  if (item.kind === "crest") return <CrestArt art={item.team.art} size={84} name={item.team.name} />;
  return (
    <span className="wm-item-sticker">
      <MemberFace face={item.person.face} className="wm-item-face" />
      <span className="wm-item-team" aria-hidden="true">
        <CrestArt art={item.team.art} size={item.person.lead ? 22 : 14} name={item.team.name} />
      </span>
      {item.person.lead && <span className="wm-item-sticker-name">{item.person.name.split(" ")[0]}</span>}
    </span>
  );
}

function Details({ item, bag, onMove, onUse }: { item: Item | null; bag: Bag; onMove: (tab: string) => void; onUse: (item: Item) => void }) {
  if (item === null)
    return (
      <aside className="wm-details wm-details-empty">
        <p>Pick an item to see what it is.</p>
      </aside>
    );
  const home = bag.home[item.key] ?? everything;
  return (
    <aside className="wm-details" aria-label={`${nameOf(item)} details`} style={{ "--wm-glow": glowOf(item) } as CSSProperties}>
      <span className="wm-details-art">
        {item.kind === "hoggie" && <HoggieArt slug={item.hoggie.hoggie} size={96} />}
        {item.kind === "pack" && <PackArt kind={item.pack.kind} width={72} className="wm-details-pack" />}
        {item.kind === "crest" && <CrestArt art={item.team.art} size={100} name={item.team.name} />}
        {item.kind === "sticker" && <MemberFace face={item.person.face} className="wm-details-face" />}
      </span>
      <h3>{item.kind === "pack" ? packLook[item.pack.kind].name : nameOf(item)}</h3>
      <DetailFacts item={item} />
      <button type="button" className="wm-button wm-button-gold" onClick={() => onUse(item)}>
        {item.kind === "pack" ? "Open pack" : item.kind === "hoggie" ? "See its page in the Hoggie book" : "Open the team page"}
      </button>
      <label className="wm-details-move">
        Move to tab…
        <select value={home} onChange={(event) => onMove(event.target.value)}>
          {bag.tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.icon} {tab.id === everything ? "No tab (Everything)" : tab.name}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}

function DetailFacts({ item }: { item: Item }) {
  if (item.kind === "hoggie")
    return (
      <div className="wm-details-facts">
        <RarityPill rarity={item.hoggie.rarity} />
        <p>Held ×{item.hoggie.count}</p>
        <p>{item.hoggie.firstAt === null ? "Just found" : `First found ${shortDate(item.hoggie.firstAt)}`}</p>
      </div>
    );
  if (item.kind === "pack")
    return (
      <div className="wm-details-facts">
        <p>From: {item.pack.from}</p>
        <p>Holds one hoggie, some XP and coins.</p>
      </div>
    );
  if (item.kind === "crest")
    return (
      <div className="wm-details-facts">
        <p>Team crest</p>
        <p>
          {item.team.held}/{item.team.total} teammates thanked
        </p>
      </div>
    );
  return (
    <div className="wm-details-facts">
      <p className="wm-details-team">
        <CrestArt art={item.team.art} size={20} name={item.team.name} /> {item.team.name}
      </p>
      <p>
        {item.person.lead ? "★ Team lead" : "Teammate"}
        {item.person.role === null ? "" : ` · ${item.person.role}`}
      </p>
      {item.person.heldAt !== null && <p>Sticker since {shortDate(item.person.heldAt)}</p>}
    </div>
  );
}

function TabEditor({ tab, onSave, onCancel }: { tab: BagTab | null; onSave: (tab: BagTab) => void; onCancel: () => void }) {
  const [name, setName] = useState(tab?.name ?? "");
  const [icon, setIcon] = useState(tab?.icon ?? tabIcons[0]!);
  const [colour, setColour] = useState(tab?.colour ?? tabColours[0]!);
  const save = () => onSave({ id: tab?.id ?? `tab-${Date.now()}`, name: name.trim() === "" ? "New tab" : name.trim(), icon, colour });
  return (
    <form
      className="wm-tab-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      <label className="wm-tab-editor-name">
        {tab === null ? "New tab" : "Rename tab"}
        <input autoFocus value={name} maxLength={18} placeholder="Name it" onChange={(event) => setName(event.target.value)} />
      </label>
      <fieldset className="wm-tab-editor-icons">
        <legend>Icon</legend>
        {tabIcons.map((each) => (
          <label key={each} className="wm-pick" style={{ "--wm-tab": colour } as CSSProperties}>
            <input type="radio" name="wm-icon" value={each} checked={each === icon} onChange={() => setIcon(each)} />
            <span>{each}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="wm-tab-editor-colours">
        <legend>Colour</legend>
        {tabColours.map((each) => (
          <label key={each} className="wm-pick wm-pick-colour" style={{ "--wm-tab": each } as CSSProperties}>
            <input type="radio" name="wm-colour" value={each} checked={each === colour} onChange={() => setColour(each)} aria-label={each} />
            <span />
          </label>
        ))}
      </fieldset>
      <span className="wm-tab-editor-actions">
        <button type="submit" className="wm-button wm-button-gold wm-button-tiny">
          {tab === null ? "Create" : "Save"}
        </button>
        <button type="button" className="wm-button wm-button-tiny" onClick={onCancel}>
          Cancel
        </button>
      </span>
    </form>
  );
}
