# GPT-6.1 Sol (high) review, round 1

Run as `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` over the diff against `main`, with #354, the conductor notes and #273's resolution as the oracle.

The checkout advanced during review; these findings remain at `b626d76`, with line references to that version.

- **High — [CrateRewardFlight.tsx:21](/home/coder/dev/kudos-wt/reward-flights/website/src/crates/CrateRewardFlight.tsx:21): Reduced motion can leave skill points held indefinitely.** Enable reduced motion during the 600 ms level-turnover pause. The component retains `reduced=false` and launches the skill-point hop afterward. CSS disables its animation, so it emits neither `animationend` nor `animationcancel`; the chip stays at 1 instead of 2. Confirmed with an in-memory probe. **Fix:** observe motion-preference changes, cancel the pause, and release outstanding holds immediately with the fade.

- **Medium — [CrateRewardFlight.tsx:69](/home/coder/dev/kudos-wt/reward-flights/website/src/crates/CrateRewardFlight.tsx:69): Queued flights release rewards prematurely and rewind XP.** With live XP 1,010 and two queued 20-XP crates, only the first crate is withheld: the initial display is 990 instead of 970. After its XP lands, the display reaches 1,010; starting the second flight drops it back to 990. Both flights also infer the same level-up skill point. Confirmed with an in-memory probe. The queue test checks flight existence, so misses this. **Fix:** hold all outstanding rewards and release each once, deriving successive level crossings from the aggregate held progression.

- **Medium — [CrateRewardFlight.tsx:76](/home/coder/dev/kudos-wt/reward-flights/website/src/crates/CrateRewardFlight.tsx:76): Live XP changes disagree with the frozen skill-point hop.** At XP 1,010, a 20-XP crate freezes a `+1 skill point` hop and holds the chip at 1. Another 20 XP arrives mid-flight: `rewardOf` now returns zero skill points, releasing the chip to 2 before that hop lands. Landing then produces no count-up. **Fix:** store each flight’s reward amount once and use it consistently for both holds and hops.

- **Medium — [RewardFlight.tsx:126](/home/coder/dev/kudos-wt/reward-flights/website/src/crates/RewardFlight.tsx:126): Fill classes and timers survive member changes.** Switch members while a fill is active and the existing `Frame` survives. Its class and `--reward-from` still describe the previous member, so the new member’s ring can animate from a percentage exceeding their actual XP. Flight cleanup does not clear this state. **Fix:** give settlement animations cancellable ownership and clear their timers, classes, and properties when the member changes.

- **Low — [Frame.tsx:56](/home/coder/dev/kudos-wt/reward-flights/website/src/Frame.tsx:56): The chip’s accessible name disagrees with its visible count.** During a 1→2 count-up, the link visibly reads `1` while its accessible name already says “2 skill points to spend.” **Fix:** derive the accessible name from `counted`, keeping it consistent with the visible label.

Feature crates flying no XP and deferring coins are sound decisions. Vitest was blocked by the read-only sandbox’s temporary-directory restriction; no files were changed.
## Outcomes

1. **High, fixed.** The motion preference is read at every hop, so a hop that would start under reduced motion fades its target in and ends the flight. Test: "lands the skill point at once with a fade when reduced motion is turned on while the level turns over".
2. **Medium, fixed.** The hero and the HUD hold every reward still on its way: queued flights, the flight waiting for its reveal to close, and claimed reveals. Each crate's skill points are chained in queue order. Test: "holds both rewards of two Claims pressed together and releases them in turn, never rewinding the ring".
3. **Medium, fixed.** A flight charts its reward once it starts (`moments.chart`), and the hold uses that reward from then on. Test: "keeps holding the skill point the flight set out with when more XP arrives before it lands".
4. **Medium, rejected.** A member switch with the frame mounted needs a session swap mid-fill. Sign-out unmounts the frame, `forgetEverything` drops every flight, and the leftover is a 1.3 s fill class with nothing to break: the next member's values are already live.
5. **Low, rejected.** The chip's accessible name is the true count. A screen reader should not hear the intermediate numbers of a visual count-up, and the hold already keeps the name at the before value until the hop lands.
