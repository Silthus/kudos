# #112: the shell's console is clean under the CSP

**Before.** Every page load logged one `style-src 'self'` violation (hash `sha256-jaH+qsR8…`). At module load, `@posthog/quill` 0.3.0-beta.30 appends `<style id="quill-scroll-area-shadows">` unless an element with that id already exists. The same violation showed on the sandbox's signed-out page. Quill's only other injected style, the ThemeProvider's transition guard, is never mounted here, and no other violation appeared.

**Fix.** `website/index.html` links `/quill-scroll-area-shadows-<quill version>.css` under Quill's id, before the module script, so Quill finds it and injects nothing. The file is Quill's exported `scrollShadowsCss`, byte for byte, served from the site's own origin. WS25's `style-src 'self'` stays as written, with no hash.

**Tests.** `website/src/quillStyles.test.tsx`: red in `red-quill-styles.txt`, green in `green-quill-styles.txt`. The second test fails if a Quill upgrade changes the CSS.

**Browser.** Fixture builds (`member`, `signed-out`) served by a local server that sends the production CSP header. On the T3 preview browser:

- **Before:** one violation per load on both pages.
- **After:** no console entries on the signed-out page, nor on the member page after switching to dark and opening the account menu.
- `document.querySelectorAll("style").length` is 0, and the linked sheet carries its 12 rules.

`console-clean-member-dark.png` shows the member page in that state.

**Sandbox.** The sandbox is shared, and another lane deployed its own code there at 22:11 UTC. This ship then redeployed 6518213 by hand at 22:17 UTC (`convex deploy`, `static-hosting upload`, `prepareWebsiteFlag`). The signed-out page there, with the flag on and a live Convex socket, logged no console entries. It holds no `<style>` element, and the versioned stylesheet carries its 12 rules (`sandbox-signed-out-dark.png`, `sandbox-curl.txt`). Signing in there redirects to Slack with no client ID until #115's credentials are set.

**Caching.** The edge served the first, unversioned name with `max-age=31536000`, and the component reads a hyphenated name as content-hashed. So the file name carries Quill's version, and the test fails on a Quill upgrade until the stylesheet is regenerated under the new name (`red-quill-styles-versioned.txt`, `green-quill-styles-versioned.txt`).
