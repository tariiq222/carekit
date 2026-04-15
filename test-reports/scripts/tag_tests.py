# -*- coding: utf-8 -*-
"""إضافة metadata tags لأسماء اختبارات موجودة.

يحوّل:
    it('[CL-001] إنشاء walk-in', ...)
إلى:
    it('[CL-001][Clients/create-client][P1] إنشاء walk-in', ...)

التعيين يعتمد على:
  - Test ID prefix → Module (CL → Clients, EM → Employees, ...)
  - اسم describe() المحيط → slice
  - Priority يُستنتج من ID أو يُضبط افتراضياً P2

يعمل على:
  - Jest: apps/backend/test/e2e/**/*.e2e-spec.ts
  - Playwright: apps/dashboard/test/e2e/**/*.e2e-spec.ts
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# خريطة ID prefix → module
ID_TO_MODULE = {
    "CL": "Clients",
    "EM": "Employees",
    "BK": "Bookings",
    "PY": "Payments",
    "AU": "Auth",
    "SV": "Services",
    "WL": "Whitelabel",
    "ZT": "ZATCA",
    "BH": "OrgConfig",
    "ET": "Comms",
    "A11Y": "Accessibility",
    "AI": "AI Chatbot",
    "CH": "Chat",
    "NT": "Notifications",
}

# FLOW prefixes for cross-feature lifecycle tests (Phase 3).
# Format: FLOW-<BLC|PAY|REC|WL|WI>-###  → module = "Flows", slice = mapped name
FLOW_SUBMODULE = {
    "BLC": "booking-lifecycle",
    "PAY": "payment-flow",
    "REC": "recurring-bookings",
    "WL": "waitlist",
    "WI": "walk-in",
}

# خريطة أولويات افتراضية لكل نطاق IDs (يمكن تخصيصها)
# بدل ذلك نبقيها P2 افتراضياً ونعتمد على التعديل اليدوي للحرجة
DEFAULT_PRIORITY = "P2"

# IDs الحرجة (P1-High)
P1_IDS = {
    "CL-001", "CL-002", "CL-003", "CL-004", "CL-007", "CL-008", "CL-009",
    "CL-019", "CL-020", "CL-021", "CL-022", "CL-023", "CL-026", "CL-028",
    "CL-031", "CL-032", "CL-038", "CL-039", "CL-042", "CL-044", "CL-045",
    "CL-054", "CL-059", "CL-060", "CL-062", "CL-064", "CL-070",
    "CL-082", "CL-083", "CL-084", "CL-085",
}
# IDs الأقل أولوية (P3-Low)
P3_IDS = {
    "CL-010", "CL-014", "CL-015", "CL-016", "CL-017", "CL-030",
    "CL-037", "CL-067", "CL-073", "CL-074", "CL-075", "CL-076",
}


def get_priority(tid: str) -> str:
    if tid in P1_IDS:
        return "P1-High"
    if tid in P3_IDS:
        return "P3-Low"
    return "P2-Medium"


# Slice mapping حسب describe محيط أو كلمات مفتاحية
def detect_slice(describe_text: str, test_title: str) -> str:
    d = (describe_text or "").lower() + " " + (test_title or "").lower()
    # Jest-style (HTTP method + path)
    if "post /dashboard/people/clients" in d and "security" not in d:
        return "create-client"
    if "patch /dashboard/people/clients" in d:
        return "update-client"
    if "delete /dashboard/people/clients" in d:
        return "delete-client"
    if "get /dashboard/people/clients/:id" in d:
        return "get-client"
    if "get /dashboard/people/clients" in d:
        return "list-clients"
    if "security" in d or "concurrency" in d:
        return "security"
    # Playwright-style
    if "list page" in d or "smoke" in d:
        return "list-page-ui"
    if "navigation" in d:
        return "navigation-ui"
    if "create form" in d:
        return "create-form-ui"
    if "row interaction" in d:
        return "row-interactions-ui"
    if "rtl" in d:
        return "rtl-ui"
    if "seeded" in d or "toggle" in d or "status badge" in d or "شارة" in d:
        return "toggle-status-ui"
    if "delete dialog" in d or "dialog" in d:
        return "delete-dialog-ui"
    if "filter reset" in d or "إعادة تعيين" in d:
        return "filter-ui"
    return "general"


# تطابقات
# in Jest + Playwright both:  it('[CL-001] title', ...) or test('[CL-054] ...', ...)
OLD_NAME_RE = re.compile(
    r"""(?P<prefix>(?:it|test)\s*\(\s*['"])\[(?P<tid>(?:FLOW-[A-Z]{1,4}-[A-Za-z0-9-]+)|(?:[A-Z]{2,3}-[A-Za-z0-9-]+))\](?!\[)(?P<rest>[^'"]*?)(?P<suffix>['"])""",
    re.DOTALL,
)
DESCRIBE_RE = re.compile(
    r"""describe\s*\(\s*['"]([^'"]+)['"]""",
    re.DOTALL,
)


def process_file(path: Path) -> int:
    """يُعدّل الملف ويُرجع عدد الاستبدالات."""
    original = path.read_text(encoding="utf-8")

    # ابنِ خريطة موقع → اسم describe
    describe_matches = list(DESCRIBE_RE.finditer(original))

    def nearest_describe(pos: int) -> str:
        candidates = [d for d in describe_matches if d.start() < pos]
        return candidates[-1].group(1) if candidates else ""

    def replacer(m):
        tid = m.group("tid").upper()
        prefix_code = tid.split("-")[0]
        module = ID_TO_MODULE.get(prefix_code, "Uncategorized")
        # Generic -UI- rollup: NT-UI-### rolls up under Notifications, same shape as CL-UI-
        if "UI" in tid and prefix_code in ID_TO_MODULE:
            module = ID_TO_MODULE[prefix_code]
        # FLOW-BLC-01 → module=Flows, slice from second segment
        is_flow = prefix_code == "FLOW"
        if is_flow:
            module = "Flows"
        rest = m.group("rest").strip()
        # إذا كان الاسم يحوي بالفعل Module/slice، لا تعيد التعديل
        if rest.startswith("["):
            return m.group(0)
        describe = nearest_describe(m.start())
        if is_flow:
            sub = tid.split("-")[1] if len(tid.split("-")) > 1 else ""
            slice_ = FLOW_SUBMODULE.get(sub, "general")
        else:
            slice_ = detect_slice(describe, rest)
        # للـ CL-UI-### اجعل slice UI-* إذا عُرّف عام
        if "UI" in tid and slice_ in ("general", "list-clients"):
            slice_ = "list-page-ui" if "smoke" in describe.lower() or "list" in describe.lower() else slice_
        # للـ parent CL (بدون UI) normal
        # priority
        parent = re.sub(r"-UI", "", tid)
        # إذا UI variant مثل CL-UI-046a → نأخذ أساس CL-046
        ui_m = re.match(r"^CL-UI-(\d+)", tid)
        lookup_id = f"CL-{int(ui_m.group(1)):03d}" if ui_m else tid
        prio = get_priority(lookup_id)
        new_name = f"[{tid}][{module}/{slice_}][{prio}] {rest}"
        return f"{m.group('prefix')}{new_name}{m.group('suffix')}"

    new_content = OLD_NAME_RE.sub(replacer, original)
    if new_content == original:
        return 0
    # عد عدد التغييرات
    # approximate: عدد الأسماء التي تغيرت
    count = 0
    for m in OLD_NAME_RE.finditer(original):
        old_rest = m.group("rest").strip()
        if not old_rest.startswith("["):
            count += 1
    path.write_text(new_content, encoding="utf-8")
    return count


def main():
    targets = []
    for glob in [
        "apps/backend/test/e2e/**/*.e2e-spec.ts",
        "apps/dashboard/test/e2e/**/*.e2e-spec.ts",
    ]:
        targets.extend(ROOT.glob(glob))

    total = 0
    for p in targets:
        n = process_file(p)
        if n:
            print(f"  [{n:3}] tagged  {p.relative_to(ROOT)}")
            total += n
        else:
            print(f"  [  0] skipped (already tagged or no matches)  {p.relative_to(ROOT)}")
    print(f"\nTotal tests tagged: {total}")


if __name__ == "__main__":
    main()
