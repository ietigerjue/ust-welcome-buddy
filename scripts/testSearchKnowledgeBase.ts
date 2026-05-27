import { searchKnowledgeBaseWithScores } from "../src/lib/searchKnowledgeBase";

const queries = [
  "airport to HKUST",
  "机场到港科大怎么走",
  "dorm preparation",
  "宿舍入住准备",
  "Octopus card",
  "学生八达通怎么申请",
  "SIM card",
  "香港电话卡和手机卡",
  "Canvas SIS email",
  "科大邮箱 Canvas SIS",
];

for (const query of queries) {
  const results = searchKnowledgeBaseWithScores(query);

  console.log(`\nQuery: ${query}`);

  if (results.length === 0) {
    console.log("  No matches");
    continue;
  }

  for (const { document, score, matchedTerms } of results) {
    console.log(
      `  - ${document.title} (score: ${score}, matched: ${matchedTerms.join(", ")})`
    );
  }
}
