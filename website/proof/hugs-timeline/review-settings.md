- **P3 — [Emoji.tsx:4](/tmp/i580/review/tree2/website/src/Emoji.tsx:4):** `12:30:45` matches `:30:` and renders the minutes as a custom-emoji chip. Guard against matches embedded in numeric times and add this case to `SettingsPage.test.tsx`.

No other findings: skin tones, `+`, `-`, apostrophes, adjacent shortcodes, `Note: x: y`, React keys, chip accessibility, and the hug renderer extraction look sound.

Verified regex behavior directly. Couldn’t run React tests because dependencies aren’t installed.
