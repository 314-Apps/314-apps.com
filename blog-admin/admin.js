const SESSION_KEY = 'inventrBlogAdmin';

let config = null;
let adminConfig = null;
let catalog = [];
let catalogByPath = new Map();
let published = new Set();
let publishedSha = null;
let githubUser = null;
let token = null;
let dirty = false;

const $ = (id) => document.getElementById(id);

function showMsg(text, type = 'info') {
  const el = $('msg');
  el.textContent = text;
  el.className = `msg ${type}`;
  el.classList.remove('hidden');
}

function hideMsg() {
  $('msg').classList.add('hidden');
}

async function loadJsonConfig() {
  const cfgRes = await fetch('config.json');
  config = await cfgRes.json();
  adminConfig = config;
}

function apiHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubGet(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: apiHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  return res.json();
}

async function validateToken() {
  const user = await githubGet('/user');
  githubUser = user.login;
  if (adminConfig.requiredGithubLogin && adminConfig.requiredGithubLogin !== githubUser) {
    throw new Error(`Signed in as ${githubUser}, but only ${adminConfig.requiredGithubLogin} may use this admin.`);
  }
}

async function loadRepoData() {
  const [catFile, pubFile] = await Promise.all([
    githubGet(`/repos/${config.repo}/contents/${config.catalogPath}?ref=${config.branch}`),
    githubGet(`/repos/${config.repo}/contents/${config.publishedPath}?ref=${config.branch}`),
  ]);
  catalog = JSON.parse(atob(catFile.content.replace(/\n/g, ''))).articles;
  catalogByPath = new Map(catalog.map((a) => [a.path, a]));
  const pub = JSON.parse(atob(pubFile.content.replace(/\n/g, '')));
  published = new Set(pub.paths || []);
  publishedSha = pubFile.sha;
  dirty = false;
}

async function login() {
  hideMsg();
  const pin = $('site-pin').value.trim();
  const expectedPin = adminConfig.sitePin;
  if (expectedPin && pin !== expectedPin) {
    showMsg('Incorrect site PIN.', 'error');
    return;
  }

  token = $('github-token').value.trim();
  if (!token) {
    showMsg('Enter a GitHub personal access token.', 'error');
    return;
  }

  try {
    await validateToken();
    await loadRepoData();
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token, githubUser, pinOk: true })
    );
    $('login-panel').classList.add('hidden');
    $('app-panel').classList.remove('hidden');
    render();
    showMsg(`Signed in as ${githubUser}.`, 'ok');
  } catch (e) {
    showMsg(e.message, 'error');
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  token = null;
  githubUser = null;
  $('app-panel').classList.add('hidden');
  $('login-panel').classList.remove('hidden');
  $('github-token').value = '';
  hideMsg();
}

async function tryRestoreSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    token = s.token;
    await validateToken();
    await loadRepoData();
    githubUser = s.githubUser;
    $('login-panel').classList.add('hidden');
    $('app-panel').classList.remove('hidden');
    render();
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function setDirty() {
  dirty = true;
  $('btn-save').disabled = false;
}

function togglePublished(path, on) {
  if (on) published.add(path);
  else published.delete(path);
  setDirty();
}

// --- Dependency graph ---

function transitiveDeps(rootPath) {
  const seen = new Set();
  const stack = [rootPath];
  while (stack.length) {
    const cur = stack.pop();
    const article = catalogByPath.get(cur);
    if (!article) continue;
    for (const target of article.linksTo ?? []) {
      if (target === rootPath || seen.has(target)) continue;
      seen.add(target);
      stack.push(target);
    }
  }
  return seen;
}

function depStatus(target) {
  const article = catalogByPath.get(target);
  if (!article) return 'missing';
  if (!published.has(target)) return 'off';
  if (article.status === 'stub') return 'stub';
  return 'ok';
}

function neededDepsToPublish(path) {
  return [...transitiveDeps(path)].filter(
    (t) => catalogByPath.has(t) && !published.has(t)
  );
}

function missingDeps(path) {
  return [...transitiveDeps(path)].filter((t) => !catalogByPath.has(t));
}

function depsSummaryForLive(path) {
  if (!published.has(path)) return { needs: [], missing: [] };
  return {
    needs: neededDepsToPublish(path),
    missing: missingDeps(path),
  };
}

function liveDepViolations() {
  const violations = [];
  for (const path of published) {
    const article = catalogByPath.get(path);
    if (!article) continue;
    for (const target of article.linksTo ?? []) {
      if (!catalogByPath.has(target)) {
        violations.push({ source: path, target, reason: 'missing' });
      } else if (!published.has(target)) {
        violations.push({ source: path, target, reason: 'off' });
      }
    }
  }
  return violations;
}

// --- Modal for dep publish prompt ---

function openDepModal({ title, intro, deps, onConfirm }) {
  $('dep-modal-title').textContent = title;
  $('dep-modal-intro').textContent = intro;
  const list = $('dep-modal-list');
  list.innerHTML = '';
  for (const t of deps) {
    const article = catalogByPath.get(t);
    const row = document.createElement('div');
    row.className = 'dep-row';
    const left = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'dep-title';
    titleEl.textContent = article ? article.title : t;
    const pathEl = document.createElement('div');
    pathEl.className = 'dep-path';
    pathEl.textContent = t;
    left.appendChild(titleEl);
    left.appendChild(pathEl);
    const right = document.createElement('div');
    if (!article) {
      right.innerHTML = '<span class="badge broken">missing source</span>';
    } else if (article.status === 'stub') {
      right.innerHTML = '<span class="badge warn">stub</span>';
    } else {
      right.innerHTML = '<span class="badge off">not live</span>';
    }
    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }
  $('dep-modal').classList.remove('hidden');

  const cancel = $('dep-modal-cancel');
  const confirm = $('dep-modal-confirm');
  const close = () => $('dep-modal').classList.add('hidden');

  const cancelHandler = () => {
    close();
    cleanup();
  };
  const confirmHandler = () => {
    close();
    cleanup();
    onConfirm();
  };
  function cleanup() {
    cancel.removeEventListener('click', cancelHandler);
    confirm.removeEventListener('click', confirmHandler);
  }
  cancel.addEventListener('click', cancelHandler);
  confirm.addEventListener('click', confirmHandler);

  const hasPublishable = deps.some((t) => catalogByPath.has(t));
  confirm.disabled = !hasPublishable;
  confirm.textContent = hasPublishable
    ? `Publish all ${deps.filter((t) => catalogByPath.has(t)).length} listed`
    : 'Nothing to publish';
}

// --- Rendering ---

function renderStats() {
  const live = published.size;
  const ready = catalog.filter((a) => a.status === 'ready').length;
  const violations = liveDepViolations();
  $('stats').innerHTML = `
    <span><strong>${live}</strong> live</span>
    <span><strong>${catalog.length}</strong> in repo</span>
    <span><strong>${ready}</strong> ready to publish</span>
    <span><strong>${violations.length}</strong> broken live links</span>
    <span>Signed in as <strong>${githubUser}</strong></span>
  `;
}

function populateClusterFilter() {
  const sel = $('filter-cluster');
  const current = sel.value;
  const clusters = [...new Set(catalog.map((a) => a.cluster))].sort();
  sel.innerHTML = '<option value="">All clusters</option>';
  for (const c of clusters) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = catalog.find((a) => a.cluster === c)?.clusterLabel || c;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function filteredArticles() {
  const q = $('filter-search').value.toLowerCase().trim();
  const cluster = $('filter-cluster').value;
  const status = $('filter-status').value;
  const live = $('filter-live').value;
  const links = $('filter-links').value;

  return catalog.filter((a) => {
    if (cluster && a.cluster !== cluster) return false;
    if (status && a.status !== status) return false;
    const isLive = published.has(a.path);
    if (live === 'yes' && !isLive) return false;
    if (live === 'no' && isLive) return false;
    if (links === 'broken') {
      if (!isLive) return false;
      const { needs, missing } = depsSummaryForLive(a.path);
      if (needs.length === 0 && missing.length === 0) return false;
    } else if (links === 'needs') {
      const needs = neededDepsToPublish(a.path);
      if (needs.length === 0) return false;
    }
    if (q && !a.title.toLowerCase().includes(q) && !a.path.toLowerCase().includes(q)) return false;
    return true;
  });
}

function linksBadge(article) {
  const isLive = published.has(article.path);
  const needs = neededDepsToPublish(article.path);
  const missing = missingDeps(article.path);

  if (missing.length > 0) {
    return `<span class="badge broken" title="Missing source files: ${missing.join(', ')}">${missing.length} missing</span>`;
  }
  if (needs.length === 0) {
    return '<span class="badge ready">OK</span>';
  }
  if (isLive) {
    return `<span class="badge broken" title="${needs.join(', ')}">${needs.length} broken</span>`;
  }
  return `<span class="badge deps" title="${needs.join(', ')}">${needs.length} needed</span>`;
}

function render() {
  renderStats();
  populateClusterFilter();

  const rows = $('article-rows');
  rows.innerHTML = '';
  const list = filteredArticles();

  for (const a of list) {
    const tr = document.createElement('tr');
    const isLive = published.has(a.path);
    const canPublish = a.status === 'ready';
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-path="${a.path}"></td>
      <td>
        <label>
          <input type="checkbox" class="live-toggle" data-path="${a.path}" ${isLive ? 'checked' : ''} ${!canPublish && !isLive ? 'disabled' : ''}>
          ${isLive ? '<span class="badge live">Live</span>' : '<span class="badge off">Off</span>'}
        </label>
      </td>
      <td><span class="badge ${a.status}">${a.status}</span></td>
      <td>
        <strong>${escapeHtml(a.title)}</strong><br>
        <code style="font-size:0.8em;color:var(--muted)">${escapeHtml(a.path)}</code>
      </td>
      <td>${escapeHtml(a.clusterLabel)}</td>
      <td>${a.wordCount}</td>
      <td>${linksBadge(a)}</td>
    `;
    rows.appendChild(tr);
  }

  rows.querySelectorAll('.live-toggle').forEach((el) => {
    el.addEventListener('change', (e) => {
      handleLiveToggle(e);
    });
  });

  $('check-all').checked = false;
}

function handleLiveToggle(e) {
  const path = e.target.dataset.path;
  const article = catalogByPath.get(path);
  const turningOn = e.target.checked;

  if (!turningOn) {
    togglePublished(path, false);
    render();
    return;
  }

  if (article?.status === 'stub') {
    if (!confirm('This article is still a stub. Publish anyway?')) {
      e.target.checked = false;
      return;
    }
  }

  const needed = neededDepsToPublish(path);
  const missing = missingDeps(path);

  if (missing.length > 0) {
    e.target.checked = false;
    showMsg(
      `Cannot publish ${path}: it links to missing source files: ${missing.join(', ')}. Add those HTML files first.`,
      'error'
    );
    return;
  }

  if (needed.length === 0) {
    togglePublished(path, true);
    render();
    return;
  }

  e.target.checked = false;
  openDepModal({
    title: 'Publishing requires more articles',
    intro: `${article.title} links to ${needed.length} article(s) that are not live yet. Publishing them together keeps internal links working after deploy.`,
    deps: needed,
    onConfirm: () => {
      togglePublished(path, true);
      for (const t of needed) togglePublished(t, true);
      render();
      showMsg(
        `Marked ${needed.length + 1} articles live. Click Save & deploy when ready.`,
        'info'
      );
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function savePublished() {
  const violations = liveDepViolations();
  if (violations.length > 0) {
    const lines = violations
      .slice(0, 10)
      .map((v) => `  ${v.source} -> ${v.target} (${v.reason})`)
      .join('\n');
    const more = violations.length > 10 ? `\n  …and ${violations.length - 10} more` : '';
    showMsg(
      `Cannot save: ${violations.length} live article(s) link to articles that are missing or not live.\n${lines}${more}`,
      'error'
    );
    return;
  }

  $('btn-save').disabled = true;
  showMsg('Saving to GitHub…', 'info');
  const body = {
    paths: [...published].sort(),
    updatedAt: new Date().toISOString(),
    updatedBy: githubUser,
  };
  const content = btoa(JSON.stringify(body, null, 2));
  const res = await fetch(
    `https://api.github.com/repos/${config.repo}/contents/${config.publishedPath}`,
    {
      method: 'PUT',
      headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `blog: publish ${body.paths.length} articles`,
        content,
        sha: publishedSha,
        branch: config.branch,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $('btn-save').disabled = false;
    showMsg(err.message || 'Save failed', 'error');
    return;
  }
  const data = await res.json();
  publishedSha = data.content.sha;
  dirty = false;
  showMsg('Saved. GitHub Actions will deploy in 1–3 minutes.', 'ok');
}

function publishAllReady() {
  const candidates = catalog.filter(
    (a) => a.status === 'ready' && !published.has(a.path)
  );
  if (candidates.length === 0) {
    showMsg('No unpublished ready articles to add.', 'info');
    return;
  }

  // Filter out anything that would create new violations (missing deps).
  let added = 0;
  let blocked = 0;
  for (const a of candidates) {
    if (missingDeps(a.path).length > 0) {
      blocked++;
      continue;
    }
    published.add(a.path);
    added++;
  }

  // Resolve newly-introduced "off" deps by adding their ready dependencies too.
  // Single pass: anything that became reachable but isn't live yet, add if ready.
  let extra = 0;
  let pass;
  do {
    pass = false;
    for (const livePath of [...published]) {
      const article = catalogByPath.get(livePath);
      if (!article) continue;
      for (const target of article.linksTo ?? []) {
        if (!published.has(target)) {
          const dep = catalogByPath.get(target);
          if (dep && dep.status === 'ready') {
            published.add(target);
            extra++;
            pass = true;
          }
        }
      }
    }
  } while (pass);

  if (added + extra > 0) setDirty();
  render();
  const blockedMsg = blocked > 0 ? ` Skipped ${blocked} with missing source files.` : '';
  showMsg(
    `Marked ${added} ready articles live (plus ${extra} pulled in by dependencies).${blockedMsg} Not saved yet.`,
    'info'
  );
}

function unpublishAll() {
  if (!confirm('Unpublish every article from the live site?')) return;
  published.clear();
  setDirty();
  render();
}

$('btn-login').addEventListener('click', login);
$('btn-logout').addEventListener('click', logout);
$('btn-save').addEventListener('click', savePublished);
$('btn-reload').addEventListener('click', () => loadRepoData().then(render).catch((e) => showMsg(e.message, 'error')));
$('btn-publish-ready').addEventListener('click', publishAllReady);
$('btn-unpublish-all').addEventListener('click', unpublishAll);
['filter-search', 'filter-cluster', 'filter-status', 'filter-live', 'filter-links'].forEach((id) => {
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
});
$('check-all').addEventListener('change', (e) => {
  document.querySelectorAll('.row-check').forEach((cb) => {
    cb.checked = e.target.checked;
  });
});

(async function init() {
  await loadJsonConfig();
  await tryRestoreSession();
})();
