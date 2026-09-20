/// <reference types="vite/client" />

/**
 * The Firebase web config, as Vite inlines it at build time.
 *
 * Deliberately typed `string | undefined`: an unconfigured checkout is a
 * supported state, not a mistake. The app has to run on localStorage alone
 * with none of these set, so the types make every reader handle their absence.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string | undefined;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string | undefined;
  readonly VITE_FIREBASE_PROJECT_ID: string | undefined;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string | undefined;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string | undefined;
  readonly VITE_FIREBASE_APP_ID: string | undefined;
  readonly VITE_USE_EMULATORS: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * The build stamp, written in by Vite's `define` (see vite.config.ts) and read
 * through `src/lib/version.ts`. Plain globals rather than `import.meta.env`:
 * they are facts about the build, not configuration anyone may set.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
