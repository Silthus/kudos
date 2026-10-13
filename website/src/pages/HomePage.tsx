import { PageTitle } from "../PageTitle";
import type { SignedInMember } from "../shell";

export function HomePage({ member }: { member: SignedInMember }) {
  return <PageTitle tab="Home">Welcome, {member.name}</PageTitle>;
}
