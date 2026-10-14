import type { TierId } from "../shell";

export const tierWords: Record<TierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export function DateOf({ at, timeZone }: { at: number; timeZone: string }) {
  const date = new Date(at);
  return <time dateTime={date.toISOString()}>{dateWords(at, timeZone)}</time>;
}

export function dateWords(at: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(at));
}
