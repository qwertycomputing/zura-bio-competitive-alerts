import fs from 'fs';

export function generateReport(data, timestamp) {
  const findings = (data?.findings ?? []).sort((a, b) => {
    const da = a.publication_date ? new Date(a.publication_date) : new Date(0);
    const db = b.publication_date ? new Date(b.publication_date) : new Date(0);
    return db - da;
  });
  const runDate = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' });

  const sourceTypes = [...new Set(findings.map(f => f.source_type).filter(Boolean))];
  const allCompetitors = [...new Set(findings.flatMap(f => f.competitors ?? []).filter(Boolean))].sort();
  const allKeywords = [...new Set(findings.flatMap(f => f.keywords ?? []).filter(Boolean))].sort();

  const badgeColor = (type) => {
    const map = {
      'SEC 8-K': '#dc2626', 'Press Release': '#2563eb', 'PubMed': '#16a34a',
      'Clinical Trial': '#9333ea', 'Conference': '#ea580c', 'News': '#0891b2',
    };
    for (const [k, v] of Object.entries(map)) {
      if (type?.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return '#6b7280';
  };

  const confidenceColor = (score) => {
    if (score >= 70) return '#16a34a';
    if (score >= 45) return '#d97706';
    return '#dc2626';
  };
  const confidenceLabel = (score) => score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';

  const findingCards = findings.map(f => {
    const competitors = f.competitors ?? [];
    const keywords = f.keywords ?? [];
    const score = f.confidence ?? 0;
    return `
    <div class="card"
      data-competitors="${competitors.join('|').toLowerCase()}"
      data-source="${f.source_type}"
      data-keywords="${keywords.join('|').toLowerCase()}"
      data-confidence="${score}">
      <div class="card-header">
        <span class="badge" style="background:${badgeColor(f.source_type)}">${f.source_type || 'Unknown'}</span>
        ${competitors.map(c => `<span class="competitor-tag">${c}</span>`).join('')}
        ${keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('')}
        <span class="confidence-badge" style="margin-left:auto;background:${confidenceColor(score)}1a;color:${confidenceColor(score)};border:1px solid ${confidenceColor(score)}40" title="Confidence score: ${score}/100">${confidenceLabel(score)} · ${score}</span>
      </div>
      <p class="summary">${f.summary || 'No summary available.'}</p>
      ${f.source_link ? `<a class="source-link" href="${f.source_link}" target="_blank" rel="noopener">View Source →</a>` : ''}
      <div class="card-domain">${f.publication_date ? `📅 ${new Date(f.publication_date).toLocaleDateString('en-CA')} · ` : ''}${f.source_domain || ''}</div>
    </div>`;
  }).join('');

  const competitorOptions = allCompetitors.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join('');
  const sourceOptions = sourceTypes.map(s => `<option value="${s}">${s}</option>`).join('');
  const keywordOptions = allKeywords.map(k => `<option value="${k.toLowerCase()}">${k}</option>`).join('');

  const competitorCounts = {};
  findings.forEach(f => (f.competitors ?? []).forEach(c => {
    competitorCounts[c] = (competitorCounts[c] || 0) + 1;
  }));
  const topCompetitors = Object.entries(competitorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const chartBars = topCompetitors.map(([name, count]) => `
    <div class="chart-row">
      <div class="chart-label">${name}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="width:${Math.round((count / (topCompetitors[0]?.[1] || 1)) * 100)}%"></div>
        <span class="chart-count">${count}</span>
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zura Bio — Competitive Intelligence Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  header { background: #0f172a; color: white; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; }
  header h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
  header .meta { font-size: 0.8rem; color: #94a3b8; }
  .container { max-width: 1400px; margin: 0 auto; padding: 32px 24px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .stat { background: white; border-radius: 12px; padding: 20px 24px; border: 1px solid #e2e8f0; }
  .stat .num { font-size: 2rem; font-weight: 800; color: #0f172a; }
  .stat .label { font-size: 0.78rem; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  .sidebar { position: sticky; top: 24px; height: fit-content; }
  .panel { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 16px; }
  .panel h3 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 14px; }
  select, input { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; color: #1e293b; background: #f8fafc; margin-bottom: 10px; }
  button { width: 100%; padding: 9px; border: none; border-radius: 8px; background: #0f172a; color: white; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #1e293b; }
  .chart-row { display: flex; align-items: center; margin-bottom: 8px; font-size: 0.8rem; }
  .chart-label { width: 60px; flex-shrink: 0; font-weight: 600; color: #475569; }
  .chart-bar-wrap { flex: 1; display: flex; align-items: center; gap: 8px; }
  .chart-bar { height: 14px; background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 4px; min-width: 4px; }
  .chart-count { color: #64748b; font-size: 0.75rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 18px 20px; transition: box-shadow 0.2s; }
  .card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .card-header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  .badge { font-size: 0.7rem; font-weight: 700; color: white; padding: 3px 9px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.04em; }
  .competitor-tag { font-size: 0.78rem; font-weight: 700; color: #0f172a; background: #f1f5f9; padding: 3px 9px; border-radius: 100px; }
  .keyword-tag { font-size: 0.75rem; color: #7c3aed; background: #ede9fe; padding: 3px 9px; border-radius: 100px; }
  .summary { font-size: 0.875rem; color: #334155; line-height: 1.6; margin-bottom: 12px; }
  .source-link { font-size: 0.8rem; color: #2563eb; text-decoration: none; font-weight: 500; }
  .source-link:hover { text-decoration: underline; }
  .card-domain { font-size: 0.72rem; color: #94a3b8; margin-top: 6px; }
  .confidence-badge { font-size: 0.7rem; font-weight: 700; padding: 3px 9px; border-radius: 100px; white-space: nowrap; }
  .hidden { display: none !important; }
  #results-count { font-size: 0.85rem; color: #64748b; margin-bottom: 16px; }
  .no-results { text-align: center; padding: 60px; color: #94a3b8; font-size: 0.95rem; grid-column: 1/-1; }
  .help-icon { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: #94a3b8; color: white; font-size: 0.6rem; font-weight: 700; cursor: help; position: relative; margin-left: 5px; vertical-align: middle; }
  .help-icon .tooltip { display: none; position: absolute; left: 20px; top: -8px; width: 220px; background: #0f172a; color: #e2e8f0; font-size: 0.72rem; font-weight: 400; line-height: 1.6; padding: 10px 12px; border-radius: 8px; z-index: 100; white-space: normal; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
  .help-icon:hover .tooltip { display: block; }
  .help-icon .tooltip b { color: #ffffff; }
  .help-icon .tooltip hr { border: none; border-top: 1px solid #334155; margin: 6px 0; }
</style>
</head>
<body>
<header>
  <h1>Zura Bio — Competitive Intelligence</h1>
  <div class="meta">Generated ${runDate} &nbsp;|&nbsp; ${findings.length} findings</div>
</header>
<div class="container">
  <div class="stats">
    <div class="stat"><div class="num">${findings.length}</div><div class="label">Total Findings</div></div>
    <div class="stat"><div class="num">${allCompetitors.filter(c => c !== 'Keyword matched').length}</div><div class="label">Competitors Detected</div></div>
    <div class="stat"><div class="num">${allKeywords.length}</div><div class="label">Keywords Matched</div></div>
    <div class="stat"><div class="num">${findings.filter(f => f.source_type?.toLowerCase().includes('pubmed')).length}</div><div class="label">PubMed Publications</div></div>
    <div class="stat"><div class="num">${findings.filter(f => f.source_type?.toLowerCase().includes('clinical')).length}</div><div class="label">Clinical Trial Updates</div></div>
    <div class="stat"><div class="num">${findings.filter(f => f.source_type?.toLowerCase().includes('8-k') || f.source_type?.toLowerCase().includes('sec')).length}</div><div class="label">SEC Filings</div></div>
  </div>
  <div class="layout">
    <div class="sidebar">
      <div class="panel">
        <h3>Filter</h3>
        <select id="filter-competitor">
          <option value="">All Competitors</option>
          ${competitorOptions}
        </select>
        <select id="filter-keyword">
          <option value="">All Keywords</option>
          ${keywordOptions}
        </select>
        <select id="filter-source">
          <option value="">All Source Types</option>
          ${sourceOptions}
        </select>
        <input type="text" id="filter-search" placeholder="Search summaries...">
        <div style="display:flex;align-items:center;margin-bottom:6px;">
          <label style="font-size:0.78rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Confidence</label>
          <span class="help-icon">?<span class="tooltip">
            <b>Confidence Score (0–100)</b><hr>
            <b>Domain trust</b> — up to 40 pts<br>
            Trusted (SEC, PubMed, competitor IR) = +40<br>
            Unknown = +15 &nbsp;·&nbsp; Blocked = −20<hr>
            <b>Source type</b> — up to 30 pts<br>
            SEC 8-K / Filing = 30<br>
            Press Release / Clinical Trial = 25<br>
            Conference / Presentation = 20<br>
            News Article = 15 &nbsp;·&nbsp; Analyst = 10<hr>
            <b>Recency</b> — up to 20 pts<br>
            Today = +20 &nbsp;·&nbsp; This month = +10 &nbsp;·&nbsp; Older = +5<hr>
            <b>Both signals</b> — 10 pts<br>
            Competitor + keyword matched together
          </span></span>
        </div>
        <select id="filter-confidence">
          <option value="0">All Confidence Levels</option>
          <option value="70">High only (70+)</option>
          <option value="45">Medium + High (45+)</option>
        </select>
        <button onclick="resetFilters()">Reset Filters</button>
      </div>
      <div class="panel">
        <h3>Findings by Competitor</h3>
        ${chartBars || '<p style="color:#94a3b8;font-size:0.8rem">No data</p>'}
      </div>
    </div>
    <div>
      <div id="results-count"></div>
      <div class="grid" id="card-grid">
        ${findingCards || '<div class="no-results">No findings returned by the agent.</div>'}
      </div>
    </div>
  </div>
</div>
<script>
  const cards = document.querySelectorAll('.card');
  const countEl = document.getElementById('results-count');

  function updateCount() {
    const visible = [...cards].filter(c => !c.classList.contains('hidden')).length;
    countEl.textContent = visible + ' of ${findings.length} findings';
  }

  function applyFilters() {
    const comp     = document.getElementById('filter-competitor').value.toLowerCase();
    const kw       = document.getElementById('filter-keyword').value.toLowerCase();
    const src      = document.getElementById('filter-source').value.toLowerCase();
    const q        = document.getElementById('filter-search').value.toLowerCase();
    const minConf  = parseInt(document.getElementById('filter-confidence').value) || 0;
    cards.forEach(card => {
      const comps = card.dataset.competitors?.split('|') ?? [];
      const kws   = card.dataset.keywords?.split('|') ?? [];
      const matchComp = !comp || comps.some(c => c === comp);
      const matchKw   = !kw   || kws.some(k => k === kw);
      const matchSrc  = !src  || card.dataset.source?.toLowerCase() === src;
      const matchQ    = !q    || card.querySelector('.summary')?.textContent.toLowerCase().includes(q);
      const matchConf = parseInt(card.dataset.confidence ?? 0) >= minConf;
      card.classList.toggle('hidden', !(matchComp && matchKw && matchSrc && matchQ && matchConf));
    });
    updateCount();
  }

  function resetFilters() {
    document.getElementById('filter-competitor').value = '';
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-source').value = '';
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-confidence').value = '0';
    applyFilters();
  }

  document.getElementById('filter-competitor').addEventListener('change', applyFilters);
  document.getElementById('filter-keyword').addEventListener('change', applyFilters);
  document.getElementById('filter-source').addEventListener('change', applyFilters);
  document.getElementById('filter-confidence').addEventListener('change', applyFilters);
  document.getElementById('filter-search').addEventListener('input', applyFilters);

  updateCount();
</script>
</body>
</html>`;

  fs.mkdirSync('results', { recursive: true });
  fs.writeFileSync(`results/report_${timestamp}.html`, html);
  fs.writeFileSync('results/report_latest.html', html);
}
