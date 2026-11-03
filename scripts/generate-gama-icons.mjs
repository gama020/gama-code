import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import * as NodeURL from "node:url";

const __dirname = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(__dirname, "..");

const SOURCE_IMAGE =
  "/Users/gama/.gemini/antigravity/brain/942d3066-c360-4be8-9df3-20a768e4bac8/.user_uploaded/media_1793531819186_641ca63e.png";

console.log("=== Generating Refined Gama Os Icon Suite ===");

// 1. Extract pure white G glyph on transparency from the source image
const rawPixels = NodeChildProcess.execFileSync("magick", [SOURCE_IMAGE, "-depth", "8", "rgba:-"]);
const w = 150;
const h = 150;
const bgR = 26;
const bgG = 38;
const bgB = 50;

const glyph = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const r = rawPixels[i * 4];
  const g = rawPixels[i * 4 + 1];
  const b = rawPixels[i * 4 + 2];
  const a = rawPixels[i * 4 + 3];

  if (a < 10) {
    glyph[i * 4 + 3] = 0;
    continue;
  }

  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

  if (luma <= bgLuma + 5) {
    glyph[i * 4 + 3] = 0;
  } else {
    const alphaNorm = Math.min(
      255,
      Math.max(0, Math.round(((luma - bgLuma) / (255 - bgLuma)) * 255)),
    );
    glyph[i * 4] = 255;
    glyph[i * 4 + 1] = 255;
    glyph[i * 4 + 2] = 255;
    glyph[i * 4 + 3] = alphaNorm;
  }
}

// Save raw extracted glyph cropped tightly to 82x134
const extractChild = NodeChildProcess.spawnSync(
  "magick",
  [
    "-size",
    `${w}x${h}`,
    "-depth",
    "8",
    "rgba:-",
    "-crop",
    "82x134+34+8",
    "+repage",
    "/tmp/gama_g_tight.png",
  ],
  { input: glyph },
);

if (extractChild.status !== 0) {
  throw new Error("Failed to extract G glyph: " + extractChild.stderr?.toString());
}
console.log("✓ Extracted crisp G glyph (/tmp/gama_g_tight.png)");

// 2. Generate macOS Master 1024x1024 Icon
// Full-bleed squircle (rx=224) prevents macOS Dock from adding a white backing plate.
// G height is 572px (55.8% of canvas, matching Photoshop's breathing room).
const baseSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="224" ry="224" fill="#141c26"/>
  <rect x="1.5" y="1.5" width="1021" height="1021" rx="222.5" ry="222.5" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3"/>
</svg>`;

await NodeFSP.writeFile("/tmp/gama_base_1024.svg", baseSvg);
NodeChildProcess.execSync(
  "magick -background none /tmp/gama_base_1024.svg /tmp/gama_base_1024.png",
);

// Scale G glyph to 350x572 with Lanczos and sharpened alpha curve
NodeChildProcess.execSync(
  "magick /tmp/gama_g_tight.png -filter Lanczos -resize 350x572 -channel A -level 25%,75% +channel /tmp/gama_g_572.png",
);

// Composite G glyph centered at (337, 226)
const master1024 = NodePath.join(repoRoot, "assets/prod/black-macos-1024.png");
NodeChildProcess.execSync(
  `magick /tmp/gama_base_1024.png /tmp/gama_g_572.png -geometry +337+226 -composite "${master1024}"`,
);
console.log("✓ Generated full-bleed macOS master 1024x1024:", master1024);

// Copy to universal (Linux) and iOS
const universal1024 = NodePath.join(repoRoot, "assets/prod/black-universal-1024.png");
const ios1024 = NodePath.join(repoRoot, "assets/prod/black-ios-1024.png");
await NodeFSP.copyFile(master1024, universal1024);
await NodeFSP.copyFile(master1024, ios1024);

// Copy to dev and nightly
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

// 3. Generate Windows Master & Multi-Resolution ICO
const windowsIco = NodePath.join(repoRoot, "assets/prod/t3-black-windows.ico");
NodeChildProcess.execSync(
  `magick "${master1024}" -define icon:auto-resize=256,128,64,48,32,24,16 "${windowsIco}"`,
);
console.log("✓ Generated multi-resolution Windows ICO:", windowsIco);

for (const env of ["dev", "nightly"]) {
  const prefix = env === "dev" ? "blueprint" : "nightly";
  await NodeFSP.copyFile(
    windowsIco,
    NodePath.join(repoRoot, `assets/${env}/${prefix}-windows.ico`),
  );
}

// 4. Generate Dedicated Web Favicons & Apple Touch Icon
// Tailored pixel boundaries: 16x16 (rx=3), 32x32 (rx=6), 180x180 (rx=38).
function generateFavicon(size, rx, gHeight, outPath) {
  const gW = Math.round(82 * (gHeight / 134));
  const gH = gHeight;
  const gX = Math.round((size - gW) / 2);
  const gY = Math.round((size - gH) / 2);

  NodeChildProcess.execSync(
    `magick /tmp/gama_g_tight.png -filter Lanczos -resize ${gW}x${gH} -channel A -level 20%,80% +channel /tmp/gama_g_fav_${size}.png`,
  );

  const margin = size <= 16 ? 0 : size <= 32 ? 1 : 2;
  const sqSize = size - margin * 2;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${margin}" y="${margin}" width="${sqSize}" height="${sqSize}" rx="${rx}" ry="${rx}" fill="#141c26"/>
    <rect x="${margin + 0.5}" y="${margin + 0.5}" width="${sqSize - 1}" height="${sqSize - 1}" rx="${rx - 0.5}" ry="${rx - 0.5}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>
  </svg>`;

  NodeChildProcess.spawnSync(
    "magick",
    ["-background", "none", "svg:-", `/tmp/gama_fav_base_${size}.png`],
    { input: svg },
  );

  NodeChildProcess.execSync(
    `magick /tmp/gama_fav_base_${size}.png /tmp/gama_g_fav_${size}.png -geometry +${gX}+${gY} -composite "${outPath}"`,
  );
}

const favicon16 = NodePath.join(repoRoot, "assets/prod/t3-black-web-favicon-16x16.png");
const favicon32 = NodePath.join(repoRoot, "assets/prod/t3-black-web-favicon-32x32.png");
const appleTouch180 = NodePath.join(repoRoot, "assets/prod/t3-black-web-apple-touch-180.png");
const faviconIco = NodePath.join(repoRoot, "assets/prod/t3-black-web-favicon.ico");

generateFavicon(16, 3, 11, favicon16);
generateFavicon(32, 6, 21, favicon32);
generateFavicon(180, 38, 105, appleTouch180);

// Multi-resolution web favicon.ico (48, 32, 16)
generateFavicon(48, 9, 31, "/tmp/gama_fav_48.png");
NodeChildProcess.execSync(
  `magick /tmp/gama_fav_48.png "${favicon32}" "${favicon16}" "${faviconIco}"`,
);
console.log("✓ Generated web favicons (16, 32, 48, 180) in assets/prod");

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
}

// Copy directly to apps/web/public
const publicDir = NodePath.join(repoRoot, "apps/web/public");
await NodeFSP.copyFile(favicon16, NodePath.join(publicDir, "favicon-16x16.png"));
await NodeFSP.copyFile(favicon32, NodePath.join(publicDir, "favicon-32x32.png"));
await NodeFSP.copyFile(appleTouch180, NodePath.join(publicDir, "apple-touch-icon.png"));
await NodeFSP.copyFile(faviconIco, NodePath.join(publicDir, "favicon.ico"));
console.log("✓ Updated apps/web/public web favicons");

console.log("=== Gama Os Refined Icon Suite Generation Complete! ===");
