// Node module hooks so tests can import the Worker entry (src/index.ts), whose
// imports are extensionless ("./feeds") and include a JSON module, both of
// which wrangler's bundler resolves but plain Node does not.
//
// Registered by tests via: register("./support/ts-resolve-hooks.mjs", import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const fromSrc = context.parentURL && context.parentURL.includes("/src/");
  if (isRelative && fromSrc) {
    if (specifier.endsWith(".json")) {
      const r = await nextResolve(specifier, { ...context, importAttributes: { type: "json" } });
      return { ...r, importAttributes: { type: "json" } };
    }
    if (!/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}
