import { Metadata } from "next";

type Props = { params: Promise<{ locale: string }> };

const content: Record<string, { title: string; intro: string; features: string[]; contact: string }> = {
  en: {
    title: "Accessibility Statement",
    intro: "SharePlus is committed to making its content accessible to all users, including people with disabilities. This site follows modern web standards and aims to conform to WCAG 2.1 Level AA guidelines.",
    features: [
      "Full keyboard navigation support",
      "Semantic HTML structure for screen readers",
      "Adjustable text size via browser zoom",
      "High-contrast readable design",
      "Alt text on meaningful images",
      "RTL language support for Hebrew and Arabic",
    ],
    contact: "If you encounter an accessibility barrier, please report it via the Contact page or at contact@shareplusai.com and we will address it promptly.",
  },
  he: {
    title: "הצהרת נגישות",
    intro: "SharePlus מחויבת להנגשת התוכן לכלל המשתמשים, לרבות אנשים עם מוגבלויות. האתר בנוי על תקנים מודרניים ושואף לעמוד בהנחיות WCAG 2.1 ברמה AA, בהתאם לדרישות תקנות שוויון זכויות לאנשים עם מוגבלות בישראל.",
    features: [
      "ניווט מלא באמצעות מקלדת",
      "מבנה HTML סמנטי לקוראי מסך",
      "אפשרות להגדלת טקסט באמצעות זום בדפדפן",
      "עיצוב קריא עם ניגודיות גבוהה",
      "טקסט חלופי לתמונות משמעותיות",
      "תמיכה מלאה ב־RTL בעברית ובערבית",
    ],
    contact: "אם נתקלת במכשול נגישות — דווח דרך עמוד 'צור קשר' או בכתובת contact@shareplusai.com ונטפל בכך בהקדם.",
  },
  es: {
    title: "Declaración de Accesibilidad",
    intro: "SharePlus se compromete a hacer su contenido accesible para todos los usuarios. El sitio sigue estándares web modernos orientados a WCAG 2.1 AA.",
    features: [
      "Navegación completa por teclado",
      "Estructura HTML semántica para lectores de pantalla",
      "Texto ampliable mediante zoom del navegador",
      "Diseño legible de alto contraste",
      "Texto alternativo en imágenes significativas",
      "Soporte RTL para hebreo y árabe",
    ],
    contact: "Si encuentras una barrera de accesibilidad, repórtala en contact@shareplusai.com.",
  },
  ar: {
    title: "بيان إمكانية الوصول",
    intro: "تلتزم SharePlus بجعل محتواها في متناول جميع المستخدمين، بما في ذلك الأشخاص ذوو الإعاقة. الموقع مبني وفق معايير حديثة تتوافق مع إرشادات WCAG 2.1 AA.",
    features: [
      "تنقل كامل بلوحة المفاتيح",
      "بنية HTML دلالية لقارئات الشاشة",
      "إمكانية تكبير النص عبر تكبير المتصفح",
      "تصميم مقروء بتباين عالٍ",
      "نص بديل للصور المهمة",
      "دعم كامل للغات RTL",
    ],
    contact: "إذا واجهت حاجزًا في إمكانية الوصول، أبلغ عبر صفحة 'اتصل بنا' أو على contact@shareplusai.com.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = content[locale] ?? content.en;
  return { title: c.title, alternates: { canonical: `/${locale}/accessibility` } };
}

export const revalidate = 86400;

export default async function AccessibilityPage({ params }: Props) {
  const { locale } = await params;
  const c = content[locale] ?? content.en;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold text-zinc-900">{c.title}</h1>
      <p className="mb-8 leading-relaxed text-zinc-600">{c.intro}</p>
      <ul className="mb-8 space-y-2">
        {c.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-zinc-700">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-600" />
            {f}
          </li>
        ))}
      </ul>
      <p className="leading-relaxed text-zinc-600">{c.contact}</p>
    </div>
  );
}
