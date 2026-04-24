import fs from 'fs';

if (!fs.existsSync('results/latest.json')) {
  console.log('No latest.json — nothing to notify.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync('results/latest.json', 'utf8'));
const findings = data?.data?.findings ?? data?.findings ?? [];

if (findings.length === 0) {
  console.log('No new findings — skipping Teams notification.');
  process.exit(0);
}

const runDate = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' });
const uniqueCompetitors = [...new Set(findings.flatMap(f => f.competitors ?? []).filter(c => c !== 'Keyword matched'))];

const DASHBOARD_URL = 'https://ci.zurabio.com/';
const HISTORICAL_URL = 'https://ci.zurabio.com/historical.html';

// ── Teams ──────────────────────────────────────────────────────────────────

const TEAMS_WEBHOOK = process.env.TEAMS_WEBHOOK_URL;

if (!TEAMS_WEBHOOK) {
  console.error('TEAMS_WEBHOOK_URL not set in environment.');
  process.exit(1);
}

const topFindings = findings.slice(0, 5);

const sections = topFindings.map(f => ({
  activityTitle: `**${(f.competitors ?? []).join(', ') || '—'}** — ${f.source_type || 'Unknown'}`,
  activitySubtitle: f.keywords?.length ? `Keywords: ${f.keywords.join(', ')}` : undefined,
  activityText: f.summary || '',
  potentialAction: f.source_link ? [{
    '@type': 'OpenUri',
    name: 'View Source',
    targets: [{ os: 'default', uri: f.source_link }]
  }] : undefined
}));

const card = {
  '@type': 'MessageCard',
  '@context': 'https://schema.org/extensions',
  themeColor: '0f172a',
  summary: `Zura Bio Competitive Alert — ${findings.length} findings`,
  title: `Zura Bio — Competitive Intelligence`,
  text: `**${findings.length} new finding${findings.length !== 1 ? 's' : ''}** across ${uniqueCompetitors.length} competitor${uniqueCompetitors.length !== 1 ? 's' : ''} · ${runDate}`,
  sections,
  potentialAction: [
    {
      '@type': 'OpenUri',
      name: `📊 Latest Report`,
      targets: [{ os: 'default', uri: DASHBOARD_URL }]
    },
    {
      '@type': 'OpenUri',
      name: `📅 Historical Dashboard`,
      targets: [{ os: 'default', uri: HISTORICAL_URL }]
    }
  ]
};

const res = await fetch(TEAMS_WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(card)
});

const body = await res.text();
if (res.ok && body === '1') {
  console.log('Teams notification sent successfully.');
} else {
  console.error('Teams failed:', res.status, body);
}

// ── Email via Resend ───────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || 'onboarding@resend.dev';

if (RESEND_API_KEY && ALERT_EMAIL) {
  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Daily Briefing · ${runDate}</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Zura Bio — Competitive Intelligence</h1>
          </td>
        </tr>

        <!-- Summary bar -->
        <tr>
          <td style="background:#6366f1;padding:14px 32px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;">
              ${findings.length} new finding${findings.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${uniqueCompetitors.length} competitor${uniqueCompetitors.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${uniqueCompetitors.slice(0, 5).join(', ')}${uniqueCompetitors.length > 5 ? ` +${uniqueCompetitors.length - 5} more` : ''}
            </p>
          </td>
        </tr>

        <!-- Dashboard links -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${DASHBOARD_URL}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">📊 Latest Report</a>
                </td>
                <td>
                  <a href="${HISTORICAL_URL}" style="display:inline-block;background:#f1f5f9;color:#0f172a;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;border:1px solid #e2e8f0;">📅 Historical Dashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:16px 32px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>

        <!-- Findings -->
        ${findings.slice(0, 10).map((f, i) => `
        <tr>
          <td style="padding:20px 32px${i < Math.min(findings.length, 10) - 1 ? ';border-bottom:1px solid #f1f5f9' : ''};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="display:inline-block;background:#ede9fe;color:#6366f1;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;">${(f.competitors ?? []).filter(c => c !== 'Keyword matched').join(', ') || 'Keyword match'}</span>
                  ${f.keywords?.length ? `<span style="display:inline-block;background:#f0fdf4;color:#16a34a;font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;margin-left:6px;">${f.keywords.join(', ')}</span>` : ''}
                  <span style="display:inline-block;background:#f8fafc;color:#64748b;font-size:11px;padding:3px 8px;border-radius:4px;margin-left:6px;">${f.source_type || 'Unknown'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;color:#1e293b;font-size:14px;line-height:1.6;">${f.summary || ''}</td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  ${f.source_link ? `<a href="${f.source_link}" style="color:#6366f1;font-size:12px;text-decoration:none;font-weight:600;">View Source →</a>` : ''}
                  <span style="color:#94a3b8;font-size:12px;margin-left:12px;">${f.publication_date || ''}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join('')}

        ${findings.length > 10 ? `
        <tr>
          <td style="padding:16px 32px 24px;text-align:center;">
            <a href="${DASHBOARD_URL}" style="color:#6366f1;font-size:13px;font-weight:600;text-decoration:none;">View all ${findings.length} findings →</a>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Zura Bio Competitive Intelligence &nbsp;·&nbsp;
              <a href="${DASHBOARD_URL}" style="color:#6366f1;text-decoration:none;">ci.zurabio.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM,
      to: ALERT_EMAIL,
      subject: `Zura Bio CI — ${findings.length} new finding${findings.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('en-CA')}`,
      html: emailHtml
    })
  });

  const emailBody = await emailRes.json();
  if (emailRes.ok) {
    console.log('Email notification sent successfully.');
  } else {
    console.error('Email failed:', emailBody);
  }
}
