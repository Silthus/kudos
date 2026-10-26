import { callSlack, readSlack, type SlackAnswer, type SlackFailure } from "./webApi";

export type ChannelTraits = { name?: string; is_ext_shared?: boolean; is_pending_ext_shared?: boolean };
export type OffLimitsReason = "shared" | "customer";
export type OffLimits = { ok: false; offLimits: OffLimitsReason };

type ChannelInfo = { channel: ChannelTraits };

const customerChannelPrefix = "customer-";
const unreadableNonPublicChannel = new Set(["channel_not_found", "missing_scope", "method_not_supported_for_channel_type"]);

export function offLimitsReasonOf(channel: ChannelTraits): OffLimitsReason | null {
  if (channel.is_ext_shared === true || channel.is_pending_ext_shared === true) return "shared";
  return channel.name?.startsWith(customerChannelPrefix) === true ? "customer" : null;
}

export function isOffLimits(answer: SlackAnswer | OffLimits): answer is OffLimits {
  return "offLimits" in answer;
}

export async function joinUnlessOffLimits<Data = object>(channel: string): Promise<SlackAnswer<Data> | OffLimits | SlackFailure> {
  const info = await readSlack<ChannelInfo>("conversations.info", { channel });
  if (info.ok) {
    const offLimits = offLimitsReasonOf(info.channel);
    if (offLimits !== null) return { ok: false, offLimits };
  } else if (!unreadableNonPublicChannel.has(info.error)) return info;
  return callSlack<Data>("conversations.join", { channel });
}
