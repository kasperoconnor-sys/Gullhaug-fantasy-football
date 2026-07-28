import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Gullhaug Fantasy Football",
  description: "Fantasy football for Gullhaug — build your squad, pick your XI, beat your friends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className="dark">
      <body className="min-h-screen bg-pitch font-sans">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
