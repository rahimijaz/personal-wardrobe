import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VTON_SERVICE_URL =
  process.env.VTON_SERVICE_URL || "http://127.0.0.1:8188";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let imageBase64 = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("image");
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageBase64 = buffer.toString("base64");
      } else if (typeof formData.get("image") === "string") {
        imageBase64 = formData.get("image") as string;
      }
    } else {
      const body = await req.json();
      imageBase64 = body.image || "";
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Image data is required for background removal" },
        { status: 400 }
      );
    }

    // Call local Python service
    const pyRes = await fetch(`${VTON_SERVICE_URL}/remove-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
      signal: AbortSignal.timeout(30000),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json(
        { error: `Background removal failed: ${errText}` },
        { status: pyRes.status }
      );
    }

    const data = await pyRes.json();
    return NextResponse.json({
      image: data.image,
      width: data.width,
      height: data.height,
    });
  } catch (err: any) {
    console.error("Error during background removal:", err);
    return NextResponse.json(
      {
        error:
          err.message ||
          "Failed to remove background. Ensure the local Python service is running.",
      },
      { status: 500 }
    );
  }
}
