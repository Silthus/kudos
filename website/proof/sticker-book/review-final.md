1. **Resolved.** [GroupAlbumCard.tsx:38](/home/coder/dev/kudos-wt/sticker-book/website/src/book/GroupAlbumCard.tsx:38) renders the held/missing roster visibly beneath the faces, outside the hidden row.

2. **Partly resolved — Minor.** [CollectionSection.tsx:8](/home/coder/dev/kudos-wt/sticker-book/website/src/book/CollectionSection.tsx:8) now reserves 112 px. The header still grows when `ReadyPillFailure` appears, so section headings can remain obscured. The proposed follow-up leaves this case unresolved. Smallest complete fix: measure the sticky header’s height, use it for the scroll margin, and verify a mobile jump with the failure notice visible.

3. **Resolved.** [NoStickersYet.tsx:6](/home/coder/dev/kudos-wt/sticker-book/website/src/book/NoStickersYet.tsx:6) supplies one hedgehog, explanatory copy and one Slack action. The empty branch receives `chatUrl`; tests cover albums present and absent.

4. **Resolved.** [stickerBook.test.tsx:157](/home/coder/dev/kudos-wt/sticker-book/website/src/stickerBook.test.tsx:157) checks the roster’s hidden ancestry and `sr-only` class. [accessibility.test.tsx:88](/home/coder/dev/kudos-wt/sticker-book/website/src/accessibility.test.tsx:88) adds populated and empty sticker-book states to the existing light/dark loop.

5. **Resolved.** [stickerBookFixtures.ts:71](/home/coder/dev/kudos-wt/sticker-book/website/src/stickerBookFixtures.ts:71) supplies synthetic face images as Slack photos, transparent company-profile cutouts with their own colours, and initials.

No new defects found in the fixes. The focused test run could not execute because the read-only environment prevented temporary-file creation.

fix first
