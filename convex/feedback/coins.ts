import { internalMutation } from "../_generated/server";
import { unlockOpenedEventValidator } from "../bus/events";
import { storeShownAndExposedTo } from "../store/visibility";
import { coinsShownTo } from "../wallet/visibility";
import { balanceOf } from "../wallet/wallet";
import { notify } from "./notify";

export const tellCoinsOpened = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event: { member } }) => {
    if (!(await coinsShownTo(ctx, member))) return;
    await storeShownAndExposedTo(ctx, member);
    await notify(ctx, member, { kind: "coins-opened", balance: await balanceOf(ctx, member) });
  },
});

export function coinsPartOf(coins: number) {
  return `+${coins} 🪙`;
}

export function coinsOpenedLineOf(balance: number) {
  return balance === 0 ? "Coins are open. You earn 🪙 when you thank someone and say why." : `Coins are open. You already have ${balance} 🪙.`;
}

export function inventoryOpenedLineOf(balance: number, kudosEmoji: string) {
  const starter = `🦔 is in your first kudos emoji slot: use it in a kudos like :${kudosEmoji}:.`;
  return balance === 0 ? `Coins and inventory are open. ${starter}` : `Coins and inventory are open. You already have ${balance} 🪙, and ${starter}`;
}

export function inCoins(balance: number) {
  return `${balance} 🪙`;
}
