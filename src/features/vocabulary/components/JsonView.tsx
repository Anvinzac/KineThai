/**
 * JSON for readers, not developers. `JsonView` draws parsed data as decorated tables:
 * an object is a field list with friendly localized labels, a list of objects is a grid
 * whose columns are their fields, short lists are chips, and each value type has its own
 * colour. `CodeView` is the fallback for text that does not parse: highlighted, numbered
 * lines with roomy spacing.
 *
 * Exports: JsonView, CodeView
 * Depends on: ../lib/word-joiner, ../lib/locale, ../lib/useLocale, vocabulary.css (.vocab-json*)
 */
import { Fragment, useState, type ReactNode } from "react";
import { localeCopy, type Locale } from "../lib/locale";
import { useLocale } from "../lib/useLocale";
import { encodeWordJoiners } from "../lib/word-joiner";

const FIELD_LABELS: Partial<Record<Locale, Record<string, string>>> = {
  vi: {
    meta: "Thông tin gói",
    name: "Tên gói",
    revision: "Phiên bản",
    words: "Danh sách từ",
    id: "Mã",
    word: "Từ",
    level: "Cấp độ",
    pos: "Từ loại",
    ipa: "Phát âm",
    defVi: "Nghĩa",
    leadVi: "Câu dẫn",
    anticipateVi: "Gợi ý",
    topic: "Chủ đề",
    topics: "Chủ đề",
    exams: "Kỳ thi",
    style: "Phong cách",
    usage: "Ví dụ",
    en: "Câu gốc",
    vi: "Bản dịch",
    emphasis: "Nhấn mạnh",
    usageEn: "Ví dụ (gốc)",
    usageVi: "Ví dụ (dịch)",
    emphasisVi: "Nhấn mạnh",
  },
  ja: {
    meta: "パック情報",
    name: "パック名",
    revision: "バージョン",
    words: "単語リスト",
    id: "ID",
    word: "単語",
    level: "レベル",
    pos: "品詞",
    ipa: "発音",
    defVi: "意味",
    leadVi: "導入文",
    anticipateVi: "ヒント",
    topic: "トピック",
    topics: "トピック",
    exams: "試験",
    style: "スタイル",
    usage: "例文",
    en: "原文",
    vi: "訳文",
    emphasis: "強調",
    usageEn: "例文（原文）",
    usageVi: "例文（訳文）",
    emphasisVi: "強調",
  },
  th: {
    meta: "ข้อมูลชุดคำศัพท์",
    name: "ชื่อชุดคำศัพท์",
    revision: "รุ่น",
    words: "รายการคำศัพท์",
    id: "รหัส",
    word: "คำศัพท์",
    level: "ระดับ",
    pos: "ชนิดของคำ",
    ipa: "การออกเสียง",
    defVi: "ความหมาย",
    leadVi: "ประโยคนำ",
    anticipateVi: "คำใบ้",
    topic: "หัวข้อ",
    topics: "หัวข้อ",
    exams: "การสอบ",
    style: "สไตล์",
    usage: "ตัวอย่าง",
    en: "ประโยคต้นฉบับ",
    vi: "คำแปล",
    emphasis: "คำเน้น",
    usageEn: "ตัวอย่าง (ต้นฉบับ)",
    usageVi: "ตัวอย่าง (คำแปล)",
    emphasisVi: "คำเน้น",
  },
};

const COPY: Partial<Record<
  Locale,
  {
    empty: string;
    yes: string;
    no: string;
    rowIndex: string;
    showMore: (shown: string, total: string) => string;
  }
>> = {
  vi: {
    empty: "trống",
    yes: "có",
    no: "không",
    rowIndex: "Số thứ tự",
    showMore: (shown, total) => `Hiện thêm · ${shown} / ${total} mục`,
  },
  ja: {
    empty: "空",
    yes: "あり",
    no: "なし",
    rowIndex: "番号",
    showMore: (shown, total) => `さらに表示 · ${shown} / ${total} 件`,
  },
  th: {
    empty: "ว่าง",
    yes: "มี",
    no: "ไม่มี",
    rowIndex: "ลำดับ",
    showMore: (shown, total) => `แสดงเพิ่ม · ${shown} / ${total} รายการ`,
  },
};

/** Slug-like fields keep their underscores; reader text shows joins as the reader sees them. */
const LITERAL_KEYS = new Set(["id", "topic", "topics", "exams", "level", "pos", "ipa", "style"]);
const GRID_ROW_LIMIT = 300;
const CHIP_LIMIT = 8;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isRecord = (v: Json): v is { [key: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isScalar = (v: Json) => v === null || typeof v !== "object";

function FieldLabel({ name, ui }: { name: string; ui: Locale }) {
  const label = localeCopy(FIELD_LABELS, ui)[name] ?? localeCopy(FIELD_LABELS, "vi")[name];
  return (
    <span className="vocab-json-key">
      {label ?? name}
      {label && <code>{name}</code>}
    </span>
  );
}

function Scalar({ value, field, ui }: { value: Json; field?: string; ui: Locale }) {
  const copy = localeCopy(COPY, ui);
  if (value === null) return <span className="vocab-json-null">{copy.empty}</span>;
  if (typeof value === "boolean")
    return <span className="vocab-json-bool">{value ? copy.yes : copy.no}</span>;
  if (typeof value === "number") return <span className="vocab-json-num">{value}</span>;
  const text = String(value);
  if (!text) return <span className="vocab-json-null">—</span>;
  if (/^(?:⟨.*⟩|<.*>)$/.test(text))
    return <span className="vocab-json-slot">{text.slice(1, -1)}</span>;
  if (field === "word")
    return <strong className="vocab-json-word">{encodeWordJoiners(text)}</strong>;
  if (field === "level") return <span className="vocab-json-level">{text}</span>;
  if (field === "ipa") return <code className="vocab-json-ipa">{text}</code>;
  if (field && LITERAL_KEYS.has(field)) return <span className="vocab-json-slug">{text}</span>;
  return <span className="vocab-json-str">{encodeWordJoiners(text)}</span>;
}

function Chips({ items, field, ui }: { items: Json[]; field?: string; ui: Locale }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, CHIP_LIMIT);
  return (
    <ul className="vocab-json-chips">
      {shown.map((item, i) => (
        <li key={i}>
          <Scalar value={item} field={field} ui={ui} />
        </li>
      ))}
      {items.length > shown.length && (
        <li>
          <button type="button" onClick={() => setAll(true)}>
            +{items.length - shown.length}
          </button>
        </li>
      )}
    </ul>
  );
}

function Fields({
  record,
  notes,
  depth,
  ui,
}: {
  record: { [key: string]: Json };
  notes?: Record<string, string>;
  depth: number;
  ui: Locale;
}) {
  return (
    <dl className="vocab-json-fields" data-depth={depth}>
      {Object.entries(record).map(([key, value]) => (
        <Fragment key={key}>
          <dt>
            <FieldLabel name={key} ui={ui} />
          </dt>
          <dd>
            <Value value={value} field={key} depth={depth + 1} notes={notes} ui={ui} />
            {notes?.[key] && <p className="vocab-json-note">{notes[key]}</p>}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Grid({
  rows,
  depth,
  ui,
}: {
  rows: { [key: string]: Json }[];
  depth: number;
  ui: Locale;
}) {
  const [limit, setLimit] = useState(GRID_ROW_LIMIT);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const copy = localeCopy(COPY, ui);
  return (
    <div className="vocab-json-grid-wrap">
      <table className="vocab-json-grid">
        <thead>
          <tr>
            <th aria-label={copy.rowIndex} />
            {columns.map((c) => (
              <th key={c}>
                <FieldLabel name={c} ui={ui} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, i) => (
            <tr key={i}>
              <td className="vocab-json-index">{i + 1}</td>
              {columns.map((c) => (
                <td key={c} data-field={c}>
                  {c in row ? <Value value={row[c]} field={c} depth={depth + 1} ui={ui} /> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button
          type="button"
          className="vocab-json-more"
          onClick={() => setLimit((n) => n + GRID_ROW_LIMIT)}
        >
          {copy.showMore(limit.toLocaleString(), rows.length.toLocaleString())}
        </button>
      )}
    </div>
  );
}

function Value({
  value,
  field,
  depth,
  notes,
  ui,
}: {
  value: Json;
  field?: string;
  depth: number;
  notes?: Record<string, string>;
  ui: Locale;
}): ReactNode {
  if (isScalar(value)) return <Scalar value={value} field={field} ui={ui} />;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="vocab-json-null">—</span>;
    if (value.every(isScalar)) return <Chips items={value} field={field} ui={ui} />;
    if (value.every(isRecord)) {
      return depth === 0 || (depth === 1 && value.length > 2) ? (
        <Grid rows={value} depth={depth} ui={ui} />
      ) : (
        <div className="vocab-json-stack">
          {value.map((item, i) => (
            <Fields key={i} record={item} depth={depth} ui={ui} />
          ))}
        </div>
      );
    }
    return (
      <div className="vocab-json-stack">
        {value.map((item, i) => (
          <div key={i}>
            <Value value={item} field={field} depth={depth + 1} ui={ui} />
          </div>
        ))}
      </div>
    );
  }
  return <Fields record={value} notes={notes} depth={depth} ui={ui} />;
}

/**
 * @param value - parsed JSON
 * @param notes - optional per-field explanations shown under a value (keyed by field name)
 */
export function JsonView({ value, notes }: { value: unknown; notes?: Record<string, string> }) {
  const ui = useLocale();
  return (
    <div className="vocab-json">
      <Value value={value as Json} depth={0} notes={notes} ui={ui} />
    </div>
  );
}

const TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(\/\/.*$)|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b|(<[^<>\n]+>)|([{}[\],:])/g;

function highlight(line: string) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(line.slice(last, at));
    const [whole, str, colon, comment, num, lit, slot, punct] = m;
    const cls = str
      ? colon
        ? "key"
        : "str"
      : comment
        ? "comment"
        : num
          ? "num"
          : lit
            ? "bool"
            : slot
              ? "slot"
              : punct
                ? "punct"
                : "";
    out.push(
      <span key={at} className={`vocab-code-${cls}`}>
        {str && colon ? str : whole}
      </span>,
    );
    if (str && colon)
      out.push(
        <span key={`${at}:`} className="vocab-code-punct">
          {colon}
        </span>,
      );
    last = at + whole.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Highlighted, line-numbered text for content that cannot be shown as a table. */
export function CodeView({ text }: { text: string }) {
  return (
    <ol className="vocab-code">
      {text.split("\n").map((line, i) => (
        <li key={i}>{line ? highlight(line) : " "}</li>
      ))}
    </ol>
  );
}
