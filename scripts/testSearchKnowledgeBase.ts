import { searchKnowledgeBaseWithScores } from "../src/lib/searchKnowledgeBase";

const queries = [
  "airport to HKUST",
  "dorm preparation",
  "Octopus card",
  "SIM card",
  "Canvas SIS email",
];

for (const query of queries) {
  const results = searchKnowledgeBaseWithScores(query);

  console.log(`\nQuery: ${query}`);

  if (results.length === 0) {
    console.log("  No matches");
    continue;
  }

  for (const { document, score } of results) {
    console.log(`  - ${document.title} (score: ${score})`);
  }
}
