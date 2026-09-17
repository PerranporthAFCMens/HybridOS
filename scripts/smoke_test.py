from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve()

CRITICAL = {
    "index.html": ["app-consistency.css", "app-stability.js", "shared-admin-nav.js"],
    "member.html": ["app-consistency.css", "app-stability.js", "membershipShort", "social-nav.js"],
    "member-preview.html": ["app-consistency.css", "app-stability.js", "social-nav.js", "member-preview-classes.js"],
    "classes.html": ["app-consistency.css", "app-stability.js", "calendar-mobile.js", "calendar-views.js", "session-manager.js", "class-admin-loader.js"],
    "staff.html": ["app-consistency.css", "app-stability.js"],
    "social.html": ["app-consistency.css", "app-stability.js"],
}
JS_CHECKS = (
    "app-stability.js", "social-nav.js", "shared-admin-nav.js", "account-menu.js",
    "calendar-mobile.js", "calendar-views.js", "scheduling-engine.js", "session-manager.js",
    "tenant-branding.js", "pb-workout-enhancements.js", "member-preview-classes.js",
    "class-admin-loader.js", "class-admin-enhancements.js", "class-admin-live-refresh.js",
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

# Ensure local CSS/JS references in every built HTML page point to real files.
asset_pattern = re.compile(r'''(?:src|href)=["']\.\/([^"'?]+\.(?:js|css))[?"']''', re.I)
for page in ROOT.glob("*.html"):
    text = page.read_text(encoding="utf-8")
    for asset in asset_pattern.findall(text):
        if not (ROOT / asset).exists():
            problems.append(f"{page.name}: references missing local asset {asset}")

# Guard against known startup regression.
member = (ROOT / "member.html").read_text(encoding="utf-8") if (ROOT / "member.html").exists() else ""
if 'id="membershipShort"' not in member:
    problems.append("member.html: membershipShort compatibility mount missing")

# Page-specific code must not leak back into tenant-branding.js.
tenant = (ROOT / "tenant-branding.js").read_text(encoding="utf-8") if (ROOT / "tenant-branding.js").exists() else ""
for forbidden in ("fixMemberPreviewClasses", "class-admin-enhancements.js", "class-admin-live-refresh.js"):
    if forbidden in tenant:
        problems.append(f"tenant-branding.js contains page-specific runtime: {forbidden}")

# Class admin helpers belong only on the class admin page.
for page in ROOT.glob("*.html"):
    text = page.read_text(encoding="utf-8")
    if page.name != "classes.html" and "class-admin-loader.js" in text:
        problems.append(f"{page.name}: class-admin-loader.js leaked outside classes.html")
    if page.name != "member-preview.html" and "member-preview-classes.js" in text:
        problems.append(f"{page.name}: member-preview-classes.js leaked outside member-preview.html")

# Guard against accidental reintroduction of multiple deployed app shells.
if (ROOT / "admin-demo.html").exists():
    problems.append("admin-demo.html should not be deployed; Core + Hybrid Hub are the supported entry points")

if problems:
    raise SystemExit("Hybrid OS smoke checks failed:\n- " + "\n- ".join(problems))

print("Hybrid OS built-site smoke checks passed")
