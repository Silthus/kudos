import type { Peer } from "../shell";

const aheadOfEveryone = 100;

export function peerLine({ percent, group: { name } }: Peer) {
  return percent >= aheadOfEveryone ? `You improved more than everyone else in ${name}.` : `You improved more than ${percent}% of ${name}.`;
}
