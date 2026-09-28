// npm run build: the Node equivalent of build-jsx.ps1, using the pinned esbuild.
import path from "node:path";
import { JSX_FILES, compile, root } from "./build-config.mjs";

for (const base of JSX_FILES) {
  const r = compile(base, path.join(root, `${base}.js`));
  if (!r.ok) {
    console.error(`BUILD FAILED on ${base}.jsx: ${r.error}`);
    process.exit(1);
  }
  console.log(`compiled ${base}.jsx -> ${base}.js`);
}
console.log(`JSX precompile complete: ${JSX_FILES.length} files`);
