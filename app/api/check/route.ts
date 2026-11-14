import { NextRequest, NextResponse } from "next/server";
import { checkProfile, normalizeUsername } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!raw) {
    return NextResponse.json(
      { error: "Enter an Instagram username or profile link." },
      { status: 400 },
    );
  }

  const username = normalizeUsername(raw);
  if (!username) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Instagram username or profile link." },
      { status: 400 },
    );
  }

  const result = await checkProfile(username);
  return NextResponse.json(result);
}
