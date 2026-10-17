// PROTOTYPE (#625) round 2 variant 4: the shop counter: a shopkeeper, three daily deals with a refresh timer, the packs shelf and a printed receipt. Never merge to main.
import { useEffect, useState, type CSSProperties } from "react";
import { HedgehogMoney } from "../../../hoggies";
import type { Pack } from "../../world";
import { Coins, PackArt } from "./bits";

type Deal = { id: string; name: string; kind: Pack["kind"]; blurb: string };

const dealPool: Deal[] = [
  { id: "morning", name: "Morning pack", kind: "weekly", blurb: "Fresh from the guild's oven." },
  { id: "lucky", name: "Lucky pack", kind: "bought", blurb: "The shopkeeper swears by it." },
  { id: "guild", name: "Guild pack", kind: "group", blurb: "Wrapped in team colours." },
  { id: "explorer", name: "Explorer pack", kind: "journey", blurb: "Smells faintly of adventure." },
];

function dealsOfToday(now: Date): Deal[] {
  const day = Math.floor(now.getTime() / 86_400_000);
  return [0, 1, 2].map((offset) => dealPool[(day + offset) % dealPool.length]!);
}

function untilMidnight(now: Date) {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const seconds = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const parts = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type Receipt = { serial: number; item: string; price: number; left: number };

type StoreProps = { coins: number; price: number; waiting: number; onBuy(): boolean; onOpenBag(): void };

export function Store({ coins, price, waiting, onBuy, onOpenBag }: StoreProps) {
  const now = useNow();
  const deals = dealsOfToday(now);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [says, setSays] = useState("Fresh packs today, friend. Every one holds a hoggie, some XP and a few coins.");
  const short = coins < price;

  const buy = (item: string) => {
    if (!onBuy()) {
      setSays(`That one's ${price} coins. Finish a quest and come back!`);
      return;
    }
    setSays("Pleasure doing business! It's in your bag.");
    setReceipt((current) => ({ serial: (current?.serial ?? 0) + 1, item, price, left: coins - price }));
  };

  return (
    <div className="gh-shop">
      <div className="gh-shop-scene">
        <span className="gh-shop-shelf-back" aria-hidden="true" />
        <span className="gh-shop-keeper" aria-hidden="true">
          <HedgehogMoney size={150} />
        </span>
        <p className="gh-shop-says" aria-live="polite">
          {says}
        </p>
        <span className="gh-shop-counter" aria-hidden="true" />
        <span className="gh-shop-purse">
          Your purse <Coins amount={coins} />
        </span>
      </div>
      <section className="gh-deals" aria-label="Daily deals">
        <header className="gh-deals-head">
          <h2>Daily deals</h2>
          <span className="gh-deals-timer" title="Deals rotate at midnight">
            New deals in <strong>{untilMidnight(now)}</strong>
          </span>
        </header>
        <ul className="gh-deal-row">
          {deals.map((deal, index) => (
            <li key={deal.id} className="gh-deal" style={{ "--deal-delay": `${index * 90}ms` } as CSSProperties}>
              <PackArt kind={deal.kind} width={58} />
              <strong>{deal.name}</strong>
              <span className="gh-muted">{deal.blurb}</span>
              <button type="button" className="gh-button gh-button-gold" disabled={short} onClick={() => buy(deal.name)}>
                Buy <Coins amount={price} size={13} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="gh-packs-shelf" aria-label="Packs shelf">
        <h2>Packs shelf</h2>
        <div className="gh-shelf-board">
          <span className="gh-shelf-item">
            <PackArt kind="bought" width={44} />
            <span>
              <strong>Hoggie pack</strong>
              <span className="gh-muted">One hoggie of any rarity, plus XP and coins.</span>
            </span>
            <button type="button" className="gh-button gh-button-gold" disabled={short} onClick={() => buy("Hoggie pack")}>
              Buy <Coins amount={price} size={13} />
            </button>
          </span>
          <button type="button" className="gh-shelf-bag" onClick={onOpenBag}>
            {waiting === 0 ? "No packs waiting in your bag" : `${waiting} ${waiting === 1 ? "pack" : "packs"} waiting in your bag · open them there`}
          </button>
        </div>
        {short && <p className="gh-shop-short">You need {price - coins} more coins.</p>}
      </section>
      {receipt !== null && <ReceiptStrip key={receipt.serial} receipt={receipt} />}
    </div>
  );
}

function ReceiptStrip({ receipt }: { receipt: Receipt }) {
  return (
    <div className="gh-receipt-slot">
      <div className="gh-receipt" role="status">
        <p className="gh-receipt-head">HedgeHug guild shop</p>
        <p className="gh-receipt-line">
          <span>1× {receipt.item}</span>
          <span>{receipt.price}</span>
        </p>
        <p className="gh-receipt-line gh-receipt-total">
          <span>Coins left</span>
          <span>{receipt.left}</span>
        </p>
        <p className="gh-receipt-foot">Thank you! · Pack sent to your bag</p>
      </div>
      <span className="gh-receipt-drop" aria-hidden="true">
        <PackArt kind="bought" width={40} />
      </span>
    </div>
  );
}
