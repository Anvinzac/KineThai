/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL the app is served from; Vite sets it from the build `base` config. */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
