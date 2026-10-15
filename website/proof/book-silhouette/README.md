# The Book's unstarted-ladder silhouette meets 3:1 (#415)

WS339, V24. Before, an unstarted ladder's hedgehog was painted black (white in dark mode) at 18 % opacity over the card: about 1.5:1, under V24's 3:1 for a meaningful graphic. It now uses the locked page's silhouette, `.hog-silhouette`, painted in a single flat `--muted-foreground`. That colour already meets 3:1 against `--card` in both modes, and its test reads the theme tokens (WS339's locked-page art). The emblem keeps the dashed, uncoloured rosette, so it still reads as "not started" beside the metal rosettes of the ladders already started.

Website only. The screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, as in #290's proof). It ran under `vite preview` on 127.0.0.1:10510 (this branch) and 10511 (`origin/main` at `902ffadf`), in the T3 preview browser at 1280 px. No backend, flag or cloud deployment was touched.

| Shot | What it shows |
|---|---|
| `1-after-ladder-light.png` | `/book?page=thanked`: Recognition, not started, with a solid muted-grey hedgehog inside the dashed rosette. |
| `2-after-ladder-dark.png` | The same in dark: a light-grey silhouette on the dark card. |
| `3-before-ladder-light.png` | `main` before the change: the faint 18 % silhouette. |
| `4-before-ladder-dark.png` | `main` in dark: the faint 18 % white silhouette. |
| `5-after-overview-light.png` | The overview: the closest-next-tier card and the Being thanked tile carry the new silhouette. |
| `6-after-overview-dark.png` | The same in dark. |

In the running app, every painted path of the silhouette computes `fill: oklch(0.446 0.03 257)` (Quill's light `--muted-foreground`), with `opacity: 1` and no filter.

- `red.txt`: the new test on `main`. No `.hog-silhouette` wraps the hedgehog.
- `green.txt`: the same test passing after the change, with the token contrast for light and dark.
