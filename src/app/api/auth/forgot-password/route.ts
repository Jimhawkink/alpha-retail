import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

// ── Server-side Supabase (service role preferred, anon key fallback) ─
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── In-memory rate limiter (resets on server restart) ────────────────
// For production, use Redis. For this POS: sufficient.
const attemptMap = new Map<string, { count: number; firstAt: number }>();
const MAX_ATTEMPTS  = 3;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes
const TOKEN_TTL_MS  = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): { allowed: boolean; retryAfterMin?: number } {
    const now    = Date.now();
    const entry  = attemptMap.get(key);
    if (entry) {
        const elapsed = now - entry.firstAt;
        if (elapsed > WINDOW_MS) {
            attemptMap.delete(key);
        } else if (entry.count >= MAX_ATTEMPTS) {
            const retryAfterMin = Math.ceil((WINDOW_MS - elapsed) / 60000);
            return { allowed: false, retryAfterMin };
        }
    }
    return { allowed: true };
}

function recordAttempt(key: string) {
    const now   = Date.now();
    const entry = attemptMap.get(key);
    if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
        attemptMap.set(key, { count: 1, firstAt: now });
    } else {
        entry.count++;
    }
}

// ── Email builder ────────────────────────────────────────────────────
function buildResetEmail(name: string, resetUrl: string, expiresAt: Date): string {
    const expiry = expiresAt.toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;padding:32px 16px}
  .wrap{max-width:520px;margin:0 auto}
  .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(79,70,229,.12)}
  .header{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px 40px 32px;text-align:center}
  .icon{width:64px;height:64px;background:rgba(255,255,255,.2);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:16px}
  .header h1{color:#fff;font-size:22px;font-weight:800;margin-bottom:6px}
  .header p{color:rgba(255,255,255,.75);font-size:14px}
  .body{padding:40px}
  .body p{color:#475569;font-size:15px;line-height:1.6;margin-bottom:16px}
  .body strong{color:#1e293b}
  .btn-wrap{text-align:center;margin:28px 0}
  .btn{display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff!important;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:800;font-size:15px;letter-spacing:.02em}
  .warn{background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-top:20px}
  .warn p{color:#92400e;font-size:13px;margin:0;line-height:1.5}
  .link-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-top:16px;word-break:break-all;font-size:12px;color:#64748b}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
  .footer p{color:#94a3b8;font-size:12px;line-height:1.6}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
  <div class="header">
    <div class="icon">🔐</div>
    <h1>Password Reset Request</h1>
    <p>Alpha Retail POS System</p>
  </div>
  <div class="body">
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to reset the password for your <strong>Alpha Retail POS</strong> account. If you made this request, click the button below to set a new password:</p>
    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn">🔑 Reset My Password</a>
    </div>
    <div class="warn">
      <p>⏰ <strong>This link expires on ${expiry} (1 hour).</strong><br>
      🚨 If you did NOT request a password reset, please ignore this email and <strong>contact your system administrator immediately</strong> as someone may have attempted to access your account.</p>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#94a3b8;">If the button above does not work, copy and paste this link into your browser:</p>
    <div class="link-box">${resetUrl}</div>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Alpha Retail POS · Powered by Alpha Solutions<br>
    Developed by Jimhawkins Korir · This is an automated security email. Do not reply.</p>
  </div>
</div>
</div>
</body>
</html>`;
}

// ── POST /api/auth/forgot-password ───────────────────────────────────
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').trim();

    if (!username) {
        return NextResponse.json({ ok: false, error: 'Username is required.' }, { status: 400 });
    }

    const rateLimitKey = `fp:${username.toLowerCase()}`;
    const { allowed, retryAfterMin } = checkRateLimit(rateLimitKey);
    if (!allowed) {
        return NextResponse.json({
            ok: false,
            error: `Too many reset attempts. Try again in ${retryAfterMin} minutes.`
        }, { status: 429 });
    }

    // ALWAYS return the same message to prevent username enumeration
    const SAFE_MSG = 'If this username exists with a registered email, a reset link has been sent. Check your inbox (and spam folder).';

    // Look up user
    const { data: user } = await supabase
        .from('retail_users')
        .select('user_id, user_name, name, email, active')
        .ilike('user_name', username)
        .single();

    // Track attempt regardless of outcome
    recordAttempt(rateLimitKey);

    // Silently exit if no valid user or no email
    if (!user || !user.active || !user.email) {
        return NextResponse.json({ ok: true, message: SAFE_MSG });
    }

    // Generate cryptographically secure token
    const plainToken   = randomBytes(32).toString('hex');          // 64-char hex — sent in email
    const tokenHash    = createHash('sha256').update(plainToken).digest('hex'); // stored in DB
    const expiresAt    = new Date(Date.now() + TOKEN_TTL_MS);

    // Persist hashed token + expiry
    const { error: dbErr } = await supabase
        .from('retail_users')
        .update({
            reset_token_hash:       tokenHash,
            reset_token_expires_at: expiresAt.toISOString(),
            reset_token_used:       false,
        })
        .eq('user_id', user.user_id);

    if (dbErr) {
        console.error('[ForgotPassword] DB error:', dbErr.message);
        return NextResponse.json({ ok: true, message: SAFE_MSG }); // Don't reveal internal error
    }

    // Build reset URL
    const host     = req.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    const resetUrl = `${appUrl}/reset-password?token=${plainToken}&uid=${user.user_id}`;

    // Load SMTP settings from retail_settings
    const { data: settings } = await supabase
        .from('retail_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'company_name']);

    const cfg: Record<string, string> = {};
    (settings || []).forEach((s: any) => { cfg[s.setting_key] = s.setting_value; });

    const smtpHost = cfg.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(cfg.smtp_port || process.env.SMTP_PORT || '587');
    const smtpUser = cfg.smtp_user || process.env.SMTP_USER || '';
    const smtpPass = cfg.smtp_pass || process.env.SMTP_PASS || '';
    const fromAddr = cfg.smtp_from || process.env.SMTP_FROM || smtpUser;
    const company  = cfg.company_name || 'Alpha Retail';

    // Send email
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host:   smtpHost,
                port:   smtpPort,
                secure: smtpPort === 465,
                auth:   { user: smtpUser, pass: smtpPass },
                tls:    { rejectUnauthorized: false },
            });

            await transporter.sendMail({
                from:    `"${company}" <${fromAddr}>`,
                to:      user.email,
                subject: `🔐 Password Reset — ${company} POS`,
                html:    buildResetEmail(user.name, resetUrl, expiresAt),
            });

            // Log the reset request
            try {
                await supabase.from('activity_log').insert({
                    action:  'Password Reset Requested',
                    details: `Reset email sent to ${user.email.replace(/(.{2})(.+?)(@.*)/, '$1***$3')} for user: ${user.user_name}`,
                });
            } catch { /* non-critical */ }

        } catch (mailErr: any) {
            console.error('[ForgotPassword] Mail error:', mailErr.message);
            // Still return success (don't reveal email failure)
        }
    } else {
        console.warn('[ForgotPassword] SMTP not configured. Token generated but email not sent.');
    }

    return NextResponse.json({ ok: true, message: SAFE_MSG });
}
