import type { MemberProfile } from "../../shell";

export type BookSpreadMember = MemberProfile & { bookSpread?: true };

export function hasTheBookSpread(member: MemberProfile): boolean {
  return (member as BookSpreadMember).bookSpread === true;
}
