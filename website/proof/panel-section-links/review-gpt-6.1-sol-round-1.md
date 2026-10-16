
codex
- **[P2] Inventory links fail when Home is already mounted** — [website/src/home/GearPanel.tsx:19](/home/coder/dev/kudos-wt/panel-section-links/website/src/home/GearPanel.tsx:19). `opensOn` only initializes state. Reproduce: open `/?panel=inventory`, switch to Character, click the home logo (`/`), then press Back. Home retains its component state, so the panel stays on Character. The landing hook finds no inventory target and consumes the arrival without scrolling or focusing. Reapply the Inventory side on a new targeted navigation before the landing runs, or remount the panel for that navigation. Add coverage for this history sequence; current tests only mount directly at the target.

Verdict: Request changes—the Inventory target does not reliably land during history navigation.
