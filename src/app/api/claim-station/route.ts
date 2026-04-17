import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json(
    { error: "Claim station is disabled" },
    { status: 410 }
  );
}
