import type { QueryCtx } from "../_generated/server";
import { waitingQuestCratesOf } from "../quests/waitingCrates";
import { featureCrateKeyOf } from "../unlocks/feature";
import { readyFeaturesOf } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { boughtCratesWaitingFor } from "./boughtCrates";
import { dropsAHoggie, kindOf, type CrateKey, type CrateKind } from "./crateKey";

export type Pack = { crate: CrateKey; kind: CrateKind; n: number };

export type WaitingPacks = { packs: Pack[]; morePacks: boolean };

type Waiting = { crate: string; at: number };

type WaitingPack = { crate: CrateKey; at: number };

const packsListed = 50;

const readPerKind = packsListed + 1;

export async function waitingPacksOf(ctx: QueryCtx, member: MemberId): Promise<WaitingPacks> {
  const features = await readyFeaturesOf(ctx, member, readPerKind);
  const waiting: Waiting[] = [
    ...(await waitingQuestCratesOf(ctx, member, readPerKind)),
    ...features.map(({ feature, readyAt }) => ({ crate: featureCrateKeyOf(feature), at: readyAt })),
    ...(await boughtCratesWaitingFor(ctx, member, readPerKind)),
  ];
  const longestWaitingFirst = waiting.filter(isAPack).toSorted(byWaitingLongest);
  return { packs: longestWaitingFirst.slice(0, packsListed).map(numbered), morePacks: longestWaitingFirst.length > packsListed };
}

function isAPack(waiting: Waiting): waiting is WaitingPack {
  return dropsAHoggie(waiting.crate);
}

const crateKeyOrder = new Intl.Collator("en", { numeric: true });

function byWaitingLongest(first: WaitingPack, second: WaitingPack) {
  return first.at - second.at || crateKeyOrder.compare(first.crate, second.crate);
}

function numbered({ crate }: WaitingPack, index: number): Pack {
  return { crate, kind: kindOf(crate), n: index + 1 };
}
