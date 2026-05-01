#!/usr/bin/env node
/**
 * Create a Kiwi Category under the CareKit product if it does not already exist.
 * Usage: node scripts/kiwi-ensure-category.mjs <CategoryName>
 *
 * Uses the same login + JSON-RPC flow as kiwi-sync-manual-qa.mjs.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const BASE = process.env.KIWI_BASE ?? 'https://localhost:6443';
const USER = process.env.KIWI_USER ?? 'admin';
const PASS = process.env.KIWI_PASS ?? 'CareKit_2026';
const PRODUCT_NAME = 'CareKit';

const tmpDir = os.tmpdir().replace(/\\/g, '/');
const COOKIES = `${tmpDir}/kiwi-cookies.txt`;
const LOGIN_HTML = `${tmpDir}/kiwi-login.html`;
const BODY_JSON = `${tmpDir}/kiwi-body.json`;

function sh(cmd) {
  const r = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cmd failed: ${cmd}\n${r.stderr}`);
  return r.stdout;
}

function login() {
  if (existsSync(COOKIES)) sh(`rm -f "${COOKIES}"`);
  sh(`curl -sk -c "${COOKIES}" "${BASE}/accounts/login/" -o "${LOGIN_HTML}"`);
  const html = readFileSync(LOGIN_HTML, 'utf8');
  const csrf = /csrfmiddlewaretoken[^>]*value="([^"]+)"/.exec(html)?.[1];
  if (!csrf) throw new Error('Login CSRF token not found.');
  sh(`curl -sk -b "${COOKIES}" -c "${COOKIES}" -X POST \
    -H "Referer: ${BASE}/accounts/login/" \
    -d "csrfmiddlewaretoken=${csrf}&username=${USER}&password=${PASS}&next=/" \
    -o /dev/null "${BASE}/accounts/login/"`);
}

function rpc(method, params) {
  const csrf = readFileSync(COOKIES, 'utf8').split('\n').find((l) => l.includes('csrftoken'))?.split('\t')[6];
  const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
  writeFileSync(BODY_JSON, body);
  const out = sh(`curl -sk -b "${COOKIES}" -X POST \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: ${csrf}" \
    -H "Referer: ${BASE}/" \
    --data-binary @${BODY_JSON} \
    "${BASE}/json-rpc/"`);
  const parsed = JSON.parse(out);
  if (parsed.error) throw new Error(`${method} → ${JSON.stringify(parsed.error)}`);
  return parsed.result;
}

const name = process.argv[2];
if (!name) { console.error('Usage: kiwi-ensure-category.mjs <CategoryName>'); process.exit(1); }

login();
const product = rpc('Product.filter', [{ name: PRODUCT_NAME }])[0];
if (!product) throw new Error(`Product "${PRODUCT_NAME}" missing.`);
const existing = rpc('Category.filter', [{ product: product.id, name }]);
if (existing.length) {
  console.log(`exists: ${name} (id=${existing[0].id})`);
} else {
  const created = rpc('Category.create', [{ product: product.id, name, description: '' }]);
  console.log(`created: ${name} (id=${created.id})`);
}
