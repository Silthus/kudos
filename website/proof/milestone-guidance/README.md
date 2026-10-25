# Milestones says exactly how to earn each medal

Branch `fix/achievement-guidance`. The walk ran on a production build (`VITE_SHELL_FIXTURE=album vite build`) served through `vite preview` and driven in a headless browser. The page reads the typed album fixtures: the member is midway, 6 of 20 medals.

## Tests

- `milestones.test.tsx`, `AL51`: every Closest medals row names what to do and what counts, for all five milestones. `Do this next` is gone.
- `profile.test.tsx`, `AL52`: the profile's counts use the same words.

## Walk

- `1-desktop.png`: 1280 px. The tally, then Closest medals with the new hints and counts, then Earned.
- `2-phone-390.png`: 390 px, no horizontal overflow (`scrollWidth` 390).
