# -*- coding: utf-8 -*-
"""توليد تقرير HTML تفاعلي — الاختبارات هي مصدر الحقيقة.

يفحص كل ملفات JSON نتائج الاختبارات في أي مكان تحت apps/ ويستخرج:
  - Test ID     من  [CL-001]
  - Module      من  [Clients/...]   (قبل /)
  - Slice       من  [Clients/create-client]  (بعد /)
  - Priority    من  [P1] | [P2] | [P3]
  - Title       الباقي من اسم الاختبار

التنسيق المعتمد لاسم الاختبار:
  [TestID][Module/slice][Priority] العنوان العربي

مثال:
  it('[CL-001][Clients/create-client][P1] إنشاء walk-in بالحد الأدنى', ...)

أي اختبار بلا metadata يُجمّع تحت "Uncategorized".

المخرج: test-reports/output/test-report.html  (standalone)

الاستخدام: py test-reports/scripts/generate_html_report.py
"""
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_HTML = ROOT / "test-reports" / "output" / "test-report.html"

# نمط اسم الاختبار: [ID][Module/slice][Priority] Title
# يقبل: CL-001 / CL-UI-046a / FLOW-BLC-01 (FLOW-<sub>-<num>)
TAG_PATTERN = re.compile(
    r"\["
    r"(?P<tid>(?:FLOW-[A-Z]{1,4}-[A-Za-z0-9-]+)|(?:[A-Z][A-Z0-9]{1,4}-[A-Za-z0-9-]+))"
    r"\]\s*"
    r"(?:\[(?P<module>[^\]/]+)/(?P<slice>[^\]]+)\]\s*)?"
    r"(?:\[(?P<prio>P[1-3][^\]]*)\]\s*)?"
    r"(?P<title>.*)",
    re.IGNORECASE,
)

ANSI = re.compile(r"\x1b\[[0-9;]*m")


def strip_ansi(s: str) -> str:
    return ANSI.sub("", s or "")


def parse_tag(name: str):
    """استخراج metadata من اسم اختبار."""
    m = TAG_PATTERN.match(name or "")
    if not m:
        return None
    tid = m.group("tid").upper()
    # CL-UI-### → parent CL-###
    ui_m = re.match(r"^CL-UI-(\d+)$", tid, re.IGNORECASE)
    if ui_m:
        parent_tid = f"CL-{int(ui_m.group(1)):03d}"
        is_ui_variant = True
    else:
        parent_tid = tid
        is_ui_variant = False
    return {
        "tid": tid,
        "parent_tid": parent_tid,
        "is_ui_variant": is_ui_variant,
        "module": (m.group("module") or "Uncategorized").strip(),
        "slice": (m.group("slice") or "general").strip(),
        "priority": (m.group("prio") or "P3").strip(),
        "title": (m.group("title") or "").strip(),
    }


def find_jest_jsons():
    """ابحث عن كل test-results-*.json في apps/."""
    results = []
    for p in (ROOT / "apps").rglob("test-results-*.json"):
        if p.is_file() and "node_modules" not in p.parts:
            results.append(p)
    return results


def find_playwright_jsons():
    results = []
    for p in (ROOT / "apps").rglob("playwright-*-results.json"):
        if p.is_file() and "node_modules" not in p.parts:
            results.append(p)
    return results


def load_jest_file(path: Path):
    """إرجاع list من السجلات من ملف Jest JSON."""
    out = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[warn] cannot parse {path}: {e}")
        return out
    for suite in data.get("testResults", []):
        for a in suite.get("assertionResults", []):
            full = a.get("title") or ""
            meta = parse_tag(full)
            if not meta:
                continue
            msg = (a.get("failureMessages") or [""])[0]
            out.append({
                **meta,
                "status": a.get("status"),
                "failure": strip_ansi(msg)[:2000],
                "duration": a.get("duration", 0),
                "source": "Jest E2E",
                "file": str(path.relative_to(ROOT)),
                "raw_name": full,
            })
    return out


def load_pw_file(path: Path):
    out = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[warn] cannot parse {path}: {e}")
        return out

    def walk(suites):
        for s in suites:
            for spec in s.get("specs", []):
                title = spec.get("title", "")
                meta = parse_tag(title)
                if not meta:
                    continue
                for t in spec.get("tests", []):
                    results = t.get("results") or []
                    r0 = results[0] if results else {}
                    status = r0.get("status", "unknown")
                    err = ""
                    if status == "failed" and r0.get("error"):
                        err = strip_ansi(r0["error"].get("message", ""))[:2000]
                    out.append({
                        **meta,
                        "status": status,
                        "failure": err,
                        "duration": r0.get("duration", 0),
                        "source": "Playwright UI",
                        "file": str(path.relative_to(ROOT)),
                        "raw_name": title,
                    })
            walk(s.get("suites") or [])

    walk(data.get("suites", []))
    return out


# ── جمع كل الاختبارات ───────────────────────────────────────────────────────
all_tests = []
jest_files = find_jest_jsons()
pw_files = find_playwright_jsons()

for p in jest_files:
    all_tests.extend(load_jest_file(p))
for p in pw_files:
    all_tests.extend(load_pw_file(p))

print(f"[info] Jest files:       {len(jest_files)}")
print(f"[info] Playwright files: {len(pw_files)}")
print(f"[info] Total tests:      {len(all_tests)}")

if not all_tests:
    print("[error] No tagged tests found. Run tests first.")
    sys.exit(1)

# ── ضَمّ النتائج حسب parent_tid (سيناريو واحد قد يُغطّى بعدة اختبارات) ─────────
grouped = defaultdict(list)
for t in all_tests:
    grouped[t["parent_tid"]].append(t)

scenarios = []
for parent_tid, tests in grouped.items():
    # الأولوية: jest > playwright للحالة العامة
    primary = next((t for t in tests if t["source"] == "Jest E2E"), tests[0])
    # حالة مجمّعة: failed > passed > skipped
    statuses = [t["status"] for t in tests]
    if "failed" in statuses:
        combined = "failed"
    elif "passed" in statuses:
        combined = "passed"
    else:
        combined = statuses[0] if statuses else "unknown"

    status_label = {
        "passed": "Pass",
        "failed": "Fail",
        "skipped": "Skipped",
    }.get(combined, "Unknown")

    failure_msgs = [
        f"[{t['tid']}] {t['failure']}" for t in tests if t["status"] == "failed" and t["failure"]
    ]

    sources = sorted({t["source"] for t in tests})
    scenarios.append({
        "id": parent_tid,
        "module": primary["module"],
        "slice": primary["slice"],
        "priority": primary["priority"],
        "title": primary["title"],
        "status": status_label,
        "sources": sources,
        "test_count": len(tests),
        "duration_ms": int(sum((t["duration"] or 0) for t in tests)),
        "failure": "\n\n".join(failure_msgs),
        "sub_tests": [
            {
                "tid": t["tid"],
                "raw": t["raw_name"],
                "status": t["status"],
                "source": t["source"],
                "file": t["file"],
            }
            for t in tests
        ],
    })

scenarios.sort(key=lambda s: (s["module"], s["slice"], s["id"]))

# ── إحصائيات ───────────────────────────────────────────────────────────────
total = len(scenarios)
passed = sum(1 for s in scenarios if s["status"] == "Pass")
failed = sum(1 for s in scenarios if s["status"] == "Fail")
skipped = sum(1 for s in scenarios if s["status"] == "Skipped")

# تجميع حسب Module > Slice
by_module = defaultdict(lambda: defaultdict(list))
for s in scenarios:
    by_module[s["module"]][s["slice"]].append(s)

module_stats = []
for mod, slices in by_module.items():
    mod_total = sum(len(v) for v in slices.values())
    mod_pass = sum(1 for v in slices.values() for s in v if s["status"] == "Pass")
    mod_fail = sum(1 for v in slices.values() for s in v if s["status"] == "Fail")
    module_stats.append({
        "name": mod,
        "total": mod_total,
        "passed": mod_pass,
        "failed": mod_fail,
        "slice_count": len(slices),
    })
module_stats.sort(key=lambda m: m["name"])


def pct(n):
    return f"{(n / total * 100):.1f}%" if total else "0%"


exec_date = datetime.now().strftime("%Y-%m-%d %H:%M")
scenarios_json = json.dumps(scenarios, ensure_ascii=False).replace("</", "<\\/")
module_stats_json = json.dumps(module_stats, ensure_ascii=False).replace("</", "<\\/")

html = f"""<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>تقرير اختبارات CareKit</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {{
    --bg:#0b0f19; --surface:#1a1f2e; --surface-2:#232a3d; --border:#2a3248;
    --text:#e6e8ef; --muted:#98a0b3; --primary:#354FD8;
    --success:#22c55e; --danger:#ef4444; --warning:#f59e0b;
    --neutral:#64748b; --accent:#82CC17;
  }}
  @media (prefers-color-scheme: light) {{
    :root {{
      --bg:#f7f8fa; --surface:#fff; --surface-2:#f1f3f8; --border:#e2e6ef;
      --text:#0f172a; --muted:#64748b;
    }}
  }}
  * {{ box-sizing:border-box; }}
  body {{
    margin:0; font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;
    background:var(--bg); color:var(--text); line-height:1.55;
  }}
  .wrap {{ max-width:1500px; margin:0 auto; padding:24px; }}
  header {{
    display:flex; justify-content:space-between; align-items:flex-end;
    gap:16px; flex-wrap:wrap; margin-bottom:24px; padding-bottom:20px;
    border-bottom:1px solid var(--border);
  }}
  header h1 {{ margin:0 0 6px; font-size:28px; }}
  header .meta {{ color:var(--muted); font-size:13px; }}
  .badge-meta {{
    display:inline-block; padding:4px 10px; border-radius:999px;
    background:var(--surface-2); color:var(--muted); font-size:12px;
    margin-inline-start:8px;
  }}

  /* Cards */
  .cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:24px; }}
  .card {{
    background:var(--surface); border:1px solid var(--border); border-radius:14px;
    padding:18px;
  }}
  .card .label {{ color:var(--muted); font-size:13px; }}
  .card .value {{ font-size:32px; font-weight:700; margin-top:4px; }}
  .card .pct   {{ color:var(--muted); font-size:13px; margin-top:2px; }}
  .card.pass {{ border-top:3px solid var(--success); }}
  .card.fail {{ border-top:3px solid var(--danger);  }}
  .card.skip {{ border-top:3px solid var(--warning); }}
  .card.total{{ border-top:3px solid var(--primary); }}

  .bar {{
    display:flex; height:10px; border-radius:6px; overflow:hidden;
    background:var(--surface-2); margin:20px 0 24px; border:1px solid var(--border);
  }}
  .bar span {{ display:block; height:100%; }}
  .bar .s-pass {{ background:var(--success); }}
  .bar .s-fail {{ background:var(--danger);  }}
  .bar .s-skip {{ background:var(--warning); }}

  /* Module cards grid */
  .module-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin-bottom:24px; }}
  .module-card {{
    background:var(--surface); border:1px solid var(--border); border-radius:12px;
    padding:14px; cursor:pointer; transition:transform .1s, border-color .1s;
  }}
  .module-card:hover {{ transform:translateY(-1px); border-color:var(--primary); }}
  .module-card.active {{ border-color:var(--primary); background:var(--surface-2); }}
  .module-card .mname {{ font-weight:600; font-size:15px; }}
  .module-card .mstats {{ display:flex; gap:8px; margin-top:8px; font-size:12px; color:var(--muted); flex-wrap:wrap; }}
  .module-card .mbar {{ display:flex; height:6px; border-radius:3px; overflow:hidden; margin-top:10px; background:var(--surface-2); }}

  /* Filter bar */
  .filter-bar {{
    display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;
    background:var(--surface); border:1px solid var(--border);
    border-radius:12px; padding:14px;
  }}
  .filter-bar input, .filter-bar select {{
    background:var(--surface-2); color:var(--text); border:1px solid var(--border);
    border-radius:8px; padding:8px 12px; font:inherit;
  }}
  .filter-bar input {{ flex:1; min-width:200px; }}
  .filter-bar .count {{ color:var(--muted); align-self:center; font-size:13px; }}

  /* Slice groups */
  .slice-group {{
    background:var(--surface); border:1px solid var(--border); border-radius:12px;
    margin-bottom:14px; overflow:hidden;
  }}
  .slice-header {{
    background:var(--surface-2); padding:10px 16px; cursor:pointer; user-select:none;
    display:flex; justify-content:space-between; align-items:center; gap:12px;
  }}
  .slice-header:hover {{ background:var(--surface); }}
  .slice-header .stitle {{ font-weight:600; }}
  .slice-header .smod   {{ color:var(--muted); font-size:12px; margin-inline-end:8px; }}
  .slice-header .sstats {{ display:flex; gap:6px; font-size:12px; }}
  .slice-header .ico::before {{ content:"▸ "; color:var(--muted); transition:transform .15s; display:inline-block; }}
  .slice-header.open .ico::before {{ content:"▾ "; }}

  table {{ width:100%; border-collapse:collapse; display:none; }}
  .slice-group.open table {{ display:table; }}
  thead th {{
    background:var(--surface); padding:10px 12px; text-align:start;
    font-weight:600; font-size:12px; color:var(--muted);
    border-bottom:1px solid var(--border);
  }}
  tbody td {{ padding:12px; border-bottom:1px solid var(--border); font-size:14px; vertical-align:top; }}
  tbody tr:hover {{ background:var(--surface-2); }}

  .mono {{ font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace; font-size:13px; }}
  .badge {{ display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:600; }}
  .b-pass {{ background:rgba(34,197,94,.15); color:var(--success); }}
  .b-fail {{ background:rgba(239,68,68,.15); color:var(--danger); }}
  .b-skip {{ background:rgba(245,158,11,.15); color:var(--warning); }}
  .b-prio-P1,.b-prio-P1-High {{ background:rgba(239,68,68,.12); color:var(--danger); }}
  .b-prio-P2,.b-prio-P2-Medium {{ background:rgba(245,158,11,.15); color:var(--warning); }}
  .b-prio-P3,.b-prio-P3-Low {{ background:rgba(100,116,139,.15); color:var(--neutral); }}
  .pill {{ display:inline-block; padding:2px 6px; border-radius:4px; background:var(--surface-2); color:var(--muted); font-size:11px; }}

  .row-toggle {{ cursor:pointer; user-select:none; }}
  .row-toggle .tog::before {{ content:"▸"; color:var(--muted); margin-inline-end:4px; }}
  .row-toggle.open .tog::before {{ content:"▾"; }}
  .details {{ display:none; }}
  .details.show {{ display:table-row; }}
  .details td {{ background:var(--bg); padding:14px 22px; }}
  .details pre {{
    background:var(--surface); border:1px solid var(--border);
    border-radius:8px; padding:10px 12px; margin:0;
    white-space:pre-wrap; word-break:break-word; font-size:12px;
    max-height:240px; overflow:auto;
  }}
  .sub-list {{ margin:0; padding-inline-start:18px; font-size:13px; }}
  .sub-list li {{ margin:3px 0; }}
  .failure-box {{
    background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.3);
    border-radius:8px; padding:10px 12px; margin-top:10px;
  }}

  footer {{ margin-top:30px; padding-top:16px; border-top:1px solid var(--border);
    color:var(--muted); font-size:12px; text-align:center; }}
  footer code {{ background:var(--surface-2); padding:2px 6px; border-radius:4px; }}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div>
      <h1>تقرير اختبارات CareKit</h1>
      <div class="meta">
        آخر تشغيل: <strong>{exec_date}</strong>
        <span class="badge-meta">مصدر: نتائج الاختبارات مباشرة</span>
      </div>
    </div>
    <div class="meta">
      <div>إجمالي السيناريوهات: <strong>{total}</strong></div>
      <div>الموديولات: <strong>{len(module_stats)}</strong></div>
    </div>
  </header>

  <div class="cards">
    <div class="card total"><div class="label">إجمالي السيناريوهات</div>
      <div class="value">{total}</div><div class="pct">في كل الموديولات</div></div>
    <div class="card pass"><div class="label">نجح</div>
      <div class="value">{passed}</div><div class="pct">{pct(passed)}</div></div>
    <div class="card fail"><div class="label">فشل</div>
      <div class="value">{failed}</div><div class="pct">{pct(failed)}</div></div>
    <div class="card skip"><div class="label">تم التخطي</div>
      <div class="value">{skipped}</div><div class="pct">{pct(skipped)}</div></div>
  </div>

  <div class="bar">
    <span class="s-pass" style="width:{passed/total*100 if total else 0}%"></span>
    <span class="s-fail" style="width:{failed/total*100 if total else 0}%"></span>
    <span class="s-skip" style="width:{skipped/total*100 if total else 0}%"></span>
  </div>

  <h3 style="margin:0 0 10px">الموديولات</h3>
  <div class="module-grid" id="modules"></div>

  <div class="filter-bar">
    <input type="search" id="q" placeholder="ابحث في المعرّف أو العنوان..." />
    <select id="fStatus">
      <option value="">كل الحالات</option>
      <option value="Pass">Pass</option>
      <option value="Fail">Fail</option>
      <option value="Skipped">Skipped</option>
    </select>
    <select id="fPriority">
      <option value="">كل الأولويات</option>
      <option value="P1">P1-High</option>
      <option value="P2">P2-Medium</option>
      <option value="P3">P3-Low</option>
    </select>
    <select id="fSource">
      <option value="">كل المصادر</option>
      <option value="Jest E2E">Jest E2E</option>
      <option value="Playwright UI">Playwright UI</option>
    </select>
    <button id="clearMod" style="display:none; background:var(--surface-2); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:8px 12px; cursor:pointer; font:inherit;">✕ إلغاء فلتر الموديول</button>
    <div class="count" id="count"></div>
  </div>

  <div id="groups"></div>

  <footer>
    تم توليد التقرير تلقائياً من <code>test-reports/scripts/generate_html_report.py</code>
    &middot; مصدر البيانات: أسماء الاختبارات نفسها بصيغة <code>[TID][Module/slice][Priority] العنوان</code>
  </footer>
</div>

<script>
const SCENARIOS = {scenarios_json};
const MODULES   = {module_stats_json};
let activeModule = null;

const statusCls = {{ "Pass":"b-pass","Fail":"b-fail","Skipped":"b-skip" }};

function esc(s) {{
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({{
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }}[c]));
}}

function renderModules() {{
  document.getElementById("modules").innerHTML = MODULES.map(m => {{
    const passPct = m.total ? (m.passed/m.total*100) : 0;
    const failPct = m.total ? (m.failed/m.total*100) : 0;
    const active = activeModule === m.name ? " active" : "";
    return `
      <div class="module-card${{active}}" data-mod="${{esc(m.name)}}">
        <div class="mname">${{esc(m.name)}}</div>
        <div class="mstats">
          <span>${{m.total}} سيناريو</span>
          <span>·</span>
          <span>${{m.slice_count}} slice</span>
          <span>·</span>
          <span style="color:var(--success)">✓ ${{m.passed}}</span>
          ${{m.failed ? `<span style="color:var(--danger)">✗ ${{m.failed}}</span>` : ""}}
        </div>
        <div class="mbar">
          <span style="width:${{passPct}}%;background:var(--success)"></span>
          <span style="width:${{failPct}}%;background:var(--danger)"></span>
        </div>
      </div>`;
  }}).join("");

  document.querySelectorAll(".module-card").forEach(el => {{
    el.addEventListener("click", () => {{
      const name = el.dataset.mod;
      activeModule = activeModule === name ? null : name;
      document.getElementById("clearMod").style.display = activeModule ? "" : "none";
      renderModules();
      applyFilters();
    }});
  }});
}}

function renderGroups(list) {{
  // group by module > slice
  const by = {{}};
  list.forEach(s => {{
    by[s.module] = by[s.module] || {{}};
    by[s.module][s.slice] = by[s.module][s.slice] || [];
    by[s.module][s.slice].push(s);
  }});

  const container = document.getElementById("groups");
  let html = "";
  Object.keys(by).sort().forEach(mod => {{
    Object.keys(by[mod]).sort().forEach(slice => {{
      const arr = by[mod][slice];
      const pass = arr.filter(s => s.status === "Pass").length;
      const fail = arr.filter(s => s.status === "Fail").length;
      const skip = arr.filter(s => s.status === "Skipped").length;
      html += `
        <div class="slice-group open">
          <div class="slice-header open">
            <div>
              <span class="smod">${{esc(mod)}}</span>
              <span class="ico"></span><span class="stitle">${{esc(slice)}}</span>
            </div>
            <div class="sstats">
              ${{pass ? `<span class="badge b-pass">✓ ${{pass}}</span>` : ""}}
              ${{fail ? `<span class="badge b-fail">✗ ${{fail}}</span>` : ""}}
              ${{skip ? `<span class="badge b-skip">⊘ ${{skip}}</span>` : ""}}
              <span class="pill">${{arr.length}} سيناريو</span>
            </div>
          </div>
          <table>
            <thead><tr>
              <th>#</th><th>العنوان</th><th>الأولوية</th>
              <th>المصدر</th><th>المدة</th><th>الحالة</th>
            </tr></thead>
            <tbody>
              ${{arr.map((r, i) => {{
                const gid = `${{esc(mod)}}_${{esc(slice)}}_${{i}}`.replace(/[^a-zA-Z0-9_]/g, "_");
                const failureHtml = r.failure
                  ? `<div class="failure-box"><strong>رسالة الفشل:</strong><pre>${{esc(r.failure)}}</pre></div>` : "";
                const sub = r.sub_tests.map(t =>
                  `<li><span class="mono">[${{esc(t.tid)}}]</span> <span class="pill">${{esc(t.source)}}</span> <span class="pill">${{esc(t.status)}}</span> — ${{esc(t.raw)}}<br><span class="mono" style="color:var(--muted)">${{esc(t.file)}}</span></li>`
                ).join("");
                return `
                  <tr class="row-toggle" data-gid="${{gid}}">
                    <td class="mono"><span class="tog"></span>${{esc(r.id)}}</td>
                    <td>${{esc(r.title)}}</td>
                    <td><span class="badge b-prio-${{esc(r.priority.split("-")[0])}}">${{esc(r.priority)}}</span></td>
                    <td>${{r.sources.map(x => `<span class="pill">${{esc(x)}}</span>`).join(" ")}}</td>
                    <td class="mono">${{r.duration_ms ? r.duration_ms + " ms" : "—"}}</td>
                    <td><span class="badge ${{statusCls[r.status]}}">${{esc(r.status)}}</span></td>
                  </tr>
                  <tr class="details" data-gid="${{gid}}">
                    <td colspan="6">
                      <strong>الاختبارات المرتبطة (${{r.sub_tests.length}}):</strong>
                      <ul class="sub-list">${{sub}}</ul>
                      ${{failureHtml}}
                    </td>
                  </tr>`;
              }}).join("")}}
            </tbody>
          </table>
        </div>`;
    }});
  }});
  container.innerHTML = html || `<div style="padding:40px;text-align:center;color:var(--muted)">لا توجد سيناريوهات تطابق الفلتر</div>`;

  // Slice header toggle
  container.querySelectorAll(".slice-header").forEach(h => {{
    h.addEventListener("click", () => {{
      h.classList.toggle("open");
      h.parentElement.classList.toggle("open");
    }});
  }});
  // Row toggle
  container.querySelectorAll(".row-toggle").forEach(tr => {{
    tr.addEventListener("click", () => {{
      const gid = tr.dataset.gid;
      const det = container.querySelector(`.details[data-gid="${{gid}}"]`);
      tr.classList.toggle("open");
      det.classList.toggle("show");
    }});
  }});
}}

function applyFilters() {{
  const q = document.getElementById("q").value.toLowerCase().trim();
  const st = document.getElementById("fStatus").value;
  const pr = document.getElementById("fPriority").value;
  const sr = document.getElementById("fSource").value;

  const list = SCENARIOS.filter(r => {{
    if (activeModule && r.module !== activeModule) return false;
    if (st && r.status !== st) return false;
    if (pr && !r.priority.startsWith(pr)) return false;
    if (sr && !r.sources.includes(sr)) return false;
    if (q) {{
      const hay = (r.id + " " + r.title + " " + r.slice + " " + r.module).toLowerCase();
      if (!hay.includes(q)) return false;
    }}
    return true;
  }});
  document.getElementById("count").textContent = `${{list.length}} / ${{SCENARIOS.length}} سيناريو`;
  renderGroups(list);
}}

["q","fStatus","fPriority","fSource"].forEach(id => {{
  document.getElementById(id).addEventListener("input", applyFilters);
}});
document.getElementById("clearMod").addEventListener("click", () => {{
  activeModule = null;
  document.getElementById("clearMod").style.display = "none";
  renderModules();
  applyFilters();
}});

renderModules();
applyFilters();
</script>
</body>
</html>
"""

OUT_HTML.parent.mkdir(parents=True, exist_ok=True)
OUT_HTML.write_text(html, encoding="utf-8")
print(f"[ok] Report written: {OUT_HTML}")
print(f"[stats] Total: {total} | Pass: {passed} | Fail: {failed} | Skipped: {skipped}")
print(f"[modules] {len(module_stats)} — {[m['name'] for m in module_stats]}")
