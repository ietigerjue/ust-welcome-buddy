# UST Buddy Retrieval Evaluation

This file defines a fixed retrieval evaluation set for Hybrid Search. It tests whether the expected documents or chunks appear in the top retrieval results. It does not test MiniMax answer generation.

Run with:

```bash
npm run test:retrieval
```

Pass rule:

- Top 5 results contain `expected_category` in `category` or `source_type`; or
- Top 5 result title/content/source/source URL/category/source type contains any `expected_document_keywords`.

`wechat_paste` and `image_upload` are source-type coverage targets, not normal document categories.

## Test Cases

| id | question | expected_category | expected_document_keywords | expected_behavior |
|---|---|---|---|---|
| arrival-001 | 我刚到香港机场，怎么去 HKUST 比较方便？ | arrival | airport, HKIA, 机场, 到港, arrival | should_answer |
| arrival-002 | From HKIA to HKUST with luggage, what route should I consider? | arrival | airport, HKIA, luggage, 机场, 行李 | should_answer |
| arrival-003 | 新生第一次来港，入境后需要注意什么？ | arrival | arrival, 入境, 来港, landing slip, 小白条 | should_warn_official |
| housing-001 | 宿舍入住前要准备什么东西？ | housing | dorm, hall, 宿舍, 入住, bedding | should_answer |
| housing-002 | What should I know before moving into the hall? | housing | dorm, hall, housing, check-in, 入住 | should_answer |
| housing-003 | 研究生宿舍申请和入住有什么注意事项？ | housing | postgraduate housing, PG housing, 宿舍申请, 研究生宿舍 | should_warn_official |
| transport-001 | 科大去市区常用的交通方式有哪些？ | transport | transport, MTR, bus, minibus, 小巴, 巴士 | should_answer |
| transport-002 | How do I commute between HKUST and Hang Hau? | transport | Hang Hau, 坑口, minibus, 11M, commute | should_answer |
| transport-003 | 学生八达通和交通补贴怎么理解？ | transport | Octopus, 八达通, transport subsidy, 交通补贴 | should_warn_official |
| life-001 | 香港电话卡、HKID 和信用卡应该先办哪些？ | life | SIM, phone card, HKID, 电话卡, 身份证 | should_answer |
| life-002 | Octopus card 和 AlipayHK 在日常生活怎么用？ | life | Octopus, 八达通, AlipayHK, payment, 支付 | should_answer |
| life-003 | 新生刚到香港生活，有哪些校园生活和社团资源？ | life | campus life, clubs, sports, MSSS, 社团, 校园生活 | should_answer |
| academic-001 | Canvas 和 SIS 是什么？新生什么时候会用到？ | academic | Canvas, SIS, Student Center, 学生邮箱, enrollment | should_answer |
| academic-002 | How does course enrollment work for a new HKUST student? | academic | course enrollment, validation, add drop, SIS, 选课 | should_warn_official |
| academic-003 | RPG 新生选课和毕业要求有什么注意事项？ | academic | RPG, GGA, graduation requirements, 选课, 毕业要求 | should_warn_official |
| food-001 | 科大校园里哪里可以吃饭？ | food | campus food, canteen, dining, 食堂, 餐饮 | should_answer |
| food-002 | Any food options near HKUST for freshmen? | food | food, restaurant, canteen, campus dining, 餐厅 | should_answer |
| food-003 | 校园餐饮付款一般用什么方式？ | food | dining, payment, Octopus, AlipayHK, 餐饮付款 | should_answer |
| shopping-001 | 到香港后买生活用品和床品去哪比较方便？ | shopping | shopping, bedding, essentials, IKEA, 生活用品, 床品 | should_answer |
| shopping-002 | How can I receive Taobao or online orders near HKUST? | shopping | Taobao, parcel, forwarding, online orders, 快递, 集运 | should_answer |
| shopping-003 | 在香港二手交易和网购有什么安全注意？ | shopping | second hand, Carousell, scam, 二手, 网购, 安全 | should_answer |
| official-001 | 学生签证激活、小白条和 IANG 有什么要注意？ | official | visa, IANG, landing slip, 小白条, 签证 | should_warn_official |
| official-002 | 学费、保险费和缴费方式有哪些提醒？ | official | tuition, insurance, fees, payment, 学费, 保险 | should_warn_official |
| official-003 | HKUST 官方政策、截止日期和学术规定哪里确认？ | official | official, deadline, policy, academic rules, 官方, 截止日期 | should_warn_official |
| wechat-001 | 2025 新生攻略里提到的打印复印怎么操作？ | wechat_paste | WeChat Article Paste, wechat_paste, 打印, 复印, 新生攻略 | should_answer |
| wechat-002 | MSSS 公众号的新生攻略里宿舍申请有什么提醒？ | wechat_paste | WeChat Article Paste, wechat_paste, MSSS, 宿舍申请, 新生攻略 | should_warn_official |
| wechat-003 | 公众号粘贴导入的资料能查到哪些新生事项？ | wechat_paste | WeChat Article Paste, wechat_paste, 公众号, 新生攻略, imported | should_answer |
| image-001 | 长图导入的校园流程图里有哪些步骤？ | image_upload | Image Upload, image_upload, 长图, 流程图, screenshot | should_answer |
| image-002 | 图片导入的文件里有没有注册或缴费提醒？ | image_upload | Image Upload, image_upload, 图片, 注册, 缴费 | should_warn_official |
| image-003 | 从截图 OCR 进来的知识库内容能检索到吗？ | image_upload | Image Upload, image_upload, OCR, screenshot, 图片 | should_answer |

