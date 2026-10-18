# #655 sandbox proof: thoughtful boards

Branch `album/11` at `b81eab43`, hand-deployed to the sandbox `different-dog-467` (functions only; the website is unchanged) in a throwaway proof tree merged with `album/14` (#671) and `album/2`'s proof tree (#646), so both live lanes kept their functions and indexes. `album` flag 970572 is at `environment = sandbox`, 100%.

1. `companyProfiles/sync:syncCompanyProfiles` ran first, so the stored company faces carry the matched profile.
2. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret. Four synthetic members join. Marlo sends a thoughtful kudos to three people, Tamsin to two, Bramble to one, and Bramble also sends a short `ty`. Output: `drive-output.txt`.
3. The three givers' tallies (`thoughtful-tallies-sandbox.jsonl`) are 3, 2 and 1 in their Monday-start week (Europe/Berlin, so `2026-10-19`). The short kudos added nothing.
4. `convex run website/album:getThoughtfulBoards --identity …` through imported `users` and `authSessions` rows (`getThoughtfulBoards-sandbox.json`, faces and crest images redacted):
   - Before any link, the people board ranks Marlo 1st (3), Tamsin 2nd (2) and Bramble 3rd (1), and the team board is empty, because none of them is matched to a posthog.com profile.
   - Each giver then links their own posthog.com profile through `website/commands:linkMyCompanyProfile`: Marlo and Tamsin to two `onboarding` profiles, Bramble to a `query-performance` one. The team board then ranks `onboarding` 1st (5) and `query-performance` 2nd (1). Each reader's own row and team are pinned and marked as theirs.
   - Who gave (`{"team":"onboarding"}`) narrows the people board to Marlo and Tamsin, who keep ranks 1 and 2.
5. Afterwards, each giver cleared their own link (`{"profile": null}`), so no synthetic member holds a posthog.com profile in the sandbox.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/655-boards/drive.mts`
