"use client";

import { useState, type FormEvent } from "react";
import type { ProfileStatus } from "@/lib/instagram";

type View = "see" | "cant_see" | "unsure";
type Tone = "danger" | "good" | "warn" | "info";

type Verdict = { title: string; tone: Tone; detail: string };

function getVerdict(result: ProfileStatus, view: View): Verdict | null {
  if (result.kind !== "found" && result.kind !== "not_found") return null;

  if (view === "unsure") {
    return {
      tone: "info",
      title: "Now check your own view",
      detail:
        "Open Instagram while signed in to your account and try to open this profile. Then pick what you see above.",
    };
  }

  if (result.kind === "found") {
    if (view === "cant_see") {
      if (result.visibility === "public") {
        return {
          tone: "danger",
          title: "You are almost certainly blocked",
          detail:
            "This profile is visible to anyone who is logged out, but your account can't see it. A public account hiding itself from you specifically is the signature of a block.",
        };
      }
      return {
        tone: "warn",
        title: "Most likely blocked — or removed as a follower",
        detail:
          "The account exists and is private. If your account can't open it, you were either blocked, or they switched to private and removed you as a follower. Those two look identical from the outside.",
      };
    }
    return {
      tone: "good",
      title: "You are not blocked",
      detail:
        result.visibility === "public"
          ? "The profile is public and your account can see it too, so there's no block."
          : "The account is private and your account can still open it, so you're still an approved follower and not blocked.",
    };
  }

  if (view === "cant_see") {
    return {
      tone: "warn",
      title: "Not a block — the account is gone for everyone",
      detail:
        "The profile doesn't exist even when logged out. That points to deactivation, deletion, a suspension, or a username change. A block would leave it visible to everyone else, so this isn't about you.",
    };
  }

  return {
    tone: "info",
    title: "Inconsistent result",
    detail:
      "Your account can see the profile but the logged-out view can't. Usually that's a temporary Instagram error, a typo, or a region restriction. Wait a minute and try again.",
  };
}

export default function Checker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProfileStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setView(null);

    try {
      const response = await fetch(`/api/check?q=${encodeURIComponent(value)}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Something went wrong.");
      } else {
        setResult(data as ProfileStatus);
      }
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  const verdict = result && view ? getVerdict(result, view) : null;
  const canCompare = result?.kind === "found" || result?.kind === "not_found";

  return (
    <main className="wrap">
      <header className="hero">
        <span className="eyebrow">Instagram · logged-out view</span>
        <h1 className="title">Blocked, deactivated, or deleted?</h1>
        <p className="sub">
          No one can see a block from the outside — not even this tool. What it can do is tell you
          what Instagram shows to a logged-out visitor. Compare that with what your own account
          sees, and the difference tells the story.
        </p>
      </header>

      <form className="card form" onSubmit={onSubmit}>
        <label className="label" htmlFor="q">
          Username or profile link
        </label>
        <div className="row">
          <input
            id="q"
            className="input"
            placeholder="@username or https://instagram.com/username"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn" type="submit" disabled={loading || !query.trim()}>
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
        <p className="hint">
          Only public information is read. No login, no password, and the account is never notified.
        </p>
      </form>

      {error && (
        <section className="card result">
          <div className="result-head">
            <span className="badge badge-danger">Error</span>
          </div>
          <p className="result-text">{error}</p>
        </section>
      )}

      {result && (
        <section className="card result">
          {result.kind === "found" && (
            <>
              <div className="result-head">
                <span className={`badge ${result.visibility === "public" ? "badge-good" : "badge-info"}`}>
                  {result.visibility === "public" ? "Public account" : "Private account"}
                </span>
                <span className="badge badge-muted">Exists</span>
                {result.isVerified && <span className="badge badge-info">Verified</span>}
              </div>
              <div className="profile">
                {result.profilePic && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="avatar"
                    src={result.profilePic}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <div className="profile-name">{result.fullName ?? result.username}</div>
                  <div className="profile-handle">@{result.username}</div>
                  {result.followerCount !== null && (
                    <div className="profile-meta">
                      {result.followerCount.toLocaleString()} followers
                    </div>
                  )}
                </div>
              </div>
              <p className="result-text">
                This account is publicly findable right now, so it hasn&apos;t been deactivated,
                deleted, or suspended. Whether <em>you</em> can see it is the next step.
              </p>
            </>
          )}

          {result.kind === "not_found" && (
            <>
              <div className="result-head">
                <span className="badge badge-warn">Not found</span>
              </div>
              <p className="result-text">
                No public profile exists for <strong>@{result.username}</strong> from a logged-out
                view. The account was deactivated, deleted, suspended, or the username changed.
              </p>
            </>
          )}

          {result.kind === "rate_limited" && (
            <>
              <div className="result-head">
                <span className="badge badge-warn">Rate limited</span>
              </div>
              <p className="result-text">
                Instagram refused the request (HTTP {result.status}). This happens when the
                server&apos;s IP is throttled. Wait a few minutes, or set{" "}
                <code>IG_PROXY_URL</code> to route through a proxy.
              </p>
            </>
          )}

          {result.kind === "error" && (
            <>
              <div className="result-head">
                <span className="badge badge-danger">Couldn&apos;t check</span>
              </div>
              <p className="result-text">{result.message}</p>
            </>
          )}

          <p className="timestamp">
            Checked {new Date(result.checkedAt).toLocaleString()} · logged-out view
          </p>
        </section>
      )}

      {canCompare && (
        <section className="card compare">
          <h2 className="compare-title">Now, what does your own account see?</h2>
          <p className="compare-sub">
            Signed in to Instagram, open this profile. Pick the option that matches what you see.
          </p>

          <div className="options">
            {(
              [
                { value: "see", label: "I can see this profile" },
                { value: "cant_see", label: "I can't find / can't see it" },
                { value: "unsure", label: "Not sure" },
              ] as { value: View; label: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                className={`opt ${view === option.value ? "opt-active" : ""}`}
                aria-pressed={view === option.value}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {verdict && (
            <div className={`verdict verdict-${verdict.tone}`}>
              <h3 className="verdict-title">{verdict.title}</h3>
              <p className="verdict-detail">{verdict.detail}</p>
            </div>
          )}
        </section>
      )}

      <section className="card notes">
        <h2 className="notes-title">How this actually works</h2>
        <ul className="notes-list">
          <li>
            Instagram has no API that reports &ldquo;who blocked me.&rdquo; Any site claiming a
            one-click block check is guessing or asking for your password.
          </li>
          <li>
            A block is targeted at you, while deactivation and deletion apply to everyone. So the
            logged-out view sees the account for a block, and nothing for a deleted account.
          </li>
          <li>
            This runs against Instagram&apos;s public web endpoint, not an official API. It can be
            rate-limited or break without notice, and it isn&apos;t affiliated with Meta.
          </li>
          <li>
            It only covers Instagram. Snapchat exposes no public profile endpoint, so a
            logged-out check isn&apos;t possible there.
          </li>
        </ul>
      </section>

      <footer className="foot">
        Not affiliated with Instagram or Meta. For personal, good-faith use only.
      </footer>
    </main>
  );
}
