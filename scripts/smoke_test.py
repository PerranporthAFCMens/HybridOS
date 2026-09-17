from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve()

CRITICAL = {
    "index.html": ["app-consistency.css", "app-stability.js", "shared-admin-nav.js"],
    "member.html": ["app-consistency.css", "app-stability.js", "social-nav.js", "member-experience.css", "member-experience.js"],
    "member-preview.html": ["app-consistency.css", "app-stability.js", "social-nav.js", "member-preview-classes.js", "member-preview-controls.js", "member-experience.css", "member-experience.js"],
    "classes.html": ["app-consistency.css", "app-stability.js", "calendar-mobile.js", "calendar-views.js", "session-manager.js", "class-admin-enhancements.js", "class-admin-live-refresh.js"],
    "staff.html": ["app-consistency.css", "app-stability.js", "staff-shell.js", "staff-operations.css", "staff-operations.js"],
    "social.html": ["app-consistency.css", "app-stability.js"],
}
JS_CHECKS = (
    "app-stability.js", "social-nav.js", "shared-admin-nav.js", "account-menu.js",
    "calendar-mobile.js", "calendar-views.js", "scheduling-engine.js", "session-manager.js",
    "tenant-branding.js", "pb-workout-enhancements.js", "member-preview-classes.js", "member-preview-controls.js", "member-experience.js",
    "class-admin-enhancements.js", "class-admin-live-refresh.js", "staff-shell.js", "staff-operations.js",
)

problems: list[str] = []

if not ROOT.exists():
    raise SystemExit(f"Build output does not exist: {ROOT}")

for js in JS_CHECKS:
    path = ROOT / js
    if not path.exists():
        problems.append(f"missing JavaScript asset: {js}")
        continue
    result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if result.returncode:
        problems.append(f"{js}: JavaScript syntax error: {result.stderr.strip()}")

for name, needles in CRITICAL.items():
    path = ROOT / name
    if not path.exists():
        problems.append(f"{name}: missing file")
        continue
    text = path.read_text(encoding="utf-8")
    low = text.lower()
    if "</html>" not in low:
        problems.append(f"{name}: missing closing html tag")
    for needle in needles:
        if needle not in text:
            problems.append(f"{name}: missing {needle}")
    for asset in ("app-consistency.css", "app-stability.js"):
        if text.count(asset) > 1:
            problems.append(f"{name}: duplicate {asset}")

asset_pattern = re.compile(r'''(?:src|href)=["']\.\/([^"'?]+\.(?:js|css))[?"']''', re.I)
for page in ROOT.glob("*.html"):
    text = page.read_text(encoding="utf-8")
    for asset in asset_pattern.findall(text):
        if not (ROOT / asset).exists():
            problems.append(f"{page.name}: references missing local asset {asset}")

member = (ROOT / "member.html").read_text(encoding="utf-8") if (ROOT / "member.html").exists() else ""
if "$('membershipShort').textContent=" in member:
    problems.append("member.html: brittle membershipShort assignment reintroduced")
if "$('membershipShort')?.textContent=" not in member:
    problems.append("member.html: safe membershipShort assignment missing")

for name in ("member.html", "member-preview.html", "staff.html"):
    text = (ROOT / name).read_text(encoding="utf-8") if (ROOT / name).exists() else ""
    if '<nav class="bottom">' in text:
        problems.append(f"{name}: legacy bottom navigation still present")
classes = (ROOT / "classes.html").read_text(encoding="utf-8") if (ROOT / "classes.html").exists() else ""
if '<a class="mobile-back"' in classes:
    problems.append("classes.html: legacy mobile back link still present")
if "class-admin-loader.js" in classes:
    problems.append("classes.html: obsolete runtime script loader still present")

for legacy_asset in ("member-mobile-rail.css", "staff-shell.css"):
    for page in ROOT.glob("*.html"):
        if legacy_asset in page.read_text(encoding="utf-8"):
            problems.append(f"{page.name}: obsolete {legacy_asset} reference remains")

shared_css = (ROOT / "app-consistency.css").read_text(encoding="utf-8") if (ROOT / "app-consistency.css").exists() else ""
for required_selector in (".admin-mobile-menu-btn", ".staff-mobile-menu-btn", ".mobile-menu-btn", "body.staff-mobile-open .side", "body.admin-mobile-open .side", "body.mobile-nav-open .side"):
    if required_selector not in shared_css:
        problems.append(f"app-consistency.css: shared mobile shell selector missing: {required_selector}")
for required_rule in ("flex-direction:column!important", ".side .gym{flex:0 0 auto;width:100%;min-height:0;height:auto!important}", ".side .nav{flex:0 0 auto;width:100%;min-width:0}"):
    if required_rule not in shared_css:
        problems.append(f"app-consistency.css: mobile drawer structure guard missing: {required_rule}")

for component_marker in (
    ".card{", ".btn{", ".btn.primary,.btn.dark{", ".field input,.field select,.field textarea,",
    ".top{", ".eyebrow{", ".userchip{", ".tag{", ".modal{", ".side .nav a,.side .nav button{",
):
    if component_marker not in shared_css:
        problems.append(f"app-consistency.css: canonical component rule missing: {component_marker}")

for design_token in (
    "--hybrid-bg:#f5f7fb", "--hybrid-panel:#fff", "--hybrid-ink:#101828", "--hybrid-line:#e7ebf2", "--hybrid-dark:#0b1020", "--hybrid-radius:20px",
):
    if design_token not in shared_css:
        problems.append(f"app-consistency.css: canonical design token missing: {design_token}")

tenant = (ROOT / "tenant-branding.js").read_text(encoding="utf-8") if (ROOT / "tenant-branding.js").exists() else ""
for forbidden in ("fixMemberPreviewClasses", "class-admin-enhancements.js", "class-admin-live-refresh.js"):
    if forbidden in tenant:
        problems.append(f"tenant-branding.js contains page-specific runtime: {forbidden}")

for page in ROOT.glob("*.html"):
    text = page.read_text(encoding="utf-8")
    if page.name != "classes.html" and ("class-admin-enhancements.js" in text or "class-admin-live-refresh.js" in text):
        problems.append(f"{page.name}: class admin runtime leaked outside classes.html")
    if page.name != "member-preview.html" and ("member-preview-classes.js" in text or "member-preview-controls.js" in text):
        problems.append(f"{page.name}: member-preview runtime leaked outside member-preview.html")
    if page.name not in ("member.html", "member-preview.html") and ("member-experience.js" in text or "member-experience.css" in text):
        problems.append(f"{page.name}: member experience runtime leaked outside member pages")
    if page.name != "staff.html" and ("staff-shell.js" in text or "staff-operations.js" in text or "staff-operations.css" in text):
        problems.append(f"{page.name}: Staff Portal runtime leaked outside staff.html")

member_runtime=(ROOT/"member-experience.js").read_text(encoding="utf-8") if (ROOT/"member-experience.js").exists() else ""
for required in ("member_class_schedule", "member_book_class", "member_cancel_class", "pt_appointments"):
    if required not in member_runtime:
        problems.append(f"member-experience.js: required member workflow missing: {required}")

if (ROOT / "class-admin-loader.js").exists():
    problems.append("obsolete class-admin-loader.js should not be deployed")
if (ROOT / "admin-demo.html").exists():
    problems.append("admin-demo.html should not be deployed; Core + Hybrid Hub are the supported entry points")

for doc_name in ("README.md", "HANDOVER.md"):
    doc = ROOT / doc_name
    if not doc.exists():
        problems.append(f"missing project documentation: {doc_name}")
        continue
    text = doc.read_text(encoding="utf-8")
    for stale in ("member-mobile-rail.css", "staff-shell.css", "class-admin-loader.js"):
        if re.search(rf"(?m)^\s*-\s+`{re.escape(stale)}`\s*(?:—.*)?$", text):
            problems.append(f"{doc_name}: removed asset is still listed as an active project file: {stale}")
    if "GoCardless is parked" not in text and "GoCardless is deliberately parked" not in text:
        problems.append(f"{doc_name}: current parked GoCardless priority is not documented")
    if "Calendar/session management" not in text and "calendar/session management" not in text:
        problems.append(f"{doc_name}: current calendar/session-management priority is missing")

if problems:
    raise SystemExit("Hybrid OS smoke checks failed:\n- " + "\n- ".join(problems))

print("Hybrid OS built-site smoke checks passed")
