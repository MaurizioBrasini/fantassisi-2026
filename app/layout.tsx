import type { Metadata, Viewport } from "next";
import InstallButton from "@/components/InstallButton";

export const metadata: Metadata = {
  title: "FantAssisi 2026",
  description: "Il gioco del Forum di Assisi 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FantAssisi 2026",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A5F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FantAssisi" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        
        {/* 🔥 Service Worker - necessario per il banner "Aggiungi a schermata Home" */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('✅ Service Worker registrato con successo');
                    })
                    .catch(function(err) {
                      console.log('❌ Errore registrazione Service Worker: ', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#f5f5f5" }}>
        {children}
        <InstallButton />
      </body>
    </html>
  );
}
