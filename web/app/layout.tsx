import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telco Agent Demo",
  description: "Elastic Agent Builder telco persona demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
