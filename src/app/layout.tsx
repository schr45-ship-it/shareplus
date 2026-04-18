import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import AccessibilityWidget from "@/components/AccessibilityWidget";
import Footer from "@/components/Footer";
import TermsGate from "@/components/TermsGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SharePlus",
  description: "רשת טעינה שיתופית לקהילת ה-EV",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TermsGate />
        {children}
        <Footer />
        <AccessibilityWidget />
      </body>
    </html>
  );
}
