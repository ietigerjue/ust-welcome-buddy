import type { KnowledgeDocument } from "@/data/knowledgeBase";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const MAX_RESULTS = 5;
const FETCH_LIMIT = 500;
const TITLE_WEIGHT = 5;
const KEYWORDS_WEIGHT = 4;
const CATEGORY_WEIGHT = 3;
const CONTENT_WEIGHT = 1;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "about",
  "buy",
  "can",
  "could",
  "do",
  "does",
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
  "please",
  "should",
  "the",
  "to",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
  "would",
  "一下",
  "不会",
  "什么",
  "以及",
  "吗",
  "呢",
  "和",
  "咋",
  "如何",
  "如果",
  "怎么",
  "怎样",
  "或者",
  "我",
  "我们",
  "是否",
  "同学",
  "有没有",
  "有无",
  "学生",
  "的",
  "了",
  "请问",
  "科大",
  "还是",
  "这个",
  "这边",
  "那个",
]);

const SYNONYM_GROUPS = [
  ["hkust", "ust", "港科", "港科大"],
  ["airport", "hkia", "机场"],
  ["dorm", "hall", "housing", "宿舍"],
  ["octopus", "八达通", "八達通"],
  ["sim", "mobile", "phone card", "sim card", "电话卡", "手機卡", "手机卡"],
];

type SupabaseDocument = {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  category?: string | null;
  source?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  updated_at?: string | null;
};

type SupabaseChunkRow = {
  id: string;
  content: string | null;
  content_hash: string | null;
  keywords: string[] | null;
  chunk_index: number | null;
  documents: SupabaseDocument | SupabaseDocument[] | null;
};

export type SupabaseKnowledgeDocument = KnowledgeDocument & {
  chunk_id: string;
  document_id: string;
  slug: string;
  chunk_index: number;
  chunkIndex: number;
  sourceUrl: string;
  updated_at: string;
  source_url: string;
  source_type: string;
  content_hash: string;
  score: number;
  matchedTerms: string[];
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function isMeaningfulTerm(value: string) {
  const term = normalizeText(value);

  if (term.length <= 1) {
    return false;
  }

  return !STOP_WORDS.has(term);
}

function addTerm(terms: Set<string>, value: string) {
  const term = normalizeText(value);

  if (isMeaningfulTerm(term)) {
    terms.add(term);
  }
}

function extractChineseFragments(value: string) {
  const fragments: string[] = [];
  const chineseSegments = value.match(/[\u3400-\u9fff]+/gu) ?? [];

  for (const segment of chineseSegments) {
    fragments.push(segment);

    for (let size = 2; size <= 4; size += 1) {
      if (segment.length < size) {
        continue;
      }

      for (let index = 0; index <= segment.length - size; index += 1) {
        fragments.push(segment.slice(index, index + size));
      }
    }
  }

  return fragments;
}

function expandSynonyms(terms: Set<string>) {
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(normalizeText);
    const hasGroupMatch = normalizedGroup.some((synonym) =>
      terms.has(synonym)
    );

    if (!hasGroupMatch) {
      continue;
    }

    for (const synonym of normalizedGroup) {
      addTerm(terms, synonym);
    }
  }
}

function getQueryTerms(query: string) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [];
  }

  const terms = new Set<string>();

  addTerm(terms, normalizedQuery);

  const englishTerms = normalizedQuery.match(/[a-z0-9]+/g) ?? [];
  for (const term of englishTerms) {
    addTerm(terms, term);
  }

  for (let index = 0; index < englishTerms.length - 1; index += 1) {
    addTerm(terms, `${englishTerms[index]} ${englishTerms[index + 1]}`);
  }

  for (const term of extractChineseFragments(normalizedQuery)) {
    addTerm(terms, term);
  }

  expandSynonyms(terms);

  return Array.from(terms);
}

function getJoinedDocument(row: SupabaseChunkRow) {
  if (Array.isArray(row.documents)) {
    return row.documents[0] ?? null;
  }

  return row.documents;
}

function scoreChunk(row: SupabaseChunkRow, terms: string[]) {
  const document = getJoinedDocument(row);
  const title = normalizeText(document?.title ?? "");
  const category = normalizeText(document?.category ?? "");
  const content = normalizeText(row.content ?? "");
  const keywords = Array.isArray(row.keywords)
    ? row.keywords.map(normalizeText)
    : [];
  const matchedTerms: string[] = [];

  const score = terms.reduce((currentScore, term) => {
    let nextScore = currentScore;
    let matched = false;

    if (title.includes(term)) {
      nextScore += TITLE_WEIGHT;
      matched = true;
    }

    const keywordMatches = keywords.filter((keyword) => {
      if (keyword.includes(term)) {
        return true;
      }

      return keyword.length > 3 && term.includes(keyword);
    }).length;

    if (keywordMatches > 0) {
      nextScore += keywordMatches * KEYWORDS_WEIGHT;
      matched = true;
    }

    if (category.includes(term)) {
      nextScore += CATEGORY_WEIGHT;
      matched = true;
    }

    if (content.includes(term)) {
      nextScore += CONTENT_WEIGHT;
      matched = true;
    }

    if (matched) {
      matchedTerms.push(term);
    }

    return nextScore;
  }, 0);

  return {
    score,
    matchedTerms,
  };
}

function toKnowledgeDocument(
  row: SupabaseChunkRow,
  score: number,
  matchedTerms: string[]
): SupabaseKnowledgeDocument {
  const document = getJoinedDocument(row);
  const slug = document?.slug || document?.id || row.id;
  const documentId = document?.id ?? slug;
  const updatedAt = document?.updated_at ?? "";
  const sourceUrl = document?.source_url ?? "";

  return {
    id: `${slug}:${row.chunk_index ?? 0}`,
    chunk_id: row.id,
    document_id: documentId,
    slug,
    title: document?.title ?? "Untitled document",
    category: document?.category ?? "",
    content: row.content ?? "",
    content_hash: row.content_hash ?? "",
    source: document?.source ?? "",
    source_type: document?.source_type ?? "",
    updatedAt,
    keywords: row.keywords ?? [],
    chunk_index: row.chunk_index ?? 0,
    chunkIndex: row.chunk_index ?? 0,
    sourceUrl,
    updated_at: updatedAt,
    source_url: sourceUrl,
    score,
    matchedTerms,
  };
}

export async function searchSupabaseKnowledgeBase(query: string) {
  const terms = getQueryTerms(query);

  if (terms.length === 0) {
    return [];
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase server client is not configured.");
  }

  const { data, error } = await supabase
    .from("document_chunks")
    .select(
      [
        "id",
        "content",
        "content_hash",
        "keywords",
        "chunk_index",
        "documents(id, slug, title, category, source, source_url, source_type, updated_at)",
      ].join(", ")
    )
    .limit(FETCH_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as SupabaseChunkRow[];

  return rows
    .map((row) => ({
      row,
      ...scoreChunk(row, terms),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const aDocument = getJoinedDocument(a.row);
      const bDocument = getJoinedDocument(b.row);
      const documentDelta = (aDocument?.id ?? "").localeCompare(
        bDocument?.id ?? "",
        "en",
        { numeric: true, sensitivity: "base" }
      );

      if (documentDelta !== 0) {
        return documentDelta;
      }

      const chunkIndexDelta =
        (a.row.chunk_index ?? 0) - (b.row.chunk_index ?? 0);

      if (chunkIndexDelta !== 0) {
        return chunkIndexDelta;
      }

      return a.row.id.localeCompare(b.row.id, "en", {
        numeric: true,
        sensitivity: "base",
      });
    })
    .slice(0, MAX_RESULTS)
    .map((result) =>
      toKnowledgeDocument(result.row, result.score, result.matchedTerms)
    );
}
