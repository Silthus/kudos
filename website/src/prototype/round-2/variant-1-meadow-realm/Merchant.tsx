// PROTOTYPE (#625): Bramble's merchant window: goods in a 2×5 grid with coin prices, a Buyback tab, and packs flying into your bags. Never merge to main.
import { useState, type ReactNode } from "react";
import { HedgehogMoney } from "../../../hoggies";
import { HoggieArt } from "../../art";
import { Coin, Coins, PackArt } from "./bits";
import { Flyer, Toast } from "./moments";
import { Frame } from "./windows";

type Tab = "merchant" | "buyback";

type Goods = { key: string; name: string; note: string; price: number; art: ReactNode; onSale: boolean };

const restocks: Goods[] = ["coffee-cup", "rocket", "chef", "robot"].map((slug) => ({ key: slug, name: "Restocks soon", note: "Not sold in the prototype", price: 120, art: <HoggieArt slug={slug} size={34} silhouette />, onSale: false }));

const slots = 10;

export function Merchant({ coins, price, onBuy, onClose }: { coins: number; price: number; onBuy(): boolean; onClose(): void }) {
  const [tab, setTab] = useState<Tab>("merchant");
  const [bought, setBought] = useState(0);
  const [refused, setRefused] = useState(0);
  const goods: Goods[] = [{ key: "pack", name: "Hoggie pack", note: "One hoggie of any rarity, plus XP and coins", price, art: <PackArt kind="bought" height={40} />, onSale: true }, ...restocks];
  const buy = () => {
    if (onBuy()) setBought(bought + 1);
    else setRefused(refused + 1);
  };
  return (
    <Frame title="Bramble · Pack merchant" icon={<HedgehogMoney size={44} />} className="mr-frame-centre mr-merchant-frame" onClose={onClose}>
      <div className="mr-vendor">
        <p className="mr-vendor-greeting">“Fresh packs, still warm from the press. Fifty coins and a hoggie's yours.”</p>
        {tab === "merchant" ? (
          <ul className="mr-vendor-grid">
            {Array.from({ length: slots }, (_, index) => goods[index] ?? null).map((item, index) =>
              item === null ? (
                <li key={`empty-${index}`} className="mr-vendor-slot mr-vendor-empty" aria-hidden="true">
                  <span className="mr-vendor-icon" />
                </li>
              ) : (
                <li key={item.key} className={`mr-vendor-slot ${item.onSale ? "" : "mr-vendor-off"} ${item.onSale && coins < item.price ? "mr-vendor-short" : ""}`}>
                  <button type="button" className="mr-vendor-buy" disabled={!item.onSale} onClick={buy} title={item.onSale ? `Buy ${item.name} for ${item.price} coins` : item.note}>
                    <span className="mr-vendor-icon">
                      {item.art}
                      {item.onSale && bought > 0 && (
                        <Flyer key={bought} to="[data-mr-pack-home]" delay={0}>
                          <PackArt kind="bought" height={40} />
                        </Flyer>
                      )}
                    </span>
                    <span className="mr-vendor-text">
                      <strong>{item.name}</strong>
                      <span className="mr-vendor-price">
                        <Coin size={13} /> {item.price}
                      </span>
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        ) : (
          <div className="mr-buyback">
            <p>Nothing to buy back.</p>
            <p className="mr-buyback-note">Bramble only sells. Packs you open stay opened, and hoggies stay yours.</p>
          </div>
        )}
        {bought > 0 && tab === "merchant" && <Toast key={bought}>Hoggie pack added to your Pack pouch.</Toast>}
        {refused > 0 && coins < price && tab === "merchant" && <Toast key={`short-${refused}`}>You need {price - coins} more coins.</Toast>}
        <div className="mr-vendor-foot">
          <div className="mr-tabs mr-vendor-tabs" role="tablist" aria-label="Merchant">
            <button type="button" role="tab" aria-selected={tab === "merchant"} className="mr-tab" onClick={() => setTab("merchant")}>
              Merchant
            </button>
            <button type="button" role="tab" aria-selected={tab === "buyback"} className="mr-tab" onClick={() => setTab("buyback")}>
              Buyback
            </button>
          </div>
          <span className="mr-vendor-purse">
            Your coins <Coins amount={coins} />
          </span>
        </div>
      </div>
    </Frame>
  );
}
