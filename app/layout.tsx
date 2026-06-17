import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FantAssisi 2026",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#FF6B35"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}