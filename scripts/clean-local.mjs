#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGETS = [".next", "out", "build", "coverage", "tsconfig.tsbuildinfo"];

for (const target of TARGETS) {
  const absolutePath = path.join(ROOT, target);
  if (!fs.existsSync(absolutePath)) continue;
  fs.rmSync(absolutePath, { recursive: true, force: true });
  console.log(`[clean-local] Removed ${target}`);
}
