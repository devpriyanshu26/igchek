# IG Status Checker

A small Next.js app that answers a narrow question honestly: **is this Instagram account
findable from a logged-out view?** It then helps you compare that with what your own account
sees, so you can tell a block apart from a deactivation, deletion, suspension, or username change.

It is **not** a "who blocked me" detector. No such thing exists on Instagram.

## How it decides

A block is aimed at one person; deactivation and deletion affect everyone. So:

| Logged-out view | Your account | Meaning                                          |
| --------------- | ------------ | ------------------------------------------------ |
| Visible (public) | Can't see it | Almost certainly blocked                         |
| Visible (private)| Can't see it | Blocked, or removed as a follower after going private |
| Visible          | Can see it   | Not blocked                                      |
| Not found        | Can't see it | Deactivated / deleted / suspended / renamed      |
| Not found        | Can see it   | Inconsistent — retry, likely transient           |

The app checks the first column and asks you for the second.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Production:

```bash
npm run build
npm start
```

## Configuration

Copy `.env.example` to `.env.local` if you want to route requests through a proxy:

```
IG_PROXY_URL=http://user:pass@host:port
```

Instagram throttles datacenter IPs aggressively. If every check returns "Rate limited"
(HTTP 401/429), a residential or rotating proxy is effectively required.

## API

`GET /api/check?q=<username-or-profile-url>`

Returns one of:

- `{ kind: "found", username, visibility: "public" | "private", fullName, isVerified, followerCount, profilePic, checkedAt }`
- `{ kind: "not_found", username, checkedAt }`
- `{ kind: "rate_limited", username, status, checkedAt }`
- `{ kind: "error", username, message, checkedAt }`

Results are cached in memory for 60 seconds per username.

## Important limitations

- **Unofficial endpoint.** There is no public API for arbitrary profile status. This calls
  Instagram's internal `web_profile_info` web endpoint, which is not documented, requires the
  `x-ig-app-id` header, and violates Instagram's Terms of Use at any real volume. It can break or
  get your IP blocked without warning.
- **Not block detection.** The tool only observes the public, logged-out view.
- **Instagram only.** Snapchat has no public profile endpoint; Facebook's public surface is
  different and not implemented here.
- **Ethics.** This is for personal, good-faith use. Do not turn it into a bulk scraper, a
  stalkerware product, or anything that misleads people about what it can see.

Not affiliated with Instagram or Meta.
