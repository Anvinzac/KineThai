/**
 * Library panel to import a personal pack from a local JSON file or a direct URL.
 * Validated against the default deck format, stored only in this browser, then the feed
 * plays just that pack with random themes, styles and effects.
 *
 * Exports: ImportPackPanel
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileUp, Link2, Play, X } from "lucide-react";
import {
  CUSTOM_PACK_EVENT,
  clearCustomPack,
  loadCustomPackFromUrl,
  parseCustomPack,
  readCustomPack,
  writeCustomPack,
  type CustomPack,
} from "../lib/custom-pack";

export function ImportPackPanel() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<CustomPack | null>(null);

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
      setError(e instanceof Error ? e.message.split("\n").slice(0, 4).join("\n") : "Không nhập được gói.");
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
        Tệp JSON theo định dạng mặc định. Gói chỉ lưu trên máy này — dòng từ sẽ chỉ phát các từ
        trong gói, với giao diện và hiệu ứng ngẫu nhiên.
      </p>
      {active && (
        <div className="vocab-import-active">
          <span>
            Đang dùng: <strong>{active.catalog.name}</strong> · {active.catalog.count} từ
          </span>
          <button type="button" className="vocab-import-btn" onClick={() => navigate({ to: "/feed" })}>
            <Play size={14} aria-hidden="true" /> Phát
          </button>
          <button type="button" className="vocab-import-btn ghost" onClick={clearCustomPack}>
            <X size={14} aria-hidden="true" /> Bỏ gói
          </button>
        </div>
      )}
      <div className="vocab-import-row">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run(async () => parseCustomPack(await file.text(), file.name));
          }}
        />
        <button
          type="button"
          className="vocab-import-btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp size={15} aria-hidden="true" /> Chọn tệp JSON
        </button>
      </div>
      <form
        className="vocab-import-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void run(() => loadCustomPackFromUrl(url));
        }}
      >
        <input
          className="vocab-import-url"
          type="url"
          inputMode="url"
          placeholder="https://…/goi-tu-vung.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Liên kết trực tiếp tới tệp JSON"
        />
        <button type="submit" className="vocab-import-btn" disabled={busy || !url.trim()}>
          <Link2 size={15} aria-hidden="true" /> {busy ? "Đang tải…" : "Nhập"}
        </button>
      </form>
      {error && (
        <p className="vocab-import-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
