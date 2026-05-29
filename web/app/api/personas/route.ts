import { NextResponse } from "next/server";
import { CARRIERS } from "@/lib/personas";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ carriers: CARRIERS });
}
