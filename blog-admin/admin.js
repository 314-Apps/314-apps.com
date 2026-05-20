const SESSION_KEY = 'inventrBlogAdmin';

let config = null;
let adminConfig = null;
let catalog = [];
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
  render();
}

function renderStats() {
  const live = published.size;
  const ready = catalog.filter((a) => a.status === 'ready').length;
  $('stats').innerHTML = `
    <span><strong>${live}</strong> live</span>
    <span><strong>${catalog.length}</strong> in repo</span>
    <span><strong>${ready}</strong> ready to publish</span>
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

  return catalog.filter((a) => {
    if (cluster && a.cluster !== cluster) return false;
    if (status && a.status !== status) return false;
    const isLive = published.has(a.path);
    if (live === 'yes' && !isLive) return false;
    if (live === 'no' && isLive) return false;
    if (q && !a.title.toLowerCase().includes(q) && !a.path.toLowerCase().includes(q)) return false;
    return true;
  });
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
    `;
    rows.appendChild(tr);
  }

  rows.querySelectorAll('.live-toggle').forEach((el) => {
    el.addEventListener('change', (e) => {
      const path = e.target.dataset.path;
      const article = catalog.find((x) => x.path === path);
      if (e.target.checked && article?.status === 'stub') {
        if (!confirm('This article is still a stub. Publish anyway?')) {
          e.target.checked = false;
          return;
        }
      }
      togglePublished(path, e.target.checked);
    });
  });

  $('check-all').checked = false;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function savePublished() {
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
  let n = 0;
  for (const a of catalog) {
    if (a.status === 'ready' && !published.has(a.path)) {
      published.add(a.path);
      n++;
    }
  }
  if (n) setDirty();
  render();
  showMsg(`Marked ${n} ready articles as live (not saved yet).`, 'info');
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
['filter-search', 'filter-cluster', 'filter-status', 'filter-live'].forEach((id) => {
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
