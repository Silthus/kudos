import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { publish } from "../bus/publish";
import { setIndicator } from "../feedback/indicator";
import { lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { allowanceDay, dailyAllowance } from "./allowance";
import { insertAwards, type Award } from "./awards";
import { messageRefValidator, type ChatUserId, type Mention, type MessageEvent, type MessageRef } from "./messageEvent";
import { annotationsOf, kudosMessageOf, type KudosMessage } from "../parser/parser";

export type Outcome =
  | { kind: "given"; awards: Award[]; kudosEmoji: string; left: number }
  | { kind: "over-allowance"; cost: number; recipients: number; perRecipient: number; left: number }
  | { kind: "invalid" };

export type Observation =
  | { kind: "ignored"; why: "not-a-member" | "ordinary-chat" | "stale-revision" | "unchanged" }
  | { kind: "awaiting-directory"; users: ChatUserId[]; retryInMs: number }
  | { kind: "abandoned" }
  | { kind: "evaluated"; outcome: Outcome };

type KudosMessageRow = Doc<"kudosMessages">;
type Member = Extract<MemberFacts, { kind: "member" }>;

export async function observe(ctx: MutationCtx, event: MessageEvent): Promise<Observation> {
  const existing = await kudosMessageRow(ctx, event.ref);
  if (existing !== null) return { kind: "ignored", why: event.revision === existing.revision ? "unchanged" : "stale-revision" };

  const author = await lookup(ctx, event.ref.workspace, event.author);
  if (author !== undefined && author.kind !== "member") return { kind: "ignored", why: "not-a-member" };
  const context = { workspace: event.ref.workspace, giver: author?.member };
  if ((await kudosMessageOf(ctx, event.content, context)) === null) return { kind: "ignored", why: "ordinary-chat" };

  const id = await ctx.db.insert("kudosMessages", {
    ...event.ref,
    author: event.author,
    revision: event.revision,
    state: "awaiting-directory",
    content: { mentions: event.content.mentions, emoji: event.content.emoji },
    annotations: annotationsOf(event.content, context),
    spendsAt: event.at,
  });
  return evaluate(ctx, (await ctx.db.get(id))!, { lastCheck: false });
}

export const recheck = internalMutation({
  args: messageRefValidator,
  handler: async (ctx, ref): Promise<Observation> => {
    const row = await kudosMessageRow(ctx, ref);
    if (row === null || row.state !== "awaiting-directory") return { kind: "ignored", why: "unchanged" };
    return evaluate(ctx, row, { lastCheck: true });
  },
});

async function evaluate(ctx: MutationCtx, row: KudosMessageRow, { lastCheck }: { lastCheck: boolean }): Promise<Observation> {
  const unknown = await unknownUsers(ctx, row);
  if (unknown.length > 0) {
    if (!lastCheck) return { kind: "awaiting-directory", users: unknown, retryInMs: 0 };
    await ctx.db.patch(row._id, { state: "abandoned" });
    return { kind: "abandoned" };
  }

  const giver = await lookup(ctx, row.workspace, row.author);
  if (giver?.kind !== "member") return ignore(ctx, row, "not-a-member");
  const kudos = await kudosMessageOf(ctx, row.content, { workspace: row.workspace, giver: giver.member });
  if (kudos === null) return ignore(ctx, row, "ordinary-chat");

  const outcome = await decide(ctx, row, giver, kudos);
  await ctx.db.patch(row._id, { state: outcome.kind });
  if (outcome.kind === "given") await setIndicator(ctx, refOf(row), { emoji: outcome.kudosEmoji });
  return { kind: "evaluated", outcome };
}

async function decide(ctx: MutationCtx, row: KudosMessageRow, giver: Member, kudos: KudosMessage): Promise<Outcome> {
  const recipients = await recipientsOf(ctx, row.workspace, kudos.mentions, giver.member);
  if (recipients.length === 0) return { kind: "invalid" };

  const { baseAllowance } = await settingsOf(ctx, row.workspace);
  const day = allowanceDay(row.spendsAt, giver.timeZone);
  const allowance = await dailyAllowance(ctx, giver.member, day, baseAllowance);
  const { perRecipient } = kudos;
  const cost = recipients.length * perRecipient;
  if (cost > allowance.left) return { kind: "over-allowance", cost, recipients: recipients.length, perRecipient, left: allowance.left };

  const awards = recipients.map((recipient) => ({ giver: giver.member, recipient, kudos: perRecipient }));
  const kudosEmoji = kudos.kudosEmoji[0]!;
  const left = allowance.left - cost;
  await allowance.spend(cost);
  await insertAwards(ctx, refOf(row), awards, day, row.spendsAt);
  await publish(ctx, {
    type: "kudosGiven",
    workspace: row.workspace,
    message: refOf(row),
    giver: giver.member,
    awards,
    kudosEmoji,
    annotations: row.annotations,
    allowance: { dailyOpening: allowance.opening, dailyLeft: left },
    day,
    at: row.spendsAt,
  });
  return { kind: "given", awards, kudosEmoji, left };
}

async function recipientsOf(ctx: QueryCtx, workspace: string, mentions: Mention[], giver: MemberId): Promise<MemberId[]> {
  const recipients: MemberId[] = [];
  for (const user of personMentions(mentions)) {
    const facts = await lookup(ctx, workspace, user);
    if (facts?.kind === "member" && facts.member !== giver && !recipients.includes(facts.member)) recipients.push(facts.member);
  }
  return recipients;
}

async function unknownUsers(ctx: QueryCtx, row: KudosMessageRow): Promise<ChatUserId[]> {
  const users = [...new Set([row.author, ...personMentions(row.content.mentions)])];
  const facts = await Promise.all(users.map((user) => lookup(ctx, row.workspace, user)));
  return users.filter((_, index) => facts[index] === undefined);
}

async function ignore(ctx: MutationCtx, row: KudosMessageRow, why: "not-a-member" | "ordinary-chat"): Promise<Observation> {
  await ctx.db.patch(row._id, { state: "watermark" });
  return { kind: "ignored", why };
}

function personMentions(mentions: Mention[]): ChatUserId[] {
  return mentions.flatMap((mention) => (mention.kind === "person" ? [mention.user] : []));
}

function refOf(row: KudosMessageRow): MessageRef {
  return { workspace: row.workspace, conversation: row.conversation, message: row.message };
}

async function kudosMessageRow(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("kudosMessages")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
