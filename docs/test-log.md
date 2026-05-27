# UST Buddy Test Log

Use this file to record manual test questions, answer quality, source coverage, and knowledge base gaps for UST Buddy.

## Test Checklist

- Question is answered in the same language as the user question.
- Answer only uses information from the local knowledge base.
- Answer is concise and useful for HKUST freshmen.
- Sources are relevant and displayed correctly.
- If the knowledge base does not cover the question, the answer says: 当前知识库没有覆盖这个问题。
- For fees, visas, deadlines, housing rules, academic policies, and official procedures, the answer reminds users to verify HKUST official sources.

## Test Cases

| Date | Question | Expected Sources | Answer Quality | Knowledge Base Gap | Notes |
| --- | --- | --- | --- | --- | --- |
|  | airport to HKUST | Airport to HKUST Transportation |  |  |  |
|  | dorm preparation | Dorm Move-in Preparation |  |  |  |
|  | Octopus card | Octopus Card Basics |  |  |  |
|  | SIM card | Hong Kong SIM Card Setup |  |  |  |
|  | Canvas SIS email | Campus Systems, Student Email, Canvas, and SIS |  |  |  |

## Knowledge Base To Add

| Priority | Topic | Reason | Suggested Source |
| --- | --- | --- | --- |
|  |  |  |  |

## Regression Notes

- Keep examples that previously failed, so they can be retested after prompt, search, or knowledge base changes.

## Test 1
Question: 从香港机场怎么去港科？ How do I get to HKUST from Hong Kong Airport? 从深圳湾去港科怎么走？ 第一次来香港，行李很多，去港科建议打车吗？
Expected: 回答机场到 HKUST 的交通方式，并显示来源。
Result: Pass 
Notes:

## Test 2
Question: Canvas 是什么？ SIS 是什么？ 港科学生邮箱怎么用？ Add/drop 是什么意思？
Expected: 回答宿舍准备清单，并显示来源。
Result: Pass 
Notes: