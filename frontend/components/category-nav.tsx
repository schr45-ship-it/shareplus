import { categoryLabel } from "@/lib/site";
import { Link } from "@/i18n/routing";
import { getCategories, getCategoryCounts } from "@/lib/supabase/queries";

export async function CategoryNav({ locale }: { locale: string }) {
  const [categories, counts] = await Promise.all([
    getCategories(locale),
    getCategoryCounts(locale),
  ]);

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
            {categoryLabel(category.name_json, category.slug, locale)}
            <span className="ms-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500">
              {counts[category.slug] ?? 0}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
