import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "AI SharePlus";
  const category = searchParams.get("category") || "News";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: 80,
          color: "white",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            background: "#3b82f6",
            padding: "12px 24px",
            marginBottom: 40,
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {category}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.2,
            maxWidth: 900,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 32,
            color: "#94a3b8",
          }}
        >
          <span style={{ color: "#3b82f6", fontWeight: 700 }}>AI SharePlus</span>
          <span>•</span>
          <span>AI-Powered Summaries</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
