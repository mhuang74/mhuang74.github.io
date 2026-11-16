import type { Locale } from "./locale";

interface LandingContent {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    headline: string;
    lead: string;
    ctaPrimary: string;
    ctaGhost: string;
    note: string;
    portraitAlt: string;
    chip: string;
  };
  stats: {
    eyebrow: string;
    items: { num: string; unit: string; label: string }[];
  };
  flagship: {
    eyebrow: string;
    title: string;
    lead: string;
    linkLabel: string;
    decisions: [headline: string, body: string][];
    facts: { role: string; team: string; scale: string };
    stack: string[];
  };
  moreWork: {
    eyebrow: string;
    heading: string;
    projects: {
      pill: string;
      title: string;
      body: string;
      metric: string;
      tags: string[];
    }[];
  };
  principles: {
    eyebrow: string;
    heading: string;
    items: [headline: string, body: string][];
  };
  experience: {
    eyebrow: string;
    heading: string;
    rows: { when: string; role: string; dek: string; pull: string }[];
  };
  writing: {
    eyebrow: string;
    heading: string;
    linkLabel: string;
    posts: {
      date: string;
      title: string;
      href: string;
      dek: string;
      pull: string;
    }[];
  };
  contact: { eyebrow: string; heading: string; lead: string; cta: string };
}

const en: LandingContent = {
  meta: {
    title: "Michael S. Huang · Product Engineer",
    description:
      "A Player-Coach who ships the software he manages — data analytics, conversion attribution, performance automation, from design through production.",
  },
  hero: {
    eyebrow: "Product Engineer · Builder",
    headline:
      "A Player-Coach who understands customers and ships the software he manages.",
    lead: "I work where product decisions meet hard technical constraints: data analytics, conversion attribution, performance automation. I design, ship, and operate the software I manage.",
    ctaPrimary: "Connect on LinkedIn",
    ctaGhost: "See selected work →",
    note: "Product judgment sharpened by knowing what the work actually costs.",
    portraitAlt: "Portrait of Michael S. Huang",
    chip: "Open to full-time product engineer roles",
  },
  stats: {
    eyebrow: "Track record · what shipped",
    items: [
      {
        num: "8",
        unit: "",
        label: "LLM-powered product features, from spec to rollout.",
      },
      {
        num: "12",
        unit: "×",
        label:
          "faster intraday cost & revenue reporting, from a new-generation OLAP pipeline.",
      },
      {
        num: "700",
        unit: "+",
        label:
          "marketing automations running on the Scripts platform I shipped.",
      },
      {
        num: "30",
        unit: "",
        label:
          "person engineering team I led in Shanghai, across five ad platforms.",
      },
    ],
  },
  flagship: {
    eyebrow: "Selected work · 01",
    title: "Stream of Worship",
    lead: "Chinese worship teams have no tooling for the space between songs. I designed and built the system that turns a song list into a seamless, offline-capable worship set — one continuous audio file plus a lyrics video with chapter markers.",
    linkLabel: "Read the case study →",
    decisions: [
      [
        "Transition quality is a boundary problem.",
        "Compatibility is judged on the key a song leaves through versus the key the next one arrives through, plus boundary BPM — not whole-song averages.",
      ],
      [
        "Worship practice encoded as constraints.",
        "Sets follow a fixed five-phase arc; a beam-search constructor runs constrained search with a scored objective over the whole catalog.",
      ],
      [
        "Domain priors beat generic models.",
        "Worship BPM priors plus a lognormal prior from lyrics characters-per-second resolve the octave errors that fool off-the-shelf tempo estimators.",
      ],
      [
        "A serverless render pipeline.",
        "Crossfaded MP3s and ~29,000-frame lyric MP4s render in an AWS Lambda container triggered by SQS, with progress streamed to the browser.",
      ],
    ],
    facts: {
      role: "Product Owner & Engineer",
      team: "Solo",
      scale: "400+ song catalog, thousands of scored pairwise transitions",
    },
    stack: [
      "Next.js 16",
      "FastAPI",
      "AWS Lambda / SQS",
      "Neon Postgres + pgvector",
      "Cloudflare R2",
      "PyTorch / Demucs",
      "Jetpack Compose",
    ],
  },
  moreWork: {
    eyebrow: "More work",
    heading: "Three more products, three more constraint sets.",
    projects: [
      {
        pill: "Rust · macOS",
        title: "HandsOff",
        body: "A lightweight macOS menu-bar utility that locks the keyboard and mouse — never the screen — so you can watch long-running coding agents work without a curious kid interrupting them.",
        metric: "Months of continuous use, zero crashes",
        tags: [
          "Rust",
          "CoreGraphics event taps",
          "AppKit menu bar",
          "GitHub Actions",
        ],
      },
      {
        pill: "Claude agent skill",
        title: "GoogleAds Analyst Skill",
        body: "A Claude agent skill that runs period-over-period Google Ads analysis, root-causes anomalies against change-event history, and applies approved mutations — with guardrails at every irreversible step.",
        metric:
          "Customized Google Ads Performance Reports with anomalies highlighted.",
        tags: ["Agent skills", "mcc-gaql CLI", "Prompt engineering"],
      },
      {
        pill: "Rust · RAG",
        title: "MCC GAQL Tool",
        body: "Three Rust CLIs for querying, mutating, and LLM-generating Google Ads GAQL across MCC child accounts — with a RAG pipeline that knows the API schema better than a generalist model.",
        metric:
          "Use English to consolidate/aggregate Campaign metrics across entire MCC structure",
        tags: [
          "Rust",
          "tonic gRPC",
          "Polars",
          "LanceDB + Arrow",
          "Cloudflare R2",
        ],
      },
    ],
  },
  principles: {
    eyebrow: "How I work",
    heading: "Three habits that survive contact with a real codebase.",
    items: [
      [
        "Start from the frustration, not the feature request",
        "When customers ask for faster horses, I focus on the core frustration and solve the parts that don't drag in expensive technical risk.",
      ],
      [
        "Design around the constraint",
        "Error-prone AI models, near-zero idle compute costs, and uninterrupted offline playback — Stream of Worship’s constraints shaped the architecture. I design around those requirements from the start.",
      ],
      [
        "Ship the proof",
        "Pick a real problem, design around the user's constraints, then ship the code, the infrastructure, and the evaluation loop that proves it works.",
      ],
    ],
  },
  experience: {
    eyebrow: "Experience",
    heading:
      "One through-line across every role: stay close to the implementation.",
    rows: [
      {
        when: "2022 – 2025",
        role: "Technical Product Manager",
        dek: "Shipped an AI chatbot with three specialized sub-agents on Azure OpenAI, a Scripts platform running 700+ marketing automations, and ML anomaly detection across hundreds of campaigns.",
        pull: "Product",
      },
      {
        when: "2012 – 2022",
        role: "Marin Software — Technical Lead → Director → Senior Director of Engineering",
        dek: "Built search features across five ad platforms, led a 30-person Shanghai team, and delivered an OLAP pipeline that made intraday cost and revenue reporting 12× faster.",
        pull: "Engineering",
      },
      {
        when: "Before 2012",
        role: "Trilogy · MetLife · Morgan Stanley",
        dek: "Underwriting automation, trade-processing tooling, and anti-money-laundering systems — plus my own offshore engineering consultancy in Shanghai.",
        pull: "Earlier",
      },
      {
        when: "Degrees",
        role: "Cornell (M.Eng.) · UC Berkeley (B.A. Physics)",
        dek: "An engineering master's and a physics degree — and a lasting habit of building the thing, not just specifying it.",
        pull: "Education",
      },
    ],
  },
  writing: {
    eyebrow: "Writing",
    heading: "Notes from building in public.",
    linkLabel: "Read all posts →",
    posts: [
      {
        date: "20 Oct 2026",
        title:
          "Infinite Worship: endless playback after the analysis API disappeared",
        href: "/posts/infinite-worship",
        dek: "Rebuilding the Infinite Jukebox for worship music after the original analysis API disappeared.",
        pull: "Music",
      },
      {
        date: "06 Oct 2026",
        title: "What building HandsOff taught me about steering coding agents",
        href: "/posts/handsoff-steering-coding-agents",
        dek: "A macOS input locker, and the runtime failures static analysis could not catch.",
        pull: "Tool",
      },
      {
        date: "06 Oct 2026",
        title: "Detector 2.0.0: catching bad Chinese worship lyrics",
        href: "/posts/lrc-detector-2-0-0",
        dek: "Triage for hundreds of timed lyric files, and the three errors it caught.",
        pull: "ML",
      },
      {
        date: "05 May 2026",
        title: "Stream of Worship, a series",
        href: "/posts/sow-intro",
        dek: "Introducing a series on building a system for seamless Chinese worship-music transitions.",
        pull: "Series",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    heading:
      "Hire a product engineer who can interview customers and guide dev teams.",
    lead: "Tell me the problem your team is stuck on. I'd rather walk you through the work than describe it. Reach me at michael@michaelhuang.xyz.",
    cta: "Connect on LinkedIn",
  },
};

const zhTw: LandingContent = {
  meta: {
    title: "Michael S. Huang｜產品工程師",
    description:
      "懂客戶、也親手把自己負責的軟體做出來的產品工程師——資料分析、轉換歸因、成效自動化，從設計到上線。",
  },
  hero: {
    eyebrow: "產品工程師 · 動手做的人",
    headline: "懂客戶，也親手把產品做出來的球員兼教練。",
    lead: "我在產品決策和硬技術限制交會的地方工作：資料分析、轉換歸因、成效自動化。我設計、交付，也維運自己負責的軟體。",
    ctaPrimary: "在 LinkedIn 上聯絡",
    ctaGhost: "看看精選作品 →",
    note: "產品判斷，來自真正知道事情要花多少成本。",
    portraitAlt: "Michael S. Huang 的肖像",
    chip: "開放全職產品工程師機會",
  },
  stats: {
    eyebrow: "實績 · 交付了什麼",
    items: [
      {
        num: "8",
        unit: "",
        label: "從規格到上線，8 個 LLM 驅動的產品功能。",
      },
      {
        num: "12",
        unit: "×",
        label: "新一代 OLAP 管線，讓當日成本與營收報表快 12 倍。",
      },
      {
        num: "700",
        unit: "+",
        label: "我交付的 Scripts 平台上，跑著 700 多個行銷自動化流程。",
      },
      {
        num: "30",
        unit: "",
        label: "我在上海帶領的 30 人工程團隊，橫跨五個廣告平台。",
      },
    ],
  },
  flagship: {
    eyebrow: "精選作品 · 01",
    title: "Stream of Worship",
    lead: "中文敬拜團隊在歌曲和歌曲之間，一直沒有工具可用。我設計並打造了把歌單變成無縫、可離線播放敬拜組的系統——一個連續音檔，加上帶章節標記的歌詞影片。",
    linkLabel: "讀案例研究 →",
    decisions: [
      [
        "轉場品質是邊界問題。",
        "相容性看的是前一首歌離開時的調性、下一首歌進來時的調性，加上交界處的 BPM，而不是整首歌的平均值。",
      ],
      [
        "把敬拜實務寫成限制條件。",
        "一組歌固定走五個階段的弧線；beam search 建構器在整份目錄上做受限搜尋，並用評分目標排序。",
      ],
      [
        "領域先驗勝過通用模型。",
        "敬拜歌曲的 BPM 先驗，加上歌詞每秒字數的對數常態先驗，解決了現成節拍偵測器會犯的八度錯誤。",
      ],
      [
        "無伺服器渲染管線。",
        "交叉淡化的 MP3 和約 29,000 幀的歌詞 MP4，在由 SQS 觸發的 AWS Lambda 容器裡渲染，進度即時串到瀏覽器。",
      ],
    ],
    facts: {
      role: "產品負責人兼工程師",
      team: "獨立開發",
      scale: "400+ 首歌曲目錄，數千組已評分的兩兩轉場",
    },
    stack: [
      "Next.js 16",
      "FastAPI",
      "AWS Lambda / SQS",
      "Neon Postgres + pgvector",
      "Cloudflare R2",
      "PyTorch / Demucs",
      "Jetpack Compose",
    ],
  },
  moreWork: {
    eyebrow: "其他作品",
    heading: "還有三個產品，三組不同的限制條件。",
    projects: [
      {
        pill: "Rust · macOS",
        title: "HandsOff",
        body: "一個輕量的 macOS 選單列工具，只鎖鍵盤和滑鼠、不鎖螢幕。你可以盯著跑很久的 coding agent 工作，不用擔心好奇的小孩來亂。",
        metric: "連續使用數個月，零當機",
        tags: [
          "Rust",
          "CoreGraphics event taps",
          "AppKit menu bar",
          "GitHub Actions",
        ],
      },
      {
        pill: "Claude agent skill",
        title: "GoogleAds Analyst Skill",
        body: "一個 Claude agent skill，做逐期 Google Ads 分析、對照變更事件歷史找出異常根因，再套用已核准的修改——每個不可逆的步驟都有防護。",
        metric: "標出異常的 Google Ads 成效報表。",
        tags: ["Agent skills", "mcc-gaql CLI", "提示詞工程"],
      },
      {
        pill: "Rust · RAG",
        title: "MCC GAQL Tool",
        body: "三個 Rust CLI，用來查詢、修改，以及用 LLM 產生跨 MCC 子帳戶的 Google Ads GAQL——背後的 RAG 管線對 API schema 的熟悉度，勝過通用模型。",
        metric: "用英文就能彙整整個 MCC 結構的廣告活動指標。",
        tags: [
          "Rust",
          "tonic gRPC",
          "Polars",
          "LanceDB + Arrow",
          "Cloudflare R2",
        ],
      },
    ],
  },
  principles: {
    eyebrow: "我怎麼工作",
    heading: "三個在真實程式庫裡還活著的習慣。",
    items: [
      [
        "從挫折開始，不是從功能需求開始",
        "客戶要更快的馬時，我會先弄清楚真正的挫折是什麼，再解決那些不會拖進昂貴技術風險的部分。",
      ],
      [
        "繞著限制設計",
        "容易出錯的 AI 模型、幾乎為零的閒置運算成本、不能中斷的離線播放——Stream of Worship 的限制塑造了整個架構。我一開始就把這些條件設計進去。",
      ],
      [
        "交出證明",
        "挑一個真問題，繞著使用者的限制設計，然後把程式、基礎設施，還有證明它真的能用的評估迴圈一起交付。",
      ],
    ],
  },
  experience: {
    eyebrow: "經歷",
    heading: "每個角色都有一條主線：貼近實作。",
    rows: [
      {
        when: "2022 – 2025",
        role: "技術產品經理",
        dek: "在 Azure OpenAI 上交付具備三個專用子代理的 AI 聊天機器人、一個跑著 700 多個行銷自動化的 Scripts 平台，以及橫跨數百個廣告活動的 ML 異常偵測。",
        pull: "產品",
      },
      {
        when: "2012 – 2022",
        role: "Marin Software — 技術主管 → 工程總監 → 資深工程總監",
        dek: "在五個廣告平台上打造搜尋功能，帶領上海 30 人團隊，交付讓當日成本與營收報表快 12 倍的 OLAP 管線。",
        pull: "工程",
      },
      {
        when: "2012 年之前",
        role: "Trilogy · MetLife · Morgan Stanley",
        dek: "核保自動化、交易處理工具、反洗錢系統——加上我在上海自己的離岸工程顧問公司。",
        pull: "更早",
      },
      {
        when: "學歷",
        role: "Cornell（M.Eng.）· UC Berkeley（B.A. 物理）",
        dek: "工程碩士和物理學位——還有那個改不掉的習慣：把東西做出來，不只寫規格。",
        pull: "學歷",
      },
    ],
  },
  writing: {
    eyebrow: "文章",
    heading: "邊做邊寫的筆記。",
    linkLabel: "讀所有文章 →",
    posts: [
      {
        date: "2026 年 10 月 20 日",
        title: "Infinite Worship：分析 API 消失後，音樂還是能一直播下去",
        href: "/zh-tw/posts/infinite-worship",
        dek: "原本的分析 API 消失後，我為敬拜音樂重做了 Infinite Jukebox。",
        pull: "音樂",
      },
      {
        date: "2026 年 10 月 6 日",
        title: "打造 HandsOff 教我怎麼帶 coding agent",
        href: "/zh-tw/posts/handsoff-steering-coding-agents",
        dek: "一個 macOS 輸入鎖，以及靜態分析抓不到的執行期故障。",
        pull: "工具",
      },
      {
        date: "2026 年 10 月 6 日",
        title: "Detector 2.0.0：先挑出該優先檢查的歌詞檔",
        href: "/zh-tw/posts/lrc-detector-2-0-0",
        dek: "替數百個時間軸歌詞檔做分流，以及它抓到的三種錯誤。",
        pull: "ML",
      },
      {
        date: "2026 年 5 月 5 日",
        title: "Stream of Worship 系列",
        href: "/zh-tw/posts/sow-intro",
        dek: "介紹這個打造無縫中文敬拜音樂轉場系統的系列。",
        pull: "系列",
      },
    ],
  },
  contact: {
    eyebrow: "聯絡",
    heading: "找一位能訪談客戶、也能帶開發團隊的產品工程師。",
    lead: "告訴我你的團隊卡在哪個問題。我比較想直接帶你看我做過的東西，而不是用說的。寫信到 michael@michaelhuang.xyz。",
    cta: "在 LinkedIn 上聯絡",
  },
};

export const landingContent: Record<Locale, LandingContent> = {
  en,
  "zh-tw": zhTw,
};
