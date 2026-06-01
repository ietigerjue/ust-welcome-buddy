import fs from "node:fs/promises";
import path from "node:path";
import {
  searchSupabaseKnowledgeBase,
  type SupabaseKnowledgeDocument,
} from "../src/lib/searchSupabaseKnowledgeBase";
import {
  searchVectorKnowledgeBase,
  type VectorKnowledgeChunk,
} from "../src/lib/searchVectorKnowledgeBase";

const HYBRID_CONTEXT_LIMIT = 6;
const PRINT_RESULT_LIMIT = 5;
const KEYWORD_SCORE_WEIGHT = 0.5;
const VECTOR_SCORE_WEIGHT = 0.5;
const HYBRID_BONUS = 0.15;

type ExpectedBehavior =
  | "should_answer"
  | "should_refuse"
  | "should_warn_official";

type RetrievalEvalCase = {
  id: string;
  question: string;
  expected_category: string;
  expected_document_keywords: string[];
  expected_behavior: ExpectedBehavior;
};

type HybridResult = {
  id: string;
  chunk_id?: string;
  document_id?: string;
  slug?: string;
  title: string;
  category: string;
  content: string;
  source: string;
  source_url?: string;
  source_type?: string;
  updated_at?: string;
  score?: number;
  similarity?: number;
  hybridScore?: number;
  retrieval_type?: string;
};

const EVAL_CASES: RetrievalEvalCase[] = [
  {
    id: "arrival-001",
    question: "我刚到香港机场，怎么去 HKUST 比较方便？",
    expected_category: "arrival",
    expected_document_keywords: ["airport", "HKIA", "机场", "到港", "arrival"],
    expected_behavior: "should_answer",
  },
  {
    id: "arrival-002",
    question: "From HKIA to HKUST with luggage, what route should I consider?",
    expected_category: "arrival",
    expected_document_keywords: ["airport", "HKIA", "luggage", "机场", "行李"],
    expected_behavior: "should_answer",
  },
  {
    id: "arrival-003",
    question: "新生第一次来港，入境后需要注意什么？",
    expected_category: "arrival",
    expected_document_keywords: ["arrival", "入境", "来港", "landing slip", "小白条"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "housing-001",
    question: "宿舍入住前要准备什么东西？",
    expected_category: "housing",
    expected_document_keywords: ["dorm", "hall", "宿舍", "入住", "bedding"],
    expected_behavior: "should_answer",
  },
  {
    id: "housing-002",
    question: "What should I know before moving into the hall?",
    expected_category: "housing",
    expected_document_keywords: ["dorm", "hall", "housing", "check-in", "入住"],
    expected_behavior: "should_answer",
  },
  {
    id: "housing-003",
    question: "研究生宿舍申请和入住有什么注意事项？",
    expected_category: "housing",
    expected_document_keywords: [
      "postgraduate housing",
      "PG housing",
      "宿舍申请",
      "研究生宿舍",
    ],
    expected_behavior: "should_warn_official",
  },
  {
    id: "transport-001",
    question: "科大去市区常用的交通方式有哪些？",
    expected_category: "transport",
    expected_document_keywords: ["transport", "MTR", "bus", "minibus", "小巴", "巴士"],
    expected_behavior: "should_answer",
  },
  {
    id: "transport-002",
    question: "How do I commute between HKUST and Hang Hau?",
    expected_category: "transport",
    expected_document_keywords: ["Hang Hau", "坑口", "minibus", "11M", "commute"],
    expected_behavior: "should_answer",
  },
  {
    id: "transport-003",
    question: "学生八达通和交通补贴怎么理解？",
    expected_category: "transport",
    expected_document_keywords: ["Octopus", "八达通", "transport subsidy", "交通补贴"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "life-001",
    question: "香港电话卡、HKID 和信用卡应该先办哪些？",
    expected_category: "life",
    expected_document_keywords: ["SIM", "phone card", "HKID", "电话卡", "身份证"],
    expected_behavior: "should_answer",
  },
  {
    id: "life-002",
    question: "Octopus card 和 AlipayHK 在日常生活怎么用？",
    expected_category: "life",
    expected_document_keywords: ["Octopus", "八达通", "AlipayHK", "payment", "支付"],
    expected_behavior: "should_answer",
  },
  {
    id: "life-003",
    question: "新生刚到香港生活，有哪些校园生活和社团资源？",
    expected_category: "life",
    expected_document_keywords: ["campus life", "clubs", "sports", "MSSS", "社团", "校园生活"],
    expected_behavior: "should_answer",
  },
  {
    id: "academic-001",
    question: "Canvas 和 SIS 是什么？新生什么时候会用到？",
    expected_category: "academic",
    expected_document_keywords: ["Canvas", "SIS", "Student Center", "学生邮箱", "enrollment"],
    expected_behavior: "should_answer",
  },
  {
    id: "academic-002",
    question: "How does course enrollment work for a new HKUST student?",
    expected_category: "academic",
    expected_document_keywords: ["course enrollment", "validation", "add drop", "SIS", "选课"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "academic-003",
    question: "RPG 新生选课和毕业要求有什么注意事项？",
    expected_category: "academic",
    expected_document_keywords: ["RPG", "GGA", "graduation requirements", "选课", "毕业要求"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "food-001",
    question: "科大校园里哪里可以吃饭？",
    expected_category: "food",
    expected_document_keywords: ["campus food", "canteen", "dining", "食堂", "餐饮"],
    expected_behavior: "should_answer",
  },
  {
    id: "food-002",
    question: "Any food options near HKUST for freshmen?",
    expected_category: "food",
    expected_document_keywords: ["food", "restaurant", "canteen", "campus dining", "餐厅"],
    expected_behavior: "should_answer",
  },
  {
    id: "food-003",
    question: "校园餐饮付款一般用什么方式？",
    expected_category: "food",
    expected_document_keywords: ["dining", "payment", "Octopus", "AlipayHK", "餐饮付款"],
    expected_behavior: "should_answer",
  },
  {
    id: "shopping-001",
    question: "到香港后买生活用品和床品去哪比较方便？",
    expected_category: "shopping",
    expected_document_keywords: ["shopping", "bedding", "essentials", "IKEA", "生活用品", "床品"],
    expected_behavior: "should_answer",
  },
  {
    id: "shopping-002",
    question: "How can I receive Taobao or online orders near HKUST?",
    expected_category: "shopping",
    expected_document_keywords: ["Taobao", "parcel", "forwarding", "online orders", "快递", "集运"],
    expected_behavior: "should_answer",
  },
  {
    id: "shopping-003",
    question: "在香港二手交易和网购有什么安全注意？",
    expected_category: "shopping",
    expected_document_keywords: ["second hand", "Carousell", "scam", "二手", "网购", "安全"],
    expected_behavior: "should_answer",
  },
  {
    id: "official-001",
    question: "学生签证激活、小白条和 IANG 有什么要注意？",
    expected_category: "official",
    expected_document_keywords: ["visa", "IANG", "landing slip", "小白条", "签证"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "official-002",
    question: "学费、保险费和缴费方式有哪些提醒？",
    expected_category: "official",
    expected_document_keywords: ["tuition", "insurance", "fees", "payment", "学费", "保险"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "official-003",
    question: "HKUST 官方政策、截止日期和学术规定哪里确认？",
    expected_category: "official",
    expected_document_keywords: [
      "official",
      "deadline",
      "policy",
      "academic rules",
      "官方",
      "截止日期",
    ],
    expected_behavior: "should_warn_official",
  },
  {
    id: "wechat-001",
    question: "2025 新生攻略里提到的打印复印怎么操作？",
    expected_category: "wechat_paste",
    expected_document_keywords: ["WeChat Article Paste", "wechat_paste", "打印", "复印", "新生攻略"],
    expected_behavior: "should_answer",
  },
  {
    id: "wechat-002",
    question: "MSSS 公众号的新生攻略里宿舍申请有什么提醒？",
    expected_category: "wechat_paste",
    expected_document_keywords: ["WeChat Article Paste", "wechat_paste", "MSSS", "宿舍申请", "新生攻略"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "wechat-003",
    question: "公众号粘贴导入的资料能查到哪些新生事项？",
    expected_category: "wechat_paste",
    expected_document_keywords: ["WeChat Article Paste", "wechat_paste", "公众号", "新生攻略", "imported"],
    expected_behavior: "should_answer",
  },
  {
    id: "image-001",
    question: "长图导入的校园流程图里有哪些步骤？",
    expected_category: "image_upload",
    expected_document_keywords: ["Image Upload", "image_upload", "长图", "流程图", "screenshot"],
    expected_behavior: "should_answer",
  },
  {
    id: "image-002",
    question: "图片导入的文件里有没有注册或缴费提醒？",
    expected_category: "image_upload",
    expected_document_keywords: ["Image Upload", "image_upload", "图片", "注册", "缴费"],
    expected_behavior: "should_warn_official",
  },
  {
    id: "image-003",
    question: "从截图 OCR 进来的知识库内容能检索到吗？",
    expected_category: "image_upload",
    expected_document_keywords: ["Image Upload", "image_upload", "OCR", "screenshot", "图片"],
    expected_behavior: "should_answer",
  },
];

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: "cause" in error ? error.cause : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
    cause: undefined,
  };
}

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);

    try {
      const content = await fs.readFile(filePath, "utf8");

      for (const line of content.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
          continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");

        process.env[key] ??= value;
      }
    } catch (error) {
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!isMissingFile) {
        throw error;
      }
    }
  }
}

function getChunkKey(document: HybridResult) {
  if (document.chunk_id) {
    return document.chunk_id;
  }

  const documentKey = document.document_id ?? document.id;
  return `${documentKey}:${document.content.slice(0, 80)}`;
}

function normalizeScore(value: number | undefined, maxValue: number) {
  if (!value || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

function toKeywordResult(document: SupabaseKnowledgeDocument): HybridResult {
  return {
    id: document.id,
    chunk_id: document.chunk_id,
    document_id: document.document_id,
    slug: document.slug,
    title: document.title,
    category: document.category,
    content: document.content,
    source: document.source,
    source_url: document.source_url,
    updated_at: document.updated_at,
    score: document.score,
    retrieval_type: "keyword",
  };
}

function toVectorResult(document: VectorKnowledgeChunk): HybridResult {
  return {
    id: document.chunk_id,
    chunk_id: document.chunk_id,
    document_id: document.document_id,
    slug: document.slug,
    title: document.title,
    category: document.category,
    content: document.content,
    source: document.source,
    source_url: document.source_url,
    source_type: document.source_type,
    updated_at: document.updated_at,
    score: document.score,
    similarity: document.similarity,
    retrieval_type: document.retrieval_type,
  };
}

function mergeHybridResults({
  keywordDocuments,
  vectorDocuments,
}: {
  keywordDocuments: HybridResult[];
  vectorDocuments: HybridResult[];
}) {
  const maxKeywordScore = Math.max(
    0,
    ...keywordDocuments.map((document) => document.score ?? 0)
  );
  const map = new Map<
    string,
    {
      document: HybridResult;
      keywordScore?: number;
      vectorSimilarity?: number;
      hasKeyword: boolean;
      hasVector: boolean;
    }
  >();

  for (const document of keywordDocuments) {
    const key = getChunkKey(document);

    map.set(key, {
      document,
      keywordScore: document.score,
      hasKeyword: true,
      hasVector: false,
    });
  }

  for (const document of vectorDocuments) {
    const key = getChunkKey(document);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        document,
        vectorSimilarity: document.similarity,
        hasKeyword: false,
        hasVector: true,
      });
      continue;
    }

    existing.vectorSimilarity = document.similarity;
    existing.hasVector = true;
    existing.document = {
      ...document,
      ...existing.document,
      similarity: document.similarity,
      score: existing.keywordScore,
      source_type: existing.document.source_type || document.source_type,
    };
  }

  return Array.from(map.values())
    .map((result) => {
      const hybridScore =
        normalizeScore(result.keywordScore, maxKeywordScore) *
          KEYWORD_SCORE_WEIGHT +
        (result.vectorSimilarity ?? 0) *
          VECTOR_SCORE_WEIGHT +
        (result.hasKeyword && result.hasVector ? HYBRID_BONUS : 0);

      return {
        ...result.document,
        score: result.keywordScore,
        similarity: result.vectorSimilarity,
        hybridScore,
      };
    })
    .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
    .slice(0, HYBRID_CONTEXT_LIMIT);
}

async function runHybridSearch(question: string) {
  const [keywordResult, vectorResult] = await Promise.allSettled([
    searchSupabaseKnowledgeBase(question),
    searchVectorKnowledgeBase(question),
  ]);

  const keywordDocuments =
    keywordResult.status === "fulfilled"
      ? keywordResult.value.map(toKeywordResult)
      : [];
  const vectorDocuments =
    vectorResult.status === "fulfilled"
      ? vectorResult.value.map(toVectorResult)
      : [];

  if (keywordResult.status === "rejected") {
    const details = getErrorDetails(keywordResult.reason);
    console.error("[test:retrieval] keyword search failed:", details);
  }

  if (vectorResult.status === "rejected") {
    const details = getErrorDetails(vectorResult.reason);
    console.error("[test:retrieval] vector search failed:", details);
  }

  return mergeHybridResults({
    keywordDocuments,
    vectorDocuments,
  });
}

function normalizeText(value: string | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function valueMatchesExpected(value: string | undefined, expected: string) {
  const normalizedValue = normalizeText(value);
  const normalizedExpected = normalizeText(expected);

  if (!normalizedValue || !normalizedExpected) {
    return false;
  }

  return (
    normalizedValue === normalizedExpected ||
    normalizedValue.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedValue)
  );
}

function buildSearchableText(result: HybridResult) {
  return [
    result.title,
    result.category,
    result.source,
    result.source_url,
    result.source_type,
    result.content,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function evaluateCase(testCase: RetrievalEvalCase, results: HybridResult[]) {
  const topResults = results.slice(0, PRINT_RESULT_LIMIT);
  const categoryMatched = topResults.some(
    (result) =>
      valueMatchesExpected(result.category, testCase.expected_category) ||
      valueMatchesExpected(result.source_type, testCase.expected_category)
  );
  const combinedText = topResults.map(buildSearchableText).join("\n");
  const keywordMatched = testCase.expected_document_keywords.some((keyword) =>
    combinedText.includes(keyword.toLowerCase())
  );

  return {
    passed: categoryMatched || keywordMatched,
    categoryMatched,
    keywordMatched,
  };
}

function getLimitArg() {
  const limitIndex = process.argv.indexOf("--limit");

  if (limitIndex === -1) {
    return undefined;
  }

  const rawValue = process.argv[limitIndex + 1];
  const parsed = Number.parseInt(rawValue ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  await loadLocalEnv();

  const limit = getLimitArg();
  const cases = limit ? EVAL_CASES.slice(0, limit) : EVAL_CASES;
  let passed = 0;
  let failed = 0;
  const failedQuestionIds: string[] = [];

  console.log("[test:retrieval] config:", {
    SUPABASE_URL_exists: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY_exists: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
    HTTPS_PROXY_exists: Boolean(process.env.HTTPS_PROXY),
    HTTP_PROXY_exists: Boolean(process.env.HTTP_PROXY),
  });

  for (const testCase of cases) {
    try {
      const results = await runHybridSearch(testCase.question);
      const topResults = results.slice(0, PRINT_RESULT_LIMIT);
      const evaluation = evaluateCase(testCase, results);

      if (evaluation.passed) {
        passed += 1;
      } else {
        failed += 1;
        failedQuestionIds.push(testCase.id);
      }

      console.log(`\n[test:retrieval] ${testCase.id}`, {
        question: testCase.question,
        expected_category: testCase.expected_category,
        expected_behavior: testCase.expected_behavior,
        top_titles: topResults.map((result) => result.title),
        top_categories: topResults.map((result) => result.category),
        top_source_type: topResults.map((result) => result.source_type ?? ""),
        scores: topResults.map((result) => ({
          score: result.score,
          similarity: result.similarity,
          hybridScore: result.hybridScore,
        })),
        pass: evaluation.passed,
        categoryMatched: evaluation.categoryMatched,
        keywordMatched: evaluation.keywordMatched,
      });
    } catch (error) {
      const details = getErrorDetails(error);
      failed += 1;
      failedQuestionIds.push(testCase.id);

      console.error(`\n[test:retrieval] ${testCase.id} failed with error:`, {
        question: testCase.question,
        expected_category: testCase.expected_category,
        name: details.name,
        message: details.message,
        cause: details.cause,
      });
    }
  }

  const total = cases.length;
  const passRate = total > 0 ? passed / total : 0;

  console.log("\n[test:retrieval] summary:", {
    total,
    passed,
    failed,
    passRate: `${(passRate * 100).toFixed(1)}%`,
    failedQuestionIds,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const details = getErrorDetails(error);

  console.error("[test:retrieval] failed:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });

  process.exitCode = 1;
});

