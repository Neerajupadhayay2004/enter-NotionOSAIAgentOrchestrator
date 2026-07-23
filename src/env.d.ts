/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENTER_ANALYTICS_ENABLED?: string;
  readonly VITE_ENTER_ANALYTICS_TOKEN?: string;
  readonly VITE_ENTER_PROJECT_ID?: string;
  readonly VITE_ENTER_ANALYTICS_ENDPOINT?: string;
  readonly VITE_ENTER_ANALYTICS_DEFINITIONS_ENDPOINT?: string;
  readonly VITE_ENTER_ANALYTICS_DEBUG?: string;
  readonly VITE_CONVEX_URL: string;
  readonly VITE_PYTHON_BACKEND_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
