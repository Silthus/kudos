/**
 * The demo's crew quests (#161, design plan #152 S10): one built and one open, so the plaque has a
 * story and the notice board a quest to finish. The bell was the crew's first build, a month ago; the
 * market awnings are 60 % funded. Contributions are scenery, like the demo's homes: the teammates'
 * wallets are left alone. `who` is a demo member's Slack id (convex/demo.ts PEOPLE).
 */
export type DemoCrewQuest = {
  part: string;
  option?: string;
  proposedBy: string;
  /** Days ago it was proposed; a built one was funded a week later and built CREW.buildDays after. */
  daysAgo: number;
  built: boolean;
  gifts: { who: string; coins: number }[];
};

export const DEMO_CREW: DemoCrewQuest[] = [
  {
    part: "structure_bell",
    proposedBy: "UDEMOLENA",
    daysAgo: 40,
    built: true,
    gifts: [
      { who: "UDEMOLENA", coins: 80 },
      { who: "UDEMOPRIYA", coins: 60 },
      { who: "UDEMOYOU", coins: 50 },
      { who: "UDEMOFREYA", coins: 40 },
      { who: "UDEMOJONAS", coins: 40 },
      { who: "UDEMONORA", coins: 30 },
    ],
  },
  {
    part: "structure_market_awnings",
    proposedBy: "UDEMOPRIYA",
    daysAgo: 6,
    built: false,
    gifts: [
      { who: "UDEMOPRIYA", coins: 100 },
      { who: "UDEMOCHLOE", coins: 80 },
      { who: "UDEMOSOFIA", coins: 60 },
      { who: "UDEMODIEGO", coins: 60 },
    ],
  },
];
