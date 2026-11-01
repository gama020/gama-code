import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import * as NodeURL from "node:url";

const __dirname = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(__dirname, "..");

const SOURCE_IMAGE =
  "/Users/gama/.gemini/antigravity/brain/942d3066-c360-4be8-9df3-20a768e4bac8/.user_uploaded/media_1793531819186_641ca63e.png";

console.log("Generating Gama Os icon suite from source monogram...");

// 1. Generate master 1024x1024
const master1024 = NodePath.join(repoRoot, "assets/prod/black-macos-1024.png");
NodeChildProcess.execFileSync("magick", [
  SOURCE_IMAGE,
  "-filter",
  "Lanczos",
  "-resize",
  "1024x1024",
  master1024,
]);
console.log("✓ Generated 1024x1024 master:", master1024);

// Copy to universal and ios
await NodeFSP.copyFile(master1024, NodePath.join(repoRoot, "assets/prod/black-universal-1024.png"));
await NodeFSP.copyFile(master1024, NodePath.join(repoRoot, "assets/prod/black-ios-1024.png"));

// Also copy to dev and nightly
for (const env of ["dev", "nightly"]) {
  const prefix = env === "dev" ? "blueprint" : "nightly";
  await NodeFSP.copyFile(
    master1024,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-macos-1024.png`),
  );
  await NodeFSP.copyFile(
    master1024,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-universal-1024.png`),
  );
  await NodeFSP.copyFile(
    master1024,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-ios-1024.png`),
  );
}

// 2. Generate web favicons
const favicon16 = NodePath.join(repoRoot, "assets/prod/t3-black-web-favicon-16x16.png");
const favicon32 = NodePath.join(repoRoot, "assets/prod/t3-black-web-favicon-32x32.png");
const appleTouch180 = NodePath.join(repoRoot, "assets/prod/t3-black-web-apple-touch-180.png");
const faviconIco = NodePath.join(repoRoot, "assets/prod/t3-black-web-favicon.ico");
const windowsIco = NodePath.join(repoRoot, "assets/prod/t3-black-windows.ico");

NodeChildProcess.execFileSync("magick", [master1024, "-resize", "16x16", favicon16]);
NodeChildProcess.execFileSync("magick", [master1024, "-resize", "32x32", favicon32]);
NodeChildProcess.execFileSync("magick", [master1024, "-resize", "180x180", appleTouch180]);
NodeChildProcess.execFileSync("magick", [
  master1024,
  "-define",
  "icon:auto-resize=48,32,16",
  faviconIco,
]);
NodeChildProcess.execFileSync("magick", [
  master1024,
  "-define",
  "icon:auto-resize=256,128,64,48,32,24,16",
  windowsIco,
]);

console.log("✓ Generated web favicons and Windows ICO in assets/prod");

// Copy to dev and nightly
for (const env of ["dev", "nightly"]) {
  const prefix = env === "dev" ? "blueprint" : "nightly";
  await NodeFSP.copyFile(
    favicon16,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-web-favicon-16x16.png`),
  );
  await NodeFSP.copyFile(
    favicon32,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-web-favicon-32x32.png`),
  );
  await NodeFSP.copyFile(
    appleTouch180,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-web-apple-touch-180.png`),
  );
  await NodeFSP.copyFile(
    faviconIco,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-web-favicon.ico`),
  );
  await NodeFSP.copyFile(
    windowsIco,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-windows.ico`),
  );
}

// Copy directly to apps/web/public
const publicDir = NodePath.join(repoRoot, "apps/web/public");
await NodeFSP.copyFile(favicon16, NodePath.join(publicDir, "favicon-16x16.png"));
await NodeFSP.copyFile(favicon32, NodePath.join(publicDir, "favicon-32x32.png"));
await NodeFSP.copyFile(appleTouch180, NodePath.join(publicDir, "apple-touch-icon.png"));
await NodeFSP.copyFile(faviconIco, NodePath.join(publicDir, "favicon.ico"));
console.log("✓ Updated apps/web/public favicons");

console.log("Gama Os icon suite generation complete!");
