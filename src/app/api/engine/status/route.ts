import { NextResponse } from "next/server";
import { checkVtonHealth } from "@/server/vton-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkVtonHealth();
  return NextResponse.json(status);
}
