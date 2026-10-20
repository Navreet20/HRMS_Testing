#!/usr/bin/env node
/**
 * Fails when source hardcodes stacking instead of importing Z / zClass
 * from src/ui/zIndex.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const FRONTEND_ROOT = path.resolve(SCRIPT_DIR, "..");
export const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

/** Scale definition — the only file allowed to spell raw z-* tokens. */
export const SCALE_ALLOWLIST = new Set(["ui/zIndex.ts"]);

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

/** @typedef {{ readonly name: string; readonly regex: RegExp }} ZIndexPattern */

/** @type {readonly ZIndexPattern[]} */
export const Z_INDEX_PATTERNS = [
  { name: "arbitrary Tailwind z-[…]", regex: /\bz-\[/g },
  {
    name: "standard Tailwind z-10…z-70 utility",
    regex: /\bz-(10|20|30|40|50|60|70)\b/g,
  },
  { name: "inline zIndex number", regex: /\bzIndex\s*[:=]\s*(?:\{\s*)?-?\d+/g },
  { name: "CSS z-index number", regex: /z-index\s*:\s*-?\d+/g },
];

/**
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\\n])\/\/.*$/gm, "$1");
}

/**
 * @param {string} filePath
 * @param {string} srcRoot
 * @returns {string}
 */
export function relativeToSrc(filePath, srcRoot = SRC_ROOT) {
  return path.relative(srcRoot, filePath).split(path.sep).join("/");
}

/**
 * @param {string} content
 * @param {string} relativePath
 * @returns {Array<{ readonly file: string; readonly line: number; readonly name: string; readonly match: string }>}
 */
export function scanSource(content, relativePath) {
  const isScale = SCALE_ALLOWLIST.has(relativePath);
  if (isScale) {
    return [];
  }

  const stripped = stripComments(content);
  const lines = stripped.split(/\r?\n/);
  /** @type {Array<{ readonly file: string; readonly line: number; readonly name: string; readonly match: string }>} */
  const violations = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of Z_INDEX_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(line);
      while (match) {
        violations.push({
          file: relativePath,
          line: index + 1,
          name: pattern.name,
          match: match[0].trim(),
        });
        match = pattern.regex.exec(line);
      }
    }
  }

  return violations;
}

/**
 * @param {string} dir
 * @param {string[]} acc
 * @returns {string[]}
 */
function collectFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, acc);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * @param {string} srcRoot
 * @returns {Array<{ readonly file: string; readonly line: number; readonly name: string; readonly match: string }>}
 */
export function scanSrcTree(srcRoot = SRC_ROOT) {
  const files = collectFiles(srcRoot);
  /** @type {Array<{ readonly file: string; readonly line: number; readonly name: string; readonly match: string }>} */
  const violations = [];
  for (const filePath of files) {
    const relativePath = relativeToSrc(filePath, srcRoot);
    const content = fs.readFileSync(filePath, "utf8");
    violations.push(...scanSource(content, relativePath));
  }
  return violations;
}

/**
 * @param {readonly { readonly file: string; readonly line: number; readonly name: string; readonly match: string }[]} violations
 * @returns {string}
 */
export function formatViolations(violations) {
  const header = [
    "Raw z-index usage must come from src/ui/zIndex.ts (import { Z, zClass }).",
    "Do not hardcode Tailwind z-[…] / z-10…z-70 or numeric zIndex / z-index.",
    "",
  ].join("\n");
  const body = violations
    .map(
      (violation) =>
        `  ${violation.file}:${violation.line}  ${violation.name}  ${violation.match}`,
    )
    .join("\n");
  return `${header}${body}`;
}

function main() {
  const violations = scanSrcTree();
  if (violations.length === 0) {
    return;
  }
  console.error(formatViolations(violations));
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main();
}
