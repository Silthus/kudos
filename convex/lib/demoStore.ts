import type { RewardInput } from "./store";

/** The demo workspace's rewards catalog (spec #4, S5). */
export const DEMO_REWARDS: RewardInput[] = [
  { emoji: "☕", name: "Coffee on us", cost: 15, description: "Any drink from the café downstairs, on the team tab." },
  { emoji: "💚", name: "Donate €25 to a charity", cost: 25, description: "We donate €25 in your name to a charity you pick.", prompt: "Which charity?" },
  { emoji: "🍜", name: "Team lunch", cost: 40, description: "Lunch out for you and two teammates of your choice." },
  { emoji: "🧥", name: "Hoodie", cost: 60, description: "The Lumen Labs hoodie. Soft, warm and a limited run.", stock: 10 },
  { emoji: "🌴", name: "Half day off", cost: 120, description: "Take an afternoon off, on us. Just tell your lead.", maxPerMember: 1 },
  { emoji: "🥂", name: "Lunch with the CEO", cost: 200, description: "An hour and a good lunch with Mira, our CEO. Bring questions.", stock: 1 },
];

export type DemoOutcome = "fulfilled" | "declined" | "cancelled" | "approved" | "pending";

export type DemoRedemption = {
  /** The requester's Slack user id. */
  who: string;
  reward: string;
  /**
   * When they asked: a fraction of the seeded window (0 = its first day, 1 = today), or
   * `workdaysAgo` for the requests still waiting in the queue.
   */
  at: { share: number } | { workdaysAgo: number };
  outcome: DemoOutcome;
  /** The admin who decides (Slack user id); the requester when they cancel. */
  by?: string;
  answer?: string;
  note?: string;
};

const LENA = "UDEMOLENA";
const ALEX = "UDEMOYOU";

/**
 * A year of the team spending what they received. Mostly fulfilled, a decline and a
 * cancellation along the way, and a handful of requests still waiting for an admin, so the
 * queue has something to decide the moment a visitor opens it. Lena and Alex are the admins
 * and decide on each other's requests (four eyes).
 */
export const DEMO_REDEMPTIONS: DemoRedemption[] = [
  { who: "UDEMOPRIYA", reward: "Coffee on us", at: { share: 0.08 }, outcome: "fulfilled", by: LENA, note: "Flat white's on the tab at Kaffeebar." },
  { who: LENA, reward: "Donate €25 to a charity", at: { share: 0.12 }, outcome: "fulfilled", by: ALEX, answer: "Médecins Sans Frontières", note: "Donated. The receipt is in your inbox." },
  { who: "UDEMOFREYA", reward: "Coffee on us", at: { share: 0.18 }, outcome: "fulfilled", by: LENA },
  { who: "UDEMOCHLOE", reward: "Team lunch", at: { share: 0.24 }, outcome: "fulfilled", by: ALEX, note: "Booked the Thai place for Thursday." },
  { who: "UDEMOJONAS", reward: "Hoodie", at: { share: 0.3 }, outcome: "fulfilled", by: LENA, note: "Size M is on your desk." },
  { who: "UDEMOSOFIA", reward: "Donate €25 to a charity", at: { share: 0.33 }, outcome: "fulfilled", by: LENA, answer: "Berliner Tafel food bank" },
  { who: "UDEMONORA", reward: "Team lunch", at: { share: 0.36 }, outcome: "declined", by: LENA, note: "The lunch budget for this quarter is spent. Ask again next quarter!" },
  { who: "UDEMOPRIYA", reward: "Hoodie", at: { share: 0.4 }, outcome: "fulfilled", by: ALEX, note: "Size S, left it with reception." },
  { who: "UDEMOSAMIR", reward: "Coffee on us", at: { share: 0.43 }, outcome: "cancelled", by: "UDEMOSAMIR" },
  { who: ALEX, reward: "Coffee on us", at: { share: 0.46 }, outcome: "fulfilled", by: LENA, note: "Enjoy!" },
  { who: "UDEMODIEGO", reward: "Donate €25 to a charity", at: { share: 0.49 }, outcome: "fulfilled", by: LENA, answer: "Wikimedia Foundation" },
  { who: LENA, reward: "Hoodie", at: { share: 0.53 }, outcome: "fulfilled", by: ALEX, note: "Your size L is in the box by my desk." },
  { who: "UDEMOAIKO", reward: "Team lunch", at: { share: 0.56 }, outcome: "fulfilled", by: LENA },
  { who: "UDEMOFREYA", reward: "Hoodie", at: { share: 0.6 }, outcome: "fulfilled", by: LENA, note: "Size M, on your chair." },
  { who: "UDEMOPRIYA", reward: "Half day off", at: { share: 0.64 }, outcome: "fulfilled", by: LENA, note: "Enjoy the afternoon!" },
  { who: "UDEMOKWAME", reward: "Coffee on us", at: { share: 0.67 }, outcome: "fulfilled", by: ALEX },
  { who: ALEX, reward: "Team lunch", at: { share: 0.7 }, outcome: "fulfilled", by: LENA, note: "Table for three on Friday." },
  { who: "UDEMOTOBIAS", reward: "Donate €25 to a charity", at: { share: 0.72 }, outcome: "cancelled", by: "UDEMOTOBIAS", answer: "Tierheim Berlin" },
  { who: "UDEMOYUKI", reward: "Coffee on us", at: { share: 0.75 }, outcome: "fulfilled", by: LENA },
  { who: "UDEMOCHLOE", reward: "Hoodie", at: { share: 0.78 }, outcome: "fulfilled", by: LENA, note: "Size S is on your desk." },
  { who: "UDEMOEMIL", reward: "Coffee on us", at: { share: 0.8 }, outcome: "fulfilled", by: ALEX },
  { who: "UDEMOJONAS", reward: "Donate €25 to a charity", at: { share: 0.83 }, outcome: "fulfilled", by: LENA, answer: "Sea-Watch" },
  { who: "UDEMONORA", reward: "Team lunch", at: { share: 0.86 }, outcome: "fulfilled", by: LENA, note: "New quarter, new budget. Enjoy!" },
  { who: "UDEMOSOFIA", reward: "Coffee on us", at: { share: 0.9 }, outcome: "fulfilled", by: ALEX },
  { who: "UDEMOHANNAH", reward: "Coffee on us", at: { share: 0.92 }, outcome: "fulfilled", by: LENA },
  // Still waiting for an admin: the queue a visitor finds.
  // Everyone can afford these, even in early January when the window is only 120 days.
  { who: "UDEMOPRIYA", reward: "Team lunch", at: { workdaysAgo: 4 }, outcome: "approved", by: LENA },
  { who: "UDEMOJONAS", reward: "Coffee on us", at: { workdaysAgo: 3 }, outcome: "pending" },
  { who: "UDEMOOSKAR", reward: "Coffee on us", at: { workdaysAgo: 2 }, outcome: "pending" },
  { who: "UDEMODIEGO", reward: "Donate €25 to a charity", at: { workdaysAgo: 1 }, outcome: "pending", answer: "Doctors Without Borders" },
  { who: LENA, reward: "Coffee on us", at: { workdaysAgo: 0 }, outcome: "pending" },
];

/** Balance adjustments admins made along the way. */
export const DEMO_ADJUSTMENTS: { who: string; by: string; amount: number; reason: string; share: number }[] = [
  { who: "UDEMOSAMIR", by: LENA, amount: 20, reason: "Hackathon winner: the on-call dashboard", share: 0.5 },
  { who: ALEX, by: LENA, amount: 15, reason: "Organised the summer offsite", share: 0.52 },
];

/** Fulfilment notes Lena leaves on the demo visitor's own live requests. */
export const LIVE_FULFIL_NOTES: Record<string, string> = {
  "Coffee on us": "Your coffee's on the tab downstairs.",
  "Donate €25 to a charity": "Donated. The receipt is in your inbox.",
  "Team lunch": "Booked. Pick a day with your two teammates.",
  Hoodie: "It's on your desk.",
  "Half day off": "Enjoy the afternoon!",
  "Lunch with the CEO": "Mira's assistant will send you an invite.",
};
