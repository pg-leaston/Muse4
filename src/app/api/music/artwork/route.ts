import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host.endsWith("archive.org") ||
      host.endsWith("coverartarchive.org") ||
      host.endsWith("ia800000.us.archive.org");

    if (!allowed) {
      return NextResponse.json({ error: "Artwork host not allowed." }, { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not fetch artwork." },
        { status: 502 },
      );
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Artwork fetch failed." }, { status: 500 });
  }
}
