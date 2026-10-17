// PROTOTYPE (#625): the Market: a stall scene with a merchant hoggie, shelves of packs, today's offers and a timed special. Never merge to main.
import { useEffect, useState } from "react";
import { HedgehogMoney } from "../../../hoggies";
import type { PackKind } from "../../world";
import { Coin, Coins, PackArt } from "./bits";
import { Flyer } from "./moments";

type Offer = { id: string; name: string; blurb: string; kind: PackKind; special?: boolean };

const offers: Offer[] = [
  { id: "meadow", name: "Meadow pack", blurb: "One hoggie, XP and coins", kind: "bought" },
  { id: "harbour", name: "Harbour pack", blurb: "Fresh off the boat", kind: "weekly" },
  { id: "village", name: "Village pack", blurb: "Bake sale favourite", kind: "group" },
];

const special: Offer = { id: "sunrise", name: "Sunrise pack", blurb: "Gone at midnight", kind: "journey", special: true };

const greetings = ["Fresh packs today!", "Psst… the special won't last.", "Every pack holds a hoggie. Promise."];

type Props = { coins: number; price: number; packsWaiting: number; onBuy: () => boolean; onOpenBag: () => void };

export function Market({ coins, price, packsWaiting, onBuy, onOpenBag }: Props) {
  const [line, setLine] = useState(greetings[0]!);
  const [sold, setSold] = useState<string | null>(null);
  const countdown = useCountdownToMidnight();

  useEffect(() => {
    const timer = window.setInterval(() => setLine((current) => greetings[(greetings.indexOf(current) + 1) % greetings.length]!), 5200);
    return () => window.clearInterval(timer);
  }, []);

  const buy = (offer: Offer) => {
    if (!onBuy()) {
      setLine("Come back with a few more coins, friend.");
      return;
    }
    setSold(`${offer.id}:${Date.now()}`);
    setLine(`A ${offer.name}! It's in your bag. Pleasure doing business!`);
  };

  return (
    <div className="wm-market">
      <div className="wm-awning" aria-hidden="true" />
      <div className="wm-market-scene">
        <div className="wm-shelf" aria-hidden="true">
          {(["bought", "weekly", "group", "journey", "bought", "weekly"] as PackKind[]).map((kind, index) => (
            <PackArt key={index} kind={kind} width={30} className="wm-shelf-pack" />
          ))}
        </div>
        <div className="wm-merchant">
          <p key={line} className="wm-speech" role="status">
            {line}
          </p>
          <HedgehogMoney size={120} className="wm-merchant-hog" />
        </div>
        <div className="wm-purse">
          <span>Your purse</span>
          <Coins amount={coins} size={18} />
          <button type="button" className="wm-link" onClick={onOpenBag}>
            {packsWaiting} {packsWaiting === 1 ? "pack" : "packs"} in your bag
          </button>
        </div>
      </div>
      <div className="wm-counter">
        <h3 className="wm-counter-title">Today's offers</h3>
        <ul className="wm-offers">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} price={price} affordable={coins >= price} justSold={sold?.startsWith(`${offer.id}:`) ?? false} soldKey={sold} onBuy={() => buy(offer)} />
          ))}
        </ul>
        <div className="wm-special">
          <span className="wm-special-badge">Special</span>
          <OfferCard offer={special} price={price} affordable={coins >= price} justSold={sold?.startsWith("sunrise:") ?? false} soldKey={sold} onBuy={() => buy(special)} />
          <p className="wm-special-timer" aria-label={`Ends in ${countdown}`}>
            Ends in <strong>{countdown}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, price, affordable, justSold, soldKey, onBuy }: { offer: Offer; price: number; affordable: boolean; justSold: boolean; soldKey: string | null; onBuy: () => void }) {
  return (
    <li className={`wm-offer ${offer.special ? "wm-offer-special" : ""}`}>
      <span className="wm-offer-art">
        {justSold ? (
          <Flyer key={soldKey} to='[data-wm-target="bag"]' delay={60} className="wm-offer-flyer">
            <PackArt kind={offer.kind} width={offer.special ? 64 : 52} />
          </Flyer>
        ) : (
          <PackArt kind={offer.kind} width={offer.special ? 64 : 52} />
        )}
      </span>
      <span className="wm-offer-name">{offer.name}</span>
      <span className="wm-offer-blurb">{offer.blurb}</span>
      <button type="button" className="wm-button wm-button-gold wm-buy" onClick={onBuy} disabled={!affordable}>
        Buy · <Coin size={14} /> {price}
      </button>
    </li>
  );
}

function useCountdownToMidnight() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const left = Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(Math.floor(left / 3600))}:${two(Math.floor((left % 3600) / 60))}:${two(left % 60)}`;
}
