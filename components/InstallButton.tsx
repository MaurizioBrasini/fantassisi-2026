'use client';

import { useEffect, useState } from 'react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Rileva se l'app è già installata (in modalità standalone)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Rileva iOS
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Cattura l'evento Chrome/Android
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone) return null; // già installata, non mostrare nulla

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSHint(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Su Android mostra il bottone solo se il prompt è disponibile
  // Su iOS mostra sempre il bottone (non esiste beforeinstallprompt)
  if (!isIOS && !deferredPrompt) return null;

  return (
    <div style={{ margin: '12px 0' }}>
      <button
        onClick={handleInstallClick}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: '#1E3A5F',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        📲 Installa l'app FantAssisi
      </button>

      {showIOSHint && (
        <div
          style={{
            marginTop: '10px',
            padding: '12px 16px',
            background: '#FFF3E0',
            border: '1px solid #FFB74D',
            borderRadius: '10px',
            fontSize: '14px',
            color: '#333',
          }}
        >
          Per installare su iPhone: tocca il tasto <strong>Condividi</strong>{' '}
          (il quadrato con la freccia verso l'alto) in basso nel browser
          Safari, poi scegli <strong>"Aggiungi a schermata Home"</strong>.
          <br />
          <button
            onClick={() => setShowIOSHint(false)}
            style={{
              marginTop: '8px',
              background: 'none',
              border: 'none',
              color: '#1E3A5F',
              textDecoration: 'underline',
              fontSize: '13px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}