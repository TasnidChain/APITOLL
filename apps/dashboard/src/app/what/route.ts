import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

let cachedHtml: string | null = null;

export async function GET() {
  if (!cachedHtml) {
    // In standalone mode, public files are at different paths
    const paths = [
      resolve(process.cwd(), "public", "what.html"),
      resolve(process.cwd(), "apps/dashboard/public", "what.html"),
    ];
    for (const p of paths) {
      try {
        cachedHtml = readFileSync(p, "utf-8");
        break;
      } catch {}
    }
  }

  if (!cachedHtml) {
    return new NextResponse("Page not found", { status: 404 });
  }

  return new NextResponse(cachedHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
