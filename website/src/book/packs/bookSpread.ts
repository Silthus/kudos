import type { MemberProfile } from "../../shell";

export type BookSpreadMember = MemberProfile;

export function hasTheBookSpread(member: MemberProfile): boolean {
  return member.bookSpread === true;
}
