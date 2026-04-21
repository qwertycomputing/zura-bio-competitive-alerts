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
