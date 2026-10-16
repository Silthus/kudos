import { useEffect, useId, useRef } from "react";
import { Button, Card, CardContent } from "@posthog/quill";
import type { Collection } from "../collectionRead";
import { CrateArt } from "../crates/CrateArt";
import { attemptMessages, useMoments } from "../crates/moments";
import { boughtCrateOf, type BoughtCrate } from "../crates/readyCrates";
import { hogOf } from "../features";
import { shortfallText } from "../home/itemPurchase";
import { crateTargetAttributes } from "../linkTarget";
import type { ShellActions } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";
import { useCratePurchase, type CratePurchasing } from "./cratePurchase";

type CrateStoreProps = { collection: Collection; coins: number | null; buyCrate: ShellActions["buyCrate"] };

export function CrateStore({ collection, coins, buyCrate }: CrateStoreProps) {
  const headingId = useId();
  const waiting = (collection.bought ?? []).flatMap((crate) => boughtCrateOf(crate) ?? []);
  const offer = collection.crateStore ?? null;
  const purchase = useCratePurchase(buyCrate, offer?.next);
  const list = useFocusOnTheBoughtCrate(purchase);
  if (offer === null && waiting.length === 0 && purchase.notice === undefined && !purchase.buying) return null;
  return (
    <section aria-labelledby={headingId} data-crate-store className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="hud-display text-lg font-bold leading-tight">
          Crates
        </h2>
        <span className="text-xs text-muted-foreground">A crate drops one hoggie when you open it.</span>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {waiting.length > 0 && <WaitingCrates crates={waiting} listRef={list} />}
          {offer !== null && <Offer price={offer.price} coins={coins} purchase={purchase} primary={waiting.length === 0} />}
          <p role="status" className={`text-xs font-medium ${purchase.notice === undefined ? "sr-only" : ""}`}>
            {purchase.notice?.text}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function useFocusOnTheBoughtCrate(purchase: CratePurchasing) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (purchase.justBought === undefined) return;
    const open = list.current?.querySelector<HTMLElement>(`[data-crate-target="${purchase.justBought}"] button`);
    if (!open) return;
    open.focus();
    purchase.focusedTheBoughtCrate();
  });
  return list;
}

type WaitingCratesProps = { crates: BoughtCrate[]; listRef: React.RefObject<HTMLUListElement | null> };

function WaitingCrates({ crates, listRef }: WaitingCratesProps) {
  return (
    <ul ref={listRef} aria-label="Waiting to open" className="flex flex-col gap-3">
      {crates.map((crate, at) => (
        <WaitingCrate key={crate.crate} crate={crate} open={at === 0 ? "primary" : "outline"} />
      ))}
    </ul>
  );
}

function WaitingCrate({ crate, open }: { crate: BoughtCrate; open: "primary" | "outline" }) {
  const moments = useMoments();
  const attempt = moments?.attemptOf(crate);
  const opening = attempt === "opening";
  return (
    <li {...crateTargetAttributes(crate.target)} tabIndex={-1} className="flex scroll-mt-28 items-center gap-3">
      <CrateArt phase="closed" width={56} Hog={hogOf("book")} nudge={attempt === undefined} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{`Crate ${crate.target.n}`}</p>
        <p className="text-xs text-muted-foreground">You bought it. Open it to see what's inside.</p>
        {attempt !== undefined && !opening && <p className="text-xs font-medium">{attemptMessages[attempt]}</p>}
      </div>
      <Button
        variant={open}
        size="sm"
        aria-disabled={opening || undefined}
        onClick={() => {
          if (!opening) moments?.open(crate);
        }}
      >
        {opening ? "Opening…" : "Open"}
      </Button>
    </li>
  );
}

type OfferProps = { price: number; coins: number | null; purchase: CratePurchasing; primary: boolean };

function Offer({ price, coins, purchase, primary }: OfferProps) {
  const hintId = useId();
  const short = Math.max(0, price - (coins ?? 0));
  const held = short > 0 || purchase.buying;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <CrateArt phase="closed" width={56} Hog={hogOf("book")} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">Your next crate</p>
        <p className="text-xs text-muted-foreground">{`It costs ${coinsText(price)}. Coins are never refunded.`}</p>
      </div>
      <div className="flex flex-col items-end gap-1" {...crateTargetAttributes("store")}>
        <Button
          variant={primary ? "primary" : "outline"}
          size="sm"
          aria-disabled={held || undefined}
          aria-describedby={short > 0 ? hintId : undefined}
          onClick={() => {
            if (!held) purchase.buy();
          }}
        >
          {purchase.buying ? "Buying…" : <BuyWords price={price} />}
        </Button>
        {short > 0 && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {shortfallText(short)}
          </p>
        )}
      </div>
    </div>
  );
}

function BuyWords({ price }: { price: number }) {
  return (
    <>
      {"Buy a crate · "}
      <CoinGlyph className="size-3.5" />
      {coinsText(price)}
    </>
  );
}
