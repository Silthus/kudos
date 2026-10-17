// PROTOTYPE (#625) round 2 variant 4: the bag in the right zone: guild bank side tabs with player icons, drag and drop, sort, and item details. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type DragEvent } from "react";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, type World } from "../../world";
import { cellsOf, itemsIn, itemsOf, packName, tabIcons, tabOf, type BagAction, type BagItem, type BagState } from "./bag";
import { PackArt, RarityPill, TabIconArt } from "./bits";

const columns = 8;

const minimumCells = columns * 9;

type InventoryProps = {
  world: World;
  bag: BagState;
  dispatch: Dispatch<BagAction>;
  fresh: ReadonlySet<string>;
  onOpenPack(id: string): void;
  onHoggiePage(slug: string): void;
  onTeamPage(team: string): void;
  onClose(): void;
};

export function Inventory({ world, bag, dispatch, fresh, onOpenPack, onHoggiePage, onTeamPage, onClose }: InventoryProps) {
  const items = itemsOf(world);
  const shown = itemsIn(bag, items, bag.active);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const chosenItem = items.find(({ key }) => key === chosen) ?? null;
  const used = cellsOf(shown);
  const fillers = Math.max(minimumCells, Math.ceil(used / columns) * columns) - used;
  const activeTab = bag.tabs.find(({ id }) => id === bag.active)!;

  const dropOnTab = (event: DragEvent, tab: string) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    setOver(null);
    setDragging(null);
    if (key !== "") dispatch({ type: "move", key, tab });
  };
  const dropOnCell = (event: DragEvent, before: string | null) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    setOver(null);
    setDragging(null);
    if (key === "" || !shown.some((item) => item.key === key)) return;
    dispatch({ type: "reorder", key, before, shown: shown.map((item) => item.key) });
  };

  return (
    <section className="gh-dock-frame gh-inventory" aria-label="Bag">
      <header className="gh-dock-tabs gh-inventory-head">
        <span className="gh-inventory-title">
          Bag · {activeTab.name}
          <small>
            {used} cells · {shown.length} items
          </small>
        </span>
        <button type="button" className="gh-button gh-button-small" onClick={() => dispatch({ type: "sort", shown })} title="Arrange this tab by kind, rarity and size">
          Sort
        </button>
        <button type="button" className="gh-dock-close" onClick={onClose} aria-label="Close the bag" title="Close the bag (B)">
          ✕
        </button>
      </header>
      <div className="gh-inventory-body">
        <nav className="gh-bank-tabs" aria-label="Bag tabs">
          {bag.tabs.map((tab) => {
            const count = items.filter((item) => tabOf(bag, item) === tab.id).length;
            return (
              <span key={tab.id} className="gh-bank-tab-wrap">
                <button
                  type="button"
                  className={`gh-bank-tab ${tab.id === bag.active ? "gh-bank-tab-on" : ""} ${over === tab.id ? "gh-bank-tab-over" : ""}`}
                  aria-pressed={tab.id === bag.active}
                  onClick={() => dispatch({ type: "select", tab: tab.id })}
                  onDoubleClick={() => setEditing(tab.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOver(tab.id);
                  }}
                  onDragLeave={() => setOver((current) => (current === tab.id ? null : current))}
                  onDrop={(event) => dropOnTab(event, tab.id)}
                >
                  <TabIconArt icon={tab.icon} size={34} />
                  <span className="gh-bank-tab-count">{count}</span>
                  <span className="gh-bank-tip" role="tooltip">
                    {tab.name} · {count} items
                    <small>Drop an item here to move it · double-click to edit</small>
                  </span>
                  <span className="sr-only">{tab.name}</span>
                </button>
              </span>
            );
          })}
          <button type="button" className="gh-bank-tab gh-bank-add" onClick={() => dispatch({ type: "add" })} aria-label="Add a tab" title="Add a tab">
            +
          </button>
          <button type="button" className="gh-bank-tab gh-bank-edit" onClick={() => setEditing(bag.active)} aria-label={`Edit the ${activeTab.name} tab`} title="Edit this tab">
            ✎
          </button>
        </nav>
        <div className="gh-grid-scroll">
          <ul className="gh-grid" style={{ "--columns": columns } as CSSProperties}>
            {shown.map((item) => (
              <li
                key={item.key}
                className="gh-grid-slot"
                style={{ gridColumn: `span ${item.size[0]}`, gridRow: `span ${item.size[1]}` }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(item.key);
                }}
                onDrop={(event) => dropOnCell(event, item.key)}
              >
                <ItemButton
                  item={item}
                  chosen={chosen === item.key}
                  dragging={dragging === item.key}
                  over={over === item.key && dragging !== item.key}
                  fresh={fresh.has(item.key)}
                  onChoose={() => setChosen(chosen === item.key ? null : item.key)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", item.key);
                    event.dataTransfer.effectAllowed = "move";
                    setDragging(item.key);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                />
              </li>
            ))}
            {Array.from({ length: fillers }, (_, index) => (
              <li
                key={`free-${index}`}
                className="gh-grid-free"
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(null);
                }}
                onDrop={(event) => dropOnCell(event, null)}
                aria-hidden="true"
              />
            ))}
          </ul>
        </div>
      </div>
      <p className="gh-inventory-help">Click an item for details. Drag to reorder, or onto a tab icon to move it.</p>
      {chosenItem !== null && (
        <ItemDetails
          item={chosenItem}
          bag={bag}
          onClose={() => setChosen(null)}
          onMove={(tab) => {
            dispatch({ type: "move", key: chosenItem.key, tab });
            setChosen(null);
          }}
          onOpenPack={(id) => {
            setChosen(null);
            onOpenPack(id);
          }}
          onHoggiePage={(slug) => {
            setChosen(null);
            onHoggiePage(slug);
          }}
          onTeamPage={(team) => {
            setChosen(null);
            onTeamPage(team);
          }}
        />
      )}
      {editing !== null && <TabEditor bag={bag} tab={editing} dispatch={dispatch} onDone={() => setEditing(null)} />}
    </section>
  );
}

type ItemButtonProps = { item: BagItem; chosen: boolean; dragging: boolean; over: boolean; fresh: boolean; onChoose(): void; onDragStart(event: DragEvent): void; onDragEnd(): void };

function ItemButton({ item, chosen, dragging, over, fresh, onChoose, onDragStart, onDragEnd }: ItemButtonProps) {
  return (
    <button
      type="button"
      draggable
      className={`gh-item gh-item-${item.kind} ${chosen ? "gh-item-chosen" : ""} ${dragging ? "gh-item-dragging" : ""} ${over ? "gh-item-over" : ""} ${fresh ? "gh-item-fresh" : ""}`}
      style={{ "--glow": glowOf(item) } as CSSProperties}
      onClick={onChoose}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={`${item.name}, ${kindLabelOf(item)}. Open details`}
      aria-expanded={chosen}
      title={item.name}
    >
      <ItemArt item={item} />
      {item.kind === "hoggie" && item.hoggie.count > 1 && <span className="gh-item-count">×{item.hoggie.count}</span>}
      {item.kind === "sticker" && item.person.lead && <span className="gh-item-lead">★ Lead</span>}
      {fresh && <span className="gh-item-new">NEW</span>}
    </button>
  );
}

function glowOf(item: BagItem) {
  if (item.kind === "hoggie") return rarityColour[item.hoggie.rarity];
  if (item.kind === "crest") return rarityColour.legendary;
  if (item.kind === "pack") return rarityColour.epic;
  return item.person.lead ? rarityColour.rare : rarityColour.uncommon;
}

function kindLabelOf(item: BagItem) {
  if (item.kind === "hoggie") return `${item.hoggie.rarity} hoggie`;
  if (item.kind === "crest") return "team crest";
  if (item.kind === "pack") return "unopened pack";
  return `${item.team.name} sticker`;
}

function ItemArt({ item, large = false }: { item: BagItem; large?: boolean }) {
  const scale = large ? 2.4 : 1;
  if (item.kind === "hoggie") return <HoggieArt slug={item.hoggie.hoggie} size={Math.round((item.size[0] > 1 ? 86 : 40) * (large ? 1.4 : 1))} />;
  if (item.kind === "crest") return <CrestArt art={item.team.art} size={Math.round(84 * (large ? 1.4 : 1))} name={item.team.name} />;
  if (item.kind === "pack") return <PackArt kind={item.pack.kind} width={Math.round(36 * scale)} />;
  return <MemberFace face={item.person.face} className={`gh-item-face ${item.person.lead ? "gh-item-face-lead" : ""} ${large ? "gh-item-face-large" : ""}`} />;
}

type DetailsProps = { item: BagItem; bag: BagState; onClose(): void; onMove(tab: string): void; onOpenPack(id: string): void; onHoggiePage(slug: string): void; onTeamPage(team: string): void };

function ItemDetails({ item, bag, onClose, onMove, onOpenPack, onHoggiePage, onTeamPage }: DetailsProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [item.key]);
  const here = tabOf(bag, item);
  return (
    <aside className="gh-details" role="dialog" aria-label={`${item.name} details`} style={{ "--glow": glowOf(item) } as CSSProperties}>
      <button type="button" className="gh-details-x" onClick={onClose} aria-label="Close details">
        ✕
      </button>
      <div className="gh-details-art">
        <ItemArt item={item} large />
      </div>
      <h3 ref={heading} tabIndex={-1} className="gh-details-name" style={{ color: glowOf(item) }}>
        {item.name}
      </h3>
      <DetailsBody item={item} />
      <div className="gh-details-actions">
        {item.kind === "pack" && (
          <button type="button" className="gh-button gh-button-gold" onClick={() => onOpenPack(item.pack.id)}>
            Open pack
          </button>
        )}
        {item.kind === "hoggie" && (
          <button type="button" className="gh-button gh-button-gold" onClick={() => onHoggiePage(item.hoggie.hoggie)}>
            Its page in the Hoggies book
          </button>
        )}
        {(item.kind === "sticker" || item.kind === "crest") && (
          <button type="button" className="gh-button gh-button-gold" onClick={() => onTeamPage(item.team.team)}>
            Open the {item.team.name} page
          </button>
        )}
        <label className="gh-move">
          <span>Move to tab…</span>
          <select value={here} onChange={(event) => onMove(event.target.value)}>
            {bag.tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}

function DetailsBody({ item }: { item: BagItem }) {
  if (item.kind === "hoggie")
    return (
      <div className="gh-details-body">
        <RarityPill rarity={item.hoggie.rarity} />
        <p>You hold ×{item.hoggie.count}.</p>
        <p className="gh-muted">{item.hoggie.firstAt === null ? "Just found." : `First found ${dateOf(item.hoggie.firstAt)}.`}</p>
      </div>
    );
  if (item.kind === "crest")
    return (
      <div className="gh-details-body">
        <p>Every teammate on {item.team.name} is in your book.</p>
        <p className="gh-muted">
          {item.team.held} of {item.team.total} stickers
        </p>
      </div>
    );
  if (item.kind === "pack")
    return (
      <div className="gh-details-body">
        <p>{packName[item.pack.kind]}, still sealed.</p>
        <p className="gh-muted">From: {item.pack.from}</p>
        <p className="gh-muted">Holds one hoggie, XP and coins.</p>
      </div>
    );
  return (
    <div className="gh-details-body">
      <p>
        {item.person.role ?? "Teammate"} on <strong>{item.team.name}</strong>
        {item.person.lead ? " · team lead" : ""}
      </p>
      <p className="gh-muted">{item.person.heldAt === null ? "Thanked." : `First thanked ${dateOf(item.person.heldAt)}.`}</p>
      <p className="gh-muted">
        {item.team.name}: {item.team.held} of {item.team.total} stickers
      </p>
    </div>
  );
}

function dateOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function TabEditor({ bag, tab, dispatch, onDone }: { bag: BagState; tab: string; dispatch: Dispatch<BagAction>; onDone(): void }) {
  const current = bag.tabs.find(({ id }) => id === tab);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  if (current === undefined) return null;
  return (
    <aside className="gh-tab-editor" role="dialog" aria-label="Edit tab">
      <h3>Edit tab</h3>
      <label className="gh-field">
        <span>Name</span>
        <input ref={input} value={current.name} maxLength={24} onChange={(event) => dispatch({ type: "rename", tab, name: event.target.value })} onKeyDown={(event) => event.key === "Enter" && onDone()} />
      </label>
      <p className="gh-field-label">Icon</p>
      <div className="gh-icon-pick">
        {tabIcons.map((icon) => (
          <button key={icon} type="button" className={`gh-icon-choice ${current.icon === icon ? "gh-icon-on" : ""}`} aria-pressed={current.icon === icon} aria-label={icon} onClick={() => dispatch({ type: "icon", tab, icon })}>
            <TabIconArt icon={icon} size={30} />
          </button>
        ))}
      </div>
      <div className="gh-tab-editor-actions">
        <button
          type="button"
          className="gh-button gh-button-danger"
          disabled={bag.tabs.length <= 1}
          onClick={() => {
            dispatch({ type: "remove", tab });
            onDone();
          }}
        >
          Delete tab
        </button>
        <button type="button" className="gh-button gh-button-gold" onClick={onDone}>
          Done
        </button>
      </div>
      <p className="gh-muted gh-tab-editor-note">Deleting a tab sends its items back to their usual tab.</p>
    </aside>
  );
}
