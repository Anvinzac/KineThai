/**
 * Full-screen, read-only preview of a JSON pack picked in the import panel. A pack that
 * validates is laid out as a sortable, searchable word table (TanStack Table, rows
 * virtualized with TanStack Virtual so 100k-word decks stay smooth); one that does not
 * shows the validation error over the file's own data. The second tab shows the file as
 * written, through JsonView's reader tables.
 *
 * Exports: PackPreviewDialog
 * Depends on: @tanstack/react-table, @tanstack/react-virtual, ./FullscreenSheet, ./JsonView,
 *   ../lib/custom-pack, ../lib/word-joiner, ../lib/schema, ../lib/locale, ../lib/useLocale
 */
import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown, FileJson, Play, Search } from "lucide-react";
import { localizeCustomPackError, parseCustomPack, type CustomPack } from "../lib/custom-pack";
import { localeCopy, type Locale } from "../lib/locale";
import { resolveClue } from "../lib/clues";
import { useLocale } from "../lib/useLocale";
import { withWordJoiners } from "../lib/word-joiner";
import { LEVELS, type VocabularyWord } from "../lib/schema";
import { FullscreenSheet } from "./FullscreenSheet";
import { CodeView, JsonView } from "./JsonView";

const RAW_LIMIT = 200_000;

type Row = VocabularyWord & { n: number };

const levelRank = (level?: string) => {
  const i = LEVELS.indexOf(level as (typeof LEVELS)[number]);
  return i < 0 ? LEVELS.length : i;
};

const COPY: Partial<Record<
  Locale,
  {
    wordCol: string;
    levelCol: string;
    defCol: string;
    topicsCol: string;
    usageCol: string;
    moreExamples: (n: number) => string;
    searchPlaceholder: string;
    searchAria: string;
    noMatches: (query: string) => string;
    defaultImportLabel: string;
    invalidPack: string;
    wordsCount: (count: string) => string;
    viewTypeAria: string;
    tableTab: string;
    jsonTab: string;
  }
>> = {
  vi: {
    wordCol: "Từ",
    levelCol: "Cấp độ",
    defCol: "Nghĩa",
    topicsCol: "Chủ đề",
    usageCol: "Ví dụ",
    moreExamples: (n) => `+${n} ví dụ`,
    searchPlaceholder: "Tìm từ, nghĩa, chủ đề…",
    searchAria: "Tìm trong gói",
    noMatches: (q) => `Không có từ nào khớp “${q}”.`,
    defaultImportLabel: "Nhập gói này",
    invalidPack: "Gói không hợp lệ.",
    wordsCount: (c) => `${c} từ`,
    viewTypeAria: "Kiểu xem",
    tableTab: "Bảng từ",
    jsonTab: "Dữ liệu gốc",
  },
  ja: {
    wordCol: "単語",
    levelCol: "レベル",
    defCol: "意味",
    topicsCol: "トピック",
    usageCol: "例文",
    moreExamples: (n) => `他 ${n} 件`,
    searchPlaceholder: "単語・意味・トピックを検索…",
    searchAria: "パック内を検索",
    noMatches: (q) => `「${q}」に一致する単語はありません。`,
    defaultImportLabel: "このパックを取り込む",
    invalidPack: "無効なパックです。",
    wordsCount: (c) => `${c} 語`,
    viewTypeAria: "表示形式",
    tableTab: "単語表",
    jsonTab: "元データ",
  },
  th: {
    wordCol: "คำศัพท์",
    levelCol: "ระดับ",
    defCol: "ความหมาย",
    topicsCol: "หัวข้อ",
    usageCol: "ตัวอย่าง",
    moreExamples: (n) => `+${n} ตัวอย่าง`,
    searchPlaceholder: "ค้นหาคำ ความหมาย หัวข้อ…",
    searchAria: "ค้นหาในชุดคำศัพท์",
    noMatches: (q) => `ไม่พบคำที่ตรงกับ “${q}”`,
    defaultImportLabel: "นำเข้าชุดนี้",
    invalidPack: "ชุดคำศัพท์ไม่ถูกต้อง",
    wordsCount: (c) => `${c} คำ`,
    viewTypeAria: "รูปแบบการดู",
    tableTab: "ตารางคำศัพท์",
    jsonTab: "ข้อมูลต้นฉบับ",
  },
};

function makeColumns(ui: Locale): ColumnDef<Row>[] {
  const copy = localeCopy(COPY, ui);
  return [
    {
      id: "n",
      header: "#",
      accessorKey: "n",
      enableGlobalFilter: false,
      cell: ({ getValue }) => <span className="vocab-preview-n">{getValue<number>()}</span>,
    },
    {
      id: "word",
      header: copy.wordCol,
      accessorFn: (w) => `${w.word} ${w.ipa ?? ""}`,
      sortingFn: (a, b) => a.original.word.localeCompare(b.original.word),
      cell: ({ row: { original: w } }) => (
        <div className="vocab-preview-word">
          <strong>{w.word}</strong>
          {(w.ipa || w.pos) && (
            <span>
              {w.ipa && <code>{w.ipa}</code>}
              {w.pos && <em>{w.pos}</em>}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "level",
      header: copy.levelCol,
      accessorFn: (w) => w.level ?? "",
      sortingFn: (a, b) => levelRank(a.original.level) - levelRank(b.original.level),
      cell: ({ row: { original: w } }) =>
        w.level ? <span className="vocab-preview-level">{w.level}</span> : null,
    },
    {
      id: "def",
      header: copy.defCol,
      accessorFn: (w) => resolveClue(w, "def", ui),
      cell: ({ getValue }) => <p className="vocab-preview-def">{getValue<string>()}</p>,
    },
    {
      id: "topics",
      header: copy.topicsCol,
      accessorFn: (w) => (w.topics?.length ? w.topics : [w.topic]).filter(Boolean).join(" "),
      enableSorting: false,
      cell: ({ row: { original: w } }) => (
        <ul className="vocab-preview-tags">
          {(w.topics?.length ? w.topics : [w.topic]).filter(Boolean).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ),
    },
    {
      id: "usage",
      header: copy.usageCol,
      accessorFn: (w) => w.usage.map((u) => `${u.en} ${u.vi}`).join(" "),
      enableSorting: false,
      cell: ({ row: { original: w } }) =>
        w.usage[0] ? (
          <div className="vocab-preview-usage">
            <p>{w.usage[0].en}</p>
            {w.usage[0].vi && <p>{w.usage[0].vi}</p>}
            {w.usage.length > 1 && <span>{copy.moreExamples(w.usage.length - 1)}</span>}
          </div>
        ) : null,
    },
  ];
}

function WordTable({ pack, ui }: { pack: CustomPack; ui: Locale }) {
  const copy = localeCopy(COPY, ui);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [query, setQuery] = useState("");
  const data = useMemo<Row[]>(
    () => withWordJoiners(pack.catalog).words.map((w, i) => ({ ...w, n: i + 1 })),
    [pack],
  );
  const columns = useMemo(() => makeColumns(ui), [ui]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76,
    overscan: 10,
  });

  return (
    <>
      <label className="vocab-preview-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder={copy.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={copy.searchAria}
        />
        {query && (
          <span className="vocab-preview-hits">
            {rows.length.toLocaleString()} / {data.length.toLocaleString()}
          </span>
        )}
      </label>
      <div ref={scrollRef} className="vocab-preview-scroll">
        <div className="vocab-preview-grid">
          <div className="vocab-preview-head" role="row">
            {table.getFlatHeaders().map((header) => {
              const sorted = header.column.getIsSorted();
              const label = flexRender(header.column.columnDef.header, header.getContext());
              return header.column.getCanSort() ? (
                <button
                  key={header.id}
                  type="button"
                  role="columnheader"
                  aria-sort={
                    sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                  }
                  data-col={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {label}
                  {sorted === "asc" ? (
                    <ArrowUp size={12} aria-hidden="true" />
                  ) : sorted === "desc" ? (
                    <ArrowDown size={12} aria-hidden="true" />
                  ) : (
                    <ChevronsUpDown size={12} aria-hidden="true" />
                  )}
                </button>
              ) : (
                <div key={header.id} role="columnheader" data-col={header.id}>
                  {label}
                </div>
              );
            })}
          </div>
          <div className="vocab-preview-body" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              return (
                <div
                  key={row.id}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="vocab-preview-row"
                  role="row"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} role="cell" data-col={cell.column.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {!rows.length && <p className="vocab-preview-empty">{copy.noMatches(query)}</p>}
        </div>
      </div>
    </>
  );
}

export function PackPreviewDialog({
  file,
  open,
  onOpenChange,
  onImport,
  importLabel,
}: {
  file: { name: string; text: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: () => void;
  /** The footer button's words: importing a picked file, or playing a pack already kept. */
  importLabel?: string;
}) {
  const ui = useLocale();
  const copy = localeCopy(COPY, ui);
  const parsed = useMemo(() => {
    try {
      return { pack: parseCustomPack(file.text, file.name), error: null };
    } catch (e) {
      return {
        pack: null,
        error: e instanceof Error ? localizeCustomPackError(e.message, ui) : copy.invalidPack,
      };
    }
  }, [file, ui, copy.invalidPack]);
  const raw = useMemo(() => {
    try {
      return { json: JSON.parse(file.text) as unknown };
    } catch {
      return null;
    }
  }, [file]);
  const [view, setView] = useState<"table" | "json">("table");

  return (
    <FullscreenSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<FileJson size={20} aria-hidden="true" />}
      title={parsed.pack?.catalog.name ?? file.name}
      subtitle={
        parsed.pack
          ? [
              copy.wordsCount(parsed.pack.catalog.count.toLocaleString()),
              parsed.pack.catalog.levels.join(" · "),
              file.name,
            ]
              .filter(Boolean)
              .join("  ·  ")
          : file.name
      }
      footer={
        parsed.pack && (
          <button type="button" className="vocab-import-btn" onClick={onImport}>
            <Play size={15} aria-hidden="true" /> {importLabel ?? copy.defaultImportLabel}
          </button>
        )
      }
    >
      {parsed.error ? (
        <p className="vocab-preview-error" role="alert">
          {parsed.error.split("\n").slice(0, 4).join("\n")}
        </p>
      ) : (
        <div
          className="vocab-import-tabs vocab-preview-tabs"
          role="tablist"
          aria-label={copy.viewTypeAria}
        >
          {(
            [
              ["table", copy.tableTab],
              ["json", copy.jsonTab],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={`vocab-import-tab${view === id ? " on" : ""}`}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {parsed.pack && view === "table" ? (
        <WordTable pack={parsed.pack} ui={ui} />
      ) : (
        <div className="vocab-preview-raw">
          {raw ? <JsonView value={raw.json} /> : <CodeView text={file.text.slice(0, RAW_LIMIT)} />}
        </div>
      )}
    </FullscreenSheet>
  );
}
