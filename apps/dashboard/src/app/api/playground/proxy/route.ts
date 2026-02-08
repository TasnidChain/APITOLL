import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!checkRateLimit(userId)) return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });

    const body = await req.json();
    const { method, url, headers: customHeaders, body: requestBody } = body;
    if (!url || !method) return NextResponse.json({ error: "Missing required fields: method, url" }, { status: 400 });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) return NextResponse.json({ error: "Only HTTP/HTTPS URLs allowed" }, { status: 400 });
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const hostname = parsedUrl.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("172.") || hostname === "0.0.0.0") {
      return NextResponse.json({ error: "Cannot proxy to internal/local addresses" }, { status: 400 });
    }

    const fetchHeaders: Record<string, string> = { "User-Agent": "APIToll-Playground/1.0", Accept: "application/json", ...customHeaders };
    delete fetchHeaders["cookie"];
    delete fetchHeaders["Cookie"];

    const fetchOptions: RequestInit = { method, headers: fetchHeaders, signal: AbortSignal.timeout(15_000) };
    if (requestBody && !["GET", "HEAD"].includes(method)) {
      fetchOptions.body = typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody);
      fetchHeaders["Content-Type"] = "application/json";
    }

    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    const latencyMs = Date.now() - startTime;

    const contentType = response.headers.get("content-type") || "";
    let responseBody: unknown;
    if (contentType.includes("application/json")) { responseBody = await response.json(); } else { responseBody = await response.text(); }

    const responseHeaders: Record<string, string> = {};
    for (const header of ["content-type", "x-payment", "payment-required", "x-apitoll-discovery", "x-apitoll-referral", "x-ratelimit-remaining", "retry-after"]) {
      const value = response.headers.get(header);
      if (value) responseHeaders[header] = value;
    }

    return NextResponse.json({ status: response.status, statusText: response.statusText, headers: responseHeaders, body: responseBody, latencyMs });
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return NextResponse.json({ status: 0, statusText: "Timeout", headers: {}, body: { error: "Request timed out after 15 seconds" }, latencyMs: 15000 });
    }
    return NextResponse.json({ status: 0, statusText: "Error", headers: {}, body: { error: error.message || "Failed to proxy request" }, latencyMs: 0 });
  }
}
