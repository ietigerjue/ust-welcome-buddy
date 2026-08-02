import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

const FIXTURE_PATH = path.join(process.cwd(), "fixtures", "test.docx");
const EMPTY_CONTENT_ERROR =
  "Extracted DOCX content is too short. Please check the document text.";

function cleanDocxText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function validateDocxFileName(fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    throw new Error("Only .docx is supported for now.");
  }

  if (!lowerName.endsWith(".docx")) {
    throw new Error("Only .docx is supported for now.");
  }
}

async function extractFixtureText() {
  const buffer = await fs.readFile(FIXTURE_PATH);
  const result = await mammoth.extractRawText({ buffer });
  const content = cleanDocxText(result.value);

  if (content.length < 50) {
    throw new Error(EMPTY_CONTENT_ERROR);
  }

  return content;
}

function testNonDocxRejected() {
  for (const fileName of ["legacy.doc", "notes.pdf", "plain.txt"]) {
    let rejected = false;

    try {
      validateDocxFileName(fileName);
    } catch (error) {
      rejected =
        error instanceof Error &&
        error.message === "Only .docx is supported for now.";
    }

    if (!rejected) {
      throw new Error(`Expected ${fileName} to be rejected.`);
    }
  }

  console.log("[test:docx-parse] non-docx rejection: pass");
}

function testEmptyDocumentRejected() {
  const cleaned = cleanDocxText(" \n\n   ");

  if (cleaned.length >= 50) {
    throw new Error("Expected empty text to be too short.");
  }

  console.log("[test:docx-parse] empty content rejection: pass");
}

async function main() {
  testNonDocxRejected();
  testEmptyDocumentRejected();

  try {
    await fs.access(FIXTURE_PATH);
  } catch {
    console.warn("[test:docx-parse] fixture not found:", FIXTURE_PATH);
    console.warn(
      "[test:docx-parse] Put a sample Word file at fixtures/test.docx to test text extraction."
    );
    return;
  }

  const content = await extractFixtureText();

  console.log("[test:docx-parse] fixture extraction: pass");
  console.log("[test:docx-parse] content length:", content.length);
  console.log("[test:docx-parse] content preview:", content.slice(0, 240));

  if (process.env.TEST_DOCX_WITH_METADATA === "true") {
    console.log(
      "[test:docx-parse] TEST_DOCX_WITH_METADATA=true is set. Use /admin/import or /api/admin/parse-docx to test metadata generation with real provider config."
    );
  }
}

main().catch((error) => {
  console.error("[test:docx-parse] failed:", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
  });

  process.exitCode = 1;
});
