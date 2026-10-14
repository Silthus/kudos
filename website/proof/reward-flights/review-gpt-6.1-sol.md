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

# Round 2

Three defects remain, most severe first.

1. **Medium — [rewards.ts:38](/home/coder/dev/kudos-wt/reward-flights/website/src/crates/rewards.ts:38): mixed crates double-allocate skill points.** At live XP **1,010**, with **2 skill points**, queue a Skill tree crate and a 20-XP quest crate. The feature claims both points; the quest independently claims the level-6 point.
   
   Feature first: its `+2` hop produces only **0 → 1**. Quest first: its `+1` hop produces **0 → 0**, then the feature produces **0 → 2**. The clamp prevents negative counts but hides the overlap.
   
   **Fix:** allocate disjoint rewards across the queue and preserve those allocations after earlier flights leave it.

2. **Medium — [CrateRewardFlight.tsx:91](/home/coder/dev/kudos-wt/reward-flights/website/src/crates/CrateRewardFlight.tsx:91): consecutive XP flights do not replay the fill.** Two ordinary queued flights land **960 ms apart**, but `reward-filling` remains for **1,300 ms**. The second landing adds an existing class, so its 600-ms CSS animation does not restart: XP jumps to its new share. The first cleanup then removes the class 340 ms after the second landing.
   
   **Fix:** clear ordinary fills when their animation completes; restarting a settlement should cancel its previous cleanup. Existing tests dispatch synthetic `animationend` events and inspect classes, so they miss this failure.

3. **Low — [countUp.ts:15](/home/coder/dev/kudos-wt/reward-flights/website/src/countUp.ts:15): active count-ups ignore reduced-motion changes.** During a **990 → 1,010** count-up, enable reduced motion at 120 ms. The displayed number continues **1,000 → 1,006 → 1,010** because the preference is checked only when the value changes.
   
   **Fix:** observe motion-preference changes, cancel the interval, and show the final value immediately.

The round-1 fixes hold for the focused scenarios:

- Two 20-XP crates at live XP 1,010 hold **970**, then release **990 → 1,010**, without rewinding. Only the second receives the level-up point.
- Closing one reveal while another remains open preserves its hold through `flightsAfterClose` and transfer into `flights`.
- Charting replaces the estimate without changing held totals. An active flight’s frozen skill point remains held when live XP increases to 1,030.
- Reduced motion during turnover releases the hold at the 600-ms boundary with a fade. StrictMode’s double effects produced no render loop or duplicate landing.

**Finding 4:** I would not retain it as material. Normal sign-out unmounts the frame; the remaining session-swap case is cosmetic. However, `forgetEverything` itself does not clear settlement classes.

**Finding 5:** I accept the rejection: exposing the final available balance while visual digits interpolate is reasonable.

Verified with read-only, in-memory probes of the actual modules and React components. I made no changes.
## Outcomes

1. **Medium, fixed.** The Skill tree crate gets only the points that no XP on its way earned, and every queued flight charts its reward as soon as its reveal has closed (`moments.chart`, run from `App`), so the shares never change after an earlier flight leaves. Test: `crates/rewards.test.tsx`.
2. **Medium, fixed.** `settle` restarts its classes (remove, reflow, add) and replaces the earlier cleanup timer, so a second fill replays and lasts its full time. Test: "restarts the fill for a second reward that lands while the first one's fill still plays".
3. **Low, fixed.** A running count-up checks the motion preference on every tick and jumps to the end. Test: "shows the hero's XP at once when reduced motion is turned on while it counts up".

Round 2 confirmed the round 1 fixes and accepted the rejection of finding 5. It no longer holds finding 4 as material.
