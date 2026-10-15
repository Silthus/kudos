# #414 follow-up: a skin-toned emoji's order

- `red.txt`: on `main` (`a0f4e2f3`, with #439's toned names), `wave::skin-tone-3` with Slack's untoned `👋` draws `👋`, not `👋🏼`.
- `green.txt`: after the change, a skin-toned name draws the shortcode table's toned character, then `unicode`, then the picture, then the chip. Every other name keeps `unicode`, picture, table, chip.
