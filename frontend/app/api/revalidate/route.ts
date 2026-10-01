import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, category, locales = [] } = body as {
      slug?: string;
      category?: string;
      locales?: string[];
    };

    revalidatePath("/", "layout");

    if (category && slug && locales.length > 0) {
      for (const locale of locales) {
        revalidatePath(`/${locale}/${category}/${slug}`);
      }
    } else if (category) {
      for (const locale of locales.length > 0 ? locales : ["en"]) {
        revalidatePath(`/${locale}/${category}`);
      }
    }

    return NextResponse.json({ revalidated: true });
  } catch (error) {
    return NextResponse.json(
      { message: "Error revalidating", error: String(error) },
      { status: 500 },
    );
  }
}
