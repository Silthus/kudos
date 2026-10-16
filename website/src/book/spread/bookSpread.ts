import type { MemberProfile } from "../../shell";

export function showsTheBookSpread(member: MemberProfile) {
  return member.bookSpread === true;
}
