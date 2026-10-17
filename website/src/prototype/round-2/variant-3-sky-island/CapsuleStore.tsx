// PROTOTYPE (#625): the travelling merchant's capsule machine: insert coins, turn the crank, a capsule drops with a pack. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HedgehogMoney } from "../../../hoggies";
import { prefersReducedMotion } from "../../../reducedMotion";
import type { World } from "../../world";
import { Coin, PackArt } from "./looks";
import { Modal } from "./Windows";

type Phase = "idle" | "coin" | "ready" | "cranking" | "dropped" | "popped";

type Props = { world: World; onClose: () => void; onBuy: () => boolean; onOpenPack: (id: string) => void };

const capsules = [
  { x: 22, y: 58, colour: "#f54e00" },
  { x: 46, y: 64, colour: "#1d4aff" },
  { x: 70, y: 58, colour: "#f7a501" },
  { x: 34, y: 40, colour: "#2fa84f" },
  { x: 58, y: 42, colour: "#a259ff" },
  { x: 80, y: 38, colour: "#ff7ab6" },
  { x: 20, y: 30, colour: "#1d4aff" },
  { x: 46, y: 22, colour: "#f7a501" },
  { x: 68, y: 22, colour: "#f54e00" },
];

const beats: Partial<Record<Phase, [Phase, number]>> = { coin: ["ready", 700], cranking: ["dropped", 1200] };

export function CapsuleStore({ world, onClose, onBuy, onOpenPack }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [direct, setDirect] = useState(0);
  const before = useRef<ReadonlySet<string>>(new Set());
  const price = world.store.price;
  const short = world.coins < price;
  const fresh = world.packs.find((pack) => !before.current.has(pack.id)) ?? null;

  useEffect(() => {
    const beat = beats[phase];
    if (beat === undefined) return;
    const timer = window.setTimeout(() => setPhase(beat[0]), prefersReducedMotion() ? 0 : beat[1]);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const insert = () => {
    before.current = new Set(world.packs.map(({ id }) => id));
    if (onBuy()) setPhase("coin");
  };
  const buyDirectly = () => {
    if (onBuy()) setDirect((count) => count + 1);
  };

  return (
    <Modal title="The travelling merchant" size="wide" className="sk-store" onClose={onClose}>
      <div className="sk-store-stage">
        <Machine phase={phase} onCrank={() => phase === "ready" && setPhase("cranking")} onPop={() => phase === "dropped" && setPhase("popped")} />
        <div className="sk-merchant">
          <div className="sk-merchant-talk">
            <HedgehogMoney size={92} />
            <p className="sk-merchant-bubble">{lineOf(phase, short)}</p>
          </div>
          <p className="sk-merchant-price">
            One capsule: <Coin size={18} /> <strong>{price}</strong> <span className="sk-merchant-purse">· you have {world.coins}</span>
          </p>
          <div className="sk-merchant-actions">
            {phase === "idle" && (
              <button type="button" className="sk-button sk-button-gold sk-button-big" disabled={short} onClick={insert}>
                Insert <Coin size={16} /> {price} coins
              </button>
            )}
            {phase === "coin" && <p className="sk-merchant-wait">Clink…</p>}
            {phase === "ready" && (
              <button type="button" className="sk-button sk-button-gold sk-button-big sk-pulse" onClick={() => setPhase("cranking")}>
                Turn the crank
              </button>
            )}
            {phase === "cranking" && <p className="sk-merchant-wait">Rattle, rattle…</p>}
            {phase === "dropped" && (
              <button type="button" className="sk-button sk-button-gold sk-button-big sk-pulse" onClick={() => setPhase("popped")}>
                Pop the capsule
              </button>
            )}
            {phase === "popped" && (
              <>
                <div className="sk-popped">
                  <PackArt kind="bought" size={96} />
                  <p>
                    <strong>Merchant pack</strong> is in your inventory.
                  </p>
                </div>
                <div className="sk-merchant-row">
                  {fresh !== null && (
                    <button type="button" className="sk-button sk-button-gold" onClick={() => onOpenPack(fresh.id)}>
                      Open it now
                    </button>
                  )}
                  <button type="button" className="sk-button" onClick={() => setPhase("idle")} disabled={short}>
                    Another capsule
                  </button>
                </div>
              </>
            )}
          </div>
          <p className="sk-merchant-direct">
            In a hurry?{" "}
            <button type="button" className="sk-link" onClick={buyDirectly} disabled={short || (phase !== "idle" && phase !== "popped")}>
              Buy a pack straight to your inventory
            </button>
            {direct > 0 && <span className="sk-merchant-bought"> ✓ {direct} added</span>}
          </p>
          {short && <p className="sk-merchant-short">You need {price - world.coins} more coins. Quests and packs pay coins.</p>}
          <p className="sk-merchant-packs">Unopened packs in your inventory: {world.packs.length}</p>
        </div>
      </div>
    </Modal>
  );
}

function lineOf(phase: Phase, short: boolean) {
  if (phase === "popped") return "A fine pack! Open it now or keep it for later.";
  if (phase === "dropped") return "There it is! Pop it open.";
  if (phase === "cranking") return "Round and round she goes…";
  if (phase === "ready") return "Now give that crank a good turn!";
  if (phase === "coin") return "Thank you kindly!";
  return short ? "Come back with a few more coins, friend." : "Fresh packs from the far islands! One hoggie in every capsule.";
}

function Machine({ phase, onCrank, onPop }: { phase: Phase; onCrank: () => void; onPop: () => void }) {
  return (
    <div className="sk-gacha" data-phase={phase}>
      <div className="sk-gacha-dome">
        {capsules.map((capsule, index) => (
          <span key={index} className="sk-capsule" style={{ left: `${capsule.x}%`, top: `${capsule.y}%`, "--capsule": capsule.colour, "--i": index } as CSSProperties} aria-hidden="true" />
        ))}
        <span className="sk-gacha-glint" aria-hidden="true" />
      </div>
      <div className="sk-gacha-body">
        <span className="sk-gacha-sign">HOGGIE CAPSULES</span>
        <span className="sk-gacha-slot" aria-hidden="true">
          {phase === "coin" && <span className="sk-gacha-coin" />}
        </span>
        <button type="button" className="sk-gacha-crank" onClick={onCrank} disabled={phase !== "ready"} aria-label="Turn the crank">
          <span className="sk-gacha-handle" />
        </button>
        <span className="sk-gacha-chute">
          {(phase === "dropped" || phase === "popped") && (
            <button type="button" className={`sk-capsule-out ${phase === "popped" ? "sk-capsule-open" : ""}`} onClick={onPop} aria-label="Pop the capsule" disabled={phase === "popped"}>
              <span className="sk-capsule-top" />
              <span className="sk-capsule-bottom" />
            </button>
          )}
        </span>
      </div>
      <span className="sk-gacha-feet" aria-hidden="true" />
    </div>
  );
}
