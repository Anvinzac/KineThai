/**
 * Library panel to import a personal pack from a local JSON file or a direct URL.
 * Validated against the default deck format and kept only in this browser. A pack lands
 * in the list right under the import row (./ImportedPackList) rather than playing at once,
 * so the reader can look through it first; playing it makes the feed play just that pack
 * with random themes, styles and effects. A second tab offers the AI prompt kit to preview
 * full-screen or download.
 *
 * Exports: ImportPackPanel
 */
import { useRef, useState, type ClipboardEvent } from "react";
import { Download, Eye, FileText, FileUp, Link2, Sparkles } from "lucide-react";
import {
  addCustomPack,
  loadCustomPackFromUrl,
  localizeCustomPackError,
  parseCustomPack,
  type CustomPack,
} from "../lib/custom-pack";
import { useCustomPacks } from "../hooks/useCustomPacks";
import { localeCopy, type Locale } from "../lib/locale";
import { PACK_KIT_MD, downloadPackKit } from "../lib/sample-pack";
import { useLocale } from "../lib/useLocale";
import { FullscreenSheet } from "./FullscreenSheet";
import { ImportedPackList } from "./ImportedPackList";
import { PackKitDoc } from "./PackKitDoc";

/** Packs shipped in public/sample-packs, for trying the import without a file of one's own. */
const SAMPLE_PACKS: { file: string; labels: Partial<Record<Locale, string>> }[] = [
  {
    file: "du-lich-a2.json",
    labels: {
      vi: "Du lịch · A1–A2",
      ja: "旅行 · A1–A2",
      th: "ท่องเที่ยว · A1–A2",
    },
  },
  {
    file: "nha-bep-b1.json",
    labels: {
      vi: "Nhà bếp · B1",
      ja: "キッチン · B1",
      th: "ห้องครัว · B1",
    },
  },
  {
    file: "cong-so-nhieu-cap.json",
    labels: {
      vi: "Công sở · A1–C1",
      ja: "オフィス · A1–C1",
      th: "ที่ทำงาน · A1–C1",
    },
  },
];

const COPY: Partial<Record<
  Locale,
  {
    title: string;
    note: string;
    tabsAria: string;
    importTab: string;
    generateTab: string;
    urlPlaceholder: string;
    urlAria: string;
    loading: string;
    linkBtn: string;
    uploadBtn: string;
    trySample: string;
    aiNote: string;
    previewBtn: string;
    downloadBtn: string;
    kitSheetTitle: string;
    downloadKitBtn: string;
    importFailed: string;
  }
>> = {
  vi: {
    title: "Nhập gói của bạn",
    note: "Muốn học từ của riêng bạn? Tải gói lên hoặc dán liên kết, dòng từ sẽ chỉ phát những từ trong gói đó. Gói chỉ lưu trên máy này, không gửi đi đâu.",
    tabsAria: "Cách nhập gói",
    importTab: "Nhập tệp",
    generateTab: "Tạo gói bằng AI",
    urlPlaceholder: "Dán liên kết JSON, hoặc tải tệp lên",
    urlAria: "Liên kết trực tiếp tới tệp JSON",
    loading: "Đang tải…",
    linkBtn: "Liên kết",
    uploadBtn: "Tải lên",
    trySample: "Thử gói mẫu:",
    aiNote:
      "Gửi tệp này cùng danh sách từ của bạn cho AI (ChatGPT, Gemini…) để nó tạo gói từ vựng theo hướng dẫn trong tệp.",
    previewBtn: "Xem trước",
    downloadBtn: "Tải xuống",
    kitSheetTitle: "Hướng dẫn tạo gói bằng AI",
    downloadKitBtn: "Tải tệp hướng dẫn",
    importFailed: "Không nhập được gói.",
  },
  ja: {
    title: "マイパックを取り込む",
    note: "自分の単語帳で学びたいですか？パックをアップロードするかリンクを貼り付けると、そのパックの単語だけがフィードで再生されます。この端末にのみ保存され、外部には送信されません。",
    tabsAria: "パックの取り込み方法",
    importTab: "ファイル取り込み",
    generateTab: "AI でパック作成",
    urlPlaceholder: "JSON の URL を貼り付けるかファイルをアップロード",
    urlAria: "JSON ファイルへの直接リンク",
    loading: "読み込み中…",
    linkBtn: "リンク",
    uploadBtn: "アップロード",
    trySample: "サンプルパックを試す：",
    aiNote:
      "このファイルと単語リストを AI（ChatGPT、Gemini など）に送ると、ガイドに従って単語パックを作成してくれます。",
    previewBtn: "プレビュー",
    downloadBtn: "ダウンロード",
    kitSheetTitle: "AI パック作成ガイド",
    downloadKitBtn: "ガイドファイルをダウンロード",
    importFailed: "パックを取り込めませんでした。",
  },
  th: {
    title: "นำเข้าชุดคำศัพท์ของคุณ",
    note: "อยากเรียนคำศัพท์ของตัวเองไหม? อัปโหลดไฟล์หรือวางลิงก์ แล้วฟีดจะเล่นเฉพาะคำในชุดนั้น ชุดคำศัพท์จะถูกเก็บไว้ในเครื่องนี้เท่านั้น ไม่ส่งออกไปที่อื่น",
    tabsAria: "วิธีนำเข้าชุดคำศัพท์",
    importTab: "นำเข้าไฟล์",
    generateTab: "สร้างชุดด้วย AI",
    urlPlaceholder: "วางลิงก์ JSON หรืออัปโหลดไฟล์",
    urlAria: "ลิงก์โดยตรงไปยังไฟล์ JSON",
    loading: "กำลังโหลด…",
    linkBtn: "ลิงก์",
    uploadBtn: "อัปโหลด",
    trySample: "ลองชุดตัวอย่าง:",
    aiNote:
      "ส่งไฟล์นี้พร้อมรายการคำศัพท์ของคุณให้ AI (ChatGPT, Gemini…) เพื่อสร้างชุดคำศัพท์ตามคำแนะนำในไฟล์",
    previewBtn: "ดูตัวอย่าง",
    downloadBtn: "ดาวน์โหลด",
    kitSheetTitle: "คู่มือสร้างชุดคำศัพท์ด้วย AI",
    downloadKitBtn: "ดาวน์โหลดไฟล์คู่มือ",
    importFailed: "ไม่สามารถนำเข้าชุดคำศัพท์ได้",
  },
};

const looksLikeUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

export function ImportPackPanel() {
  const ui = useLocale();
  const copy = localeCopy(COPY, ui);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"import" | "generate">("import");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [kitOpen, setKitOpen] = useState(false);
  const library = useCustomPacks();

  const run = async (task: () => Promise<CustomPack>) => {
    setBusy(true);
    setError(null);
    try {
      const pack = addCustomPack(await task());
      setFresh(pack.id);
      setUrl("");
    } catch (e) {
      setError(
        e instanceof Error
          ? localizeCustomPackError(e.message, ui).split("\n").slice(0, 4).join("\n")
          : copy.importFailed,
      );
    } finally {
      setBusy(false);
    }
  };
  const fromUrl = (link: string) => void run(() => loadCustomPackFromUrl(link));
  // A pasted link is the whole intent: load it straight away instead of waiting for a tap.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!looksLikeUrl(pasted) || busy) return;
    event.preventDefault();
    setUrl(pasted.trim());
    fromUrl(pasted);
  };

  return (
    <section className="vocab-import" aria-labelledby="vocab-import-title">
      <h2 id="vocab-import-title" className="vocab-library-group-title">
        {copy.title}
      </h2>
      <p className="vocab-library-group-note">{copy.note}</p>
      <div className="vocab-import-tabs" role="tablist" aria-label={copy.tabsAria}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "import"}
          className={`vocab-import-tab${tab === "import" ? " on" : ""}`}
          onClick={() => setTab("import")}
        >
          {copy.importTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "generate"}
          className={`vocab-import-tab${tab === "generate" ? " on" : ""}`}
          onClick={() => setTab("generate")}
        >
          {copy.generateTab}
        </button>
      </div>
      {tab === "import" ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (!picked) return;
              void run(async () => parseCustomPack(await picked.text(), picked.name));
            }}
          />
          <form
            className="vocab-import-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) fromUrl(url);
              else fileRef.current?.click();
            }}
          >
            <input
              className="vocab-import-url"
              type="url"
              inputMode="url"
              placeholder={copy.urlPlaceholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={onPaste}
              aria-label={copy.urlAria}
            />
            <button type="submit" className="vocab-import-btn" disabled={busy}>
              {busy ? (
                copy.loading
              ) : url.trim() ? (
                <>
                  <Link2 size={15} aria-hidden="true" /> {copy.linkBtn}
                </>
              ) : (
                <>
                  <FileUp size={15} aria-hidden="true" /> {copy.uploadBtn}
                </>
              )}
            </button>
          </form>
          <div className="vocab-import-samples">
            <span>
              <Sparkles size={13} aria-hidden="true" /> {copy.trySample}
            </span>
            {SAMPLE_PACKS.map((sample) => (
              <button
                key={sample.file}
                type="button"
                className="vocab-import-sample"
                disabled={busy}
                onClick={() =>
                  fromUrl(new URL(`/sample-packs/${sample.file}`, window.location.origin).href)
                }
              >
                {localeCopy(sample.labels, ui)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="vocab-import-generate">
          <p className="vocab-library-group-note">{copy.aiNote}</p>
          <div className="vocab-import-row vocab-import-actions">
            <button
              type="button"
              className="vocab-import-btn ghost"
              aria-haspopup="dialog"
              onClick={() => setKitOpen(true)}
            >
              <Eye size={15} aria-hidden="true" /> {copy.previewBtn}
            </button>
            <button type="button" className="vocab-import-btn" onClick={downloadPackKit}>
              <Download size={15} aria-hidden="true" /> {copy.downloadBtn}
            </button>
          </div>
          <FullscreenSheet
            open={kitOpen}
            onOpenChange={setKitOpen}
            icon={<FileText size={20} aria-hidden="true" />}
            title={copy.kitSheetTitle}
            subtitle="tao-goi-tu-vung.md"
            footer={
              <button type="button" className="vocab-import-btn" onClick={downloadPackKit}>
                <Download size={15} aria-hidden="true" /> {copy.downloadKitBtn}
              </button>
            }
          >
            <div className="vocab-preview-raw">
              <PackKitDoc markdown={PACK_KIT_MD} />
            </div>
          </FullscreenSheet>
        </div>
      )}
      {error && (
        <p className="vocab-import-error" role="alert">
          {error}
        </p>
      )}
      <ImportedPackList packs={library.packs} active={library.active} fresh={fresh} />
    </section>
  );
}
