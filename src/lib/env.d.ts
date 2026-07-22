/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
  // Add other env variables here as needed
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
