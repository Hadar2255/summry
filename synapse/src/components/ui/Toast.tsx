import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  tone: 'good' | 'bad';
}

const ToastContext = createContext<(message: string, tone?: 'good' | 'bad') => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: 'good' | 'bad' = 'good') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message, tone }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className="card pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 text-sm shadow-xl shadow-black/10 animate-rise-in"
          >
            {t.tone === 'good' ? <CheckCircle2 size={16} className="text-good" /> : <AlertTriangle size={16} className="text-bad" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
