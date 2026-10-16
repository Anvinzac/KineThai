/**
 * Library panel to import a personal pack from a local JSON file or a direct URL.
 * Validated against the default deck format, stored only in this browser, then the feed
 * plays just that pack with random themes, styles and effects. A second tab offers the
 * AI prompt kit to preview full-screen or download.
 *
 * Exports: ImportPackPanel
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, Eye, FileJson, FileText, FileUp, Link2, Play, X } from "lucide-react";
import {
  CUSTOM_PACK_EVENT,
  clearCustomPack,
  loadCustomPackFromUrl,
  parseCustomPack,
  readCustomPack,
  writeCustomPack,
  type CustomPack,
} from "../lib/custom-pack";
import { PACK_KIT_MD, downloadPackKit } from "../lib/sample-pack";
import { FullscreenSheet } from "./FullscreenSheet";
import { PackKitDoc } from "./PackKitDoc";
import { PackPreviewDialog } from "./PackPreviewDialog";

export function ImportPackPanel() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"import" | "generate">("import");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<CustomPack | null>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);

  useEffect(() => {
    const sync = () => setActive(readCustomPack());
    sync();
    window.addEventListener(CUSTOM_PACK_EVENT, sync);
    return () => window.removeEventListener(CUSTOM_PACK_EVENT, sync);
  }, []);

  const activate = (pack: CustomPack) => {
    writeCustomPack(pack);
    void navigate({ to: "/feed" });
  };
  const run = async (task: () => Promise<CustomPack>) => {
    setBusy(true);
    setError(null);
    try {
      activate(await task());
    } catch (e) {
      setError(
        e instanceof Error ? e.message.split("\n").slice(0, 4).join("\n") : "Không nhập được gói.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vocab-import" aria-labelledby="vocab-import-title">
      <h2 id="vocab-import-title" className="vocab-library-group-title">
        Nhập gói của bạn
      </h2>
      <p className="vocab-library-group-note">
        Muốn học từ của riêng bạn? Tải gói lên hoặc dán liên kết, dòng từ sẽ chỉ phát những từ trong
        gói đó. Gói chỉ lưu trên máy này, không gửi đi đâu.
      </p>
      {active && (
        <div className="vocab-import-active">
          <span>
            Đang dùng: <strong>{active.catalog.name}</strong> · {active.catalog.count} từ
          </span>
          <button
            type="button"
            className="vocab-import-btn"
            onClick={() => navigate({ to: "/feed" })}
          >
            <Play size={14} aria-hidden="true" /> Phát
          </button>
          <button type="button" className="vocab-import-btn ghost" onClick={clearCustomPack}>
            <X size={14} aria-hidden="true" /> Bỏ gói
          </button>
        </div>
      )}
      <div className="vocab-import-tabs" role="tablist" aria-label="Cách nhập gói">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "import"}
          className={`vocab-import-tab${tab === "import" ? " on" : ""}`}
          onClick={() => setTab("import")}
        >
          Nhập tệp
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "generate"}
          className={`vocab-import-tab${tab === "generate" ? " on" : ""}`}
          onClick={() => setTab("generate")}
        >
          Tạo gói bằng AI
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
              setError(null);
              setPreview(false);
              void picked.text().then((text) => setFile({ name: picked.name, text }));
            }}
          />
          <form
            className="vocab-import-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (file) void run(async () => parseCustomPack(file.text, file.name));
              else if (url.trim()) void run(() => loadCustomPackFromUrl(url));
              else fileRef.current?.click();
            }}
          >
            {file ? (
              <div className="vocab-import-url vocab-import-file">
                <button
                  type="button"
                  className="vocab-import-file-name"
                  aria-haspopup="dialog"
                  title="Xem nội dung tệp"
                  onClick={() => setPreview(true)}
                >
                  <FileJson size={15} aria-hidden="true" />
                  <span>{file.name}</span>
                  <Eye size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="vocab-import-file-clear"
                  aria-label="Bỏ tệp"
                  onClick={() => {
                    setFile(null);
                    setPreview(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <input
                className="vocab-import-url"
                type="url"
                inputMode="url"
                placeholder="Dán liên kết JSON, hoặc tải tệp lên"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-label="Liên kết trực tiếp tới tệp JSON"
              />
            )}
            <button type="submit" className="vocab-import-btn" disabled={busy}>
              {busy ? (
                "Đang tải…"
              ) : file ? (
                <>
                  <Play size={15} aria-hidden="true" /> Nhập
                </>
              ) : url.trim() ? (
                <>
                  <Link2 size={15} aria-hidden="true" /> Liên kết
                </>
              ) : (
                <>
                  <FileUp size={15} aria-hidden="true" /> Tải lên
                </>
              )}
            </button>
          </form>
          {file && (
            <PackPreviewDialog
              file={file}
              open={preview}
              onOpenChange={setPreview}
              onImport={() => {
                setPreview(false);
                void run(async () => parseCustomPack(file.text, file.name));
              }}
            />
          )}
        </>
      ) : (
        <div className="vocab-import-generate">
          <p className="vocab-library-group-note">
            Gửi tệp này cùng danh sách từ của bạn cho AI (ChatGPT, Gemini…) để nó tạo gói từ vựng
            theo hướng dẫn trong tệp.
          </p>
          <div className="vocab-import-row vocab-import-actions">
            <button
              type="button"
              className="vocab-import-btn ghost"
              aria-haspopup="dialog"
              onClick={() => setKitOpen(true)}
            >
              <Eye size={15} aria-hidden="true" /> Xem trước
            </button>
            <button type="button" className="vocab-import-btn" onClick={downloadPackKit}>
              <Download size={15} aria-hidden="true" /> Tải xuống
            </button>
          </div>
          <FullscreenSheet
            open={kitOpen}
            onOpenChange={setKitOpen}
            icon={<FileText size={20} aria-hidden="true" />}
            title="Hướng dẫn tạo gói bằng AI"
            subtitle="tao-goi-tu-vung.md"
            footer={
              <button type="button" className="vocab-import-btn" onClick={downloadPackKit}>
                <Download size={15} aria-hidden="true" /> Tải tệp hướng dẫn
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
    </section>
  );
}
