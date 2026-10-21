import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { TeamSticker } from "../album/records";
import type { PageOwner } from "../album/teamPages";
import { isShared } from "./finds";
import { itemShareShownTo } from "./flag";
import type { Win } from "./shareRecords";
import type { TurnedFace } from "./turn";

type Landed = { face: TurnedFace; teamStickers: TeamSticker[] };

export async function recordWinOf(ctx: MutationCtx, owner: PageOwner, item: Id<"items">, landed: Landed, at: number): Promise<void> {
  const win = winOf(landed);
  if (win === null || !(await itemShareShownTo(ctx, owner.member))) return;
  await ctx.db.insert("itemShares", { workspace: owner.workspace, member: owner.member, item, win, wonAt: at });
}

function winOf({ face, teamStickers }: Landed): Win | null {
  if (face.kind === "hoggie") return isShared(face.drop.rarity) ? { kind: "hoggie", hoggie: face.drop.hoggie, name: face.drop.name, rarity: face.drop.rarity } : null;
  const completed = teamStickers[0];
  return completed === undefined ? null : { kind: "teamPage", team: completed.team, name: completed.name, art: completed.art };
}
