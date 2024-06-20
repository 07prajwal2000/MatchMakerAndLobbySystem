import esbuild from "esbuild";

esbuild.buildSync({
  outdir: "dist",
  minify: true,
  sourcemap: true,
  bundle: true,
  platform: "node",
  entryPoints: ["src/index.ts"],
});