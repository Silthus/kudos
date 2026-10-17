// PROTOTYPE (#625): the bag bar and bag frames rising from the bottom-right corner: drag items between bags, click any item for its details. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type FormEvent } from "react";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour } from "../../world";
import { BagGlyph, dateOf, Meter, packName, PackArt, RarityPill } from "./bits";
import { bagIcons, capacityOf, packHome, usedBy, type Bag, type BagIcon, type Bags, type Item } from "./bags";
import { isTyping } from "./navigation";

type BagsProps = { state: Bags; stacks: Bag[][]; onOpenPack(id: string): void; onFindHoggie(slug: string): void; onOpenTeam(team: string, person: string | null): void };

type Card = { key: string; anchor: DOMRect };

const dragType = "text/x-mr-item";

export function BagsHud({ state, stacks, onOpenPack, onFindHoggie, onOpenTeam }: BagsProps) {
  const [card, setCard] = useState<Card | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ bag: string; serial: number } | null>(null);
  const allItems = state.bags.flatMap((bag) => state.arranged[bag.id]!);
  const fresh = useFresh(allItems.map(({ key }) => key));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isTyping(event.target)) return;
      if (card !== null) setCard(null);
      else if (adding) setAdding(false);
      else return;
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [card, adding]);

  const drop = (to: string, before: string | null) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const key = event.dataTransfer.getData(dragType) || dragging;
    setDragging(null);
    if (key === null || key === "") return;
    if (!state.move({ key, to, before })) setRefused({ bag: to, serial: (refused?.serial ?? 0) + 1 });
  };
  const carry = { dragging, setDragging, drop };
  const shown = card === null ? null : (allItems.find(({ key }) => key === card.key) ?? null);

  return (
    <>
      <div className="mr-bag-stacks">
        {stacks.map((stack) => (
          <div key={stack[0]!.id} className="mr-bag-stack">
            {stack.map((bag) => (
              <BagFrame key={bag.id} bag={bag} items={state.arranged[bag.id]!} state={state} carry={carry} fresh={fresh} shaking={refused?.bag === bag.id ? refused.serial : null} chosen={card?.key ?? null} onChoose={(key, anchor) => setCard(card?.key === key ? null : { key, anchor })} onOpenPack={onOpenPack} />
            ))}
          </div>
        ))}
      </div>
      <nav className="mr-bag-bar mr-panel" aria-label="Bags">
        {state.bags.map((bag) => {
          const packs = state.arranged[bag.id]!.filter(({ kind }) => kind === "pack").length;
          return (
            <button key={bag.id} type="button" className={`mr-bag-slot ${bag.open ? "mr-bag-slot-open" : ""}`} aria-pressed={bag.open} onClick={() => state.toggle(bag.id)} onDragOver={(event) => event.preventDefault()} onDrop={drop(bag.id, null)} title={`${bag.name} (${usedBy(state.arranged[bag.id]!)}/${capacityOf(bag, state.arranged[bag.id]!)})${bag.id === "backpack" ? " · B opens every bag" : ""}`} data-mr-pack-home={bag.id === packHome ? "" : undefined}>
              <BagGlyph icon={bag.icon} size={34} />
              <span className="sr-only">{bag.name}</span>
              {packs > 0 && (
                <span key={packs} className="mr-bag-count">
                  {packs}
                </span>
              )}
            </button>
          );
        })}
        <button type="button" className="mr-bag-slot mr-bag-add" onClick={() => setAdding(!adding)} aria-expanded={adding} title="Add a bag">
          +<span className="sr-only">Add a bag</span>
        </button>
        {adding && (
          <AddBag
            onAdd={(name, icon) => {
              state.add(name, icon);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </nav>
      {card !== null && shown !== null && <ItemCard item={shown} anchor={card.anchor} bags={state.bags} bagOf={state.bags.find((bag) => state.arranged[bag.id]!.some(({ key }) => key === shown.key))!.id} onMove={(to) => state.move({ key: shown.key, to, before: null })} onClose={() => setCard(null)} onOpenPack={(id) => (setCard(null), onOpenPack(id))} onFindHoggie={(slug) => (setCard(null), onFindHoggie(slug))} onOpenTeam={(team, person) => (setCard(null), onOpenTeam(team, person))} />}
    </>
  );
}

type Carry = { dragging: string | null; setDragging(key: string | null): void; drop(to: string, before: string | null): (event: DragEvent) => void };

type FrameProps = { bag: Bag; items: Item[]; state: Bags; carry: Carry; fresh: ReadonlySet<string>; shaking: number | null; chosen: string | null; onChoose(key: string, anchor: DOMRect): void; onOpenPack(id: string): void };

function BagFrame({ bag, items, state, carry, fresh, shaking, chosen, onChoose, onOpenPack }: FrameProps) {
  const [renaming, setRenaming] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const capacity = capacityOf(bag, items);
  const used = usedBy(items);
  return (
    <section key={shaking ?? "still"} className={`mr-bag ${shaking !== null ? "mr-bag-refused" : ""}`} aria-label={bag.name}>
      <header className="mr-bag-head">
        <BagGlyph icon={bag.icon} size={24} />
        {renaming ? (
          <RenameField
            name={bag.name}
            onDone={(name) => {
              if (name !== null) state.rename(bag.id, name);
              setRenaming(false);
            }}
          />
        ) : (
          <button type="button" className="mr-bag-name" onClick={() => setRenaming(true)} title="Rename this bag">
            {bag.name}
          </button>
        )}
        <span className="mr-bag-used">
          {used}/{capacity}
        </span>
        {!bag.starter && (
          <button type="button" className="mr-bag-tool" onClick={() => state.remove(bag.id)} title="Remove this bag (its items go back to their usual bags)" aria-label={`Remove ${bag.name}`}>
            🗑
          </button>
        )}
        <button type="button" className="mr-bag-tool" onClick={() => state.toggle(bag.id)} aria-label={`Close ${bag.name}`} title="Close">
          ✕
        </button>
      </header>
      <div className={`mr-bag-grid ${carry.dragging !== null ? "mr-bag-grid-dropping" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={carry.drop(bag.id, null)} onDragLeave={() => setOver(null)}>
        {items.map((item) => (
          <ItemButton key={item.key} item={item} fresh={fresh.has(item.key)} chosen={chosen === item.key} over={over === item.key} dragging={carry.dragging === item.key} onChoose={onChoose} onOpenPack={onOpenPack} onDragStart={() => carry.setDragging(item.key)} onDragEnd={() => (carry.setDragging(null), setOver(null))} onDragOver={() => setOver(item.key)} onDrop={carry.drop(bag.id, item.key)} />
        ))}
        {Array.from({ length: Math.max(0, capacity - used) }, (_, index) => (
          <span key={`free-${index}`} className="mr-cell" aria-hidden="true" />
        ))}
      </div>
    </section>
  );
}

function RenameField({ name, onDone }: { name: string; onDone(name: string | null): void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      className="mr-bag-rename"
      value={value}
      autoFocus
      maxLength={24}
      aria-label="Bag name"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onDone(value);
        if (event.key === "Escape") onDone(null);
      }}
    />
  );
}

type ItemButtonProps = { item: Item; fresh: boolean; chosen: boolean; over: boolean; dragging: boolean; onChoose(key: string, anchor: DOMRect): void; onOpenPack(id: string): void; onDragStart(): void; onDragEnd(): void; onDragOver(): void; onDrop(event: DragEvent): void };

function ItemButton({ item, fresh, chosen, over, dragging, onChoose, onOpenPack, onDragStart, onDragEnd, onDragOver, onDrop }: ItemButtonProps) {
  const [width, height] = item.span;
  return (
    <button
      type="button"
      draggable
      className={`mr-item mr-item-${item.kind} ${fresh ? "mr-item-fresh" : ""} ${chosen ? "mr-item-chosen" : ""} ${over ? "mr-item-over" : ""} ${dragging ? "mr-item-dragging" : ""} ${item.kind === "sticker" && item.person.lead ? "mr-item-lead" : ""}`}
      style={{ gridColumn: `span ${width}`, gridRow: `span ${height}`, "--glow": glowOf(item) } as CSSProperties}
      aria-label={`${nameOf(item)}, ${kindOf(item)}. Open details`}
      title={nameOf(item)}
      onClick={(event) => onChoose(item.key, event.currentTarget.getBoundingClientRect())}
      onDoubleClick={() => item.kind === "pack" && onOpenPack(item.pack.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData(dragType, item.key);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={onDrop}
    >
      <ItemArt item={item} />
      {item.kind === "hoggie" && item.hoggie.count > 1 && <span className="mr-item-count">{item.hoggie.count}</span>}
      {fresh && <span className="mr-item-new">NEW</span>}
    </button>
  );
}

function ItemArt({ item }: { item: Item }) {
  if (item.kind === "hoggie") return <HoggieArt slug={item.hoggie.hoggie} size={32} />;
  if (item.kind === "crest") return <CrestArt art={item.team.art} size={70} name={item.team.name} />;
  if (item.kind === "pack") return <PackArt kind={item.pack.kind} height={70} />;
  return (
    <>
      <MemberFace face={item.person.face} className="mr-item-face" />
      <span className="mr-item-corner">
        <CrestArt art={item.team.art} size={item.person.lead ? 22 : 14} name={item.team.name} />
      </span>
      {item.person.lead && <span className="mr-item-star">★</span>}
    </>
  );
}

function glowOf(item: Item) {
  if (item.kind === "hoggie") return rarityColour[item.hoggie.rarity];
  if (item.kind === "crest") return rarityColour.legendary;
  if (item.kind === "pack") return rarityColour.epic;
  return item.person.lead ? rarityColour.rare : rarityColour.uncommon;
}

function nameOf(item: Item) {
  if (item.kind === "hoggie") return item.hoggie.name;
  if (item.kind === "crest") return `${item.team.name} crest`;
  if (item.kind === "pack") return packName[item.pack.kind];
  return item.person.name;
}

function kindOf(item: Item) {
  if (item.kind === "hoggie") return `${item.hoggie.rarity} hoggie`;
  if (item.kind === "crest") return "team crest";
  if (item.kind === "pack") return "unopened pack";
  return item.person.lead ? `${item.team.name} lead sticker` : `${item.team.name} sticker`;
}

type CardProps = { item: Item; anchor: DOMRect; bags: Bag[]; bagOf: string; onMove(to: string): boolean; onClose(): void; onOpenPack(id: string): void; onFindHoggie(slug: string): void; onOpenTeam(team: string, person: string | null): void };

function ItemCard({ item, anchor, bags, bagOf, onMove, onClose, onOpenPack, onFindHoggie, onOpenTeam }: CardProps) {
  const [refusal, setRefusal] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), [item.key]);
  const style: CSSProperties = { right: Math.max(12, window.innerWidth - anchor.left + 12), ...verticalPlaceOf(anchor), ["--glow" as string]: glowOf(item) };
  return (
    <aside className="mr-card" style={style} role="dialog" aria-label={nameOf(item)}>
      <button type="button" className="mr-card-close" onClick={onClose} aria-label="Close details">
        ✕
      </button>
      <CardBody item={item} />
      <div className="mr-card-actions">
        {item.kind === "pack" && (
          <button ref={first} type="button" className="mr-button mr-button-gold mr-glow" onClick={() => onOpenPack(item.pack.id)}>
            Open pack
          </button>
        )}
        {item.kind === "hoggie" && (
          <button ref={first} type="button" className="mr-button mr-button-gold" onClick={() => onFindHoggie(item.hoggie.hoggie)}>
            Find its page in the Hoggie book
          </button>
        )}
        {(item.kind === "sticker" || item.kind === "crest") && (
          <button ref={first} type="button" className="mr-button mr-button-gold" onClick={() => onOpenTeam(item.team.team, item.kind === "sticker" ? item.person.key : null)}>
            Open the {item.team.name} team page
          </button>
        )}
        <label className="mr-card-move">
          Move to bag
          <select value={bagOf} onChange={(event) => setRefusal(!onMove(event.target.value))}>
            {bags.map((bag) => (
              <option key={bag.id} value={bag.id}>
                {bag.name}
              </option>
            ))}
          </select>
        </label>
        {refusal && <p className="mr-card-refusal">That bag is full.</p>}
      </div>
    </aside>
  );
}

function verticalPlaceOf(anchor: DOMRect) {
  if (anchor.top < window.innerHeight / 2) return { top: Math.max(16, anchor.top - 40) };
  return { bottom: Math.max(110, window.innerHeight - anchor.bottom - 20) };
}

function CardBody({ item }: { item: Item }) {
  if (item.kind === "hoggie")
    return (
      <>
        <div className="mr-card-art">
          <HoggieArt slug={item.hoggie.hoggie} size={110} />
        </div>
        <h2 className="mr-card-name" style={{ color: rarityColour[item.hoggie.rarity] }}>
          {item.hoggie.name}
        </h2>
        <RarityPill rarity={item.hoggie.rarity} />
        <ul className="mr-card-stats">
          <li>Held ×{item.hoggie.count}</li>
          <li>{item.hoggie.firstAt === null ? "Just found" : `First found ${dateOf(item.hoggie.firstAt)}`}</li>
        </ul>
        <p className="mr-card-flavour">Drag it into any bag. Its page waits in the Hoggie book.</p>
      </>
    );
  if (item.kind === "pack")
    return (
      <>
        <div className="mr-card-art">
          <PackArt kind={item.pack.kind} height={120} />
        </div>
        <h2 className="mr-card-name">{packName[item.pack.kind]}</h2>
        <ul className="mr-card-stats">
          <li>From: {item.pack.from}</li>
          <li>Holds one hoggie, XP and coins</li>
        </ul>
        <p className="mr-card-flavour">Double-click a pack in your bags to open it right away.</p>
      </>
    );
  if (item.kind === "crest")
    return (
      <>
        <div className="mr-card-art">
          <CrestArt art={item.team.art} size={120} name={item.team.name} />
        </div>
        <h2 className="mr-card-name">{item.team.name} crest</h2>
        <ul className="mr-card-stats">
          <li>
            {item.team.held} of {item.team.total} teammates thanked
          </li>
        </ul>
        <p className="mr-card-flavour">Earned by thanking the whole team.</p>
      </>
    );
  return (
    <>
      <div className="mr-card-art">
        <MemberFace face={item.person.face} className="mr-card-face" />
      </div>
      <h2 className="mr-card-name">
        {item.person.lead && "★ "}
        {item.person.name}
      </h2>
      <p className="mr-card-kind">
        {item.person.role ?? "Teammate"}
        {item.person.lead ? ` · leads ${item.team.name}` : ""}
      </p>
      <p className="mr-card-team">
        <CrestArt art={item.team.art} size={26} name={item.team.name} />
        {item.team.name} · {item.team.held}/{item.team.total} stickers
      </p>
      <Meter value={item.team.held} max={item.team.total} label={`${item.team.name} stickers`} tone="gold" />
      <ul className="mr-card-stats">
        <li>{item.person.heldAt === null ? "Thanked" : `First thanked ${dateOf(item.person.heldAt)}`}</li>
      </ul>
    </>
  );
}

function AddBag({ onAdd, onCancel }: { onAdd(name: string, icon: BagIcon): void; onCancel(): void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<BagIcon>("chest");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd(name, icon);
  };
  return (
    <form className="mr-add-bag mr-panel" onSubmit={submit} aria-label="Add a bag">
      <label className="mr-add-label">
        Name your bag
        <input
          autoFocus
          value={name}
          maxLength={24}
          placeholder="Rares, My team…"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
        />
      </label>
      <div className="mr-add-icons" role="radiogroup" aria-label="Bag">
        {bagIcons.map((each) => (
          <button key={each} type="button" role="radio" aria-checked={each === icon} className="mr-add-icon" onClick={() => setIcon(each)} title={each}>
            <BagGlyph icon={each} size={30} />
          </button>
        ))}
      </div>
      <div className="mr-add-actions">
        <button type="button" className="mr-button mr-button-ghost mr-button-tiny" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="mr-button mr-button-gold mr-button-tiny">
          Add bag
        </button>
      </div>
    </form>
  );
}

function useFresh(keys: string[]) {
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const signature = keys.join("|");
  useEffect(() => {
    const current = signature === "" ? [] : signature.split("|");
    if (known.current === null) {
      known.current = new Set(current);
      return;
    }
    const added = current.filter((key) => !known.current!.has(key));
    current.forEach((key) => known.current!.add(key));
    if (added.length === 0) return;
    setFresh((before) => new Set([...before, ...added]));
    window.setTimeout(() => setFresh((before) => new Set([...before].filter((key) => !added.includes(key)))), 6000);
  }, [signature]);
  return fresh;
}
