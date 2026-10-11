/**
 * Curated vocabulary packs for the Library page: additional decks focused on a
 * specific FIELD (business, tech, medicine…), a NEED (exam prep, interviews,
 * travel…) and a PROFICIENCY band. This is mock catalogue metadata — the packs are
 * not yet wired into the feed, so the page reads as a browsable shelf rather than a
 * working import. Counts are illustrative pool sizes, matching the difficulty ladder's
 * mock totals rather than any live catalog.
 *
 * Exports: VocabPack, VocabPackGroup, libraryGroups
 * Depends on: ./schema (VocabularyLevel)
 */

import type { Locale } from "./locale";
import type { VocabularyLevel } from "./schema";

/** A display string offered per locale; `vi` is always present, others fall back to it. */
type Localized = Partial<Record<Locale, string>> & { vi: string };

/** Resolve a localized string for the active locale, falling back to the Vietnamese base. */
function pick(text: Localized, locale: Locale): string {
  return text[locale] ?? text.vi;
}

/** Seed shape: the structural fields are fixed, every human-readable field is localized. */
type VocabPackSeed = {
  id: string;
  /** Illustrative word count for the pack. */
  words: number;
  /** CEFR band the pack targets. */
  levels: VocabularyLevel[];
  /** Pack name shown on the card (product names like IELTS/TOEIC stay identical everywhere). */
  name: Localized;
  /** Short gloss of who the pack is for. */
  blurb: Localized;
  /** Free-form tags referencing LIBRARY_TAGS ids. */
  tags: string[];
};

type VocabPackGroupSeed = {
  id: string;
  /** Section heading, e.g. "Công việc" or "Luyện thi". */
  title: Localized;
  /** One-line description of the shelf. */
  note: Localized;
  packs: VocabPackSeed[];
};

/** Resolved pack — display fields already flattened to the chosen locale. */
export type VocabPack = {
  id: string;
  name: string;
  blurb: string;
  words: number;
  levels: VocabularyLevel[];
  tags: string[];
};

/** Resolved group — display fields already flattened to the chosen locale. */
export type VocabPackGroup = {
  id: string;
  title: string;
  note: string;
  packs: VocabPack[];
};

/**
 * Shared tag vocabulary, keyed by a stable id so a tag like "giao tiếp" is translated once
 * and reused across every pack that references it. Order is irrelevant.
 */
const LIBRARY_TAGS: Record<string, Localized> = {
  "giao-tiep": { vi: "giao tiếp", th: "การสื่อสาร", ja: "会話" },
  "chu-de-gia-dinh": { vi: "chủ đề gia đình", th: "ครอบครัว", ja: "家族" },
  "so-thich": { vi: "sở thích", th: "งานอดิเรก", ja: "趣味" },
  "danh-tu": { vi: "danh từ", th: "คำนาม", ja: "名詞" },
  "tinh-tu": { vi: "tính từ", th: "คำคุณศัพท์", ja: "形容詞" },
  "kinh-doanh": { vi: "kinh doanh", th: "ธุรกิจ", ja: "ビジネス" },
  "thuong-mai": { vi: "thương mại", th: "การค้า", ja: "商業" },
  "phong-van": { vi: "phỏng vấn", th: "การสัมภาษณ์", ja: "面接" },
  "cong-nghe": { vi: "công nghệ", th: "เทคโนโลยี", ja: "テクノロジー" },
  "ky-thuat": { vi: "kỹ thuật", th: "ด้านเทคนิค", ja: "技術" },
  marketing: { vi: "marketing", th: "การตลาด", ja: "マーケティング" },
  "luyen-thi": { vi: "luyện thi", th: "เตรียมสอบ", ja: "試験対策" },
  "hoc-thuat": { vi: "học thuật", th: "เชิงวิชาการ", ja: "学術" },
  "viet-lach": { vi: "viết lách", th: "การเขียน", ja: "ライティング" },
  "du-lich": { vi: "du lịch", th: "การท่องเที่ยว", ja: "旅行" },
  "am-thuc": { vi: "ẩm thực", th: "อาหาร", ja: "料理" },
};

/**
 * The shelves, ordered most-to-least aspirational: daily grounding first, then work,
 * study and travel. Levels deliberately overlap between packs so several shelves can
 * share a proficiency band without any single pack feeling empty. Counts are
 * illustrative pool sizes, matching the difficulty ladder's mock totals rather than any
 * live catalog. `vi` is the base; `th`/`ja` are the language experiments; any other
 * locale resolves to `vi`.
 */
const LIBRARY_GROUP_SEEDS: readonly VocabPackGroupSeed[] = [
  {
    id: "daily",
    title: { vi: "Đời sống hằng ngày", th: "ชีวิตประจำวัน", ja: "日常生活" },
    note: {
      vi: "Nền tảng giao tiếp cho những tình huống quen thuộc nhất.",
      th: "พื้นฐานการสื่อสารสำหรับสถานการณ์ที่พบบ่อยที่สุด",
      ja: "最も身近な場面のための会話の土台。",
    },
    packs: [
      {
        id: "daily-conversation",
        name: { vi: "Giao tiếp thường nhật", th: "การสนทนาประจำวัน", ja: "日常会話" },
        blurb: {
          vi: "Ăn uống, mua sắm, hỏi đường, trò chuyện xã giao.",
          th: "การกิน สั่งซื้อ ถามทาง และสนทนาอย่างเป็นกันเอง",
          ja: "食事、買い物、道案内、気軽なおしゃべり。",
        },
        words: 1600,
        levels: ["A1", "A2"],
        tags: ["giao-tiep", "chu-de-gia-dinh", "so-thich"],
      },
      {
        id: "home-family",
        name: { vi: "Gia đình & Nhà cửa", th: "ครอบครัว & ที่บ้าน", ja: "家族と暮らし" },
        blurb: {
          vi: "Thành viên, việc nhà, đồ vật và thói quen sinh hoạt.",
          th: "สมาชิกในครอบครัว งานบ้าน ของใช้ และนิสัยในชีวิตประจำวัน",
          ja: "家族、家事、持ち物、暮らしの習慣。",
        },
        words: 900,
        levels: ["A1", "A2"],
        tags: ["chu-de-gia-dinh", "danh-tu"],
      },
      {
        id: "feelings",
        name: { vi: "Cảm xúc & Tính cách", th: "อารมณ์ & บุคลิกภาพ", ja: "感情と性格" },
        blurb: {
          vi: "Mô tả tâm trạng, tính nết và phản ứng.",
          th: "บรรยายอารมณ์ นิสัย และปฏิกิริยาต่าง ๆ",
          ja: "気分、性質、反応を描写する。",
        },
        words: 720,
        levels: ["A2", "B1"],
        tags: ["tinh-tu", "giao-tiep"],
      },
    ],
  },
  {
    id: "work",
    title: { vi: "Công việc", th: "การทำงาน", ja: "仕事" },
    note: {
      vi: "Từ vựng cho môi trường chuyên môn, hội họp và phỏng vấn.",
      th: "คำศัพท์สำหรับสภาพแวดล้อมการทำงาน การประชุม และการสัมภาษณ์",
      ja: "職場、会議、面接のための語彙。",
    },
    packs: [
      {
        id: "business-core",
        name: { vi: "Kinh doanh tổng quát", th: "ธุรกิจเบื้องต้น", ja: "ビジネス一般" },
        blurb: {
          vi: "Họp, đàm phán, báo cáo và thuật ngữ văn phòng.",
          th: "การประชุม การเจรจา รายงาน และศัพท์สำนักงาน",
          ja: "会議、交渉、報告、オフィスの用語。",
        },
        words: 1400,
        levels: ["B1", "B2"],
        tags: ["kinh-doanh", "thuong-mai"],
      },
      {
        id: "interview",
        name: { vi: "Phỏng vấn xin việc", th: "สัมภาษณ์งาน", ja: "就職面接" },
        blurb: {
          vi: "Cách nói về trải nghiệm, điểm mạnh và kỳ vọng.",
          th: "วิธีพูดถึงประสบการณ์ จุดแข็ง และความคาดหวัง",
          ja: "経験、強み、希望の伝え方。",
        },
        words: 640,
        levels: ["B1", "B2"],
        tags: ["phong-van", "giao-tiep"],
      },
      {
        id: "tech",
        name: {
          vi: "Công nghệ & Lập trình",
          th: "เทคโนโลยี & การเขียนโปรแกรม",
          ja: "テクノロジーとプログラミング",
        },
        blurb: {
          vi: "Thuật ngữ kỹ thuật, sản phẩm và quy trình phát triển.",
          th: "ศัพท์เทคนิค ผลิตภัณฑ์ และกระบวนการพัฒนาซอฟต์แวร์",
          ja: "技術用語、プロダクト、開発プロセス。",
        },
        words: 1100,
        levels: ["B2", "C1"],
        tags: ["cong-nghe", "ky-thuat"],
      },
      {
        id: "marketing",
        name: {
          vi: "Marketing & Truyền thông",
          th: "การตลาด & สื่อสาร",
          ja: "マーケティングと広報",
        },
        blurb: {
          vi: "Thương hiệu, chiến dịch và số liệu tăng trưởng.",
          th: "แบรนด์ แคมเปญ และตัวเลขการเติบโต",
          ja: "ブランド、キャンペーン、成長指標。",
        },
        words: 820,
        levels: ["B2"],
        tags: ["marketing", "kinh-doanh"],
      },
    ],
  },
  {
    id: "study",
    title: { vi: "Luyện thi & Học thuật", th: "เตรียมสอบ & วิชาการ", ja: "試験対策とアカデミック" },
    note: {
      vi: "Bám sát khung CEFR cho mục tiêu điểm số và du học.",
      th: "สอดคล้องกรอบ CEFR สำหรับเป้าหมายคะแนนและการเรียนต่อ",
      ja: "スコア目標と留学のためのCEFR準拠。",
    },
    packs: [
      {
        id: "ielts",
        name: {
          vi: "IELTS Listening & Speaking",
          th: "IELTS Listening & Speaking",
          ja: "IELTS Listening & Speaking",
        },
        blurb: {
          vi: "Ngôn ngữ chủ đề thi nói và nghe thường gặp.",
          th: "ภาษาของหัวข้อสอบพูดและฟังที่พบบ่อย",
          ja: "スピーキングとリスニングでよく出るトピックの言葉。",
        },
        words: 1500,
        levels: ["B1", "B2", "C1"],
        tags: ["luyen-thi", "hoc-thuat"],
      },
      {
        id: "toeic",
        name: { vi: "TOEIC Reading", th: "TOEIC Reading", ja: "TOEIC Reading" },
        blurb: {
          vi: "Từ vựng kinh doanh và đời sống cho phần đọc hiểu.",
          th: "คำศัพท์ธุรกิจและชีวิตประจำวันสำหรับส่วนอ่าน",
          ja: "読解パートのビジネスと生活の語彙。",
        },
        words: 1300,
        levels: ["A2", "B1", "B2"],
        tags: ["luyen-thi", "kinh-doanh"],
      },
      {
        id: "academic",
        name: { vi: "Tiếng Anh học thuật", th: "ภาษาอังกฤษเชิงวิชาการ", ja: "アカデミック英語" },
        blurb: {
          vi: "Văn phong luận, trích dẫn và lập luận.",
          th: "บทบรรยายเชิงวิเคราะห์ การอ้างอิง และการให้เหตุผล",
          ja: "論文の文体、引用、論証。",
        },
        words: 1200,
        levels: ["C1", "C2"],
        tags: ["hoc-thuat", "viet-lach"],
      },
    ],
  },
  {
    id: "travel",
    title: { vi: "Du lịch & Trải nghiệm", th: "การท่องเที่ยว & ประสบการณ์", ja: "旅行と体験" },
    note: {
      vi: "Đủ dùng khi đi xa, đặt chỗ và xử lý tình huống.",
      th: "พอใช้เมื่อเดินทาง จองที่ และจัดการสถานการณ์ต่าง ๆ",
      ja: "旅行、予約、いろいろな場面の対処に。",
    },
    packs: [
      {
        id: "travel-essentials",
        name: { vi: "Du lịch căn bản", th: "การท่องเที่ยวขั้นพื้นฐาน", ja: "旅行の基本" },
        blurb: {
          vi: "Sân bay, khách sạn, vận chuyển và ăn ngoài.",
          th: "สนามบิน โรงแรม การเดินทาง และการกินนอกบ้าน",
          ja: "空港、ホテル、移動、外食。",
        },
        words: 980,
        levels: ["A1", "A2", "B1"],
        tags: ["du-lich", "giao-tiep"],
      },
      {
        id: "food-dining",
        name: { vi: "Ẩm thực", th: "อาหาร", ja: "料理" },
        blurb: {
          vi: "Món ăn, hương vị, nguyên liệu và gọi món.",
          th: "จานอาหาร รสชาติ วัตถุดิบ และการสั่งอาหาร",
          ja: "料理、味、材料、注文。",
        },
        words: 760,
        levels: ["A2", "B1"],
        tags: ["am-thuc", "du-lich"],
      },
    ],
  },
];

/**
 * Resolve the library shelves for a locale, flattening every display string and
 * dereferencing tag ids through the shared catalog. Unknown locales fall back to `vi`.
 * @param locale Active content locale.
 * @returns Ordered groups with locale-resolved titles, notes, pack names, blurbs and tags.
 */
export function libraryGroups(locale: Locale): VocabPackGroup[] {
  const tag = (id: string) => {
    const entry = LIBRARY_TAGS[id];
    return entry ? pick(entry, locale) : id;
  };
  return LIBRARY_GROUP_SEEDS.map((group) => ({
    id: group.id,
    title: pick(group.title, locale),
    note: pick(group.note, locale),
    packs: group.packs.map((pack) => ({
      id: pack.id,
      name: pick(pack.name, locale),
      blurb: pick(pack.blurb, locale),
      words: pack.words,
      levels: pack.levels,
      tags: pack.tags.map(tag),
    })),
  }));
}
