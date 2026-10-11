/**
 * Localized display names for the vocabulary feed's option sheet and stage labels.
 *
 * The stored identifiers are the contract — topic slugs come from the catalog, and
 * theme and style ids come from the palette collection and the motion presets — so
 * only the LABELS are translated here. The source strings stay English in their own
 * modules because the admin surfaces (export studio, template manager) still read
 * them, and a palette/style/topic added by an admin has no entry in this map: every
 * lookup takes the source label as a fallback rather than rendering a blank or an id.
 *
 * The map is keyed by Locale (see lib/locale.ts). `vi` is the base and is always
 * fully populated; `th` and `ja` are populated for the language experiments; the
 * remaining locales are empty stubs that fall back to Vietnamese until they are
 * authored later.
 *
 * Exports: LabelSet, LOCALE_LABELS, topicLabel, themeLabel, styleLabel, posLabel,
 *   stageLabel
 * Depends on: locale (type), schema (NarrativeStyle)
 */

import type { Locale } from "./locale";
import { DEFAULT_LOCALE } from "./locale";
import type { NarrativeStyle } from "./schema";

/** The complete set of UI strings for one locale. */
export type LabelSet = {
  /** Catalog topic slug → name shown in the "Chủ đề" picker. */
  topics: Record<string, string>;
  /** Palette id → the colour-story name. */
  themes: Record<string, string>;
  /** Narrative style id → the reveal name. */
  styles: Record<string, string>;
  /** Part-of-speech code → grammar label. */
  pos: Record<string, string>;
  /** Stage (page) labels keyed by their role; `lead` varies by narrative style. */
  stage: {
    definition: string;
    usage: string;
    anticipation: string;
    letters: string;
    /** Derived letter-count sentence template; `{count}` and `{initial}` are filled. */
    lettersText: string;
    reveal: string;
    lead: Record<NarrativeStyle, string>;
  };
};

/** Vietnamese base — migrated verbatim from the original `*_VI` maps. */
const VI: LabelSet = {
  topics: {
    attention: "Chú ý",
    character: "Tính cách",
    communication: "Giao tiếp",
    daily: "Đời thường",
    emotion: "Cảm xúc",
    thinking: "Suy nghĩ",
    time: "Thời gian",
    work: "Công việc",
  },
  themes: {
    "midnight-magenta": "Đêm tím hồng",
    "deep-lagoon": "Vịnh nước sâu",
    "forest-ember": "Rừng than hồng",
    "indigo-dusk": "Chàm hoàng hôn",
    "olive-brass": "Ô liu đồng",
    "plum-orchid": "Mận tím lan",
    "slate-cyan": "Xám xanh lơ",
    "obsidian-lime": "Đen obsidian chanh",
    "teal-sunrise": "Cổ vịt bình minh",
    "cobalt-flare": "Cobalt rực",
    "rose-quartz": "Thạch anh hồng",
    "morning-mint": "Bạc hà sớm",
    "azure-linen": "Lam vải lanh",
    "paper-amber": "Giấy hổ phách",
    "apple-frost": "Táo sương",
    "apple-sand": "Táo cát",
    "apple-graphite": "Táo chì",
    "apple-twilight": "Táo chạng vạng",
    "obsidian-vault": "Hầm obsidian",
    "phantom-rose": "Hồng ảo ảnh",
    "ink-wash": "Thủy mặc",
    "midnight-ember": "Đêm lửa tàn",
    "vermillion-jade": "Son ngọc bích",
    "ink-bamboo": "Mực trúc",
    "lotus-gold": "Sen vàng",
    "indigo-porcelain": "Sứ chàm",
  },
  styles: {
    detective: "Thám tử",
    speed: "Tốc độ",
    confession: "Tự sự",
    minimal: "Tối giản",
  },
  pos: {
    adj: "tính từ",
    adjective: "tính từ",
    adv: "trạng từ",
    adverb: "trạng từ",
    noun: "danh từ",
    v: "động từ",
    verb: "động từ",
    prep: "giới từ",
    preposition: "giới từ",
    conj: "liên từ",
    pron: "đại từ",
    pronoun: "đại từ",
  },
  stage: {
    definition: "Ý nghĩa",
    usage: "Trong câu",
    anticipation: "Bạn đoán gì?",
    letters: "Đếm chữ cái",
    lettersText: "Gồm {count} chữ cái, bắt đầu bằng {initial}",
    reveal: "Đây rồi!",
    lead: {
      detective: "Bối cảnh",
      speed: "Sẵn sàng chưa?",
      confession: "Có quen không?",
      minimal: "Một suy nghĩ",
    },
  },
};

/** Thai overlay for the experiment. Rough translations; correctness not asserted. */
const TH: LabelSet = {
  topics: {
    attention: "ความสนใจ",
    character: "บุคลิกภาพ",
    communication: "การสื่อสาร",
    daily: "ชีวิตประจำวัน",
    emotion: "อารมณ์",
    thinking: "ความคิด",
    time: "เวลา",
    work: "การทำงาน",
  },
  themes: {
    "midnight-magenta": "คืนชมพูม่วง",
    "deep-lagoon": "ลากูนลึก",
    "forest-ember": "ป่าถ่านไฟ",
    "indigo-dusk": "อินดิโกยามสนธยา",
    "olive-brass": "มะกอกทองเหลือง",
    "plum-orchid": "พลัมกล้วยไม้",
    "slate-cyan": "สเลตไซอัน",
    "obsidian-lime": "ออบซิเดียนมะนาว",
    "teal-sunrise": "เติลยามรุ่งอรุณ",
    "cobalt-flare": "โคบอลท์เรืองแสง",
    "rose-quartz": "ควอทซ์กุหลาบ",
    "morning-mint": "มินต์ยามเช้า",
    "azure-linen": "อะซูร์ลินิน",
    "paper-amber": "กระดาษอำพัน",
    "apple-frost": "แอปเปิลเย็น",
    "apple-sand": "แอปเปิลทราย",
    "apple-graphite": "แอปเปิลกราฟไฟต์",
    "apple-twilight": "แอปเปิลสนธยา",
    "obsidian-vault": "ออบซิเดียนคลัง",
    "phantom-rose": "กุหลาบผี",
    "ink-wash": "ภาพหมึก",
    "midnight-ember": "ถ่านไฟยามค่ำ",
    "vermillion-jade": "วีมิเลียนหยก",
    "ink-bamboo": "หมึกไผ่",
    "lotus-gold": "บัวทอง",
    "indigo-porcelain": "ครามเซรามิก",
  },
  styles: {
    detective: "นักสืบ",
    speed: "ความเร็ว",
    confession: "สารภาพ",
    minimal: "เรียบง่าย",
  },
  pos: {
    adj: "คำคุณศัพท์",
    adjective: "คำคุณศัพท์",
    adv: "คำกริยาวิเศษณ์",
    adverb: "คำกริยาวิเศษณ์",
    noun: "คำนาม",
    v: "คำกริยา",
    verb: "คำกริยา",
    prep: "คำบุพบท",
    preposition: "คำบุพบท",
    conj: "คำสันธาน",
    pron: "คำสรรพนาม",
    pronoun: "คำสรรพนาม",
  },
  stage: {
    definition: "ความหมาย",
    usage: "ในประโยค",
    anticipation: "ทายดูสิ!",
    letters: "นับตัวอักษร",
    lettersText: "มี {count} ตัวอักษร เริ่มต้นด้วย {initial}",
    reveal: "นี่ไง!",
    lead: {
      detective: "บริบท",
      speed: "พร้อมหรือยัง?",
      confession: "คุ้นไหม?",
      minimal: "ความคิดหนึ่ง",
    },
  },
};

/** Japanese overlay. Rough translations; correctness not asserted. */
const JA: LabelSet = {
  topics: {
    attention: "注意",
    character: "性格",
    communication: "コミュニケーション",
    daily: "日常",
    emotion: "感情",
    thinking: "思考",
    time: "時間",
    work: "仕事",
  },
  themes: {
    "midnight-magenta": "真夜中のマゼンタ",
    "deep-lagoon": "深いラグーン",
    "forest-ember": "森の残り火",
    "indigo-dusk": "インディゴの夕暮れ",
    "olive-brass": "オリーブと真鍮",
    "plum-orchid": "プラムと蘭",
    "slate-cyan": "スレートとシアン",
    "obsidian-lime": "黒曜石とライム",
    "teal-sunrise": "ティールの夜明け",
    "cobalt-flare": "コバルトの閃光",
    "rose-quartz": "ローズクォーツ",
    "morning-mint": "朝のミント",
    "azure-linen": "紺碧のリネン",
    "paper-amber": "紙と琥珀",
    "apple-frost": "アップルフロスト",
    "apple-sand": "アップルサンド",
    "apple-graphite": "アップルグラファイト",
    "apple-twilight": "アップルトワイライト",
    "obsidian-vault": "黒曜石の蔵",
    "phantom-rose": "幻の薔薇",
    "ink-wash": "水墨",
    "midnight-ember": "真夜中の残り火",
    "vermillion-jade": "朱と翡翠",
    "ink-bamboo": "墨と竹",
    "lotus-gold": "蓮と金",
    "indigo-porcelain": "藍の磁器",
  },
  styles: {
    detective: "探偵",
    speed: "スピード",
    confession: "告白",
    minimal: "ミニマル",
  },
  pos: {
    adj: "形容詞",
    adjective: "形容詞",
    adv: "副詞",
    adverb: "副詞",
    noun: "名詞",
    v: "動詞",
    verb: "動詞",
    prep: "前置詞",
    preposition: "前置詞",
    conj: "接続詞",
    pron: "代名詞",
    pronoun: "代名詞",
  },
  stage: {
    definition: "意味",
    usage: "例文",
    anticipation: "当ててみて！",
    letters: "文字数",
    lettersText: "{count} 文字、{initial} で始まる",
    reveal: "これだ！",
    lead: {
      detective: "状況",
      speed: "準備はいい？",
      confession: "見覚えある？",
      minimal: "ひとつの想い",
    },
  },
};

/** Locale → label set. Stub locales fall back to Vietnamese via the helpers below. */
export const LOCALE_LABELS: Record<Locale, LabelSet> = {
  vi: VI,
  th: TH,
  ja: JA,
  zh: { topics: {}, themes: {}, styles: {}, pos: {}, stage: emptyStage() },
  ko: { topics: {}, themes: {}, styles: {}, pos: {}, stage: emptyStage() },
  fil: { topics: {}, themes: {}, styles: {}, pos: {}, stage: emptyStage() },
};

function emptyStage(): LabelSet["stage"] {
  return {
    definition: "",
    usage: "",
    anticipation: "",
    letters: "",
    lettersText: "",
    reveal: "",
    lead: { detective: "", speed: "", confession: "", minimal: "" },
  };
}

/** Topic name, falling back to Vietnamese then to the slug itself. */
export function topicLabel(topic: string, locale: Locale = DEFAULT_LOCALE): string {
  return LOCALE_LABELS[locale].topics[topic] ?? VI.topics[topic] ?? topic;
}

/** Theme name, falling back to Vietnamese then to the palette's own label. */
export function themeLabel(id: string, fallback: string, locale: Locale = DEFAULT_LOCALE): string {
  return LOCALE_LABELS[locale].themes[id] ?? VI.themes[id] ?? fallback;
}

/** Narrative style name, falling back to Vietnamese then to the preset's own label. */
export function styleLabel(id: string, fallback: string, locale: Locale = DEFAULT_LOCALE): string {
  return LOCALE_LABELS[locale].styles[id] ?? VI.styles[id] ?? fallback;
}

/** Part-of-speech label, falling back to Vietnamese then to the stored code. */
export function posLabel(pos: string, locale: Locale = DEFAULT_LOCALE): string {
  const key = pos.toLowerCase();
  return LOCALE_LABELS[locale].pos[key] ?? VI.pos[key] ?? pos;
}

/** Stage (page) label for a given role, falling back to Vietnamese. */
export function stageLabel(
  role: "definition" | "usage" | "anticipation" | "letters" | "reveal",
  locale: Locale = DEFAULT_LOCALE,
): string {
  return LOCALE_LABELS[locale].stage[role] || VI.stage[role];
}

/** Filled letter-count sentence ("Gồm N chữ cái…"), localized, falling back to Vietnamese. */
export function lettersSentence(
  count: number,
  initial: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const template = LOCALE_LABELS[locale].stage.lettersText || VI.stage.lettersText;
  return template.replace("{count}", String(count)).replace("{initial}", initial);
}

/** Lead-page label, which depends on the narrative style. */
export function leadLabel(style: NarrativeStyle, locale: Locale = DEFAULT_LOCALE): string {
  return LOCALE_LABELS[locale].stage.lead[style] || VI.stage.lead[style];
}
