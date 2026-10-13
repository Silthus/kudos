import { query } from "../_generated/server";
import { homeFacts, type HomeFacts } from "../engine/home";
import { signedInMember } from "./signedInMember";

type MemberHome = Extract<HomeFacts, { kind: "member" }>;

export type MyProfile =
  | { kind: "signed-out" }
  | { kind: "verifying" }
  | { kind: "not-a-member" }
  | {
      kind: "member";
      name?: string;
      image?: string;
      kudosEmoji: string;
      allowance: { left: number; base: number };
      thisWeek: { given: number; received: number };
      lifetime: { given: number; received: number };
    };

export const getMyProfile = query({
  args: {},
  handler: async (ctx): Promise<MyProfile> => {
    const me = await signedInMember(ctx);
    if (me.kind === "signed-out") return me;

    const home = await homeFacts(ctx, me.workspace, me.user);
    if (home === null) return { kind: "verifying" };
    if (home.kind === "not-a-member") return home;
    return { kind: "member", name: me.name, image: me.image, ...profileOf(home) };
  },
});

function profileOf(home: MemberHome) {
  return {
    kudosEmoji: home.kudosEmoji,
    allowance: { left: home.left, base: home.base },
    thisWeek: { given: home.givenWeek, received: home.receivedWeek },
    lifetime: { given: home.given, received: home.received },
  };
}
