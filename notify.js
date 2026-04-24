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

const uniqueCompetitors = [...new Set(findings.flatMap(f => f.competitors ?? []).filter(c => c !== 'Keyword matched'))];

const card = {
  '@type': 'MessageCard',
  '@context': 'https://schema.org/extensions',
  themeColor: '0f172a',
  summary: `Zura Bio Competitive Alert — ${findings.length} findings`,
  title: `Zura Bio — Competitive Intelligence`,
  text: `**${findings.length} new findings** across ${uniqueCompetitors.length} competitors · ${runDate}`,
  sections,
  potentialAction: findings.length > 5 ? [{
    '@type': 'OpenUri',
    name: `View all ${findings.length} findings`,
    targets: [{ os: 'default', uri: 'about:blank' }]
  }] : undefined
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

// Email via Resend
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM;

if (RESEND_API_KEY && ALERT_EMAIL) {
  const uniqueCompetitors2 = [...new Set(findings.flatMap(f => f.competitors ?? []).filter(c => c !== 'Keyword matched'))];
  const emailHtml = `
    <h2>Zura Bio — Competitive Intelligence</h2>
    <p><strong>${findings.length} new finding${findings.length !== 1 ? 's' : ''}</strong> across ${uniqueCompetitors2.length} competitor${uniqueCompetitors2.length !== 1 ? 's' : ''} · ${runDate}</p>
    <hr>
    ${findings.slice(0, 10).map(f => `
      <div style="margin-bottom:20px;">
        <strong>${(f.competitors ?? []).join(', ') || '—'}</strong> — ${f.source_type || 'Unknown'}
        ${f.keywords?.length ? `<br><em>Keywords: ${f.keywords.join(', ')}</em>` : ''}
        <br>${f.summary || ''}
        ${f.source_link ? `<br><a href="${f.source_link}">View Source</a>` : ''}
        <br><small>${f.publication_date || ''}</small>
      </div>
    `).join('<hr>')}
    ${findings.length > 10 ? `<p><a href="https://ci.zurabio.com">View all ${findings.length} findings</a></p>` : ''}
  `;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM || 'onboarding@resend.dev',
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
