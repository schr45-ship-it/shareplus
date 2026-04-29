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
  metadataBase: new URL("https://car.clap.co.il"),
  other: {
    "og:image:secure_url": "https://car.clap.co.il/og.jpg?v=2",
    "og:image:type": "image/jpeg",
  },
  openGraph: {
    title: "SharePlus",
    description: "רשת טעינה שיתופית לקהילת ה-EV",
    url: "https://car.clap.co.il/",
    siteName: "SharePlus",
    images: [
      {
        url: "https://car.clap.co.il/og.jpg?v=2",
        width: 490,
        height: 306,
        alt: "SharePlus",
      },
    ],
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SharePlus",
    description: "רשת טעינה שיתופית לקהילת ה-EV",
    images: ["https://car.clap.co.il/og.jpg?v=2"],
  },
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
      <head>
        <meta property="og:title" content="SharePlus" />
        <meta property="og:description" content="רשת טעינה שיתופית לקהילת ה-EV" />
        <meta property="og:url" content="https://car.clap.co.il/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://car.clap.co.il/og.jpg?v=2" />
        <meta property="og:image:secure_url" content="https://car.clap.co.il/og.jpg?v=2" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="490" />
        <meta property="og:image:height" content="306" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SharePlus" />
        <meta name="twitter:description" content="רשת טעינה שיתופית לקהילת ה-EV" />
        <meta name="twitter:image" content="https://car.clap.co.il/og.jpg?v=2" />
      </head>
      <body className="min-h-full flex flex-col">
        <TermsGate />
        {children}
        <Footer />
        <AccessibilityWidget />
      </body>
    </html>
  );
}
