// PROTOTYPE round 1: three variants of the Milestones page on /book#milestones, switchable via ?variant=.
// Question: how does the page show everything at a glance, with what can be unlocked and the next steps up front?
// Mounted only when VITE_PROTOTYPE=1. Throwaway: the winner gets rebuilt in Milestones.tsx.
import { PrototypeSwitcher, useVariant } from "../../PrototypeSwitcher";
import type { Album } from "../answer";
import { MilestonesPage } from "../Milestones";
import { VariantCollection } from "./VariantCollection";
import { VariantLanes } from "./VariantLanes";
import { VariantNextSteps } from "./VariantNextSteps";
import "./prototype.css";

const variants = [
  { key: "now", name: "Today's page" },
  { key: "A", name: "Next steps first" },
  { key: "B", name: "Collection grid" },
  { key: "C", name: "Three lanes" },
] as const;

export function MilestonesPrototype({ album }: { album: Album }) {
  const [variant, choose] = useVariant(variants);
  return (
    <>
      {variant === "now" && <MilestonesPage album={album} />}
      {variant === "A" && <VariantNextSteps album={album} />}
      {variant === "B" && <VariantCollection album={album} />}
      {variant === "C" && <VariantLanes album={album} />}
      <PrototypeSwitcher variants={variants} current={variant} onChoose={choose} />
    </>
  );
}
