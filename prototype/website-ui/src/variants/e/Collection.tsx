// Variant E collection: the hedgehog shelf, then a simple store and finds for titles, quips and kudos emoji. Equipping lives on the profile.
import { HedgehogShelf } from "./collection-hedgehogs";
import { GearShop } from "./gear-shop";
import { useHud } from "./hud";

export function Collection(_props: { param?: string }) {
  useHud();
  return (
    <div className="flex flex-col gap-10">
      <HedgehogShelf />
      <GearShop />
    </div>
  );
}
