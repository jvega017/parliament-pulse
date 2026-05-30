// Daily digest delivery — Resend integration.
//
// Resend is free up to 3,000 emails/month (no credit card required).
// Sign up at https://resend.com, verify your sender domain, then set the secret:
//   wrangler secret put RESEND_API_KEY
//
// Sender domain must be verified in Resend (Domains tab in dashboard).
// For testing without a domain use "onboarding@resend.dev" as DIGEST_FROM_EMAIL.
//
// When the API key is missing, this function is a no-op so subscriptions can
// be collected before the email integration is wired.

import type { Env } from "./archive";

interface EnvWithSecrets extends Env {
  RESEND_API_KEY?: string;
  DIGEST_FROM_EMAIL?: string;
}

interface Subscriber {
  email: string;
  watchlists: string;
  attention_min: string;
  active: number;
}

interface SignalRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_label: string;
  source_group: string;
  kind: string;
  attention: string | null;
}

const ATTENTION_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

export async function sendDailyDigest(env: EnvWithSecrets): Promise<{
  delivered: number;
  skipped: number;
  reason?: string;
}> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { delivered: 0, skipped: 0, reason: "RESEND_API_KEY not set" };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const items = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, feed_label, source_group, kind, attention
       FROM signals
       WHERE first_seen_at >= ?
       ORDER BY COALESCE(pub_date, first_seen_at) DESC
       LIMIT 50`,
  )
    .bind(since)
    .all<SignalRow>();
  const newItems = items.results ?? [];
  if (newItems.length === 0) {
    return { delivered: 0, skipped: 0, reason: "no new items in last 24h" };
  }

  const subs = await env.ARCHIVE.prepare(
    `SELECT email, watchlists, attention_min, active FROM digest_subscribers WHERE active = 1`,
  ).all<Subscriber>();
  const subscribers = subs.results ?? [];

  const fromEmail = env.DIGEST_FROM_EMAIL ?? "noreply@prometheuspolicylab.com";
  const fromField = `Parliament Pulse <${fromEmail}>`;
  let delivered = 0;
  let skipped = 0;

  for (const sub of subscribers) {
    const minRank = ATTENTION_RANK[sub.attention_min] ?? 0;
    const filtered = newItems.filter((item) => {
      let resolved = item.attention;
      if (!resolved) {
        const lower = item.title.toLowerCase();
        const matchesWl = sub.watchlists
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .some((term) => lower.includes(term));
        resolved = matchesWl ? "high"
          : ["inquiry", "hearing", "report"].includes(item.kind) ? "med"
          : "low";
      }
      return (ATTENTION_RANK[resolved] ?? 2) <= minRank;
    });
    if (filtered.length === 0) {
      skipped += 1;
      continue;
    }

    const subject = `Parliament Pulse — ${filtered.length} new ${filtered.length === 1 ? "signal" : "signals"}`;
    const html = renderDigestHtml(filtered);
    const text = renderDigestText(filtered);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromField,
        to: [sub.email],
        subject,
        html,
        text,
      }),
    });
    if (res.ok || res.status === 200) {
      delivered += 1;
    } else {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string };
      console.error({ digest_error: errBody.message ?? res.status, email: sub.email });
      skipped += 1;
    }
  }

  return { delivered, skipped };
}

function renderDigestText(items: SignalRow[]): string {
  return [
    "Parliament Pulse — daily digest",
    "",
    ...items.map(
      (i) =>
        `* ${i.title}\n  ${i.feed_label} · ${i.kind}\n  ${i.link}\n`,
    ),
    "",
    "Open the live app at https://parliament-pulse.pages.dev",
  ].join("\n");
}

function renderDigestHtml(items: SignalRow[]): string {
  const rows = items
    .map(
      (i) =>
        `<li style="margin-bottom:14px"><a href="${escapeHtml(safeUrl(i.link))}" style="color:#e89668;text-decoration:none;font-weight:500">${escapeHtml(i.title)}</a><br /><span style="color:#888;font-size:12px">${escapeHtml(i.feed_label)} · ${escapeHtml(i.kind)}</span></li>`,
    )
    .join("");
  return `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;background:#0a121b;color:#d8dfe9;padding:24px">
    <h1 style="font-size:20px;margin:0 0 16px">Parliament Pulse</h1>
    <p style="font-size:13px;color:#b3bcca">${items.length} new ${items.length === 1 ? "signal" : "signals"} in the last 24 hours.</p>
    <ul style="list-style:none;padding:0;margin:16px 0">${rows}</ul>
    <p style="font-size:12px;color:#8e98a8;border-top:1px solid #2a3a51;padding-top:12px;margin-top:24px">
      <a href="https://parliament-pulse.pages.dev" style="color:#58b9ad">Open Parliament Pulse</a>
    </p>
  </body></html>`;
}

function safeUrl(u: string): string {
  try {
    const p = new URL(u);
    return (p.protocol === "https:" || p.protocol === "http:") ? u : "#";
  } catch {
    return "#";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
