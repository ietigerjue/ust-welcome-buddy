import type { KnowledgeDocument } from "@/data/knowledgeBase";
import { loadKnowledgeBase } from "@/lib/loadKnowledgeBase";

const MAX_RESULTS = 3;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "buy",
  "can",
  "do",
  "for",
  "from",
  "get",
  "how",
  "i",
  "in",
  "is",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "where",
]);

export type SearchKnowledgeBaseResult = {
  document: KnowledgeDocument;
  score: number;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getQueryTerms(query: string) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery
    .split(/[\s,.;:!?()[\]{}"'，。！？、；：]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  return Array.from(new Set([normalizedQuery, ...terms]));
}

function scoreDocument(document: KnowledgeDocument, terms: string[]) {
  const title = normalizeText(document.title);
  const category = normalizeText(document.category);
  const content = normalizeText(document.content);
  const keywords = document.keywords.map(normalizeText);

  return terms.reduce((score, term) => {
    let nextScore = score;

    if (title.includes(term)) nextScore += 3;
    if (category.includes(term)) nextScore += 2;
    if (content.includes(term)) nextScore += 1;

    nextScore += keywords.filter((keyword) => keyword.includes(term)).length * 2;

    return nextScore;
  }, 0);
}

export function searchKnowledgeBaseWithScores(
  query: string
): SearchKnowledgeBaseResult[] {
  const terms = getQueryTerms(query);

  if (terms.length === 0) {
    return [];
  }

  return loadKnowledgeBase()
    .map((document) => ({
      document,
      score: scoreDocument(document, terms),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

export function searchKnowledgeBase(query: string): KnowledgeDocument[] {
  return searchKnowledgeBaseWithScores(query).map((result) => result.document);
}
