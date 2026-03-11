#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mode = process.argv[2] || "patch";
const dryRun = process.argv.includes("--dry-run");

const allowedModes = new Set(["patch", "minor", "major"]);
if (!allowedModes.has(mode)) {
  console.error("Usage: node scripts/bump-version.mjs <patch|minor|major> [--dry-run]");
  process.exit(1);
}

function bumpSemver(version, bumpMode) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`Invalid semver: ${version}`);
  }

  let major = Number(m[1]);
  let minor = Number(m[2]);
  let patch = Number(m[3]);

  if (bumpMode === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpMode === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

const packageJsonPath = path.join(root, "package.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");

const packageJson = JSON.parse(read(packageJsonPath));
const currentVersion = packageJson.version;
const nextVersion = bumpSemver(currentVersion, mode);

const nextPackageJson = { ...packageJson, version: nextVersion };

let cargoToml = read(cargoTomlPath);
const cargoVersionPattern = /^version\s*=\s*"(\d+\.\d+\.\d+)"\s*$/m;
if (!cargoVersionPattern.test(cargoToml)) {
  throw new Error("Could not find version in src-tauri/Cargo.toml");
}
cargoToml = cargoToml.replace(cargoVersionPattern, `version = \"${nextVersion}\"`);

const tauriConf = JSON.parse(read(tauriConfPath));
const nextTauriConf = { ...tauriConf, version: nextVersion };

if (!dryRun) {
  write(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`);
  write(cargoTomlPath, cargoToml);
  write(tauriConfPath, `${JSON.stringify(nextTauriConf, null, 2)}\n`);
}

console.log(`${dryRun ? "[dry-run] " : ""}Version bumped: ${currentVersion} -> ${nextVersion}`);
console.log("Updated files:");
console.log("- package.json");
console.log("- src-tauri/Cargo.toml");
console.log("- src-tauri/tauri.conf.json");
console.log("Next:");
console.log(`- git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json`);
console.log(`- git commit -m \"chore(release): v${nextVersion}\"`);
console.log(`- git tag v${nextVersion}`);
console.log(`- git push && git push --tags`);
