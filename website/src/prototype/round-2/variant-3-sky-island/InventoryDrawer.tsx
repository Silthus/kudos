// PROTOTYPE (#625): the right drawer: one inventory grid with smart tabs, player-made tabs, drag and drop, and an item card. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, type World } from "../../world";
import { hashOfHoggie, hashOfPerson } from "./books";
import { arranged, itemsOf, smartTabs, type InventoryState, type Item, type TabId } from "./inventory";
import { dayOf, Meter, PackArt, packLook, rarityLabel } from "./looks";

type Props = { world: World; open: boolean; inventory: InventoryState; fresh: ReadonlySet<string>; onToggle: () => void; onClose: () => void; onOpenPack: (id: string) => void; onShowInBook: (hash: string, spotlight: string) => void };

const columns = 7;

const minimumCells = columns * 8;

export function InventoryDrawer({ world, open, inventory, fresh, onToggle, onClose, onOpenPack, onShowInBook }: Props) {
  const items = arranged(itemsOf(world), inventory.order);
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ key: string; from: TabId } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const customTab = inventory.custom.find((tab) => tab.id === inventory.active) ?? null;
  const smart = smartTabs.find((tab) => tab.id === inventory.active);
  const shown = customTab !== null ? customTab.keys.flatMap((key) => items.find((item) => item.key === key) ?? []) : items.filter((item) => smart?.holds(item, fresh) ?? true);
  const chosen = items.find((item) => item.key === chosenKey) ?? null;
  const used = shown.reduce((sum, { size: [width, height] }) => sum + width * height, 0);

  useEffect(() => {
    if (refused === null) return;
    const timer = window.setTimeout(() => setRefused(null), 500);
    return () => window.clearTimeout(timer);
  }, [refused]);

  const carried = useRef<{ key: string; from: TabId } | null>(null);
  const startDrag = (event: DragEvent, item: Item) => {
    event.dataTransfer.setData("text/plain", item.key);
    event.dataTransfer.effectAllowed = "move";
    carried.current = { key: item.key, from: inventory.active };
    setDragging(carried.current);
  };
  const endDrag = () => {
    carried.current = null;
    setDragging(null);
    setOver(null);
  };
  const allowDrop = (event: DragEvent, target: string) => {
    if (carried.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(target);
  };
  const dropOnTab = (event: DragEvent, tab: TabId) => {
    event.preventDefault();
    const held = carried.current;
    if (held === null) return;
    if (!tab.startsWith("custom:")) setRefused(tab);
    else inventory.putInto(tab, held.key, held.from);
    endDrag();
  };
  const dropOnItem = (event: DragEvent, before: string | null) => {
    event.preventDefault();
    const held = carried.current;
    if (held !== null && held.key !== before) inventory.reorder(inventory.active, held.key, before, items.map(({ key }) => key));
    endDrag();
  };

  return (
    <aside className="sk-drawer sk-drawer-right" data-open={open || undefined} aria-label="Inventory">
      <button type="button" className="sk-pull sk-pull-right" onClick={onToggle} aria-expanded={open} aria-keyshortcuts="I" data-sk-target="inventory">
        <BagIcon />
        <span>Inventory</span>
        {world.packs.length > 0 && <span className="sk-pull-tally">{world.packs.length}</span>}
      </button>
      <div className="sk-drawer-body sk-inventory" inert={!open}>
        <header className="sk-inventory-head">
          <h2>Inventory</h2>
          <span className="sk-inventory-count">{items.length} items</span>
          <button type="button" className="sk-drawer-close" onClick={onClose} aria-label="Close the inventory">
            ✕
          </button>
        </header>
        <div className="sk-inv-tabs" role="tablist" aria-label="Inventory tabs">
          {smartTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={inventory.active === tab.id}
              className={`sk-inv-tab sk-inv-tab-smart ${refused === tab.id ? "sk-refused" : ""} ${over === `tab:${tab.id}` ? "sk-tab-over-refuse" : ""}`}
              onClick={() => inventory.setActive(tab.id)}
              onDragOver={(event) => allowDrop(event, `tab:${tab.id}`)}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => dropOnTab(event, tab.id)}
              title={`${tab.label}: fills itself`}
            >
              <span aria-hidden="true">{tab.icon}</span> {tab.label}
              {tab.id === "packs" && world.packs.length > 0 && <span className="sk-inv-tab-count">{world.packs.length}</span>}
            </button>
          ))}
          <span className="sk-inv-tabs-gap" aria-hidden="true" />
          {inventory.custom.map((tab) => (
            <CustomTabButton
              key={tab.id}
              name={tab.name}
              count={tab.keys.filter((key) => items.some((item) => item.key === key)).length}
              selected={inventory.active === tab.id}
              over={over === `tab:${tab.id}`}
              onSelect={() => inventory.setActive(tab.id as TabId)}
              onRename={(name) => inventory.renameTab(tab.id, name)}
              onDelete={() => inventory.deleteTab(tab.id)}
              onDragOver={(event) => allowDrop(event, `tab:${tab.id}`)}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => dropOnTab(event, tab.id as TabId)}
            />
          ))}
          <button type="button" className="sk-inv-tab sk-inv-add" onClick={inventory.addTab} title="Make your own tab">
            + Tab
          </button>
        </div>
        <p className="sk-inv-hint">{customTab === null ? "Smart tab: fills itself. Drag items onto your own tabs to sort them." : customTab.keys.length === 0 ? "Your own tab. Drag items here from any other tab." : "Your own tab. Drag to reorder, or onto another tab to move."}</p>
        <div className="sk-inv-grid" style={{ "--columns": columns } as CSSProperties} onDragOver={(event) => allowDrop(event, "grid")} onDrop={(event) => dropOnItem(event, null)}>
          {shown.map((item) => (
            <ItemCell
              key={item.key}
              item={item}
              fresh={fresh.has(item.key)}
              chosen={chosenKey === item.key}
              over={over === item.key}
              dragging={dragging?.key === item.key}
              onChoose={() => setChosenKey(chosenKey === item.key ? null : item.key)}
              onDragStart={(event) => startDrag(event, item)}
              onDragEnd={endDrag}
              onDragOver={(event) => {
                event.stopPropagation();
                allowDrop(event, item.key);
              }}
              onDrop={(event) => {
                event.stopPropagation();
                dropOnItem(event, item.key);
              }}
            />
          ))}
          {Array.from({ length: Math.max(0, minimumCells - used) }, (_, index) => (
            <span key={`free-${index}`} className="sk-cell sk-cell-free" aria-hidden="true" />
          ))}
        </div>
        {chosen !== null && <ItemCard key={chosen.key} item={chosen} world={world} inventory={inventory} onClose={() => setChosenKey(null)} onOpenPack={onOpenPack} onShowInBook={onShowInBook} />}
      </div>
    </aside>
  );
}

type CustomTabProps = { name: string; count: number; selected: boolean; over: boolean; onSelect: () => void; onRename: (name: string) => void; onDelete: () => void; onDragOver: (event: DragEvent) => void; onDragLeave: () => void; onDrop: (event: DragEvent) => void };

function CustomTabButton({ name, count, selected, over, onSelect, onRename, onDelete, onDragOver, onDragLeave, onDrop }: CustomTabProps) {
  const [editing, setEditing] = useState(name.startsWith("Tab ") && count === 0 && selected);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);
  if (editing)
    return (
      <input
        ref={field}
        className="sk-inv-tab sk-inv-rename"
        defaultValue={name}
        aria-label="Tab name"
        maxLength={18}
        onBlur={(event) => {
          onRename(event.currentTarget.value);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setEditing(false);
          event.stopPropagation();
        }}
      />
    );
  return (
    <span className={`sk-inv-custom ${selected ? "sk-inv-custom-on" : ""} ${over ? "sk-tab-over" : ""}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <button type="button" role="tab" aria-selected={selected} className="sk-inv-tab sk-inv-tab-custom" onClick={onSelect} onDoubleClick={() => setEditing(true)} title="Your tab. Double-click to rename.">
        {name}
        <span className="sk-inv-tab-count">{count}</span>
      </button>
      {selected && (
        <>
          <button type="button" className="sk-inv-tab-tool" onClick={() => setEditing(true)} aria-label={`Rename ${name}`} title="Rename">
            ✎
          </button>
          <button type="button" className="sk-inv-tab-tool" onClick={onDelete} aria-label={`Delete ${name}`} title="Delete this tab (items stay in All)">
            🗑
          </button>
        </>
      )}
    </span>
  );
}

type CellProps = { item: Item; fresh: boolean; chosen: boolean; over: boolean; dragging: boolean; onChoose: () => void; onDragStart: (event: DragEvent) => void; onDragEnd: () => void; onDragOver: (event: DragEvent) => void; onDrop: (event: DragEvent) => void };

function ItemCell({ item, fresh, chosen, over, dragging, onChoose, onDragStart, onDragEnd, onDragOver, onDrop }: CellProps) {
  const [width, height] = item.size;
  return (
    <button
      type="button"
      draggable
      className={`sk-cell sk-item sk-item-${item.kind} ${chosen ? "sk-item-chosen" : ""} ${over ? "sk-item-over" : ""} ${dragging ? "sk-item-dragging" : ""} ${fresh ? "sk-item-fresh" : ""}`}
      style={{ gridColumn: `span ${width}`, gridRow: `span ${height}`, "--glow": item.kind === "pack" ? packLook[item.pack.kind].colour : item.kind === "sticker" ? "#1f8a3b" : rarityColour[item.rarity] } as CSSProperties}
      aria-label={`${labelOf(item)}. Open details`}
      aria-pressed={chosen}
      onClick={onChoose}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ItemArt item={item} />
      {item.kind === "hoggie" && item.hoggie.count > 1 && <span className="sk-item-corner">×{item.hoggie.count}</span>}
      {item.kind === "sticker" && item.person.lead && <span className="sk-item-lead">★ {item.person.name.split(" ")[0]}</span>}
      {(fresh || item.recent) && <span className="sk-item-new">NEW</span>}
    </button>
  );
}

function labelOf(item: Item) {
  if (item.kind === "pack") return `${packLook[item.pack.kind].name}, unopened`;
  if (item.kind === "sticker") return `${item.name}, team sticker${item.person.lead ? ", lead" : ""}`;
  return `${item.name}, ${rarityLabel[item.rarity]} hoggie`;
}

function ItemArt({ item }: { item: Item }) {
  if (item.kind === "pack") return <PackArt kind={item.pack.kind} size={70} />;
  if (item.kind === "sticker") return <MemberFace face={item.person.face} className={item.person.lead ? "sk-item-face sk-item-face-lead" : "sk-item-face"} />;
  return <HoggieArt slug={item.hoggie.hoggie} size={40} />;
}

type CardProps = { item: Item; world: World; inventory: InventoryState; onClose: () => void; onOpenPack: (id: string) => void; onShowInBook: (hash: string, spotlight: string) => void };

function ItemCard({ item, world, inventory, onClose, onOpenPack, onShowInBook }: CardProps) {
  return (
    <section className="sk-item-card" aria-label={`${item.name} details`} style={{ "--glow": item.kind === "pack" ? packLook[item.pack.kind].colour : item.kind === "sticker" ? "#1f8a3b" : rarityColour[item.rarity] } as CSSProperties}>
      <button type="button" className="sk-item-card-close" onClick={onClose} aria-label="Close details">
        ✕
      </button>
      {item.kind === "hoggie" && (
        <div className="sk-card-row">
          <span className="sk-card-art">
            <HoggieArt slug={item.hoggie.hoggie} size={92} />
          </span>
          <div className="sk-card-text">
            <p className="sk-card-kind" style={{ color: rarityColour[item.rarity] }}>
              {rarityLabel[item.rarity]} hoggie
            </p>
            <h3>{item.name}</h3>
            <p className="sk-card-sub">
              Held ×{item.hoggie.count}
              {item.hoggie.firstAt !== null && ` · first found ${dayOf(item.hoggie.firstAt)}`}
            </p>
            <button type="button" className="sk-button sk-button-blue" onClick={() => onShowInBook(hashOfHoggie(world, item.hoggie.hoggie), item.hoggie.hoggie)}>
              See its page in the Hoggies book
            </button>
          </div>
        </div>
      )}
      {item.kind === "sticker" && (
        <div className="sk-card-row">
          <span className="sk-card-art">
            <MemberFace face={item.person.face} className="sk-card-face" />
          </span>
          <div className="sk-card-text">
            <p className="sk-card-kind" style={{ color: "#1f7a35" }}>
              Team sticker{item.person.lead ? " · ★ lead" : ""}
            </p>
            <h3>{item.name}</h3>
            <p className="sk-card-sub">
              {item.person.role ?? "Teammate"}
              {item.person.heldAt !== null && ` · thanked ${dayOf(item.person.heldAt)}`}
            </p>
            <ul className="sk-card-teams">
              {item.teams.map((team) => (
                <li key={team.team}>
                  <button type="button" className="sk-card-team" onClick={() => onShowInBook(hashOfPerson(world, team.team, item.person.key), item.person.key)}>
                    <CrestArt art={team.art} size={30} name={team.name} collected={team.complete || team.crest !== null} />
                    <span>
                      <strong>{team.name}</strong>
                      <Meter value={team.held} max={team.total} label={`${team.name} stickers`} colour="#1f8a3b" />
                    </span>
                    <span className="sk-card-team-go">Team page ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {item.kind === "pack" && (
        <div className="sk-card-row">
          <span className="sk-card-art sk-card-pack">
            <PackArt kind={item.pack.kind} size={96} />
          </span>
          <div className="sk-card-text">
            <p className="sk-card-kind" style={{ color: packLook[item.pack.kind].colour }}>
              Unopened pack
            </p>
            <h3>{packLook[item.pack.kind].name}</h3>
            <p className="sk-card-sub">From: {item.pack.from}. One hoggie, plus XP and coins.</p>
            <button type="button" className="sk-button sk-button-gold sk-button-big" onClick={() => onOpenPack(item.pack.id)}>
              Open pack
            </button>
          </div>
        </div>
      )}
      <MoveToTab item={item} inventory={inventory} />
    </section>
  );
}

function MoveToTab({ item, inventory }: { item: Item; inventory: InventoryState }) {
  const inCustom = inventory.custom.find((tab) => tab.id === inventory.active);
  return (
    <div className="sk-card-move">
      <label>
        Move to tab…
        <select
          value=""
          onChange={(event) => {
            if (event.target.value !== "") inventory.putInto(event.target.value, item.key, inventory.active);
          }}
        >
          <option value="">Choose a tab</option>
          {inventory.custom
            .filter((tab) => !tab.keys.includes(item.key))
            .map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.name}
              </option>
            ))}
        </select>
      </label>
      {inCustom !== undefined && inCustom.keys.includes(item.key) && (
        <button type="button" className="sk-link" onClick={() => inventory.takeOut(inCustom.id, item.key)}>
          Take out of {inCustom.name}
        </button>
      )}
    </div>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M9 4a3 3 0 0 1 6 0v1h3.2l1.6 15.5A1.4 1.4 0 0 1 18.4 22H5.6a1.4 1.4 0 0 1-1.4-1.5L5.8 5H9zm1.6 0v1h2.8V4a1.4 1.4 0 0 0-2.8 0zM8 9a4 4 0 0 0 8 0h-1.6a2.4 2.4 0 0 1-4.8 0z" fill="currentColor" />
    </svg>
  );
}
