import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── PBKDF2-SHA512 hashing (same as login verification) ───────────────
async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32).toString('hex');
    const { createHmac } = await import('crypto');
    // Use Node's synchronous PBKDF2 via callback-wrapped promise
    const { pbkdf2 } = await import('crypto');
    return new Promise((resolve, reject) => {
        pbkdf2(password, salt, 210000, 64, 'sha512', (err, derived) => {
            if (err) reject(err);
            else resolve(`${salt}:${derived.toString('hex')}`);
        });
    });
}

function isStrongPassword(pwd: string): { ok: boolean; reason?: string } {
    if (pwd.length < 8)          return { ok: false, reason: 'At least 8 characters required.' };
    if (!/[A-Z]/.test(pwd))     return { ok: false, reason: 'Include at least one uppercase letter.' };
    if (!/[a-z]/.test(pwd))     return { ok: false, reason: 'Include at least one lowercase letter.' };
    if (!/[0-9]/.test(pwd))     return { ok: false, reason: 'Include at least one number.' };
    if (!/[^A-Za-z0-9]/.test(pwd)) return { ok: false, reason: 'Include at least one special character (!@#$%...).' };
    return { ok: true };
}

// ── POST /api/auth/reset-password ────────────────────────────────────
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { token, uid, newPassword } = body;

    if (!token || !uid || !newPassword) {
        return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
    }

    // Password strength check
    const strength = isStrongPassword(newPassword);
    if (!strength.ok) {
        return NextResponse.json({ ok: false, error: strength.reason }, { status: 422 });
    }

    // Fetch user + stored token hash
    const { data: user, error: userErr } = await supabase
        .from('retail_users')
        .select('user_id, user_name, name, reset_token_hash, reset_token_expires_at, reset_token_used, active')
        .eq('user_id', uid)
        .single();

    if (userErr || !user) {
        return NextResponse.json({ ok: false, error: 'Invalid or expired reset link.' }, { status: 404 });
    }

    // Validate: user active
    if (!user.active) {
        return NextResponse.json({ ok: false, error: 'This account is inactive. Contact your administrator.' }, { status: 403 });
    }

    // Validate: token not already used
    if (user.reset_token_used) {
        return NextResponse.json({ ok: false, error: 'This reset link has already been used. Request a new one.' }, { status: 410 });
    }

    // Validate: token not expired
    if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
        return NextResponse.json({ ok: false, error: 'This reset link has expired. Please request a new one.' }, { status: 410 });
    }

    // Validate: token hash matches
    const incomingHash = createHash('sha256').update(token).digest('hex');
    if (incomingHash !== user.reset_token_hash) {
        // Log tamper attempt
    try {
        await supabase.from('activity_log').insert({
            action:  'Password Reset Tamper Attempt',
            details: `Invalid token used for user_id: ${uid}`,
        });
    } catch { /* non-critical */ }
        return NextResponse.json({ ok: false, error: 'Invalid or tampered reset link.' }, { status: 403 });
    }

    // Hash new password with PBKDF2-SHA512
    const newHash = await hashPassword(newPassword);

    // Update password + mark token as used + clear pin
    const { error: updateErr } = await supabase
        .from('retail_users')
        .update({
            password_hash:          newHash,
            pin:                    null,           // clear any temp PIN
            reset_token_used:       true,
            reset_token_hash:       null,
            reset_token_expires_at: null,
        })
        .eq('user_id', uid);

    if (updateErr) {
        console.error('[ResetPassword] DB update error:', updateErr.message);
        return NextResponse.json({ ok: false, error: 'Failed to update password. Please try again.' }, { status: 500 });
    }

    // Audit log
    try {
        await supabase.from('activity_log').insert({
            action:  'Password Reset Successful',
            details: `Password successfully reset for user: ${user.user_name}`,
        });
    } catch { /* non-critical */ }

    return NextResponse.json({ ok: true, message: 'Password reset successfully! You can now log in with your new password.' });
}
