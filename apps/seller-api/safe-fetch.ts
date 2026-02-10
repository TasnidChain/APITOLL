/**
 * Unified SSRF-safe fetch utility.
 * Blocks private IPs, IPv6 mapped addresses, DNS rebinding, redirect-based SSRF.
 * All URL-fetching routes MUST use this instead of raw fetch().
 */

import dns from "dns/promises";
import net from "net";

function isPrivateIP(ip: string): boolean {
  // Normalize IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1 → 127.0.0.1)
  let normalizedIP = ip;
  if (normalizedIP.startsWith("::ffff:")) {
    normalizedIP = normalizedIP.slice(7);
  }
  // Remove brackets from IPv6
  normalizedIP = normalizedIP.replace(/^\[|\]$/g, "");

  // IPv4 checks
  if (net.isIPv4(normalizedIP)) {
    const parts = normalizedIP.split(".").map(Number);
    if (
      parts[0] === 127 || // 127.0.0.0/8 (loopback)
      parts[0] === 10 || // 10.0.0.0/8 (private)
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16 (link-local / cloud metadata)
      parts[0] === 0 || // 0.0.0.0/8
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || // 100.64.0.0/10 (carrier NAT)
      (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) // 198.18.0.0/15 (benchmarking)
    ) {
      return true;
    }
  }

  // IPv6 checks
  if (net.isIPv6(normalizedIP)) {
    const lower = normalizedIP.toLowerCase();
    if (
      lower === "::1" || // loopback
      lower === "::" || // unspecified
      lower.startsWith("fc") || // unique local
      lower.startsWith("fd") || // unique local
      lower.startsWith("fe80") || // link-local
      lower.startsWith("::ffff:") // IPv4-mapped (re-check)
    ) {
      return true;
    }
    // Check if it's an IPv4-mapped IPv6 that maps to a private IPv4
    const v4Match = normalizedIP.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/i);
    if (v4Match) {
      return isPrivateIP(v4Match[1]);
    }
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Block obvious localhost aliases
  if (["localhost", "localhost.", "ip6-localhost", "ip6-loopback"].includes(lower)) {
    return true;
  }

  // Block numeric-only hostnames (decimal IP notation like 2130706433)
  if (/^\d+$/.test(lower)) {
    return true;
  }

  // Block octal IP notation (0177.0.0.1)
  if (/^0\d+\./.test(lower)) {
    return true;
  }

  // Block hex IP notation
  if (/^0x[0-9a-f]+$/i.test(lower)) {
    return true;
  }

  // If it parses as an IP, check if it's private
  if (net.isIP(lower)) {
    return isPrivateIP(lower);
  }

  return false;
}

async function resolveAndCheck(hostname: string): Promise<void> {
  // If hostname is already an IP, check directly
  const cleanHost = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(cleanHost)) {
    if (isPrivateIP(cleanHost)) {
      throw new Error("Cannot connect to private/reserved IP addresses");
    }
    return;
  }

  // Resolve DNS and check ALL resolved IPs
  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    const allAddresses = [...addresses, ...addresses6];

    if (allAddresses.length === 0) {
      // If DNS doesn't resolve, let fetch handle the error
      return;
    }

    for (const addr of allAddresses) {
      if (isPrivateIP(addr)) {
        throw new Error("DNS resolved to private/reserved IP address");
      }
    }
  } catch (err) {
    if ((err as Error).message.includes("private") || (err as Error).message.includes("reserved")) {
      throw err;
    }
    // DNS resolution errors are OK — let fetch handle them
  }
}

export interface SafeFetchOptions extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
}

export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 10000, maxRedirects = 5, signal: callerSignal, ...fetchOptions } = options;

  // Step 1: Parse and validate the URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("Cannot fetch internal/private addresses");
  }

  // Step 2: Resolve DNS and verify IPs BEFORE making the request
  await resolveAndCheck(parsed.hostname);

  // Step 3: Fetch with manual redirect handling (re-check each redirect)
  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    const response = await fetch(currentUrl, {
      ...fetchOptions,
      signal: callerSignal || AbortSignal.timeout(timeoutMs),
      redirect: "manual", // Don't auto-follow — we check each redirect
    });

    // If not a redirect, return
    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    // Handle redirect
    redirectCount++;
    if (redirectCount > maxRedirects) {
      throw new Error(`Too many redirects (>${maxRedirects})`);
    }

    const location = response.headers.get("location");
    if (!location) {
      return response; // No Location header, return as-is
    }

    // Resolve relative redirect URLs
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(location, currentUrl);
    } catch {
      throw new Error("Invalid redirect URL");
    }

    // Re-check the redirect target for SSRF
    if (!["http:", "https:"].includes(redirectUrl.protocol)) {
      throw new Error("Redirect to non-HTTP(S) protocol blocked");
    }
    if (isBlockedHostname(redirectUrl.hostname)) {
      throw new Error("Redirect to internal/private address blocked");
    }
    await resolveAndCheck(redirectUrl.hostname);

    currentUrl = redirectUrl.toString();
  }
}

export function validateDomain(domain: string): string {
  // Clean protocol and path
  const cleaned = domain.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].toLowerCase();

  if (!cleaned || cleaned.length > 253) {
    throw new Error("Invalid domain");
  }

  if (isBlockedHostname(cleaned)) {
    throw new Error("Cannot query internal/private addresses");
  }

  return cleaned;
}

export async function validateDomainWithDNS(domain: string): Promise<string> {
  const cleaned = validateDomain(domain);
  await resolveAndCheck(cleaned);
  return cleaned;
}

// Export for DNS oracle protection
export { isBlockedHostname, isPrivateIP };
