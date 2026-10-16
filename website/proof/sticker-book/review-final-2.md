- **Minor — [hudHeight.ts:14](/home/coder/dev/kudos-wt/sticker-book/website/src/hudHeight.ts:14): incomplete unmount cleanup.** `--hud-height` remains on `<html>` after unmount, overriding its fallback. Reproduced with StrictMode and without `ResizeObserver`: both leave `140px`. Smallest fix: always return cleanup that removes the property and disconnects an optional observer; avoid the early return when the observer is unavailable.

- **Minor — [stickerBook.test.tsx:225](/home/coder/dev/kudos-wt/sticker-book/website/src/stickerBook.test.tsx:225): lifecycle coverage can pass falsely.** `disconnect()` does nothing, and the test invokes every observer, including StrictMode’s disconnected first instance. It proves resize-to-variable wiring, but cannot prove the surviving observer works or cleanup occurs. `afterEach` also masks the leaked property. Smallest fix: track disconnection, invoke only the active observer, explicitly unmount, and assert disconnection plus property removal before teardown. Cover cleanup without `ResizeObserver` too.

Client-only mounting and StrictMode setup showed no additional defect. Vitest startup was blocked by the read-only filesystem; an in-memory run of the actual hook reproduced the cleanup defect.

fix first
