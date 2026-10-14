import type { RecentKudosRead } from "../recentKudosRead";

export function RecentKudosCard({ useRecentKudos }: { useRecentKudos: RecentKudosRead }) {
  useRecentKudos("received");
  return null;
}
