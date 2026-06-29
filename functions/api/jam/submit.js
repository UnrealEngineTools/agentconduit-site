// POST /api/jam/submit — Conduit Launch Jam entry intake.
// Cloudflare Pages Function. Bindings (see wrangler.toml):
//   env.DB                — D1 database `conduit-jam`
//   env.TURNSTILE_SECRET  — Cloudflare Turnstile secret (test key by default; replace via secret)
//   env.RESEND_API_KEY    — optional; if set, a confirmation email is sent (best-effort)
//   env.JAM_DEADLINE      — optional ISO date; submissions are rejected after it

const LIMITS = {
  name: 80, email: 160, handle: 80, title: 120,
  description: 180, videoUrl: 400, buildUrl: 400, prompts: 4000,
};
const TIERS = new Set(['indie', 'commercial']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= LIMITS.email;
}

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function clean(s) {
  return typeof s === 'string' ? s.trim() : '';
}

async function verifyTurnstile(secret, token, ip) {
  if (!secret || !token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await r.json();
    return data.success === true;
  } catch {
    return false;
  }
}

async function sendConfirmation(env, entry) {
  // Best-effort. Only fires if a provider key is configured; never blocks the submission.
  if (!env.RESEND_API_KEY) return;
  const from = env.JAM_EMAIL_FROM || 'Conduit Jam <jam@conduit.unrealtools.com>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [entry.email],
        subject: `Your Conduit Launch Jam entry: ${entry.title}`,
        text:
          `Hi ${entry.name},\n\n` +
          `Your entry "${entry.title}" is in. We've got it.\n\n` +
          `You can resubmit any time before the deadline to update it — the latest one counts.\n\n` +
          `Good luck,\nThe Conduit team\nhttps://conduit.unrealtools.com/jam\n`,
      }),
    });
  } catch {
    // swallow — confirmation email is non-critical
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Deadline gate (optional).
  if (env.JAM_DEADLINE) {
    const deadline = Date.parse(env.JAM_DEADLINE);
    if (!Number.isNaN(deadline) && Date.now() > deadline) {
      return json({ ok: false, error: 'Submissions are closed.' }, 403);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const entry = {
    name: clean(body.name),
    email: clean(body.email).toLowerCase(),
    handle: clean(body.handle),
    title: clean(body.title),
    description: clean(body.description),
    videoUrl: clean(body.videoUrl),
    buildUrl: clean(body.buildUrl),
    prompts: clean(body.prompts),
    tier: clean(body.tier),
  };

  // Validation.
  if (!entry.name || entry.name.length > LIMITS.name) return json({ ok: false, error: 'Please enter your name.' }, 400);
  if (!isEmail(entry.email)) return json({ ok: false, error: 'Please enter a valid email.' }, 400);
  if (entry.handle.length > LIMITS.handle) return json({ ok: false, error: 'Handle is too long.' }, 400);
  if (!entry.title || entry.title.length > LIMITS.title) return json({ ok: false, error: 'Please enter a project title.' }, 400);
  if (!entry.description || entry.description.length > LIMITS.description) return json({ ok: false, error: 'Please add a one-line description.' }, 400);
  if (!isHttpUrl(entry.videoUrl) || entry.videoUrl.length > LIMITS.videoUrl) return json({ ok: false, error: 'Please add a valid video URL.' }, 400);
  if (entry.buildUrl && (!isHttpUrl(entry.buildUrl) || entry.buildUrl.length > LIMITS.buildUrl)) return json({ ok: false, error: 'The build URL looks invalid.' }, 400);
  if (!entry.prompts || entry.prompts.length > LIMITS.prompts) return json({ ok: false, error: 'Please paste the prompts you used.' }, 400);
  if (!TIERS.has(entry.tier)) return json({ ok: false, error: 'Please select which tier you used.' }, 400);

  // Anti-bot.
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ok = await verifyTurnstile(env.TURNSTILE_SECRET, clean(body.turnstileToken), ip);
  if (!ok) return json({ ok: false, error: 'Verification failed. Please try again.' }, 400);

  // Persist (UPSERT on email — resubmission updates the entry, preserves created_at).
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO entries (email, name, handle, title, description, video_url, build_url, prompts, tier, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
       ON CONFLICT(email) DO UPDATE SET
         name=?2, handle=?3, title=?4, description=?5, video_url=?6, build_url=?7, prompts=?8, tier=?9, updated_at=?10`
    )
      .bind(
        entry.email, entry.name, entry.handle || null, entry.title, entry.description,
        entry.videoUrl, entry.buildUrl || null, entry.prompts, entry.tier, now
      )
      .run();
  } catch (e) {
    return json({ ok: false, error: 'Could not save your entry. Please try again.' }, 500);
  }

  await sendConfirmation(env, entry);
  return json({ ok: true });
}
