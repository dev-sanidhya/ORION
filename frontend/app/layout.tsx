import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORION",
  description: "Personal AI Assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="hud-grid">{children}</body>
    </html>
  );
}
