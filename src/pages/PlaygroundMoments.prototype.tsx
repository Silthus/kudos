// PROTOTYPE (#54): every celebration moment on one screen, replayable. Throwaway.
import { useState } from "react";
import { Gift, RotateCcw } from "lucide-react";
import { Crest, CrestStamp, DiscoveryMoment } from "@/components/moments";
import { Button, Card, CardHeader, PageHeader, Window } from "@/components/ui";
import { RARITY_META, RARITY_ORDER } from "@/lib/rarity";

const SAMPLE: Record<string, string> = {
  common: "Kudos sent to Priya Raman in #general. 4 🌮 left for today.",
  uncommon: "You just made someone's afternoon. 1 🌮 for Jonas Weber, 3 still to give.",
  rare: "Signal received across the org: Lena Hoffmann got 2 🌮 from you. 2 left today.",
  epic: "That's epic giving. You sent 3 🌮 to Samir Haddad, and the team noticed.",
  legendary: "Legendary. 5 🌮 from you to Aiko Tanaka. People will talk about this one in #general for a while.",
};

export function MomentsGallery() {
  const [run, setRun] = useState(0);
  return (
    <div key={run}>
      <PageHeader
        eyebrow="Prototype · #54"
        title="Celebration moments"
        subtitle="Discoveries escalate with rarity; quests stamp an original crest; store steps get a stamp. Each one animates in and ends on a still frame."
        action={
          <Button variant="primary" onClick={() => setRun((r) => r + 1)}>
            <RotateCcw className="h-3.5 w-3.5" /> Replay
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="New discoveries, by rarity" subtitle="Common slides in · uncommon presses in · rare opens a window · epic stamps a crest and calls a hog · legendary adds the party hog" />
          <div className="grid grid-cols-1 gap-5 px-4 pb-6 pt-2 md:grid-cols-2">
            {RARITY_ORDER.map((r) => (
              <div key={r} className={r === "legendary" ? "md:col-span-2" : undefined}>
                <DiscoveryMoment rarity={r} text={SAMPLE[r]} isNew to="To you" category="giver success" />
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Window title="Quest complete" icon={<span className="h-2 w-2 rounded-full bg-success" />}>
            <div className="p-4">
              <CrestStamp tint="var(--k-series-received)" glyph="heart" caption="Spread the love" sub="Thank 3 different teammates · week 39" />
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 text-xs font-semibold text-text-3">Crest cabinet · 3 of 7 earned</div>
                <div className="flex flex-wrap gap-2">
                  <Crest tint="var(--k-series-received)" glyph="heart" size={34} title="Spread the love" />
                  <Crest tint={RARITY_META.uncommon.color} glyph="check" size={34} title="First of the day" />
                  <Crest tint={RARITY_META.epic.color} glyph="sparkles" size={34} title="Cross-team" />
                  {[0, 1, 2, 3].map((i) => (
                    <Crest key={i} tint="" glyph="star" size={34} locked title="Not earned yet" />
                  ))}
                </div>
              </div>
            </div>
          </Window>
          <Window title="Store request" icon={<Gift className="h-3.5 w-3.5 text-text-3" />}>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between rounded-[var(--radius-lemon)] border border-dashed border-border-bold bg-surface-2 px-3 py-2 text-[13px]">
                <span className="font-semibold">Team lunch · 40 🌮</span>
                <span className="text-text-2">Waiting for an admin</span>
              </div>
              <CrestStamp tint="var(--k-success)" glyph="check" caption="Approved" sub="Lena approved your request · just now" />
              <CrestStamp tint="var(--k-series-given)" glyph="truck" caption="Delivered" sub="Marked fulfilled · enjoy it" />
            </div>
          </Window>
        </div>
      </div>
    </div>
  );
}
