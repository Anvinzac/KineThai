/**
 * JSON for readers, not developers. `JsonView` draws parsed data as decorated tables:
 * an object is a field list with friendly Vietnamese labels, a list of objects is a grid
 * whose columns are their fields, short lists are chips, and each value type has its own
 * colour. `CodeView` is the fallback for text that does not parse: highlighted, numbered
 * lines with roomy spacing.
 *
 * Exports: JsonView, CodeView
 * Depends on: ../lib/word-joiner, vocabulary.css (.vocab-json*)
 */
import { Fragment, useState, type ReactNode } from "react";
import { encodeWordJoiners } from "../lib/word-joiner";

const FIELD_LABELS: Record<string, string> = {
  meta: "Thông tin gói",
  name: "Tên gói",
  revision: "Phiên bản",
  words: "Danh sách từ",
  id: "Mã",
  word: "Từ",
  level: "Cấp độ",
  pos: "Từ loại",
  ipa: "Phát âm",
  kana: "Đọc katakana",
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
};

/** Slug-like fields keep their underscores; reader text shows joins as the reader sees them. */
const LITERAL_KEYS = new Set([
  "id",
  "topic",
  "topics",
  "exams",
  "level",
  "pos",
  "ipa",
  "kana",
  "style",
]);
const GRID_ROW_LIMIT = 300;
const CHIP_LIMIT = 8;

const JP_LEVEL_LABELS: Record<string, string> = {
  JPRIM: "Tiểu học",
  JSEC: "THCS",
  JHIGH: "THPT",
  JCOLL: "Đại học",
};

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isRecord = (v: Json): v is { [key: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isScalar = (v: Json) => v === null || typeof v !== "object";

function FieldLabel({ name }: { name: string }) {
  const japaneseLevel = JP_LEVEL_LABELS[name];
  const label = FIELD_LABELS[name];
  return (
    <span className="vocab-json-key">
      {japaneseLevel ?? label ?? name}
      {label && !japaneseLevel && <code>{name}</code>}
    </span>
  );
}

function Scalar({ value, field }: { value: Json; field?: string }) {
  if (value === null) return <span className="vocab-json-null">trống</span>;
  if (typeof value === "boolean")
    return <span className="vocab-json-bool">{value ? "có" : "không"}</span>;
  if (typeof value === "number") return <span className="vocab-json-num">{value}</span>;
  const text = String(value);
  if (!text) return <span className="vocab-json-null">—</span>;
  if (/^(?:⟨.*⟩|<.*>)$/.test(text))
    return <span className="vocab-json-slot">{text.slice(1, -1)}</span>;
  if (field === "word")
    return <strong className="vocab-json-word">{encodeWordJoiners(text)}</strong>;
  if (JP_LEVEL_LABELS[text] || field === "level")
    return <span className="vocab-json-level">{JP_LEVEL_LABELS[text] ?? text}</span>;
  if (field === "ipa") return <code className="vocab-json-ipa">{text}</code>;
  if (field === "kana")
    return (
      <span className="vocab-json-kana" lang="ja">
        {text}
      </span>
    );
  if (field && LITERAL_KEYS.has(field)) return <span className="vocab-json-slug">{text}</span>;
  return <span className="vocab-json-str">{encodeWordJoiners(text)}</span>;
}

function Chips({ items, field }: { items: Json[]; field?: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, CHIP_LIMIT);
  return (
    <ul className="vocab-json-chips">
      {shown.map((item, i) => (
        <li key={i}>
          <Scalar value={item} field={field} />
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
}: {
  record: { [key: string]: Json };
  notes?: Record<string, string>;
  depth: number;
}) {
  return (
    <dl className="vocab-json-fields" data-depth={depth}>
      {Object.entries(record).map(([key, value]) => (
        <Fragment key={key}>
          <dt>
            <FieldLabel name={key} />
          </dt>
          <dd>
            <Value value={value} field={key} depth={depth + 1} notes={notes} />
            {notes?.[key] && <p className="vocab-json-note">{notes[key]}</p>}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Grid({ rows, depth }: { rows: { [key: string]: Json }[]; depth: number }) {
  const [limit, setLimit] = useState(GRID_ROW_LIMIT);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <div className="vocab-json-grid-wrap">
      <table className="vocab-json-grid">
        <thead>
          <tr>
            <th aria-label="Số thứ tự" />
            {columns.map((c) => (
              <th key={c}>
                <FieldLabel name={c} />
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
                  {c in row ? <Value value={row[c]} field={c} depth={depth + 1} /> : null}
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
          Hiện thêm · {limit.toLocaleString()} / {rows.length.toLocaleString()} mục
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
}: {
  value: Json;
  field?: string;
  depth: number;
  notes?: Record<string, string>;
}): ReactNode {
  if (isScalar(value)) return <Scalar value={value} field={field} />;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="vocab-json-null">—</span>;
    if (value.every(isScalar)) return <Chips items={value} field={field} />;
    if (value.every(isRecord)) {
      return depth === 0 || (depth === 1 && value.length > 2) ? (
        <Grid rows={value} depth={depth} />
      ) : (
        <div className="vocab-json-stack">
          {value.map((item, i) => (
            <Fields key={i} record={item} depth={depth} />
          ))}
        </div>
      );
    }
    return (
      <div className="vocab-json-stack">
        {value.map((item, i) => (
          <div key={i}>
            <Value value={item} field={field} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  return <Fields record={value} notes={notes} depth={depth} />;
}

/**
 * @param value - parsed JSON
 * @param notes - optional per-field explanations shown under a value (keyed by field name)
 */
export function JsonView({ value, notes }: { value: unknown; notes?: Record<string, string> }) {
  return (
    <div className="vocab-json">
      <Value value={value as Json} depth={0} notes={notes} />
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
