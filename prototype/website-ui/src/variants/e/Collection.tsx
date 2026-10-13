// Variant E collection: the hedgehog shelf on top of round 2's cosmetics collection.
import { Collection as BaseCollection } from "../../screens/Collection";
import { useHud } from "../b/hud";
import { HedgehogShelf } from "./collection-hedgehogs";

export function Collection(props: { param?: string }) {
  useHud();
  return (
    <div className="flex flex-col gap-8">
      <HedgehogShelf />
      <BaseCollection {...props} />
    </div>
  );
}
