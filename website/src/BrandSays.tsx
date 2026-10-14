import type { ComponentProps } from "react";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { Says } from "./Max";

export function BrandSays(props: Omit<ComponentProps<typeof Says>, "art">) {
  return <Says art={<BrandLockup />} {...props} />;
}

function BrandLockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <HedgehogHeart size={112} title="" />
      <span className="flex flex-col leading-tight">
        <span className="hud-display text-xl font-bold">HedgeHug</span>
        <span className="text-sm text-muted-foreground">Thanks a Hog</span>
      </span>
    </div>
  );
}
