const DEFAULT_REPO = 'BoomForge/TassieNow';
const CATALOGUE_PATH = 'src/data/places.json';
const UPLOAD_ROOT = 'public/uploads/admin';

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToText(value) {
  const binary = atob(String(value || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function github(context, path, init = {}) {
  const token = context.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured');
  const repo = context.env.GITHUB_REPO || DEFAULT_REPO;
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      'accept': 'application/vnd.github+json',
      'authorization': `Bearer ${token}`,
      'user-agent': 'TassieNow-Admin',
      'x-github-api-version': '2022-11-28',
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub request failed (${response.status})`);
  return data;
}

export async function readCatalogue(context) {
  const data = await github(context, `/contents/${CATALOGUE_PATH}?ref=main`);
  const blob = data.content ? data : await github(context, `/git/blobs/${data.sha}`);
  return { sha: data.sha, places: JSON.parse(base64ToText(blob.content)) };
}

export async function readDiscovery(context) {
  const paths = ['discovery-candidates.json', 'discovery-report.json'];
  const [candidates, report] = await Promise.all(paths.map(async name => {
    const data = await github(context, `/contents/src/data/${name}?ref=main`);
    const blob = data.content ? data : await github(context, `/git/blobs/${data.sha}`);
    return JSON.parse(base64ToText(blob.content));
  }));
  return { candidates, report };
}

export async function writeCatalogue(context, places, sha, message) {
  const content = bytesToBase64(new TextEncoder().encode(`${JSON.stringify(places, null, 2)}\n`));
  return github(context, `/contents/${CATALOGUE_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha, branch: 'main' })
  });
}

export async function writeUploadedImage(context, bytes, { extension, label = 'image' } = {}) {
  const safeLabel = slugify(label) || 'image';
  const date = hobartDate();
  const month = date.slice(0, 7);
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const filename = `${safeLabel.slice(0, 54)}-${suffix}.${extension}`;
  const repoPath = `${UPLOAD_ROOT}/${month}/${filename}`;
  await github(context, `/contents/${repoPath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `admin: upload ${filename}`,
      content: bytesToBase64(bytes),
      branch: 'main'
    })
  });
  return {
    path: repoPath,
    url: `/${repoPath.replace(/^public\//, '')}`
  };
}

export function slugify(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

export function hobartDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Hobart', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
