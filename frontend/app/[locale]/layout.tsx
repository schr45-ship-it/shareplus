import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { LocaleDirection } from "@/components/locale-direction";
import { Navbar } from "@/components/navbar";
import { GoogleAnalytics } from "@/components/google-analytics";
import { AdSenseScript } from "@/components/adsense-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      dir={locale === "ar" || locale === "he" ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <GoogleAnalytics />
        <AdSenseScript />
      </head>
      <body className="min-h-full flex flex-col bg-white text-foreground">
        <LocaleDirection locale={locale}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Navbar />
            <main className="flex-1">{children}</main>
          </NextIntlClientProvider>
        </LocaleDirection>
      </body>
    </html>
  );
}
