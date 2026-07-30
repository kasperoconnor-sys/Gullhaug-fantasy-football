import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Gullhaug Fantasy Football",
  description: "Fantasy football for Gullhaug — build your squad, pick your XI, beat your friends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className="dark">
      <body className="min-h-screen bg-pitch font-sans">
        <TopNav />
        <main className="pb-20 md:pb-0">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
