import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dns from "dns/promises";

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

// Comprehensive SSRF protection with DNS resolution
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  if (ip === "0.0.0.0") return true;
  // IPv6
  if (ip === "::1" || ip === "::") return true;
  if (/^f[cd]/i.test(ip)) return true;
  if (/^fe80/i.test(ip)) return true;
  // IPv6-mapped IPv4
  if (ip.startsWith("::ffff:")) {
    const v4 = ip.slice(7);
    return isPrivateIP(v4);
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const blocked = ["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"];
  if (blocked.includes(lower)) return true;
  // Block numeric-only hostnames (decimal IP notation)
  if (/^\d+$/.test(lower)) return true;
  // Block octal/hex notation
  if (/^0[xX]/.test(lower) || /^0\d+\./.test(lower)) return true;
  // Direct IP check
  if (isPrivateIP(hostname)) return true;
  return false;
}

async function resolveAndCheckDNS(hostname: string): Promise<void> {
  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    const allAddresses = [...addresses, ...addresses6];
    for (const addr of allAddresses) {
      if (isPrivateIP(addr)) {
        throw new Error("Cannot proxy to internal/local addresses");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Cannot proxy")) throw err;
    // DNS resolution failed — let the fetch handle it
  }
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

    const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, "");

    // Enhanced SSRF protection
    if (isBlockedHostname(hostname)) {
      return NextResponse.json({ error: "Cannot proxy to internal/local addresses" }, { status: 400 });
    }

    // DNS resolution check to prevent DNS rebinding
    await resolveAndCheckDNS(hostname);

    const fetchHeaders: Record<string, string> = { "User-Agent": "APIToll-Playground/1.0", Accept: "application/json", ...customHeaders };
    // Strip sensitive headers
    delete fetchHeaders["cookie"];
    delete fetchHeaders["Cookie"];
    delete fetchHeaders["authorization"];
    delete fetchHeaders["Authorization"];

    // Disable redirects to prevent redirect-based SSRF
    const fetchOptions: RequestInit = { method, headers: fetchHeaders, signal: AbortSignal.timeout(15_000), redirect: "manual" };
    if (requestBody && !["GET", "HEAD"].includes(method)) {
      fetchOptions.body = typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody);
      fetchHeaders["Content-Type"] = "application/json";
    }

    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    const latencyMs = Date.now() - startTime;

    // If redirect, validate target before following
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      return NextResponse.json({
        status: response.status,
        statusText: response.statusText,
        headers: { location: location || "" },
        body: { error: "Redirect detected — redirects are not followed for security reasons", redirectTo: location },
        latencyMs,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    let responseBody: unknown;
    if (contentType.includes("application/json")) { responseBody = await response.json(); } else { responseBody = await response.text(); }

    const responseHeaders: Record<string, string> = {};
    for (const header of ["content-type", "x-payment", "payment-required", "x-apitoll-discovery", "x-apitoll-referral", "x-ratelimit-remaining", "retry-after"]) {
      const value = response.headers.get(header);
      if (value) responseHeaders[header] = value;
    }

    return NextResponse.json({ status: response.status, statusText: response.statusText, headers: responseHeaders, body: responseBody, latencyMs });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Failed to proxy request");
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return NextResponse.json({ status: 0, statusText: "Timeout", headers: {}, body: { error: "Request timed out after 15 seconds" }, latencyMs: 15000 });
    }
    // Don't leak internal error details
    const isSafe = err.message.includes("Cannot proxy") || err.message.includes("Only HTTP");
    return NextResponse.json({ status: 0, statusText: "Error", headers: {}, body: { error: isSafe ? err.message : "Failed to proxy request" }, latencyMs: 0 });
  }
}
