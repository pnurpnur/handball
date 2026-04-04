import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emre – Håndball",
  description: "Kampstatistikk for Emre Askim Pettersen",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
