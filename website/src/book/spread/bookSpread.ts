import type { MemberProfile } from "../../shell";

type WithTheBookSpread = MemberProfile & { bookSpread?: true };

export function showsTheBookSpread(member: MemberProfile) {
  return (member as WithTheBookSpread).bookSpread === true;
}
