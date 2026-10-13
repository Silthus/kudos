import type { MutationCtx } from "../_generated/server";

export type Receipt = { workspace: string; eventId: string };

export async function processEvent(_ctx: MutationCtx, _receipt: Receipt): Promise<void> {}
