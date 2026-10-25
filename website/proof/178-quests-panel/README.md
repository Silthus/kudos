# Strand D proof: the quests panel and the profile section

Strand D of `spec/monday-quests.md` (MQ37–MQ42), landed on `spec/monday-quests` at `a51d7b29`. The walk ran on production builds (`vite build`, then `vite preview`) of three committed shell fixtures. All members are made up:

- `album-quests`: page D on, and a Monday-path member halfway through Getting started (hug, first quest and turn done, 1 of 2 days).
- `album-quests-week`: the same member after onboarding, with this week's three drawn quests. One is finished and its hoggie waits.
- `album-person-page-d`: the same album off the Monday path (`getQuests` answers `not-found`).

Gate on the landed tree (`gate-a51d7b29.txt`): `env -u SITE_URL pnpm gate` exit 0, 342 test files, 5934 tests.

## Tests

- Seam 1, `convex/website/mondayQuests.test.ts`: Slack events, then a signed-in session calling `getQuests` and `viewQuests`. It covers the five-step journey, item states `waiting` and `turned`, no item for a step finished before it paid one, the drawn week after the hourly sweep, and `not-found` off the path. `quests viewed` reaches the fake PostHog with its surface, once per call, and is refused off the path.
- Seam 2, `website/src/album/questsPanel.test.tsx`: the rendered album with fixture reads. It covers the panel's copy and steps, the first-visit open and its view, fold and unfold with a view per open, `Escape`, the remembered fold, the phone starting folded, the drawn rows, the own page D section with its profile view and the tab, the remembered fold kept when the tab opens on the own page, no section on a teammate's page or on the old profile, and no panel off the path, while loading or on a failed read.

## Walk, against #172's element checklist

Prototype screenshots: [profile](https://github.com/Silthus/kudos/blob/aabbc54f25b3d0f8f4fe09d16fdf9080b6fb6946/website/src/album/questsPrototype/shots/profile-merge-newcomer.png?raw=true), [panel at 1536 px](https://github.com/Silthus/kudos/blob/aabbc54f25b3d0f8f4fe09d16fdf9080b6fb6946/website/src/album/questsPrototype/shots/panel-merge-newcomer-1536.png?raw=true), [weekly panel](https://github.com/Silthus/kudos/blob/aabbc54f25b3d0f8f4fe09d16fdf9080b6fb6946/website/src/album/questsPrototype/shots/panel-weekly.png?raw=true), [folded tab](https://github.com/Silthus/kudos/blob/aabbc54f25b3d0f8f4fe09d16fdf9080b6fb6946/website/src/album/questsPrototype/shots/panel-folded-tab.png?raw=true).

**Panel**
- [x] Open on a first visit, right side under the top bar, card surface, 21 rem: `01-panel-journey-1280-light.png`, `02-panel-journey-1536-light.png`
- [x] Eyebrow in accent ink: `01`, `12-panel-week-1536-light.png`
- [x] Warm title with the first name, and its note: `01`, `12`
- [x] Fold button (chevron), "Fold the quests away": `01`; the label is asserted in Seam 2
- [x] Folded tab with a ring, n/m and a vertical "QUESTS"; pressing it unfolds: `03-folded-tab-1280.png`, `06-own-page-d-tab-opened.png`
- [x] The fold is remembered: `04-fold-remembered-on-the-next-page.png`, where `localStorage` holds `hedgehug:quests-panel = folded`
- [x] Steps aside to its tab on the own profile: `05-own-page-d-section-and-tab-1280.png`
- [x] Pushes the page at 90 rem and wider, floats below: `02` (1536 px pushes), `01` (1280 px floats)
- [x] Both footers: `01`, `12`
- [x] `quests viewed{surface: panel}` on open: Seam 1 and Seam 2

**Getting started journey**
- [x] Five steps on a line: `01`
- [x] A done step: green tick ring, goal crossed off, reward dimmed: `01`
- [x] The next step: solid accent ring, "NEXT", hint: `01`
- [x] Progress bar with n/m on a step that counts more than one: `01` (1/2)
- [x] Reward on quest steps only: `01`

**Weekly quests**
- [x] Three checklist rows: checkbox, goal, progress bar with n/m, "+20 XP" and the card back: `12`, `13-panel-week-1280-light.png`
- [x] A finished row: green check, crossed off, "Turn it on your board →", which opens the item board: `12`
- [x] Days left and Monday 9:00 in the footer: `12`

**Profile (page D, own page only)**
- [x] The section between the card row and This week: `05`, `15-own-page-d-week.png`
- [x] `quests viewed{surface: profile}` when it shows: Seam 1 and Seam 2

**States**
- [x] Light and dark from the album tokens: `07-panel-journey-1536-dark.png`, `08-own-page-d-dark.png`, `11-phone-opened-dark.png`, `14-panel-week-1536-dark.png`
- [x] Phones start folded and open over the page (MQ39 makes this `build`): `09-phone-starts-folded.png`, `10-phone-opened-over-the-page.png`, `16-phone-week-opened.png`
- [x] Off the path, no panel: `17-off-the-path-no-panel.png`. Loading and a failed read are covered in Seam 2.

**After review round 1**
- [x] The welcome's links `/book#me/quests` and `/book#me/quests/<step>` (MQ22) land at the own page D's quests section, below the top bar, with the next quest and its how-to in view: `18-welcome-link-lands-at-the-section-1280.png`, `19-welcome-link-lands-at-the-section-phone.png`. Seam 2 covers the scroll and the focus.
- [x] A finished onboarding step whose hoggie waits offers "Turn it on your board →", and `quests viewed` waits until the item board or another moment is put away: Seam 2.
