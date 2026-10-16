# Company profiles

The website's copy of posthog.com's public team pages, and the matcher for one member's face: a daily internal action reads every page of the team API, keeps each person once with their posthog.com ID, their colour, the slug of every team they are on, their trimmed role when they have one and, when they have one, their cutout sized on res.cloudinary.com, and keeps each team with a slug and a name as a company team with its name, its leads and people in posthog.com's order and its crest when that is an image on res.cloudinary.com, sized like the cutouts. It replaces the companyProfiles and companyTeams tables together in one mutation only after a complete, validated read, stamping every row with the time the read began and dropping a replacement older than the stored copy; a read that fails, answers malformed data or holds no profile keeps the previous rows and logs companyProfiles.read_failed with a fixed reason. A company team's crest art is the catalogue's crest of its slug, else its crest image, else none. A member's face is a company profile only when exactly one profile's first and last name, normalised for case, accents and spacing, equals the member's Slack real name and that profile has a cutout. Only this module knows posthog.com.

## invariants
- a failed posthog.com read keeps the previous profiles: A sync replaces the company profiles and the company teams, both together, only after it read every page of posthog.com's team API in full and found it well formed and not empty; any other read keeps the previous profiles and teams and logs a fixed code.
  over: a sync after a good read, answered by an error status, a network failure, a body that isn't JSON, a team without its profiles, a team whose name isn't text, a team whose leads aren't profiles, a profile without a last name, no pagination, no profiles at all, a later page that declares fewer pages or answers as the first page again, and a failure on a later page
  via: WS22: a failed posthog.com read keeps the previous profiles
  because: posthog.com is outside the deployment's control; a partial, failed or changed answer replacing the table would turn every member's face back to their Slack photo, and empty or cut the team pages, until the next good day (WS22, CV15)
  crossing: posthog-com -> domain
  entrances: none
  refuted: syncCompanyProfiles replaced the table with no profiles after a failed read instead of keeping the previous rows -> all 8 read-failure tests failed on the kept face (2026-10-13)
  refuted: syncCompanyProfiles cleared the company teams after a failed read instead of keeping them -> all 14 read-failure tests failed on the kept teams (2026-10-16)
  kinds: storage
  checklist: scoped-reads dismissed: the company profiles are the workspace's shared copy of public team pages; a member's read takes only the one profile their own name selects, under the website guard
  checklist: encrypted-storage dismissed: the rows copy public pages from posthog.com and hold no credential or secret
  checklist: key-rotation-compatibility dismissed: no key protects the rows
  checklist: input-validation declared as a failed posthog.com read keeps the previous profiles
  checklist: revision-preservation dismissed: the table is a cache of posthog.com's current pages, replaced whole by design; posthog.com keeps the history
  checklist: commit-ordered-effects dismissed: the sync issues no external effect; it only reads posthog.com and writes its own rows in one mutation
  checklist: durable-dispatch-intent dismissed: no work is dispatched; a missed day is read again by the next daily run
  checklist: declared-target-coverage dismissed: the sync fans out to no targets; it reads every page pageCount declares, which the oracle covers
  checklist: completion-evidence dismissed: nothing waits on the sync's completion; a failed read logs its code and the old rows stay
- a face needs exactly one company profile: A member reads a company profile face only when exactly one company profile's normalised first and last name equals the member's normalised Slack real name and that profile has a cutout; two, none, or one without a cutout fall back to the Slack picture, then initials.
  over: getMyProfile for a member whose name matches one profile, two profiles, two people of whom only one has a cutout, none, and a profile whose cutout isn't a Cloudinary PNG
  via: WS21 V19 V21: without exactly one company profile the face falls back
  because: names are the only key posthog.com shares; with two people of one name, picking either would show a member someone else's face (WS21, V21)
  crossing: posthog-com -> domain
  entrances: none
  refuted: companyFaceOf took the first of two profiles with the member's name instead of falling back -> the two-profiles test read a company face instead of the Slack picture (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads dismissed: the face is read only inside getMyProfile, whose website reads pass one guard invariant scopes it to the session's own member
  checklist: capability-authorization dismissed: no credential is accepted; the member and their name come from the live session the website guard checked
  checklist: redaction dismissed: the face carries only a public cutout URL and a colour, never a name or another member's facts
  checklist: canonical-encoding declared as a face needs exactly one company profile
  checklist: identity-continuity dismissed: a face is chosen afresh on every read from the latest sign-in name and the latest good sync, so no association is carried across a change
