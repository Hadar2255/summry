/* In the web build the API lives on the same origin ('' → relative /api).
   In the Android (Capacitor) build the app runs from a local WebView, so
   VITE_API_BASE points at the deployed Vercel server. */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
