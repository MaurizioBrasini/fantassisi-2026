import type { Metadata } from "next"; 
import "./globals.css"; 
export const metadata: Metadata = { 
  title: "FantAssisi 2026", 
  manifest: "/manifest.json", 
  themeColor: "#FF6B35" 
}; 
export default function RootLayout({ children }) { 
  return ( 
    <html lang="it"> 
      <body>{children}</body> 
    </html> 
  ); 
} 
