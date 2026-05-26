export type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  updatedAt: string;
  keywords: string[];
};

export const knowledgeBase: KnowledgeDocument[] = [
  {
    id: "airport-to-hkust",
    title: "Getting from Hong Kong Airport to HKUST",
    category: "Arrival",
    content:
      "New students arriving at Hong Kong International Airport can reach HKUST by taxi, Airport Express plus taxi, or public bus. A direct taxi is usually the simplest option when carrying luggage and normally takes about 45 to 60 minutes depending on traffic. A cheaper option is to take the Airport Express to Tsing Yi or Kowloon, then continue by taxi to campus. Students can also take airport buses toward Tseung Kwan O or Po Lam, then transfer to a taxi or minibus for HKUST. Before arrival, students should save the campus address, check their hall check-in time, and keep passport, visa or entry permit, admission documents, and hall offer information easy to access.",
    source: "UST Buddy local admin knowledge base - Arrival transport mock guide",
    updatedAt: "2026-05-26",
    keywords: [
      "airport",
      "HKIA",
      "arrival",
      "taxi",
      "Airport Express",
      "bus",
      "transport",
      "luggage",
      "HKUST",
    ],
  },
  {
    id: "dorm-move-in-preparation",
    title: "Dorm Move-in Preparation",
    category: "Housing",
    content:
      "Before moving into an HKUST student hall, new students should prepare bedding, daily toiletries, towels, shower slippers, hangers, laundry supplies, power adapters, and basic stationery. Hong Kong uses Type G three-pin plugs, so international students may need adapters. Students should bring identity documents, admission information, hall offer details, and any check-in QR codes or emails required by the hall. Large household items can usually be purchased after arrival from shops in Hang Hau, Tseung Kwan O, or online local stores. Students should avoid overpacking because dorm rooms are compact and shared storage space is limited.",
    source: "UST Buddy local admin knowledge base - Housing mock guide",
    updatedAt: "2026-05-26",
    keywords: [
      "dorm",
      "hall",
      "move in",
      "housing",
      "bedding",
      "toiletries",
      "adapter",
      "laundry",
      "check in",
      "宿舍",
    ],
  },
  {
    id: "hong-kong-sim-card",
    title: "Hong Kong SIM Card and Mobile Plans",
    category: "Telecom",
    content:
      "New students can buy a prepaid SIM card at Hong Kong International Airport, convenience stores, telecom shops, or shopping malls near campus. Common providers include csl, SmarTone, China Mobile Hong Kong, 3HK, and Club SIM. A prepaid SIM is often easiest for the first few days because it can be activated quickly. After receiving local identity documents or settling in, students may compare monthly plans based on data allowance, contract length, coverage, and price. Students should keep their phone unlocked before arrival and check whether their device supports Hong Kong mobile bands.",
    source: "UST Buddy local admin knowledge base - SIM card mock guide",
    updatedAt: "2026-05-26",
    keywords: [
      "SIM",
      "sim card",
      "phone",
      "mobile",
      "telecom",
      "prepaid",
      "data plan",
      "csl",
      "SmarTone",
      "3HK",
      "電話卡",
    ],
  },
  {
    id: "octopus-card-basics",
    title: "Octopus Card Basics",
    category: "Transport",
    content:
      "The Octopus card is a stored-value card widely used in Hong Kong for MTR, buses, minibuses, ferries, convenience stores, vending machines, and many campus dining outlets. New students can buy a standard Octopus card at MTR stations or convenience stores. It can be topped up at MTR stations, convenience stores, and supported mobile apps. Students will likely use Octopus every day for transport and small purchases. Eligible students may later apply for student transport concessions according to the official transport operator rules and university guidance.",
    source: "UST Buddy local admin knowledge base - Octopus mock guide",
    updatedAt: "2026-05-26",
    keywords: [
      "Octopus",
      "octopus card",
      "MTR",
      "bus",
      "minibus",
      "transport",
      "top up",
      "payment",
      "八達通",
      "八达通",
    ],
  },
  {
    id: "campus-dining-options",
    title: "Campus Dining Options",
    category: "Food",
    content:
      "HKUST has multiple dining options across campus, including canteens, cafes, coffee shops, and casual dining outlets. Students commonly look for meals around major academic buildings, the Atrium, lower ground levels, and hall areas. Octopus and other electronic payments are commonly accepted, but students should keep a small amount of cash for backup. During peak lunch and dinner times, queues can be long, so new students may want to explore different outlets and avoid the busiest time slots. Nearby areas such as Hang Hau and Tseung Kwan O provide more off-campus restaurants and supermarkets.",
    source: "UST Buddy local admin knowledge base - Campus dining mock guide",
    updatedAt: "2026-05-26",
    keywords: [
      "food",
      "dining",
      "canteen",
      "restaurant",
      "cafe",
      "meal",
      "Octopus",
      "Hang Hau",
      "Tseung Kwan O",
      "餐飲",
      "食堂",
    ],
  },
  {
    id: "campus-systems-email-canvas-sis",
    title: "Campus Systems, Student Email, Canvas, and SIS",
    category: "Campus Systems",
    content:
      "New HKUST students should set up and regularly check their university IT account, student email, Canvas, and Student Information System. Student email is commonly used for official university announcements, course messages, administrative reminders, and event notices. Canvas is used by many courses for lecture materials, assignments, announcements, grades, and discussion activities. SIS is used for student records and academic administration tasks such as course enrollment, timetable checks, and personal information updates. Students should enable account security features where available and avoid sharing passwords with anyone.",
    source: "UST Buddy local admin knowledge base - Campus systems mock guide",
    updatedAt: "2026-05-26",
    keywords: [
      "email",
      "student email",
      "Canvas",
      "SIS",
      "IT account",
      "course enrollment",
      "timetable",
      "grades",
      "password",
      "campus system",
      "學生郵箱",
    ],
  },
];
