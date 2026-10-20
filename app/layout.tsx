import type { Metadata } from "next";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Side B | Your stock. Their next obsession.",
  description:
    "The Qloo-powered merchandising agent for independent record shops. Turn cultural taste into a shoppable edit from records already on your shelves.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
