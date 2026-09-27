import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './hooks/useStore';
import { NavProvider } from './hooks/useNav';
import { ToastProvider } from './components/ui/Toast';
import { audio } from './utils/audio';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <NavProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </NavProvider>
    </StoreProvider>
  </StrictMode>
);

const unlockAudio = () => {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline caching is a progressive enhancement; the app works without it.
    });
  });
}
