import { internalMutation } from "../_generated/server";
import { unlockOpenedEventValidator } from "../bus/events";
import { coinsShownTo } from "../wallet/visibility";
import { balanceOf } from "../wallet/wallet";
import { notify } from "./notify";

export const tellCoinsOpened = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event: { member } }) => {
    if (await coinsShownTo(ctx, member)) await notify(ctx, member, { kind: "coins-opened", balance: await balanceOf(ctx, member) });
  },
});

export function coinsPartOf(coins: number) {
  return `+${coins} 🪙`;
}

export function coinsOpenedLineOf(balance: number) {
  return balance === 0 ? "Coins are open. You earn 🪙 when you thank someone and say why." : `Coins are open. You already have ${balance} 🪙.`;
}

export function inCoins(balance: number) {
  return `${balance} 🪙`;
}
