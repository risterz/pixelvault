import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

// JetBrains Mono for headings and code feel — chosen for hacker aesthetic identity.
// Inter for body text — optimal readability at small sizes.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "PixelVault — Hide secrets in plain sight",
  description:
    "Client-side image steganography with AES-256 encryption. Zero uploads, zero traces. Your secrets stay in your browser.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${inter.variable}`}>
      <body className="bg-[#0a0a0a] text-[#d4d4d4] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
