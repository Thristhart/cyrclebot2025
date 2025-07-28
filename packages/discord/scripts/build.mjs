import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/bot.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  charset: "utf8",
  sourcemap: true,
  outdir: "./dist",
  banner: {
    js: `
import { createRequire as topLevelCreateRequireCyrclebot } from 'module';
import { fileURLToPath as topLevelFileUrlToPath } from "node:url";
const require = topLevelCreateRequireCyrclebot( import.meta.url );
const __dirname = topLevelFileUrlToPath( new URL( ".", import.meta.url ) );
const __filename = topLevelFileUrlToPath( import.meta.url );
        `,
  },
  external: ["dbmate", "better-sqlite3", 'ffmpeg-static'],
});

console.log("discord bot built.");