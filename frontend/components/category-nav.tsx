import { Link } from "@/i18n/routing";
import { getCategories } from "@/lib/supabase/queries";

export async function CategoryNav({ locale }: { locale: string }) {
  const categories = await getCategories(locale);

  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="Categories"
      className="border-b border-zinc-100 bg-white"
    >
      <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/${category.slug}` as any}
            className="whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            {category.name_json[locale] ?? category.name_json["en"] ?? category.slug}
          </Link>
        ))}
      </div>
    </nav>
  );
}
