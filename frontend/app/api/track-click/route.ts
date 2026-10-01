import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const articleId = body?.articleId;

    if (!articleId || typeof articleId !== "string") {
      return NextResponse.json({ error: "Invalid articleId" }, { status: 400 });
    }

    const supabase = await createClient();
    await (supabase.rpc as any)("increment_article_clicks", {
      p_article_id: articleId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("track-click error:", error);
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500 },
    );
  }
}
