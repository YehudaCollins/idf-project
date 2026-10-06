/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHAREPOINT_SITE_URL?: string;
  readonly VITE_ALLOW_DEMO_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}