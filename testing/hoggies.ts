import { catalogue, hoggieNamed } from "../convex/hoggies/catalogue";
import type { MemberId } from "../convex/workspace/directory";
import type { Backend } from "./slackBackend";

type Row = Record<string, unknown>;

type Tables = { flagExposures: Row[]; analyticsOutbox: Row[] };

export function withoutExposureOf<T extends Tables>(flag: string, tables: T): T {
  return {
    ...tables,
    flagExposures: tables.flagExposures.filter((exposure) => exposure.flag !== flag),
    analyticsOutbox: tables.analyticsOutbox.filter(({ properties }) => (properties as Row | undefined)?.feature_flag !== flag),
  };
}

export function withoutCollectionExposure<T extends Tables>(tables: T): T {
  return withoutExposureOf("collection", tables);
}

export async function holds(t: Backend, member: MemberId, ...hoggies: string[]) {
  await t.run(async (ctx) => {
    for (const hoggie of hoggies) {
      const tally = await ctx.db
        .query("dropTallies")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique();
      const n = (tally?.drops ?? 0) + 1;
      if (tally === null) await ctx.db.insert("dropTallies", { member, drops: n });
      else await ctx.db.patch(tally._id, { drops: n });
      const at = Date.now();
      await ctx.db.insert("drops", { member, crate: `test:held:${n}`, hoggie, rarity: hoggieNamed(hoggie)!.rarity, n, copy: 1, catalogueVersion: catalogue.version, at, crest: null });
      await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: at, firstN: n });
    }
  });
}
