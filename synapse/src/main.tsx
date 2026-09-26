import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './hooks/useStore';
import { NavProvider } from './hooks/useNav';
import { ToastProvider } from './components/ui/Toast';
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
