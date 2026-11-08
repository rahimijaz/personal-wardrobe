import { NextResponse } from "next/server";
import { getVtonJobById } from "@/server/storage";
import { cancelTryOnJob } from "@/server/vton-client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getVtonJobById(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = await cancelTryOnJob(id);
  return NextResponse.json({ success, message: `Job ${id} cancelled.` });
}
