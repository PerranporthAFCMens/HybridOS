from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
VERSION = os.environ.get("GITHUB_SHA", "dev")[:12]

EXCLUDE = {".git", ".github", "scripts", "_site"}

APP_PAGES = (
    "index.html", "classes.html", "class-setup.html", "admin-operations.html",
    "resource-availability.html", "staff-permissions.html", "access-settings.html",
    "reporting.html", "staff.html", "member.html", "member-preview.html",
    "member-memberships.html", "integrations.html", "social.html", "onboarding.html",
)
TENANT_PAGES = (
    "index.html", "member.html", "member-preview.html", "classes.html", "staff.html",
    "member-memberships.html", "integrations.html", "social.html",
)
ADMIN_PAGES = (
    "index.html", "classes.html", "class-setup.html", "admin-operations.html",
    "resource-availability.html", "staff-permissions.html", "access-settings.html", "reporting.html",
)


def copy_source() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for item in ROOT.iterdir():
        if item.name in EXCLUDE:
            continue
        target = OUT / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


def read(name: str) -> str:
    return (OUT / name).read_text(encoding="utf-8")


def write(name: str, text: str) -> None:
    (OUT / name).write_text(text, encoding="utf-8")


def inject_head(text: str, asset_name: str, markup: str) -> str:
    if asset_name in text:
        return text
    if "</head>" not in text:
        raise RuntimeError(f"Cannot inject {asset_name}: missing </head>")
    return text.replace("</head>", markup + "</head>", 1)


def inject_body(text: str, asset_name: str, markup: str) -> str:
    if asset_name in text:
        return text
    if "</body>" not in text:
        raise RuntimeError(f"Cannot inject {asset_name}: missing </body>")
    return text.replace("</body>", markup + "</body>", 1)


def clean_legacy_mobile_chrome() -> None:
    """Remove superseded mobile navigation markup from built pages only."""
    for name in ("member.html", "member-preview.html", "staff.html"):
        p = OUT / name
        if not p.exists():
            continue
        s = read(name)
        s = re.sub(r'<nav class="bottom">.*?</nav>', '', s, count=1, flags=re.S)
        write(name, s)

    name = "classes.html"
    s = read(name)
    s = re.sub(r'<a class="mobile-back"[^>]*>.*?</a>', '', s, count=1, flags=re.S)
    write(name, s)


def add_shared_runtime() -> None:
    css = f'<link rel="stylesheet" href="./app-consistency.css?v={VERSION}">'
    guard = f'<script src="./app-stability.js?v={VERSION}"></script>'
    for name in APP_PAGES:
        p = OUT / name
        if not p.exists():
            continue
        s = read(name)
        s = inject_head(s, "app-consistency.css", css)
        s = inject_head(s, "app-stability.js", guard)
        write(name, s)


def add_tenant_runtime() -> None:
    """Branding + tenant-wide member access only. No page-specific feature code belongs here."""
    css = f'<link rel="stylesheet" href="./tenant-branding.css?v={VERSION}">'
    js = f'<script src="./tenant-branding.js?v={VERSION}" defer></script>'
    for name in TENANT_PAGES:
        p = OUT / name
        if not p.exists():
            continue
        s = read(name)
        s = inject_head(s, "tenant-branding.css", css)
        s = inject_body(s, "tenant-branding.js", js)
        write(name, s)


def harden_member() -> None:
    name = "member.html"
    s = read(name)
    brittle = "$('membershipShort').textContent=membership?.membership_plans?.name||'None';"
    safe = "$('membershipShort')?.textContent=membership?.membership_plans?.name||'None';"
    if brittle in s:
        s = s.replace(brittle, safe, 1)
    elif safe not in s:
        raise RuntimeError("member.html membership summary assignment changed; review startup hardening")
    s = inject_body(s, "social-nav.js", f'<script src="./social-nav.js?v={VERSION}" defer></script>')
    write(name, s)

    name = "member-preview.html"
    s = read(name)
    s = inject_body(s, "social-nav.js", f'<script src="./social-nav.js?v={VERSION}" defer></script>')
    s = inject_body(s, "member-preview-classes.js", f'<script src="./member-preview-classes.js?v={VERSION}" defer></script>')
    write(name, s)


def add_admin_shell() -> None:
    css = f'<link rel="stylesheet" href="./admin-shell.css?v={VERSION}">'
    nav = f'<script src="./shared-admin-nav.js?v={VERSION}" defer></script>'
    account = f'<script src="./account-menu.js?v={VERSION}" defer></script>'
    for name in ADMIN_PAGES:
        s = read(name)
        s = inject_head(s, "admin-shell.css", css)
        s = inject_body(s, "shared-admin-nav.js", nav)
        if name == "index.html":
            s = s.replace('<section id="authView" class="auth">', '<section id="authView" class="auth hidden">', 1)
            s = inject_body(s, "account-menu.js", account)
        write(name, s)


def add_staff_shell() -> None:
    name = "staff.html"
    s = read(name)
    s = inject_body(s, "staff-shell.js", f'<script src="./staff-shell.js?v={VERSION}" defer></script>')
    write(name, s)


def add_scheduler_assets() -> None:
    name = "classes.html"
    s = read(name)
    for asset in ("calendar-mobile.css", "calendar-views.css", "session-manager.css"):
        s = inject_head(s, asset, f'<link rel="stylesheet" href="./{asset}?v={VERSION}">')
    for asset in (
        "scheduling-engine.js", "calendar-mobile.js", "calendar-views.js",
        "session-manager.js", "class-admin-loader.js",
    ):
        s = inject_body(s, asset, f'<script src="./{asset}?v={VERSION}" defer></script>')
    write(name, s)

    name = "admin-operations.html"
    s = read(name)
    s = inject_body(s, "operations-scheduling-link.js", f'<script src="./operations-scheduling-link.js?v={VERSION}" defer></script>')
    write(name, s)


def brand_member_preview() -> None:
    name = "member-preview.html"
    s = read(name)
    s = s.replace('<title>Member Preview · Hybrid OS</title>', '<title>Hybrid Hub · Member Preview</title>')
    old_brand = '<div class="brand"><svg class="mark" viewBox="0 0 54 48"><path d="M6 42 L27 6 M12 42 L30 11 M18 42 L33 16 M48 42 L27 6 M42 42 L24 11 M36 42 L21 16"/></svg><span class="word">HYBRID <b>OS</b></span></div>'
    new_brand = '<div class="brand hybrid-hub-brand"><img src="./assets/hybrid-hub-logo-horizontal.svg" alt="Hybrid Hub"></div>'
    s = s.replace(old_brand, new_brand).replace("Puffin Performance", "Hybrid Hub")
    if "member-gym-logo" not in s:
        if '<main class="main">' not in s:
            raise RuntimeError("member-preview.html main mount point changed")
        s = s.replace('<main class="main">', '<main class="main"><div class="member-gym-logo"><img src="./assets/hybrid-hub-logo-horizontal.svg" alt="Hybrid Hub"></div>', 1)
    if "hybrid-hub-preview-branding" not in s:
        brand_css = '''<style id="hybrid-hub-preview-branding">
.hybrid-hub-brand{min-height:54px;align-items:center}.hybrid-hub-brand img{display:block;width:100%;max-width:205px;height:auto;filter:brightness(0) invert(1)}
.gym{position:relative;overflow:hidden}.gym:after{content:"";position:absolute;right:-10px;bottom:-16px;width:74px;height:74px;background:url("./assets/hybrid-hub-mark.svg") center/contain no-repeat;opacity:.08;filter:brightness(0) invert(1);pointer-events:none}
.member-gym-logo{display:flex;justify-content:center;align-items:center;margin:-2px 0 18px}.member-gym-logo img{display:block;width:min(230px,58vw);height:auto}
@media(max-width:900px){.member-gym-logo{margin:0 0 14px}.member-gym-logo img{width:min(185px,52vw)}}
</style>'''
        s = inject_head(s, "hybrid-hub-preview-branding", brand_css)
    write(name, s)


def build() -> None:
    copy_source()
    clean_legacy_mobile_chrome()
    add_shared_runtime()
    add_tenant_runtime()
    harden_member()
    add_admin_shell()
    add_staff_shell()
    add_scheduler_assets()
    brand_member_preview()
    print(f"Built Hybrid OS site in {OUT}")


if __name__ == "__main__":
    build()
