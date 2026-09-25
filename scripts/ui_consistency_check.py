#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '_site')
APP_PAGES=(
 'index.html','community.html','classes.html','class-setup.html','workout-builder.html',
 'admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html',
 'staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html',
 'staff.html','member.html','member-preview.html','member-memberships.html','integrations.html',
 'social.html','groups.html','onboarding.html','communications.html','admin.html'
)
problems=[]

css_path=ROOT/'app-consistency.css'
if not css_path.exists():
 problems.append('app-consistency.css missing from build')
else:
 css=css_path.read_text(encoding='utf-8')
 for marker in (
  'HybridOne final UI contract',
  '--hybrid-surface-soft',
  '--bg:var(--hybrid-bg)!important',
  '.top,.groups-top',
  '.card,.panel',
  '.btn,.staff-ops-btn,.roster-btn,.export,.mini-btn,.report-actions button',
  '.tab,.page-tab,.admin-context-tab',
  '.table-wrap'
 ):
  if marker not in css:problems.append(f'app-consistency.css missing UI contract marker: {marker}')

for name in APP_PAGES:
 p=ROOT/name
 if not p.exists():
  problems.append(f'{name}: missing product surface')
  continue
 t=p.read_text(encoding='utf-8')
 links=list(re.finditer(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*>',t,flags=re.I))
 app=[m for m in links if 'app-consistency.css' in m.group(1)]
 if len(app)!=1:
  problems.append(f'{name}: expected exactly one app-consistency stylesheet, found {len(app)}')
  continue
 if links and app[0].start()!=links[-1].start():
  later=[m.group(1) for m in links if m.start()>app[0].start()]
  problems.append(f'{name}: app-consistency must be final stylesheet; later={later}')

if problems:
 print('UI CONSISTENCY CHECK FAILED')
 for p in problems:print(' - '+p)
 raise SystemExit(1)

print(f'UI consistency contract passed for {len(APP_PAGES)} product surfaces')
