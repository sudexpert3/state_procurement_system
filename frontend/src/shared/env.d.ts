/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GPZ_USERNAME: string;
  readonly VITE_GPZ_PASSWORD: string;
  readonly VITE_GPZ_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
