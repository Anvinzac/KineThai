/**
 * The reader's imported packs, as cards under the library's import row: what each pack
 * holds (word count, levels, where it came from), a peek at its first words, and what can
 * be done with it — play or stop it, look through every word, download it again, delete it.
 *
 * Deleting is two taps: the first turns the button into a confirmation, which lapses on its
 * own, so a stray tap never throws a pack away.
 *
 * Exports: ImportedPackList
 * Depends on: router navigate, lucide icons, ../lib/custom-pack, ../lib/difficulty,
 *   ../lib/word-joiner, ../lib/locale, ../lib/useLocale, ./PackPreviewDialog
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, Eye, FileJson, Link2, Play, Square, Trash2 } from "lucide-react";
import {
  activateCustomPack,
  packLevelCounts,
  removeCustomPack,
  type CustomPack,
} from "../lib/custom-pack";
import { formatLevelBand } from "../lib/difficulty";
import { localeCopy, type Locale } from "../lib/locale";
import { resolveClue } from "../lib/clues";
import type { VocabularyLevel } from "../lib/schema";
import { useLocale } from "../lib/useLocale";
import { stripWordJoiners } from "../lib/word-joiner";
import { PackPreviewDialog } from "./PackPreviewDialog";

/** Words shown in a card's peek before "và N từ nữa". */
const PEEK = 6;
/** How long a delete waits for its confirming tap. */
const CONFIRM_MS = 3500;

const COPY: Partial<Record<
  Locale,
  {
    dateLocale: string;
    cardAria: (name: string, count: number, active: boolean) => string;
    playingBadge: string;
    freshBadge: string;
    wordsCount: (count: string) => string;
    importedOn: (date: string) => string;
    levelsAria: string;
    otherLevel: string;
    peekAria: string;
    andMore: (count: string) => string;
    stopBtn: string;
    playBtn: string;
    quickLookBtn: string;
    downloadAria: (name: string) => string;
    deleteConfirmAria: (name: string) => string;
    deleteAria: (name: string) => string;
    deleteConfirmText: string;
    playThisPack: string;
    listTitle: (count: number) => string;
  }
>> = {
  vi: {
    dateLocale: "vi-VN",
    cardAria: (name, count, active) => `${name}, ${count} từ${active ? ", đang phát" : ""}`,
    playingBadge: "Đang phát",
    freshBadge: "Mới thêm",
    wordsCount: (count) => `${count} từ`,
    importedOn: (date) => `nhập ${date}`,
    levelsAria: "Số từ theo trình độ",
    otherLevel: "Khác",
    peekAria: "Vài từ đầu tiên",
    andMore: (count) => `và ${count} từ nữa`,
    stopBtn: "Dừng",
    playBtn: "Phát",
    quickLookBtn: "Xem nhanh",
    downloadAria: (name) => `Tải xuống ${name}`,
    deleteConfirmAria: (name) => `Chắc chắn xóa ${name}`,
    deleteAria: (name) => `Xóa ${name}`,
    deleteConfirmText: " Xóa thật?",
    playThisPack: "Phát gói này",
    listTitle: (count) => `Gói đã nhập · ${count}`,
  },
  ja: {
    dateLocale: "ja-JP",
    cardAria: (name, count, active) => `${name}、${count} 語${active ? "、再生中" : ""}`,
    playingBadge: "再生中",
    freshBadge: "新規追加",
    wordsCount: (count) => `${count} 語`,
    importedOn: (date) => `${date} 追加`,
    levelsAria: "レベル別の単語数",
    otherLevel: "その他",
    peekAria: "最初の数語",
    andMore: (count) => `他 ${count} 語`,
    stopBtn: "停止",
    playBtn: "再生",
    quickLookBtn: "プレビュー",
    downloadAria: (name) => `${name} をダウンロード`,
    deleteConfirmAria: (name) => `${name} を本当に削除`,
    deleteAria: (name) => `${name} を削除`,
    deleteConfirmText: " 削除する？",
    playThisPack: "このパックを再生",
    listTitle: (count) => `取り込み済みパック · ${count}`,
  },
  th: {
    dateLocale: "th-TH",
    cardAria: (name, count, active) => `${name}, ${count} คำ${active ? ", กำลังเล่น" : ""}`,
    playingBadge: "กำลังเล่น",
    freshBadge: "เพิ่งเพิ่ม",
    wordsCount: (count) => `${count} คำ`,
    importedOn: (date) => `นำเข้า ${date}`,
    levelsAria: "จำนวนคำตามระดับ",
    otherLevel: "อื่นๆ",
    peekAria: "คำศัพท์แรกๆ",
    andMore: (count) => `และอีก ${count} คำ`,
    stopBtn: "หยุด",
    playBtn: "เล่น",
    quickLookBtn: "ดูตัวอย่าง",
    downloadAria: (name) => `ดาวน์โหลด ${name}`,
    deleteConfirmAria: (name) => `ยืนยันการลบ ${name}`,
    deleteAria: (name) => `ลบ ${name}`,
    deleteConfirmText: " ลบจริง?",
    playThisPack: "เล่นชุดนี้",
    listTitle: (count) => `ชุดที่นำเข้า · ${count}`,
  },
};

/** Where a pack came from, short: the file's name, whether uploaded or linked (the link's
 * host when its path names no file). The full source stays in the tooltip. */
function sourceLabel(source: string): { label: string; link: boolean } {
  try {
    const url = new URL(source);
    if (/^https?:$/.test(url.protocol)) {
      const file = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      return { label: file || url.host, link: true };
    }
  } catch {
    // Not a URL: a file name.
  }
  return { label: source.split(/[/\\]/).pop() ?? source, link: false };
}

/** The pack as a file again: the shape the importer reads, named after the pack. */
function downloadPack(pack: CustomPack): void {
  const body = JSON.stringify({ name: pack.catalog.name, words: pack.catalog.words }, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  const slug =
    pack.catalog.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "goi-tu-vung";
  link.download = `${slug}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function PackCard({
  pack,
  active,
  fresh,
  ui,
}: {
  pack: CustomPack;
  active: boolean;
  fresh: boolean;
  ui: Locale;
}) {
  const copy = localeCopy(COPY, ui);
  const navigate = useNavigate();
  const [looking, setLooking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const card = useRef<HTMLLIElement>(null);
  const { catalog } = pack;
  const levels = packLevelCounts(pack);
  const named = levels.filter((entry) => entry.level).map((entry) => entry.level);
  const band = named.length ? formatLevelBand(named as VocabularyLevel[]) : null;
  const source = sourceLabel(pack.source);
  const imported = new Date(pack.importedAt).toLocaleDateString(copy.dateLocale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const peek = catalog.words.slice(0, PEEK);
  const more = catalog.count - peek.length;

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  // A pack that just arrived is brought into view, so the reader sees where it landed.
  useEffect(() => {
    if (fresh) card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [fresh]);

  const play = () => {
    activateCustomPack(pack.id);
    void navigate({ to: "/feed" });
  };

  return (
    <li
      ref={card}
      className="vocab-pack-card"
      data-active={active || undefined}
      data-fresh={fresh || undefined}
      aria-label={copy.cardAria(catalog.name, catalog.count, active)}
    >
      <div className="vocab-pack-card-head">
        <FileJson size={18} aria-hidden="true" />
        <h3>{catalog.name}</h3>
        {active && <span className="vocab-pack-card-badge">{copy.playingBadge}</span>}
        {fresh && !active && (
          <span className="vocab-pack-card-badge" data-fresh>
            {copy.freshBadge}
          </span>
        )}
      </div>
      <p className="vocab-pack-card-meta">
        <span>{copy.wordsCount(catalog.count.toLocaleString(copy.dateLocale))}</span>
        {band && <span>{band}</span>}
        <span className="vocab-pack-card-source" title={pack.source}>
          {source.link ? <Link2 size={12} aria-hidden="true" /> : null}
          {source.label}
        </span>
        <span>{copy.importedOn(imported)}</span>
      </p>
      {levels.length > 1 && (
        <ul className="vocab-pack-card-levels" aria-label={copy.levelsAria}>
          {levels.map((entry) => (
            <li key={entry.level || "none"}>
              <span>{entry.level || copy.otherLevel}</span>
              {entry.count}
            </li>
          ))}
        </ul>
      )}
      <ul className="vocab-pack-card-peek" aria-label={copy.peekAria}>
        {peek.map((word) => (
          <li key={word.id}>
            <strong lang="en">{word.word}</strong>
            <span>
              {stripWordJoiners(word.meaningJP ?? word.meaningVi ?? resolveClue(word, "def", ui))}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li className="vocab-pack-card-more">
            <button type="button" onClick={() => setLooking(true)}>
              {copy.andMore(more.toLocaleString(copy.dateLocale))}
            </button>
          </li>
        )}
      </ul>
      <div className="vocab-pack-card-actions">
        {active ? (
          <button
            type="button"
            className="vocab-import-btn"
            onClick={() => activateCustomPack(null)}
          >
            <Square size={13} aria-hidden="true" /> {copy.stopBtn}
          </button>
        ) : (
          <button type="button" className="vocab-import-btn" onClick={play}>
            <Play size={14} aria-hidden="true" /> {copy.playBtn}
          </button>
        )}
        <button
          type="button"
          className="vocab-import-btn ghost"
          aria-haspopup="dialog"
          onClick={() => setLooking(true)}
        >
          <Eye size={14} aria-hidden="true" /> {copy.quickLookBtn}
        </button>
        <button
          type="button"
          className="vocab-import-btn ghost"
          onClick={() => downloadPack(pack)}
          aria-label={copy.downloadAria(catalog.name)}
        >
          <Download size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vocab-import-btn ghost vocab-pack-card-delete"
          data-confirming={confirming || undefined}
          onClick={() => (confirming ? removeCustomPack(pack.id) : setConfirming(true))}
          aria-label={
            confirming ? copy.deleteConfirmAria(catalog.name) : copy.deleteAria(catalog.name)
          }
        >
          <Trash2 size={14} aria-hidden="true" />
          {confirming && copy.deleteConfirmText}
        </button>
      </div>
      {looking && (
        <PackPreviewDialog
          file={{
            name: source.label,
            text: JSON.stringify({ name: catalog.name, words: catalog.words }),
          }}
          open={looking}
          onOpenChange={setLooking}
          importLabel={active ? copy.playingBadge : copy.playThisPack}
          onImport={() => {
            setLooking(false);
            if (!active) play();
          }}
        />
      )}
    </li>
  );
}

/**
 * @param packs The imported packs, newest first
 * @param active The playing pack's id, or null
 * @param fresh The id of a pack that was just added, to highlight
 */
export function ImportedPackList({
  packs,
  active,
  fresh,
}: {
  packs: CustomPack[];
  active: string | null;
  fresh: string | null;
}) {
  const ui = useLocale();
  if (!packs.length) return null;
  return (
    <section className="vocab-pack-list" aria-labelledby="vocab-pack-list-title">
      <h3 id="vocab-pack-list-title" className="vocab-pack-list-title">
        {localeCopy(COPY, ui).listTitle(packs.length)}
      </h3>
      <ul>
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            active={pack.id === active}
            fresh={pack.id === fresh}
            ui={ui}
          />
        ))}
      </ul>
    </section>
  );
}
