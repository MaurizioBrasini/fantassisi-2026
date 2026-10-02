'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Banner flottante "Installa l'app", montato una sola volta in app/layout.tsx.
// L'evento beforeinstallprompt di Chrome parte una volta sola e presto: lo cattura uno script
// in <head> (layout.tsx) che lo salva in window.__fantInstallPrompt, così non si perde anche
// se questo componente si monta dopo.
const DISMISS_KEY = 'fantassisi_install_dismissed_until';
const DISMISS_MS = 24 * 60 * 60 * 1000;

function readDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export default function InstallButton() {
  const pathname = usePathname() || '';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isChromeIOS, setIsChromeIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setDismissed(readDismissed());

    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsChromeIOS(/CriOS/.test(ua));

    // Evento già catturato dallo script in <head>, oppure in arrivo adesso.
    if ((window as any).__fantInstallPrompt) setDeferredPrompt((window as any).__fantInstallPrompt);
    const onReady = () => setDeferredPrompt((window as any).__fantInstallPrompt || null);
    const onInstalled = () => {
      (window as any).__fantInstallPrompt = null;
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('fant-install-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('fant-install-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Mai sui tabelloni per il proiettore né nel pannello admin.
  if (pathname.startsWith('/tabellone') || pathname.startsWith('/admin')) return null;
  if (isStandalone || dismissed) return null; // già installata, o chiusa da meno di 24 ore
  if (!isIOS && !deferredPrompt) return null; // Android/desktop: solo se il browser offre l'installazione

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSHint((v) => !v);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      (window as any).__fantInstallPrompt = null;
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* senza localStorage la chiusura vale solo finché la pagina resta aperta */
    }
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        width: 'calc(100% - 32px)',
        maxWidth: 360,
        zIndex: 1000,
      }}
    >
      {showIOSHint && (
        <div
          style={{
            marginBottom: 8,
            padding: '12px 16px',
            background: '#FFF3E0',
            border: '1px solid #FFB74D',
            borderRadius: 10,
            fontSize: 14,
            color: '#333',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {isChromeIOS && (
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
              Su iPhone l&apos;installazione funziona bene solo da Safari: apri questo indirizzo in Safari.
            </p>
          )}
          Tocca il tasto <strong>Condividi</strong> (il quadrato con la freccia verso l&apos;alto) nel browser,
          poi scegli <strong>&quot;Aggiungi a schermata Home&quot;</strong>.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#1E3A5F',
          color: '#fff',
          borderRadius: 999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={handleInstallClick}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📲 Installa l&apos;app FantAssisi
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Nascondi per 24 ore"
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
