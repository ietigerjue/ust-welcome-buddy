import { searchKnowledgeBase } from "@/lib/searchKnowledgeBase";

export type Source = {
  id: string;
  document_id?: string;
  slug?: string;
  title: string;
  titleZh?: string;
  snippet: string;
  source?: string;
  source_url?: string;
  updatedAt?: string;
  updated_at?: string;
  category?: string;
  matchedChunksCount?: number;
};

export type Doc = {
  id: string;
  title: string;
  titleZh: string;
  type: "pdf" | "md" | "txt";
  size: string;
  uploadedAt: string;
  chunks: number;
  category: string;
};

export const mockSources: Source[] = [
  {
    id: "s1",
    title: "HKUST Freshman Arrival Guide",
    titleZh: "科大新生抵港指南",
    snippet: "Step-by-step instructions for new students arriving in Hong Kong.",
  },
  {
    id: "s2",
    title: "Dormitory Preparation Checklist",
    titleZh: "宿舍入住準備清單",
    snippet: "Everything you need to bring and prepare before moving in.",
  },
  {
    id: "s3",
    title: "Hong Kong Student Life Tips",
    titleZh: "香港學生生活貼士",
    snippet: "Practical guide to living and studying in Hong Kong.",
  },
  {
    id: "s4",
    title: "Campus Transportation Guide",
    titleZh: "校園交通指南",
    snippet: "How to get around HKUST and travel to/from campus.",
  },
  {
    id: "s5",
    title: "HKUST Dining & Food Map",
    titleZh: "科大餐飲地圖",
    snippet: "All food options across LG7, LG5, the Atrium and nearby Hang Hau.",
  },
  {
    id: "s6",
    title: "SIM Card & Mobile Plans in HK",
    titleZh: "香港電話卡與通訊計劃",
    snippet: "How new students can choose prepaid SIM cards and mobile plans in Hong Kong.",
  },
];

export const mockDocs: Doc[] = [
  {
    id: "d1",
    title: "HKUST Freshman Arrival Guide",
    titleZh: "科大新生抵港指南",
    type: "pdf",
    size: "2.4 MB",
    uploadedAt: "2025-08-12",
    chunks: 48,
    category: "Arrival",
  },
  {
    id: "d2",
    title: "Dormitory Preparation Checklist",
    titleZh: "宿舍入住準備清單",
    type: "md",
    size: "18 KB",
    uploadedAt: "2025-08-15",
    chunks: 12,
    category: "Housing",
  },
  {
    id: "d3",
    title: "Hong Kong Student Life Tips",
    titleZh: "香港學生生活貼士",
    type: "pdf",
    size: "1.1 MB",
    uploadedAt: "2025-08-20",
    chunks: 32,
    category: "Life",
  },
  {
    id: "d4",
    title: "Campus Transportation Guide",
    titleZh: "校園交通指南",
    type: "md",
    size: "24 KB",
    uploadedAt: "2025-08-22",
    chunks: 16,
    category: "Transport",
  },
  {
    id: "d5",
    title: "HKUST Dining & Food Map",
    titleZh: "科大餐飲地圖",
    type: "txt",
    size: "9 KB",
    uploadedAt: "2025-08-25",
    chunks: 8,
    category: "Food",
  },
  {
    id: "d6",
    title: "SIM Card & Mobile Plans in HK",
    titleZh: "香港電話卡與通訊計劃",
    type: "md",
    size: "11 KB",
    uploadedAt: "2025-08-28",
    chunks: 7,
    category: "Telecom",
  },
  {
    id: "d7",
    title: "Banking for International Students",
    titleZh: "國際學生開戶指南",
    type: "pdf",
    size: "780 KB",
    uploadedAt: "2025-09-01",
    chunks: 14,
    category: "Banking",
  },
  {
    id: "d8",
    title: "Student ID & Registration FAQ",
    titleZh: "學生證與註冊常見問題",
    type: "txt",
    size: "6 KB",
    uploadedAt: "2025-09-03",
    chunks: 5,
    category: "Registration",
  },
];

export type MockAnswer = {
  match: string[];
  answer: string;
  sources: string[];
};

export const mockAnswers: MockAnswer[] = [
  {
    match: ["airport", "hkia", "arrive", "from hong kong airport", "機場"],
    answer:
      "From Hong Kong International Airport, the most convenient way to reach HKUST is:\n\n1. **Airport Express + Taxi** — Take the Airport Express to Tsing Yi (HK$70), then a red taxi to HKUST (~HK$220, 30 min).\n2. **Bus A29** — Direct bus to Po Lam, then taxi or minibus 11 to HKUST (~HK$50 total, 90 min).\n3. **Taxi (direct)** — Around HK$400 and 50 minutes door-to-door — easiest with luggage.\n\nLook for the **HKUST Welcome Desk** at the airport during peak arrival weeks in August — they offer free shuttle service for new students.",
    sources: ["s1", "s4"],
  },
  {
    match: ["dorm", "hall", "move", "moving in", "宿舍"],
    answer:
      "Before moving into your hall, prepare the following essentials:\n\n- **Bedding**: pillow, bedsheet (single bed, 36\" × 75\"), blanket, mattress protector\n- **Toiletries**: shower slippers, toiletry caddy, towels\n- **Power**: UK-style 3-pin plug adapters and a small power strip\n- **Storage**: foldable hangers, under-bed boxes\n- **Documents**: HKID/passport, admission letter, hall offer email\n\nPro tip: most items are cheaper at **DON DON DONKI** or **Japan Home Centre** in Hang Hau than buying everything online before arrival.",
    sources: ["s2", "s3"],
  },
  {
    match: ["sim", "phone", "mobile", "電話卡"],
    answer:
      "You have a few easy options for a Hong Kong SIM card:\n\n- **Airport pickup**: CSL, China Mobile and 3HK kiosks in the arrival hall sell tourist SIMs (HK$80–150).\n- **csl. or SmarTone** retail shops in Hang Hau (one MTR stop from HKUST) for monthly contracts — bring your **HKID or student visa**.\n- **Club Sim / 1010 Prepaid** — flexible monthly top-up, popular with students (~HK$78/month for 30GB).\n\nMost students activate a tourist SIM on arrival and switch to a monthly plan after getting their HKID card.",
    sources: ["s1", "s6" as string],
  },
  {
    match: ["octopus", "八達通"],
    answer:
      "The **Octopus card** is Hong Kong's universal stored-value card — used for MTR, buses, minibuses, ferries, 7-Eleven, vending machines, and most campus dining outlets.\n\n- Buy one at any **MTR Customer Service Centre** for HK$150 (HK$100 stored value + HK$50 refundable deposit).\n- Top up at MTR stations, convenience stores, or via the **Octopus app** (Apple Pay / Google Pay supported).\n- Students aged 12–25 can apply for the **Personalised Octopus** with the JoyYou or Student Octopus for half-fare MTR rides.\n\nYou'll use it daily — get one within your first 24 hours in Hong Kong.",
    sources: ["s3", "s4"],
  },
  {
    match: ["food", "eat", "dining", "canteen", "餐"],
    answer:
      "HKUST has plenty of on-campus food options:\n\n- **LG7 Canteen** — large food court, cheapest meals (HK$30–45), multi-cuisine\n- **LG5 Bistro** — Western and Asian fusion, sit-down style\n- **McDonald's & Pacific Coffee** — in the Atrium\n- **Seafront Cafeteria** — sea-view dining, popular for dinner\n- **UniBar** — casual drinks and snacks\n\nOff-campus, **Hang Hau** (one minibus 11 ride away) has dozens of cha chaan tengs, ramen shops, hotpot, and a large supermarket.",
    sources: ["s5", "s3"],
  },
];

export function findMockAnswer(question: string): { answer: string; sources: Source[] } {
  const documents = searchKnowledgeBase(question);

  if (documents.length > 0) {
    const sources = documents.map((document) => ({
      id: document.id,
      title: document.title,
      snippet: document.content,
      source: document.source,
      updatedAt: document.updatedAt,
    }));

    return {
      answer:
        `我在本地知識庫中找到了 ${documents.length} 篇相關資料。` +
        "\n\n" +
        "This is a mock answer for now. I have not called OpenAI yet; the references below are matched directly from the local preset knowledge base.",
      sources,
    };
  }

  return {
    answer: "当前知识库没有覆盖这个问题。",
    sources: [],
  };
}

export const suggestedQuestions = [
  "从香港机场到 HKUST 怎么走？",
  "宿舍入住前需要准备哪些东西？",
  "新生到香港后怎么买电话卡或 SIM 卡？",
  "八达通怎么申请和使用？",
  "科大学生账号、邮箱和 Canvas 怎么设置？",
  "Student Center 里怎么查学费和缴费？",
  "RPG 新生选课和毕业要求要注意什么？",
];
