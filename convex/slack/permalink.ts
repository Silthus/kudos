import type { MessageRef } from "../engine/messageEvent";

export function permalinkOf(workspaceUrl: string, { conversation, message }: MessageRef, threadRoot: string | null): string {
  const link = `${withTrailingSlash(workspaceUrl)}archives/${conversation}/p${message.replace(".", "")}`;
  return threadRoot === null || threadRoot === message ? link : `${link}?thread_ts=${threadRoot}&cid=${conversation}`;
}

export function channelLinkOf(workspaceUrl: string, channel: string): string {
  return `${withTrailingSlash(workspaceUrl)}archives/${channel}`;
}

function withTrailingSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}
