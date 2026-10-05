import { Link } from "@/i18n/routing";

const labels: Record<string, { about: string; contact: string; privacy: string; terms: string; accessibility: string; rights: string }> = {
  en: { about: "About", contact: "Contact", privacy: "Privacy Policy", terms: "Terms of Use", accessibility: "Accessibility", rights: "All rights reserved" },
  he: { about: "אודות", contact: "צור קשר", privacy: "מדיניות פרטיות", terms: "תנאי שימוש", accessibility: "נגישות", rights: "כל הזכויות שמורות" },
  es: { about: "Acerca de", contact: "Contacto", privacy: "Política de privacidad", terms: "Términos de uso", accessibility: "Accesibilidad", rights: "Todos los derechos reservados" },
  ar: { about: "حول", contact: "اتصل بنا", privacy: "سياسة الخصوصية", terms: "شروط الاستخدام", accessibility: "إمكانية الوصول", rights: "جميع الحقوق محفوظة" },
};

export function Footer({ locale }: { locale: string }) {
  const l = labels[locale] ?? labels.en;

  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-6 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-600">
          <Link href="/about" className="hover:text-zinc-900 hover:underline">{l.about}</Link>
          <Link href="/contact" className="hover:text-zinc-900 hover:underline">{l.contact}</Link>
          <Link href={"/privacy" as any} className="hover:text-zinc-900 hover:underline">{l.privacy}</Link>
          <Link href={"/terms" as any} className="hover:text-zinc-900 hover:underline">{l.terms}</Link>
          <Link href={"/accessibility" as any} className="hover:text-zinc-900 hover:underline">{l.accessibility}</Link>
        </nav>
        <p className="text-xs text-zinc-400">
          © {new Date().getFullYear()} SharePlus · shareplusai.com — {l.rights}
        </p>
      </div>
    </footer>
  );
}
