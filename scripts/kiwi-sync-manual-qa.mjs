#!/usr/bin/env node
/**
 * CareKit → Kiwi TCMS: sync a manual QA run under Product "CareKit".
 *
 * Usage:
 *   node scripts/kiwi-sync-manual-qa.mjs --plan data/kiwi/bookings-2026-04-17.json
 *
 * Plan file shape (JSON):
 *   {
 *     "domain": "Bookings",              // must match an existing Kiwi Category name
 *     "version": "main",                 // existing Version on CareKit product
 *     "build": "manual-qa-2026-04-17",   // created if missing under that version
 *     "planName": "CareKit / Bookings / Manual QA",
 *     "planSummary": "Bookings page full manual QA — 2026-04-17.",
 *     "runSummary": "Bookings QA verification — 2026-04-17",
 *     "cases": [
 *       { "summary": "B1 Relations missing in list API",
 *         "text": "Steps: ...\n\nExpected: ...",
 *         "result": "PASSED" | "FAILED" | "BLOCKED" }
 *     ]
 *   }
 *
 * Idempotent: all lookups create-or-reuse by (name + parent).
 * Credentials are read from env (KIWI_USER / KIWI_PASS) or the defaults below.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import path from 'node:path';
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
  if (!csrf) throw new Error('Login CSRF token not found — is Kiwi running on ' + BASE + '?');
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

function ensure(model, filter, createPayload) {
  const found = rpc(`${model}.filter`, [filter]);
  if (found && found.length) return found[0];
  return rpc(`${model}.create`, [createPayload]);
}

function main() {
  const { values } = parseArgs({
    options: { plan: { type: 'string', short: 'p' } },
    strict: true,
  });
  if (!values.plan) {
    console.error('Usage: node scripts/kiwi-sync-manual-qa.mjs --plan <path-to-json>');
    process.exit(1);
  }

  const planFile = path.resolve(values.plan);
  if (!existsSync(planFile)) {
    console.error(`Plan file not found: ${planFile}`);
    process.exit(1);
  }
  /** @type {{ domain:string, version:string, build:string, planName:string, planSummary:string, runSummary:string, cases:{summary:string,text:string,result:'PASSED'|'FAILED'|'BLOCKED'}[] }} */
  const plan = JSON.parse(readFileSync(planFile, 'utf8'));

  login();

  // Product must already exist (bootstrapped by /c/pro/kiwi-tcms/setup_carekit.py).
  const product = rpc('Product.filter', [{ name: PRODUCT_NAME }])[0];
  if (!product) throw new Error(`Product "${PRODUCT_NAME}" missing — run setup_carekit.py first.`);

  const version = rpc('Version.filter', [{ product: product.id, value: plan.version }])[0];
  if (!version) throw new Error(`Version "${plan.version}" missing under ${PRODUCT_NAME}.`);

  const category = rpc('Category.filter', [{ product: product.id, name: plan.domain }])[0];
  if (!category) throw new Error(`Category "${plan.domain}" missing under ${PRODUCT_NAME}.`);

  const build = ensure('Build',
    { version: version.id, name: plan.build },
    { version: version.id, name: plan.build });
  console.log(`Product=${product.name} Version=${version.value} Build=${build.name} Category=${category.name}`);

  const planType = rpc('PlanType.filter', [{ name: 'Manual QA' }])[0]
    ?? rpc('PlanType.create', [{ name: 'Manual QA' }]);
  const caseStatus = rpc('TestCaseStatus.filter', [{ name: 'CONFIRMED' }])[0];
  const priority = rpc('Priority.filter', [{ value: 'P1' }])[0] ?? rpc('Priority.filter', [{}])[0];

  const existingPlan = rpc('TestPlan.filter', [{ name: plan.planName, product: product.id }])[0];
  const tp = existingPlan ?? rpc('TestPlan.create', [{
    name: plan.planName,
    text: plan.planSummary,
    product: product.id,
    product_version: version.id,
    type: planType.id,
    is_active: true,
  }]);
  console.log(`Plan: ${plan.planName} (id=${tp.id})`);

  const rows = [];
  for (const c of plan.cases) {
    const existing = rpc('TestCase.filter', [{ summary: c.summary, category: category.id }])[0];
    const tc = existing ?? rpc('TestCase.create', [{
      summary: c.summary,
      text: c.text,
      category: category.id,
      product: product.id,
      priority: priority.id,
      case_status: caseStatus.id,
      is_automated: false,
    }]);
    try { rpc('TestPlan.add_case', [tp.id, tc.id]); } catch { /* already linked */ }
    rows.push({ caseId: tc.id, summary: c.summary, result: c.result });
  }

  const manager = rpc('User.filter', [{ username: USER }])[0];
  const existingRun = rpc('TestRun.filter', [{ summary: plan.runSummary, plan: tp.id, build: build.id }])[0];
  const run = existingRun ?? rpc('TestRun.create', [{
    summary: plan.runSummary,
    manager: manager.id,
    plan: tp.id,
    build: build.id,
  }]);
  console.log(`Run:  ${plan.runSummary} (id=${run.id})`);

  const execStatuses = rpc('TestExecutionStatus.filter', [{}]);
  const pickExecStatus = (result) => execStatuses.find((s) =>
    result === 'PASSED' ? /^pass/i.test(s.name) :
    result === 'FAILED' ? /^fail/i.test(s.name) :
                          /^block/i.test(s.name)
  ).id;

  for (const row of rows) {
    const added = rpc('TestRun.add_case', [run.id, row.caseId]);
    const exec = Array.isArray(added) ? added[0] : added;
    const execId = exec.id ?? exec.case_run_id ?? exec;
    rpc('TestExecution.update', [execId, { status: pickExecStatus(row.result), tested_by: manager.id }]);
    console.log(`  exec=${execId} case=${row.caseId} ${row.result.padEnd(8)} ${row.summary}`);
  }

  console.log('\nDone.');
  console.log(`  Plan: ${BASE}/plan/${tp.id}/`);
  console.log(`  Run:  ${BASE}/runs/${run.id}/`);
}

main();
