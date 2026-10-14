# Tickets: groups stopping point 3

Published on 2026-10-14 as sub-issues of [#52](https://github.com/Silthus/kudos/issues/52), with native blocking edges, from [groups-and-boards.md](groups-and-boards.md).

## Slice 1: groups and the group boards (`groups`, branch `spec/groups`)

1. [#318](https://github.com/Silthus/kudos/issues/318) Every Everyone board row says how many places it climbed (GB18, GB35). No blocker.
2. [#319](https://github.com/Silthus/kudos/issues/319) Members count for a primary group that follows Slack's user groups (GB1–GB9). No blocker.
3. [#321](https://github.com/Silthus/kudos/issues/321) Every kudos counts for the giver's primary group (GB10–GB12). Blocked by #319.
4. [#322](https://github.com/Silthus/kudos/issues/322) Pick your primary group in the welcome message and Settings (GB7, GB19, GB20). Blocked by #319.
5. [#323](https://github.com/Silthus/kudos/issues/323) Admins choose which groups count (GB26, GB27). Blocked by #319.
6. [#324](https://github.com/Silthus/kudos/issues/324) The Groups board ranks groups by kudos given per member (GB13, GB14, GB17). Blocked by #318, #321.
7. [#325](https://github.com/Silthus/kudos/issues/325) The My group board and the peer line (GB15, GB16). Blocked by #324.
8. [#326](https://github.com/Silthus/kudos/issues/326) Gate: groups behind the `groups` flag. Blocked by #322, #323, #325.
9. [#327](https://github.com/Silthus/kudos/issues/327) **Merge to `main` and deploy.** Blocked by #318–#326.

## Slice 2: the group quest (`group-quest`, branch `spec/group-quest`)

10. [#328](https://github.com/Silthus/kudos/issues/328) Each group gets a weekly group quest (GB21, GB22, GB25). Blocked by #327.
11. [#329](https://github.com/Silthus/kudos/issues/329) Members finish the group quest together (GB23, GB24, GB36). Blocked by #328.
12. [#330](https://github.com/Silthus/kudos/issues/330) Gate: the group quest behind the `group-quest` flag. Blocked by #329.
13. [#331](https://github.com/Silthus/kudos/issues/331) **Merge to `main` and deploy.** Blocked by #328–#330.

## Slice 3: the Monday post (`monday-post`, branch `spec/monday-post`)

14. [#332](https://github.com/Silthus/kudos/issues/332) Admins switch on the Monday post (GB28). Blocked by #327.
15. [#333](https://github.com/Silthus/kudos/issues/333) Gate: the Monday post behind the `monday-post` flag. Blocked by #332.
16. [#334](https://github.com/Silthus/kudos/issues/334) **Merge to `main` and deploy.** Blocked by #332, #333.
