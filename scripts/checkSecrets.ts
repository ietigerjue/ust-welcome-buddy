import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type Finding = {
  severity: "high" | "medium";
  type: string;
  file: string;
  line?: number;
  variable?: string;
};

const root = process.cwd();
const excludedDirs = new Set(["node_modules", ".git", ".output", "dist", "build"]);
const excludedFiles = new Set([
  "package-lock.json",
  "bun.lock",
  "scripts/checkSecrets.ts",
  ".env",
  ".env.local",
]);

const placeholderPattern = /^(your_|replace_|placeholder|example|todo|xxx|changeme|<|$)/i;

function toRelative(filePath: string) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function isEnvLikeFile(relativePath: string) {
  return /^\.env($|\.|\/)/.test(relativePath) && relativePath !== ".env.example";
}

function getTrackedEnvFiles() {
  try {
    const output = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((file) => file === ".env" || file === ".env.local" || /^\.env\..*\.local$/.test(file));
  } catch {
    return [];
  }
}

function walk(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const relative = toRelative(fullPath);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!excludedDirs.has(entry)) {
        walk(fullPath, files);
      }
      continue;
    }

    if (excludedFiles.has(relative) || isEnvLikeFile(relative)) {
      continue;
    }

    if (stats.size > 1_000_000) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function scanFile(filePath: string): Finding[] {
  const relative = toRelative(filePath);
  const findings: Finding[] = [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const assignment = line.match(/\b([A-Z0-9_]*(?:API_KEY|SERVICE_ROLE_KEY|SECRET|TOKEN|PRIVATE_KEY)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]{12,})/);
    if (assignment && !placeholderPattern.test(assignment[2])) {
      findings.push({
        severity: "high",
        type: "secret-like assignment",
        file: relative,
        line: index + 1,
        variable: assignment[1],
      });
    }

    const bearerPrefix = "Bearer ";
    const bearerIndex = line.indexOf(bearerPrefix);
    if (bearerIndex >= 0 && /sk-[A-Za-z0-9_-]{8,}/.test(line.slice(bearerIndex + bearerPrefix.length))) {
      findings.push({
        severity: "high",
        type: "bearer sk token",
        file: relative,
        line: index + 1,
      });
    }

    if (/\bsk-[A-Za-z0-9_-]{20,}\b/.test(line)) {
      findings.push({
        severity: "high",
        type: "provider sk token",
        file: relative,
        line: index + 1,
      });
    }

    if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(line)) {
      findings.push({
        severity: "high",
        type: "jwt-like token, possible Supabase key",
        file: relative,
        line: index + 1,
      });
    }
  });

  return findings;
}

const findings: Finding[] = [];

for (const trackedEnv of getTrackedEnvFiles()) {
  findings.push({
    severity: "high",
    type: "tracked env file",
    file: trackedEnv,
  });
}

for (const file of walk(root)) {
  findings.push(...scanFile(file));
}

console.log("[check:secrets] Secret scan complete.");
console.log("[check:secrets] Full secret values are never printed.");

if (findings.length === 0) {
  console.log("[check:secrets] No high-risk patterns found.");
  process.exit(0);
}

for (const finding of findings) {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  const variable = finding.variable ? ` variable=${finding.variable}` : "";
  console.error(`[check:secrets] ${finding.severity.toUpperCase()} ${finding.type} ${location}${variable}`);
}

const hasHighRisk = findings.some((finding) => finding.severity === "high");
process.exit(hasHighRisk ? 1 : 0);
