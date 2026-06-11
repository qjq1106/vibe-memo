const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing build asset: ${src}`);
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  throw new Error(
    "Next standalone output not found. Ensure next.config.ts sets output: 'standalone'.",
  );
}

copyDir(staticSrc, staticDest);

if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
}

console.log("Prepared Next.js standalone bundle for Electron.");
