import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Channel Flow — Specific Energy Simulator",
  description: "Interactive open-channel hydraulics laboratory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}