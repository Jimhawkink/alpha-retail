import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    const { to } = await req.json().catch(() => ({}));
    if (!to || !to.includes('@')) {
        return NextResponse.json({ ok: false, error: 'Valid recipient email required.' }, { status: 400 });
    }

    // Load SMTP from retail_settings
    const { data: settings } = await supabase
        .from('retail_settings').select('setting_key,setting_value')
        .in('setting_key', ['smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','company_name']);

    const cfg: Record<string, string> = {};
    (settings || []).forEach((s: any) => { cfg[s.setting_key] = s.setting_value; });

    const smtpUser = cfg.smtp_user || process.env.SMTP_USER || '';
    const smtpPass = cfg.smtp_pass || process.env.SMTP_PASS || '';
    const smtpHost = cfg.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(cfg.smtp_port || process.env.SMTP_PORT || '587');
    const fromAddr = cfg.smtp_from || smtpUser;
    const company  = cfg.company_name || 'Alpha Retail';

    if (!smtpUser || !smtpPass) {
        return NextResponse.json({ ok: false, error: 'SMTP credentials not configured. Save your settings first.' }, { status: 400 });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost, port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false },
        });

        await transporter.sendMail({
            from: `"${company}" <${fromAddr}>`,
            to,
            subject: `✅ Email Test — ${company} POS`,
            html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:32px 16px">
            <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,.1)">
                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center">
                    <div style="font-size:40px;margin-bottom:8px">✅</div>
                    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800">Email Test Successful!</h1>
                    <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">${company} POS System</p>
                </div>
                <div style="padding:32px">
                    <p style="color:#475569;font-size:15px;line-height:1.6">🎉 Congratulations! Your SMTP email configuration is working correctly.</p>
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:20px 0">
                        <p style="color:#166534;font-size:13px;margin:0"><strong>✓ SMTP Host:</strong> ${smtpHost}:${smtpPort}<br>
                        <strong>✓ From:</strong> ${fromAddr}<br>
                        <strong>✓ Status:</strong> Connected &amp; Authenticated</p>
                    </div>
                    <p style="color:#64748b;font-size:13px">Users with registered emails can now securely receive password reset links from your POS system.</p>
                </div>
                <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center">
                    <p style="color:#94a3b8;font-size:11px;margin:0">© ${new Date().getFullYear()} ${company} · Powered by Alpha Solutions</p>
                </div>
            </div></div>`,
        });

        return NextResponse.json({ ok: true, message: `Test email sent to ${to} successfully.` });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: `SMTP Error: ${err.message}` }, { status: 500 });
    }
}
