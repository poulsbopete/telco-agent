import { NextResponse } from "next/server";
import { CARRIERS, STARTER_PROMPTS } from "@/lib/personas";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ carriers: CARRIERS, starterPrompts: STARTER_PROMPTS });
}
