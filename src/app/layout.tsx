import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import ScrollNav from "@/components/ScrollNav";

export const metadata: Metadata = {
  title: "Gullhaug Fantasy Football",
  description: "Fantasy football for Gullhaug — build your squad, pick your XI, beat your friends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="min-h-screen bg-pitch font-sans">
        <SiteHeader />
        <ScrollNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
