import { Metadata } from "next";

type Props = { params: Promise<{ locale: string }> };

const content: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  en: {
    title: "Privacy Policy",
    sections: [
      {
        h: "What we collect",
        p: "SharePlus is an AI-powered aggregation service. We automatically collect and summarize publicly available articles and videos. We do not require registration and do not store personal accounts.",
      },
      {
        h: "Cookies & analytics",
        p: "We use cookies and analytics tools (such as Google Analytics and Vercel Analytics) to understand traffic, improve performance, and measure content popularity. These tools may collect your IP address, device type and browsing behavior on this site.",
      },
      {
        h: "Advertising",
        p: "In the future we may display ads via Google AdSense or similar networks, which may use cookies to serve relevant ads. You can opt out of personalized advertising in your Google Ads settings.",
      },
      {
        h: "Content reports",
        p: "If you submit a content report, we store the report details to review the item. No personal data is required.",
      },
      {
        h: "Contact",
        p: "For privacy questions or removal requests, contact us via the Contact page or at contact@shareplusai.com.",
      },
    ],
  },
  he: {
    title: "מדיניות פרטיות",
    sections: [
      {
        h: "מה אנחנו אוספים",
        p: "SharePlus הוא שירות אגרגציה מבוסס AI. אנחנו אוספים ומסכמים באופן אוטומטי כתבות וסרטונים פומביים בלבד. האתר אינו דורש הרשמה ואינו שומר חשבונות משתמש.",
      },
      {
        h: "עוגיות וניתוח",
        p: "אנו משתמשים בעוגיות ובכלי ניתוח (כגון Google Analytics ו־Vercel Analytics) כדי להבין תנועה, לשפר ביצועים ולמדוד פופולריות של תוכן. הכלים עשויים לאסוף כתובת IP, סוג מכיור והתנהגות גלישה באתר.",
      },
      {
        h: "פרסומות",
        p: "בעתיד ייתכן ונציג פרסומות דרך Google AdSense או רשתות דומות, שעשויות להשתמש בעוגיות להצגת מודעות רלוונטיות. ניתן לבטל פרסום מותאם אישית בהגדרות Google Ads שלך.",
      },
      {
        h: "דיווחי תוכן",
        p: "אם תשלח דיווח על תוכן לא ראוי, נשמור את פרטי הדיווח לצורך בדיקת הפריט. אין צורך במסירת פרטים אישיים.",
      },
      {
        h: "יצירת קשר",
        p: "לשאלות בנושא פרטיות או בקשות הסרה, צור קשר דרך עמוד 'צור קשר' או בכתובת contact@shareplusai.com.",
      },
    ],
  },
  es: {
    title: "Política de Privacidad",
    sections: [
      { h: "Qué recopilamos", p: "SharePlus es un servicio de agregación impulsado por IA. Recopilamos y resumimos automáticamente artículos y videos públicos. No requerimos registro." },
      { h: "Cookies y analítica", p: "Usamos cookies y herramientas de análisis (Google Analytics, Vercel Analytics) para entender el tráfico y mejorar el rendimiento. Pueden recopilar IP, dispositivo y comportamiento de navegación." },
      { h: "Publicidad", p: "Podemos mostrar anuncios a través de Google AdSense, que puede usar cookies para mostrar anuncios relevantes." },
      { h: "Reportes de contenido", p: "Si envías un reporte de contenido inapropiado, guardamos los detalles para revisarlo. No se requieren datos personales." },
      { h: "Contacto", p: "Para preguntas de privacidad o solicitudes de eliminación, contáctanos en contact@shareplusai.com." },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    sections: [
      { h: "ما نجمعه", p: "SharePlus خدمة تجميع مدعومة بالذكاء الاصطناعي. نجمع ونلخص تلقائيًا مقالات وفيديوهات عامة. لا نتطلب التسجيل." },
      { h: "ملفات تعريف الارتباط والتحليلات", p: "نستخدم ملفات تعريف الارتباط وأدوات التحليل لفهم حركة المرور وتحسين الأداء." },
      { h: "الإعلانات", p: "قد نعرض إعلانات عبر Google AdSense، والتي قد تستخدم ملفات تعريف الارتباط لعرض إعلانات مناسبة." },
      { h: "تقارير المحتوى", p: "إذا أرسلت تقريرًا عن محتوى غير لائق، فإننا نخزن التفاصيل لمراجعته. لا حاجة لبيانات شخصية." },
      { h: "اتصل بنا", p: "لأسئلة الخصوصية أو طلبات الإزالة، راسلنا على contact@shareplusai.com." },
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = content[locale] ?? content.en;
  return { title: c.title, alternates: { canonical: `/${locale}/privacy` } };
}

export const revalidate = 86400;

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const c = content[locale] ?? content.en;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-zinc-900">{c.title}</h1>
      {c.sections.map((s) => (
        <section key={s.h} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">{s.h}</h2>
          <p className="leading-relaxed text-zinc-600">{s.p}</p>
        </section>
      ))}
    </div>
  );
}
