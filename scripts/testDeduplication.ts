import { hashContent, normalizeForHash } from "../src/lib/contentHash";
import { mergeHybridResults, type HybridKnowledgeDocument } from "../src/lib/hybridSearch";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function createDocument(
  overrides: Partial<HybridKnowledgeDocument>
): HybridKnowledgeDocument {
  return {
    id: "chunk-default",
    chunk_id: "chunk-default",
    document_id: "document-default",
    title: "Default document",
    category: "other",
    content: "Default content",
    source: "test",
    updatedAt: "2026-06-02",
    keywords: [],
    score: 1,
    chunk_index: 0,
    ...overrides,
  };
}

function testHashNormalization() {
  const first = "  HKUST   Dorm\n\nPreparation  ";
  const second = "hkust dorm preparation";

  const firstNormalized = normalizeForHash(first);
  const secondNormalized = normalizeForHash(second);
  const firstHash = hashContent(first);
  const secondHash = hashContent(second);

  console.log("[test:dedupe] normalization:", {
    firstNormalized,
    secondNormalized,
    firstHash,
    secondHash,
  });

  assert(
    firstNormalized === secondNormalized,
    "Expected whitespace/case differences to normalize to the same text."
  );
  assert(
    firstHash === secondHash,
    "Expected whitespace/case differences to produce the same hash."
  );
}

function testDuplicateChunkRecognition() {
  const chunks = [
    "Campus dining options and meal planning.",
    "  campus   dining options\n\nand meal planning. ",
    "Octopus card transport basics.",
  ];
  const hashes = chunks.map(hashContent);
  const uniqueHashes = new Set(hashes);

  console.log("[test:dedupe] chunk hashes:", {
    hashes,
    uniqueCount: uniqueHashes.size,
  });

  assert(
    uniqueHashes.size === 2,
    "Expected duplicate chunks to be recognized by normalized content hash."
  );
}

function testHybridDedupeKeepsHighestScore() {
  const duplicateContent = "Move-in checklist: bedding, adapter, documents.";
  const duplicateHash = hashContent(duplicateContent);

  const results = mergeHybridResults({
    keywordDocuments: [
      createDocument({
        id: "low",
        chunk_id: "low",
        document_id: "document-a",
        title: "Lower score duplicate",
        content: duplicateContent,
        content_hash: duplicateHash,
        score: 1,
      }),
      createDocument({
        id: "high",
        chunk_id: "high",
        document_id: "document-b",
        title: "Higher score duplicate",
        content: "  move-in checklist: bedding, adapter, documents. ",
        content_hash: duplicateHash,
        score: 10,
      }),
      createDocument({
        id: "unique",
        chunk_id: "unique",
        document_id: "document-c",
        title: "Unique chunk",
        content: "Canvas and SIS account basics.",
        content_hash: hashContent("Canvas and SIS account basics."),
        score: 5,
      }),
    ],
    vectorDocuments: [],
  });

  console.log("[test:dedupe] hybrid results:", {
    titles: results.map((result) => result.title),
    chunkIds: results.map((result) => result.chunk_id),
    scores: results.map((result) => result.finalScore),
  });

  assert(
    results.some((result) => result.chunk_id === "high"),
    "Expected duplicate content dedupe to keep the highest-scoring chunk."
  );
  assert(
    !results.some((result) => result.chunk_id === "low"),
    "Expected duplicate content dedupe to remove the lower-scoring chunk."
  );
  assert(
    results.some((result) => result.chunk_id === "unique"),
    "Expected unique chunk to remain in Hybrid Search results."
  );
}

function main() {
  console.log("[test:dedupe] starting duplicate handling tests");
  testHashNormalization();
  testDuplicateChunkRecognition();
  testHybridDedupeKeepsHighestScore();
  console.log("[test:dedupe] all tests passed");
}

try {
  main();
} catch (error) {
  console.error("[test:dedupe] failed:", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
