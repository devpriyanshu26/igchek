import { fetch as undiciFetch, ProxyAgent } from "undici";

const IG_APP_ID = "936619743392459";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

export type ProfileStatus =
  | {
      kind: "found";
      username: string;
      visibility: "public" | "private";
      fullName: string | null;
      isVerified: boolean;
      followerCount: number | null;
      profilePic: string | null;
      checkedAt: string;
    }
  | { kind: "not_found"; username: string; checkedAt: string }
  | { kind: "rate_limited"; username: string; status: number; checkedAt: string }
  | { kind: "error"; username: string; message: string; status?: number; checkedAt: string };

const RESERVED_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "about",
  "legal",
  "tv",
  "direct",
  "developer",
]);

export function normalizeUsername(raw: string): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  if (/instagram\.com/i.test(value) || /^https?:\/\//i.test(value)) {
    try {
      const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const url = new URL(withProtocol);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length === 0) return null;
      if (RESERVED_SEGMENTS.has(segments[0].toLowerCase())) return null;
      value = segments[0];
    } catch {
      return null;
    }
  }

  value = value.replace(/^@+/, "");
  value = value.split(/[/?#]/)[0];

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(value)) return null;
  if (value.startsWith(".") || value.endsWith(".") || value.includes("..")) return null;

  return value.toLowerCase();
}

let proxyAgent: ProxyAgent | null | undefined;

function getProxyAgent(): ProxyAgent | null {
  if (proxyAgent !== undefined) return proxyAgent;
  const proxyUrl = process.env.IG_PROXY_URL;
  if (!proxyUrl) {
    proxyAgent = null;
    return proxyAgent;
  }
  try {
    proxyAgent = new ProxyAgent(proxyUrl);
  } catch {
    proxyAgent = null;
  }
  return proxyAgent;
}

type RawUser = {
  username?: string;
  full_name?: string;
  is_private?: boolean;
  is_verified?: boolean;
  edge_followed_by?: { count?: number };
  profile_pic_url_hd?: string;
  profile_pic_url?: string;
};

async function fetchProfile(username: string): Promise<ProfileStatus> {
  const checkedAt = new Date().toISOString();
  const endpoint = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
    username,
  )}`;

  const headers: Record<string, string> = {
    "x-ig-app-id": IG_APP_ID,
    "user-agent": USER_AGENT,
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    referer: `https://www.instagram.com/${username}/`,
  };

  const agent = getProxyAgent();

  let response: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    response = await undiciFetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(agent ? { dispatcher: agent } : {}),
    });
  } catch {
    return {
      kind: "error",
      username,
      message: "Could not reach Instagram. Check the connection or proxy settings.",
      checkedAt,
    };
  }

  if (response.status === 404) {
    return { kind: "not_found", username, checkedAt };
  }
  if (response.status === 401 || response.status === 429) {
    return { kind: "rate_limited", username, status: response.status, checkedAt };
  }
  if (!response.ok) {
    return {
      kind: "error",
      username,
      message: `Instagram returned HTTP ${response.status}.`,
      status: response.status,
      checkedAt,
    };
  }

  let body: { data?: { user?: RawUser | null } } | null;
  try {
    body = (await response.json()) as { data?: { user?: RawUser | null } };
  } catch {
    return {
      kind: "error",
      username,
      message: "Instagram returned a response that couldn't be parsed.",
      checkedAt,
    };
  }

  const user = body?.data?.user;
  if (!user) {
    return { kind: "not_found", username, checkedAt };
  }

  const followerCount =
    typeof user.edge_followed_by?.count === "number" ? user.edge_followed_by.count : null;

  return {
    kind: "found",
    username: user.username ?? username,
    visibility: user.is_private ? "private" : "public",
    fullName: user.full_name?.trim() || null,
    isVerified: Boolean(user.is_verified),
    followerCount,
    profilePic: user.profile_pic_url_hd || user.profile_pic_url || null,
    checkedAt,
  };
}

type CacheEntry = { at: number; value: ProfileStatus };
const cache = new Map<string, CacheEntry>();

export async function checkProfile(username: string): Promise<ProfileStatus> {
  const now = Date.now();
  const cached = cache.get(username);
  if (
    cached &&
    now - cached.at < CACHE_TTL_MS &&
    cached.value.kind !== "rate_limited" &&
    cached.value.kind !== "error"
  ) {
    return cached.value;
  }

  const value = await fetchProfile(username);
  cache.set(username, { at: now, value });

  if (cache.size > 500) {
    for (const [key, entry] of cache) {
      if (now - entry.at >= CACHE_TTL_MS) cache.delete(key);
    }
  }

  return value;
}
