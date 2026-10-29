import { v, type Infer } from "convex/values";

export const visitSourceParam = "src";

export const visitSourceValidator = v.union(
  v.literal("welcome"),
  v.literal("monday-dm"),
  v.literal("recap"),
  v.literal("app-home"),
  v.literal("reply"),
  v.literal("monday-post"),
  v.literal("link-card"),
);

export type VisitSource = Infer<typeof visitSourceValidator>;

export type Website = { origin: string; source: VisitSource };

const visitSources: readonly VisitSource[] = visitSourceValidator.members.map(({ value }) => value);

export function visitSourceIn(param: string | null): VisitSource | undefined {
  return visitSources.find((source) => source === param);
}

export function websiteAt(origin: string | null, source: VisitSource): Website | null {
  return origin === null ? null : { origin, source };
}

export function linkFrom(source: VisitSource, url: string): string {
  const address = new URL(url);
  address.searchParams.set(visitSourceParam, source);
  return address.toString();
}
