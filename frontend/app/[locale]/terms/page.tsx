import { Metadata } from "next";

type Props = { params: Promise<{ locale: string }> };

const content: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  en: {
    title: "Terms of Use",
    sections: [
      { h: "Automated content", p: "The content on SharePlus is generated and published automatically by AI systems that summarize publicly available articles and videos. While we strive for accuracy, we do not guarantee that every summary is complete, accurate, or up to date." },
      { h: "Third-party sources", p: "Content is aggregated from external sources (RSS feeds, YouTube). We are not responsible for the accuracy or legality of the original source material. A link to the original source is provided on every item." },
      { h: "Copyright / DMCA", p: "All content is credited to its original source with a direct link. If you are a rights holder and believe your content is used improperly, contact us and we will review and remove it promptly." },
      { h: "Reporting inappropriate content", p: "If you encounter content that seems inappropriate, misleading or harmful, please use the report button on the article page. Our moderators will review it." },
      { h: "No professional advice", p: "Content on this site is for informational purposes only and does not constitute legal, financial, medical or other professional advice." },
      { h: "Limitation of liability", p: "To the fullest extent permitted by law, SharePlus shall not be liable for any damages arising from use of the site or reliance on its content." },
    ],
  },
  he: {
    title: "תנאי שימוש",
    sections: [
      { h: "תוכן אוטומטי", p: "התוכן ב־SharePlus מופק ומפורסם אוטומטית על ידי מערכות AI שמסכמות כתבות וסרטונים פומביים. אנו שואפים לדיוק, אך איננו מתחייבים שכל סיכום יהיה מלא, מדויק או עדכני." },
      { h: "מקורות צד שלישי", p: "התוכן מאוגרג ממקורות חיצוניים (RSS, YouTube). איננו אחראים לדיוק או לחוקיות חומר המקור. בכל פריט מוצג קישור ישיר למקור המקורי." },
      { h: "זכויות יוצרים / DMCA", p: "כל התוכן מקבל קרדיט למקור המקורי עם קישור ישיר. אם אתה בעל זכויות וסבור שתוכן שלך משומש שלא כהלכה — צור קשר ואנו נבחן ונסיר מיידית." },
      { h: "דיווח על תוכן לא ראוי", p: "אם נתקלת בתוכן שנראה לא מתאים, מטעה או מזיק — לחץ על כפתור הדיווח בדף הכתבה והצוות יבדוק." },
      { h: "אין ייעוץ מקצועי", p: "התוכן באתר נועד למידע כללי בלבד ואינו מהווה ייעוץ משפטי, פיננסי, רפואי או מקצועי אחר." },
      { h: "הגבלת אחריות", p: "במידה המרבית המותרת בחוק, SharePlus לא תהיה אחראית לנזקים הנובעים משימוש באתר או מהסתמכות על התוכן." },
    ],
  },
  es: {
    title: "Términos de Uso",
    sections: [
      { h: "Contenido automatizado", p: "El contenido de SharePlus es generado automáticamente por sistemas de IA que resumen artículos y videos públicos. No garantizamos que cada resumen sea completo o exacto." },
      { h: "Fuentes de terceros", p: "El contenido proviene de fuentes externas (RSS, YouTube). No somos responsables de la exactitud del material original." },
      { h: "Derechos de autor / DMCA", p: "Todo el contenido acredita su fuente original con un enlace directo. Si eres titular de derechos y crees que tu contenido se usa indebidamente, contáctanos y lo retiraremos." },
      { h: "Reportar contenido", p: "Si encuentras contenido inapropiado, usa el botón de reporte en la página del artículo." },
      { h: "Sin asesoramiento profesional", p: "El contenido es solo informativo y no constituye asesoramiento legal, financiero o médico." },
      { h: "Limitación de responsabilidad", p: "En la medida permitida por la ley, SharePlus no será responsable de daños derivados del uso del sitio." },
    ],
  },
  ar: {
    title: "شروط الاستخدام",
    sections: [
      { h: "محتوى آلي", p: "يتم إنشاء محتوى SharePlus تلقائيًا بواسطة أنظمة ذكاء اصطناعي تلخص مقالات وفيديوهات عامة. لا نضمن دقة كل ملخص." },
      { h: "مصادر خارجية", p: "المحتوى مجمع من مصادر خارجية (RSS وYouTube). لسنا مسؤولين عن دقة المادة الأصلية." },
      { h: "حقوق النشر / DMCA", p: "كل محتوى ينسب مصدره الأصلي مع رابط مباشر. أصحاب الحقوق يمكنهم طلب المراجعة والإزالة عبر الاتصال بنا." },
      { h: "الإبلاغ عن محتوى غير لائق", p: "إذا وجدت محتوى غير مناسب، استخدم زر الإبلاغ في صفحة المقال." },
      { h: "لا نصيحة مهنية", p: "المحتوى للمعلومات العامة فقط وليس نصيحة قانونية أو مالية أو طبية." },
      { h: "حدود المسؤولية", p: "إلى الحد المسموح به قانونًا، لا تتحمل SharePlus مسؤولية أضرار ناجمة عن استخدام الموقع." },
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = content[locale] ?? content.en;
  return { title: c.title, alternates: { canonical: `/${locale}/terms` } };
}

export const revalidate = 86400;

export default async function TermsPage({ params }: Props) {
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
