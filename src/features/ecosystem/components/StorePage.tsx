/**
 * The ecosystem store: every Chay Lá app with its screenshots and description.
 *
 * The screenshot frames are MOCK — no real captures exist yet, so each frame is
 * drawn from the app's own accent and glyph and captioned with what it would
 * show. Swap the frame body for an <img> when the real art lands; the caption
 * and layout stay.
 *
 * Exports: StorePage
 * Depends on: router Link, ecosystem app data, store.css
 */

import type React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ECOSYSTEM_APPS, type EcosystemApp } from "../data/apps";
import { t } from "@/features/vocabulary/lib/ui-copy";
import { useLocale } from "@/features/vocabulary/lib/useLocale";
import "../store.css";

function AppSection({ app }: { app: EcosystemApp }): React.ReactElement {
  // Section chrome follows the UI locale; the mock app catalog stays as authored.
  const ui = useLocale();
  const accent = { "--eco-from": app.accent[0], "--eco-to": app.accent[1] } as React.CSSProperties;
  return (
    <section className="store-app" style={accent} aria-labelledby={`store-${app.id}`}>
      <header className="store-app-head">
        <span className="store-app-glyph" aria-hidden="true">
          {app.glyph}
        </span>
        <div className="store-app-id">
          <h2 className="store-app-name" id={`store-${app.id}`}>
            {app.name}
          </h2>
          <p className="store-app-tagline">{app.tagline}</p>
        </div>
        {app.status === "live" ? (
          <a
            className="store-app-open"
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t(ui, "store.openAria", { name: app.name })}
          >
            {t(ui, "store.open")}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : (
          <span className="store-app-soon">{t(ui, "store.soon")}</span>
        )}
      </header>

      <p className="store-app-copy">{app.description}</p>

      {/* Horizontal strip, the way a store shows captures: it scrolls rather
          than shrinking three frames down to thumbnails on a phone. */}
      <ul className="store-shots" aria-label={t(ui, "store.shotsAria", { name: app.name })}>
        {app.shots.map((caption) => (
          <li className="store-shot" key={caption}>
            <div className="store-shot-frame" aria-hidden="true">
              <span className="store-shot-glyph">{app.glyph}</span>
            </div>
            <span className="store-shot-caption">{caption}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Store listing for the whole app family.
 * @returns The store page.
 */
export function StorePage(): React.ReactElement {
  const ui = useLocale();
  return (
    <main className="vocabulary-shell store-shell">
      <header className="store-head">
        <Link className="vocab-icon-button" to="/feed" aria-label={t(ui, "store.back")}>
          <ArrowLeft size={19} />
        </Link>
        <div>
          <h1 className="store-title">{t(ui, "store.title")}</h1>
          <p className="store-subtitle">{t(ui, "store.subtitle")}</p>
        </div>
      </header>

      <div className="store-list">
        {ECOSYSTEM_APPS.map((app) => (
          <AppSection key={app.id} app={app} />
        ))}
      </div>

      <p className="store-foot">{t(ui, "store.note")}</p>
    </main>
  );
}
