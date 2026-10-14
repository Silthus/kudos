# #133 the leaderboard read

- `red-convex.txt`: the new and changed tests on `spec/website-2` at `05d07ea`, before the change: 38 fail. After the red run, one expectation in `rankedBoardOf`'s first module test was corrected: it had expected no improvement line, but the viewer gained 1 this week.
- `green-convex.txt`: the same tests pass after the change, and no test is skipped.
- `gate.txt`: `pnpm gate` on the landed tree.
- `running-app.txt`: `getLeaderboard` and `getMyProfile` on a disposable local backend, never a cloud deployment. The conductor assigned ports 3910/3911, but map #1's ship #105 held 3910–3912, so this ran on 3920/3921. A local fake on 3922 served the flags. The flag override (`website` and `everyone-board` on, then `everyone-board` off) existed only in that fake's file and was never sent to PostHog. The members, totals and session are synthetic and were imported with `convex import`. The signed-in reads ran through `convex run --identity` with the session's subject, and the result matches App Home's `everyoneBoard` for the same viewer. The ticket changes no browser view, so there are no screenshots.
- `review-gpt-6.1-sol.txt`: the cross-model review and the response to each finding.
