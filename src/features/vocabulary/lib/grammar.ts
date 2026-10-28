/**
 * The grammar of a word in its own language: plural, gender, conjugation class and
 * principal forms, the case or particle it governs, counters, honorifics, Sino-Vietnamese
 * readings, and the one trap a beginner falls into. It feeds the collapsed grammar
 * section at the foot of the meaning panel.
 *
 * Three shapes, one table:
 *   • A generated deck writes every field FLAT on the card, `null` where it does not
 *     apply (gen-rules-{de,fr,es}.md v3; ko/ja/zh in docs/word-grammar-fields.md).
 *   • normalizeDeck folds them into ONE optional `word.grammar` object with every null
 *     dropped, so the served catalog carries nothing for a word without grammar and the
 *     panel has one thing to test.
 *   • `grammarRows` turns that object into labelled display rows. Grammar terms inside
 *     values are written in the target language ("stark", "passé composé", "ㅂ 불규칙"),
 *     so object keys are already their own native labels; this file only adds the
 *     UI-locale gloss beside them. A new key needs a gloss entry here, never new UI.
 *
 * Exports: GRAMMAR_KEYS, grammarSchema, deckGrammarFields, foldGrammar, grammarRows,
 *   grammarHint, types WordGrammar, GrammarRow
 * Depends on: zod, ./locale, ./target-language (type)
 */
import { z } from "zod";
import type { Locale } from "./locale";
import type { TargetLocale } from "./target-language";

const line = z.string().trim().min(1).max(200);
/** A paradigm: native form label → form ("Präteritum" → "er kam an"). */
const formTable = z.record(z.string().trim().min(1).max(40), line);
/** verbInfo: native sub-key → a value, a paradigm, or null where it does not apply. */
const infoTable = z.record(z.string().trim().min(1).max(40), z.union([line, formTable]).nullable());
const collocation = z.object({ text: line, vi: z.string().trim().max(200).optional() });

/**
 * Every grammar field, in the order the panel shows it.
 */
const GRAMMAR_SHAPE = {
  gender: z.enum(["m", "f", "n"]),
  article: z.string().trim().min(1).max(8),
  feminine: line,
  plural: line,
  comparison: line,
  hAspire: z.enum(["h aspiré", "h muet"]),
  counter: line,
  hanja: line,
  traditional: line,
  hanViet: line,
  verbInfo: infoTable,
  reflexive: line,
  governs: line,
  serEstar: line,
  honorific: formTable,
  reduplication: line,
  collocations: z.array(collocation).min(1).max(4),
  tipVi: line,
} as const;

type Shape = typeof GRAMMAR_SHAPE;
export type GrammarKey = keyof Shape;
export const GRAMMAR_KEYS = Object.keys(GRAMMAR_SHAPE) as GrammarKey[];

/** The compiled form: every key optional, never null. */
export const grammarSchema = z.object(GRAMMAR_SHAPE).partial();
export type WordGrammar = z.infer<typeof grammarSchema>;

/**
 * The flat deck form, spread into the word schema. `null` (and a stray "") means "does
 * not apply", exactly as the generation rules write it.
 */
export const deckGrammarFields = Object.fromEntries(
  GRAMMAR_KEYS.map((key) => [
    key,
    z.preprocess(
      (value) => (value === "" ? null : value),
      GRAMMAR_SHAPE[key].nullable().optional(),
    ),
  ]),
) as unknown as { [K in GrammarKey]: z.ZodType<z.infer<Shape[K]> | null | undefined> };

/** Drop nulls (verbInfo's `trennbar: null`) and anything left empty by doing so. */
function prune(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  if (Array.isArray(value)) return value.length ? value : undefined;
  if (typeof value === "object") {
    const kept = Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => [key, prune(inner)] as const)
      .filter(([, inner]) => inner !== undefined);
    return kept.length ? Object.fromEntries(kept) : undefined;
  }
  return value;
}

/**
 * Gather a parsed deck word's grammar into one object.
 * @param entry - a parsed word: flat deck fields and/or an already compiled `grammar`
 * @returns The grammar with nulls dropped, or undefined when nothing applies. A flat
 *   field wins over the same key in `grammar`, so re-importing a compiled pack with a
 *   corrected flat value takes the correction.
 * @pure true
 */
export function foldGrammar(
  entry: Partial<Record<GrammarKey, unknown>> & { grammar?: WordGrammar },
): WordGrammar | undefined {
  const merged: Record<string, unknown> = { ...entry.grammar };
  for (const key of GRAMMAR_KEYS) {
    if (entry[key] !== undefined) merged[key] = entry[key];
  }
  // Rebuilt in table order, so the stored object always reads in display order.
  const ordered = Object.fromEntries(
    GRAMMAR_KEYS.map((key) => [key, prune(merged[key])]).filter(([, value]) => value !== undefined),
  );
  return Object.keys(ordered).length ? (ordered as WordGrammar) : undefined;
}

// ── Display ─────────────────────────────────────────────────────────────────────

/** Vietnamese gloss of each field, the same in every language. */
const FIELD_VI: Record<GrammarKey, string> = {
  gender: "giống",
  article: "mạo từ",
  feminine: "giống cái",
  plural: "số nhiều",
  comparison: "so sánh",
  hAspire: "âm h",
  counter: "lượng từ",
  hanja: "chữ Hán",
  traditional: "phồn thể",
  hanViet: "âm Hán Việt",
  verbInfo: "cách chia",
  reflexive: "phản thân",
  governs: "đi kèm",
  serEstar: "ser hay estar",
  honorific: "kính ngữ",
  reduplication: "lặp từ",
  collocations: "cụm hay gặp",
  tipVi: "lưu ý",
};

/** Japanese gloss of each field. */
const FIELD_JA: Record<GrammarKey, string> = {
  gender: "性",
  article: "冠詞",
  feminine: "女性形",
  plural: "複数形",
  comparison: "比較変化",
  hAspire: "h音",
  counter: "助数詞",
  hanja: "漢字",
  traditional: "繁体字",
  hanViet: "漢越音",
  verbInfo: "活用",
  reflexive: "再帰形",
  governs: "結合・格支配",
  serEstar: "ser と estar",
  honorific: "敬語",
  reduplication: "畳語",
  collocations: "連語・表現",
  tipVi: "ワンポイント",
};

/** Thai gloss of each field. */
const FIELD_TH: Record<GrammarKey, string> = {
  gender: "เพศ",
  article: "คำนำหน้านาม",
  feminine: "เพศหญิง",
  plural: "พหูพจน์",
  comparison: "การเปรียบเทียบ",
  hAspire: "เสียง h",
  counter: "ลักษณนาม",
  hanja: "ตัวจีน",
  traditional: "ตัวเต็ม",
  hanViet: "เสียงฮ้านเหวียด",
  verbInfo: "การผัน",
  reflexive: "สะท้อนกลับ",
  governs: "ใช้คู่กับ",
  serEstar: "ser หรือ estar",
  honorific: "คำราชาศัพท์/สุภาพ",
  reduplication: "คำซ้ำ",
  collocations: "วลีที่ใช้บ่อย",
  tipVi: "ข้อควรระวัง",
};

/** Each field's name as that language's own textbook writes it. */
const FIELD_NATIVE: Partial<Record<TargetLocale, Partial<Record<GrammarKey, string>>>> = {
  de: {
    gender: "Genus",
    plural: "Plural",
    comparison: "Steigerung",
    reflexive: "reflexiv",
    governs: "Rektion",
    collocations: "Wendungen",
    tipVi: "Achtung",
  },
  fr: {
    gender: "genre",
    feminine: "féminin",
    plural: "pluriel",
    comparison: "comparatif",
    hAspire: "h",
    reflexive: "pronominal",
    governs: "construction",
    collocations: "expressions",
    tipVi: "attention",
  },
  es: {
    gender: "género",
    feminine: "femenino",
    plural: "plural",
    comparison: "comparativo",
    reflexive: "pronominal",
    governs: "régimen",
    serEstar: "ser / estar",
    collocations: "expresiones",
    tipVi: "ojo",
  },
  ko: {
    counter: "단위 명사",
    hanja: "한자",
    governs: "문형",
    honorific: "높임말",
    collocations: "자주 쓰는 표현",
    tipVi: "주의",
  },
  ja: {
    counter: "助数詞",
    governs: "文型",
    honorific: "敬語",
    collocations: "よく使う表現",
    tipVi: "注意",
  },
  zh: {
    counter: "量词",
    traditional: "繁体",
    governs: "句型",
    reduplication: "重叠",
    collocations: "搭配",
    tipVi: "注意",
  },
  en: {
    plural: "plural",
    comparison: "comparison",
    governs: "pattern",
    collocations: "collocations",
    tipVi: "watch out",
  },
};

/**
 * Glosses for the target-language terms that appear as verbInfo / honorific keys and
 * as enumerated values. Keys and values are written by the generator in the target
 * language, so one flat table serves every deck: the terms do not collide.
 */
const TERM_VI: Record<string, string> = {
  // de
  Konjugation: "loại",
  schwach: "yếu (có quy tắc)",
  stark: "mạnh (đổi nguyên âm)",
  gemischt: "hỗn hợp",
  unregelmäßig: "bất quy tắc",
  Hilfsverb: "trợ động từ",
  trennbar: "tiền tố tách",
  Vokalwechsel: "đổi nguyên âm",
  Stammformen: "các dạng chính",
  Präsens: "hiện tại",
  Präteritum: "quá khứ đơn",
  Perfekt: "hoàn thành",
  Nominativ: "cách 1",
  Akkusativ: "cách 4",
  Dativ: "cách 3",
  Genitiv: "cách 2",
  Infinitiv: "nguyên mẫu",
  // fr
  groupe: "nhóm",
  "1er groupe": "nhóm 1",
  "2e groupe": "nhóm 2",
  "3e groupe": "nhóm 3",
  conjugaison: "loại",
  régulier: "có quy tắc",
  irrégulier: "bất quy tắc",
  auxiliaire: "trợ động từ",
  radical: "đổi gốc",
  temps: "các thì chính",
  présent: "hiện tại",
  "passé composé": "quá khứ kép",
  "futur simple": "tương lai đơn",
  "h aspiré": "h bật hơi, không nối âm",
  "h muet": "h câm, có nối âm",
  infinitif: "nguyên mẫu",
  // es
  conjugación: "loại",
  regular: "có quy tắc",
  irregular: "bất quy tắc",
  raíz: "đổi gốc",
  tiempos: "các dạng chính",
  presente: "hiện tại",
  pretérito: "quá khứ đơn",
  participio: "phân từ",
  gerundio: "tiếp diễn",
  infinitivo: "nguyên mẫu",
  // ko
  활용: "kiểu chia",
  규칙: "có quy tắc",
  "ㅂ 불규칙": "bất quy tắc ㅂ",
  "ㄷ 불규칙": "bất quy tắc ㄷ",
  "ㅅ 불규칙": "bất quy tắc ㅅ",
  "ㅎ 불규칙": "bất quy tắc ㅎ",
  "르 불규칙": "bất quy tắc 르",
  "ㄹ 탈락": "rụng ㄹ",
  "으 탈락": "rụng 으",
  활용형: "các dạng chia",
  현재: "hiện tại",
  과거: "quá khứ",
  관형형: "định ngữ",
  높임말: "kính ngữ",
  // ja
  種類: "nhóm",
  五段動詞: "nhóm 1",
  一段動詞: "nhóm 2",
  カ変動詞: "nhóm 3, bất quy tắc",
  サ変動詞: "nhóm 3, đuôi する",
  い形容詞: "tính từ đuôi い",
  な形容詞: "tính từ đuôi な",
  自他: "nội / ngoại",
  自動詞: "nội động từ",
  他動詞: "ngoại động từ",
  活用形: "các thể",
  ます形: "thể lịch sự",
  て形: "thể て",
  ない形: "phủ định",
  た形: "quá khứ",
  否定: "phủ định",
  過去: "quá khứ",
  尊敬語: "tôn kính",
  謙譲語: "khiêm nhường",
  // zh
  离合词: "từ ly hợp",
};

const TERM_JA: Record<string, string> = {
  // de
  Konjugation: "活用型",
  schwach: "弱変化（規則）",
  stark: "強変化（母音交替）",
  gemischt: "混合変化",
  unregelmäßig: "不規則変化",
  Hilfsverb: "助動詞",
  trennbar: "分離前綴り",
  Vokalwechsel: "幹母音変化",
  Stammformen: "三基本形",
  Präsens: "現在形",
  Präteritum: "過去形",
  Perfekt: "完了形",
  Nominativ: "1格（主格）",
  Akkusativ: "4格（対格）",
  Dativ: "3格（与格）",
  Genitiv: "2格（属格）",
  Infinitiv: "不定詞",
  // fr
  groupe: "群",
  "1er groupe": "第1群",
  "2e groupe": "第2群",
  "3e groupe": "第3群",
  conjugaison: "活用型",
  régulier: "規則動詞",
  irrégulier: "不規則動詞",
  auxiliaire: "助動詞",
  radical: "語幹変化",
  temps: "主要時制",
  présent: "現在形",
  "passé composé": "複合過去",
  "futur simple": "単純未来",
  "h aspiré": "有音のh（エリジオン・リエゾン不可）",
  "h muet": "無音のh（エリジオン・リエゾン可）",
  infinitif: "不定詞",
  // es
  conjugación: "活用型",
  regular: "規則動詞",
  irregular: "不規則動詞",
  raíz: "語幹母音変化",
  tiempos: "主要活用形",
  presente: "現在形",
  pretérito: "点過去",
  participio: "過去分詞",
  gerundio: "現在分詞",
  infinitivo: "不定詞",
  // ko
  활용: "活用型",
  규칙: "規則活用",
  "ㅂ 불규칙": "ㅂ変格活用",
  "ㄷ 불규칙": "ㄷ変格活用",
  "ㅅ 불규칙": "ㅅ変格活用",
  "ㅎ 불규칙": "ㅎ変格活用",
  "르 불규칙": "르変格活用",
  "ㄹ 탈락": "ㄹ脱落",
  "으 탈락": "으脱落",
  활용형: "主な活用形",
  현재: "現在形",
  과거: "過去形",
  관형형: "連体形",
  높임말: "敬語",
  // ja
  種類: "活用種別",
  五段動詞: "五段活用（Iグループ）",
  一段動詞: "一段活用（IIグループ）",
  カ変動詞: "カ行変格活用（IIIグループ）",
  サ変動詞: "サ行変格活用（IIIグループ）",
  い形容詞: "イ形容詞",
  な形容詞: "ナ形容詞",
  自他: "自他",
  自動詞: "自動詞",
  他動詞: "他動詞",
  活用形: "主な活用形",
  ます形: "丁寧形（ます形）",
  て形: "テ形",
  ない形: "否定形（ナイ形）",
  た形: "過去形（タ形）",
  否定: "否定形",
  過去: "過去形",
  尊敬語: "尊敬語",
  謙譲語: "謙譲語",
  // zh
  离合词: "離合詞",
};

const TERM_TH: Record<string, string> = {
  Konjugation: "ประเภทการผัน",
  schwach: "ผันปกติ",
  stark: "ผันเปลี่ยนสระ",
  gemischt: "ผันผสม",
  unregelmäßig: "ผันไม่ปกติ",
  Hilfsverb: "กริยาช่วย",
  trennbar: "คำอุปสรรคแยกได้",
  Vokalwechsel: "เปลี่ยนสระ",
  Stammformen: "รูปหลัก",
  Präsens: "ปัจจุบันกาล",
  Präteritum: "อดีตกาล",
  Perfekt: "สมบูรณ์กาล",
  Nominativ: "กรรตุการก",
  Akkusativ: "กรรมการก",
  Dativ: "สัมปทานการก",
  Genitiv: "สัมพันธการก",
  Infinitiv: "รูปไม่ผัน",
  groupe: "กลุ่ม",
  "1er groupe": "กลุ่ม 1",
  "2e groupe": "กลุ่ม 2",
  "3e groupe": "กลุ่ม 3",
  conjugaison: "ประเภทการผัน",
  régulier: "ผันปกติ",
  irrégulier: "ผันไม่ปกติ",
  auxiliaire: "กริยาช่วย",
  radical: "เปลี่ยนรากศัพท์",
  temps: "กาลหลัก",
  présent: "ปัจจุบันกาล",
  "passé composé": "อดีตสมบูรณ์",
  "futur simple": "อนาคตกาล",
  "h aspiré": "h ออกเสียง (ไม่เชื่อมเสียง)",
  "h muet": "h ไม่ออกเสียง (เชื่อมเสียง)",
  infinitif: "รูปไม่ผัน",
  conjugación: "ประเภทการผัน",
  regular: "ผันปกติ",
  irregular: "ผันไม่ปกติ",
  raíz: "เปลี่ยนรากศัพท์",
  tiempos: "รูปหลัก",
  presente: "ปัจจุบันกาล",
  pretérito: "อดีตกาล",
  participio: "กริยาช่อง 3",
  gerundio: "กริยากำลังกระทำ",
  infinitivo: "รูปไม่ผัน",
  활용: "รูปแบบการผัน",
  규칙: "ผันปกติ",
  "ㅂ 불규칙": "ผันไม่ปกติ ㅂ",
  "ㄷ 불규칙": "ผันไม่ปกติ ㄷ",
  "ㅅ 불규칙": "ผันไม่ปกติ ㅅ",
  "ㅎ 불규칙": "ผันไม่ปกติ ㅎ",
  "르 불규칙": "ผันไม่ปกติ 르",
  "ㄹ 탈락": "ตัด ㄹ",
  "으 탈락": "ตัด 으",
  활용형: "รูปผันหลัก",
  현재: "ปัจจุบัน",
  과거: "อดีต",
  관형형: "รูปขยายนาม",
  높임말: "คำสุภาพ",
  種類: "กลุ่มคำ",
  五段動詞: "กริยากลุ่ม 1",
  一段動詞: "กริยากลุ่ม 2",
  カ変動詞: "กริยากลุ่ม 3 (ไม่ปกติ)",
  サ変動詞: "กริยากลุ่ม 3 (ลงท้าย する)",
  い形容詞: "คุณศัพท์ い",
  な形容詞: "คุณศัพท์ な",
  自他: "อกรรม / สกรรม",
  自動詞: "อกรรมกริยา",
  他動詞: "สกรรมกริยา",
  活用形: "รูปผันหลัก",
  ます形: "รูปสุภาพ (ます)",
  て形: "รูป て",
  ない形: "รูปปฏิเสธ (ない)",
  た形: "รูปอดีต (た)",
  否定: "ปฏิเสธ",
  過去: "อดีต",
  尊敬語: "คำยกย่อง",
  謙譲語: "คำถ่อมตัว",
  离合词: "คำแยกประกอบได้",
};

const GENDER_VI = { m: "giống đực", f: "giống cái", n: "giống trung" } as const;
const GENDER_JA = { m: "男性名詞", f: "女性名詞", n: "中性名詞" } as const;
const GENDER_TH = { m: "เพศชาย", f: "เพศหญิง", n: "เพศกลาง" } as const;

function fieldMap(uiLocale: Locale): Record<GrammarKey, string> {
  if (uiLocale === "ja") return FIELD_JA;
  if (uiLocale === "th") return FIELD_TH;
  return FIELD_VI;
}

function termMap(uiLocale: Locale): Record<string, string> {
  if (uiLocale === "ja") return TERM_JA;
  if (uiLocale === "th") return TERM_TH;
  return TERM_VI;
}

function genderMap(uiLocale: Locale): Record<"m" | "f" | "n", string> {
  if (uiLocale === "ja") return GENDER_JA;
  if (uiLocale === "th") return GENDER_TH;
  return GENDER_VI;
}

/** Values whose head is an enumerated term: "他動詞 ↔ 開く", "e → i : er hilft". */
function termGloss(value: string, uiLocale: Locale): string | undefined {
  const map = termMap(uiLocale);
  return map[value] ?? map[value.split(/\s+(?:↔|:)\s+/)[0]!.trim()];
}

/** Every known term named inside a construction ("jemandem (Dativ) etwas (Akkusativ)"). */
function namedTerms(value: string, uiLocale: Locale): string | undefined {
  const map = termMap(uiLocale);
  const found = Object.keys(TERM_VI)
    .map((term) => ({
      term,
      at: value.search(new RegExp(`(?<![\\p{L}])${term}(?![\\p{L}])`, "u")),
    }))
    .filter(({ at }) => at !== -1)
    .sort((a, b) => a.at - b.at);
  const glosses = [...new Set(found.map(({ term }) => map[term] ?? TERM_VI[term]!))];
  return glosses.length ? glosses.join(" · ") : undefined;
}

type Label = { label: string; gloss?: string };
export type GrammarForm = Label & { value: string };
export type GrammarRow = Label &
  (
    | { kind: "line"; key: string; value: string; valueGloss?: string }
    | { kind: "table"; key: string; forms: GrammarForm[] }
    | { kind: "list"; key: string; items: { text: string; vi?: string }[] }
    | { kind: "tip"; key: string; value: string }
  );

/** A field's label: the native term with the UI-locale gloss, or the gloss alone. */
function fieldLabel(key: GrammarKey, locale: TargetLocale, uiLocale: Locale): Label {
  const native = FIELD_NATIVE[locale]?.[key];
  const gloss = fieldMap(uiLocale)[key];
  return native ? { label: native, gloss } : { label: gloss };
}

/** A verbInfo / honorific key is already its native label. */
function termLabel(key: string, uiLocale: Locale): Label {
  return { label: key, gloss: termMap(uiLocale)[key] };
}

/**
 * Lay a word's grammar out as display rows, in table order.
 * @param grammar - the word's folded grammar
 * @param locale - the deck language, which picks the native field names
 * @param uiLocale - reader UI locale for glosses (defaults to "vi" for base compatibility)
 * @returns One row per field; gender and article share a row, verbInfo's scalar entries
 *   become rows of their own and its paradigm a table, the trap note comes last.
 * @pure true
 */
export function grammarRows(
  grammar: WordGrammar,
  locale: TargetLocale,
  uiLocale: Locale = "vi",
): GrammarRow[] {
  const rows: GrammarRow[] = [];
  for (const key of GRAMMAR_KEYS) {
    const value = grammar[key];
    if (value === undefined) continue;
    switch (key) {
      case "article":
        if (!grammar.gender)
          rows.push({
            kind: "line",
            key,
            ...fieldLabel("gender", locale, uiLocale),
            value: value as string,
          });
        break;
      case "gender": {
        const gender = value as keyof typeof GENDER_VI;
        rows.push({
          kind: "line",
          key,
          ...fieldLabel("gender", locale, uiLocale),
          value: grammar.article ?? gender,
          valueGloss: genderMap(uiLocale)[gender],
        });
        break;
      }
      case "verbInfo":
      case "honorific":
        for (const [term, inner] of Object.entries(value as Record<string, unknown>)) {
          if (typeof inner === "string") {
            rows.push({
              kind: "line",
              key: `${key}.${term}`,
              ...termLabel(term, uiLocale),
              value: inner,
              valueGloss: termGloss(inner, uiLocale),
            });
          } else if (inner && typeof inner === "object") {
            rows.push({
              kind: "table",
              key: `${key}.${term}`,
              ...termLabel(term, uiLocale),
              forms: Object.entries(inner as Record<string, string>).map(([form, text]) => ({
                ...termLabel(form, uiLocale),
                value: text,
              })),
            });
          }
        }
        break;
      case "collocations":
        rows.push({
          kind: "list",
          key,
          ...fieldLabel(key, locale, uiLocale),
          items: value as { text: string; vi?: string }[],
        });
        break;
      case "tipVi":
        rows.push({
          kind: "tip",
          key,
          ...fieldLabel(key, locale, uiLocale),
          value: value as string,
        });
        break;
      default: {
        const text = value as string;
        rows.push({
          kind: "line",
          key,
          ...fieldLabel(key, locale, uiLocale),
          value: text,
          valueGloss: key === "governs" ? namedTerms(text, uiLocale) : termGloss(text, uiLocale),
        });
      }
    }
  }
  return rows;
}

/**
 * What the closed section promises: the UI-locale names of its first few rows.
 * @param rows - the section's rows
 * @param limit - max row names to preview
 * @param uiLocale - reader UI locale (defaults to "vi")
 * @returns e.g. "số nhiều · cách chia · đi kèm" or "複数形 · 活用 · 結合・格支配"
 * @pure true
 */
export function grammarHint(rows: GrammarRow[], limit = 3, uiLocale: Locale = "vi"): string {
  const fields = fieldMap(uiLocale);
  const names = rows
    .filter((row) => row.kind !== "tip")
    .map((row) => {
      const field = row.key.split(".")[0] as GrammarKey;
      return fields[field] ?? row.gloss ?? row.label;
    });
  return [...new Set(names)].slice(0, limit).join(" · ");
}
