// Variant E collection: only the hedgehog shelf; titles, quips and kudos emoji live in the profile's inventory.
import { IconArrowRight } from "@posthog/icons";
import { HedgehogShelf } from "./collection-hedgehogs";
import { useHud } from "./hud";

export function Collection(_props: { param?: string }) {
  useHud();
  return (
    <div className="flex flex-col gap-6">
      <HedgehogShelf />
      <a href="#/profile/inventory" className="group inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Titles, quips and emoji live in your inventory
        <IconArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}
