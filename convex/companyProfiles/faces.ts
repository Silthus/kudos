import type { QueryCtx } from "../_generated/server";

export type CompanyFace = { image: string; colour: string };

export function companyFaceOfProfile({ image, colour }: { image?: string; colour: string }): CompanyFace | null {
  return image === undefined ? null : { image, colour };
}

export function normalisedName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")
    .join(" ");
}

export async function companyFaceOf(ctx: QueryCtx, realName: string): Promise<CompanyFace | undefined> {
  const name = normalisedName(realName);
  if (name === "") return undefined;
  const matches = await ctx.db
    .query("companyProfiles")
    .withIndex("by_normalised_name", (q) => q.eq("normalisedName", name))
    .take(2);
  const [only] = matches;
  if (only?.image === undefined || matches.length !== 1) return undefined;
  return { image: only.image, colour: only.colour };
}
