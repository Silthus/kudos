import base from "./vite.config.ts";
export default { ...base, build: { ...base.build, emptyOutDir: true, rollupOptions: { input: "proof-fixture.html" } } };
