import base from "./vite.config.ts";
export default { ...base, build: { ...base.build, rollupOptions: { input: "audit-preview.html" } } };
