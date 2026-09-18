from __future__ import annotations
import re,subprocess,sys
from pathlib import Path
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '_site').resolve();problems=[]
CRITICAL={'index.html':['app-consistency.css','app-stability.js','shared-admin-nav.js'],'member-view-settings.html':['app-consistency.css','app-stability.js','shared-admin-nav.js','Member home layout'],'member.html':['app-consistency.css','app-stability.js','social-nav.js','member-experience.css','member-experience.js','member-coach.css','member-coach.js'],'member-preview.html':['app-consistency.css','app-stability.js','social-nav.js','member-preview-classes.js','member-preview-controls.js','member-experience.css','member-experience.js','member-coach.css','member-coach.js'],'classes.html':['app-consistency.css','app-stability.js','calendar-mobile.js','calendar-views.js','session-manager.js','class-admin-enhancements.js','class-admin-live-refresh.js'],'staff.html':['app-consistency.css','app-stability.js','staff-shell.js','staff-operations.css','staff-operations.js'],'social.html':['app-consistency.css','app-stability.js','social-enhancements.js','window.__hybridSocial']}
JS=('app-stability.js','social-nav.js','shared-admin-nav.js','account-menu.js','calendar-mobile.js','calendar-views.js','scheduling-engine.js','session-manager.js','tenant-branding.js','pb-workout-enhancements.js','member-preview-classes.js','member-preview-controls.js','member-experience.js','member-coach.js','class-admin-enhancements.js','class-admin-live-refresh.js','staff-shell.js','staff-operations.js','social-enhancements.js')
if not ROOT.exists():raise SystemExit(f'Build output does not exist: {ROOT}')
for js in JS:
 p=ROOT/js
 if not p.exists():problems.append(f'missing JavaScript asset: {js}');continue
 r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 if r.returncode:problems.append(f'{js}: JavaScript syntax error: {r.stderr.strip()}')
for n,needles in CRITICAL.items():
 p=ROOT/n
 if not p.exists():problems.append(f'{n}: missing file');continue
 t=p.read_text(encoding='utf-8')
 if '</html>' not in t.lower():problems.append(f'{n}: missing closing html tag')
 for x in needles:
  if x not in t:problems.append(f'{n}: missing {x}')
for page in ROOT.glob('*.html'):
 t=page.read_text(encoding='utf-8')
 if page.name!='classes.html' and ('class-admin-enhancements.js' in t or 'class-admin-live-refresh.js' in t):problems.append(f'{page.name}: class admin runtime leaked')
 if page.name!='member-preview.html' and ('member-preview-classes.js' in t or 'member-preview-controls.js' in t):problems.append(f'{page.name}: preview runtime leaked')
 if page.name not in ('member.html','member-preview.html') and ('member-experience.js' in t or 'member-experience.css' in t or 'member-coach.js' in t or 'member-coach.css' in t):problems.append(f'{page.name}: member runtime leaked')
 if page.name!='social.html' and 'social-enhancements.js' in t:problems.append(f'{page.name}: social runtime leaked')
member=(ROOT/'member.html').read_text(encoding='utf-8')
if "$('membershipShort')?.textContent=" not in member:problems.append('member.html: safe membership summary missing')
mr=(ROOT/'member-experience.js').read_text(encoding='utf-8')
for x in ('member_class_schedule','member_book_class','member_cancel_class','pt_appointments','workout_sessions','personal_bests','memberProgressSnapshot','loadProgress','memberWeeklyGoal','loadWeeklyGoal','hybrid_member_weekly_goal','memberRecentActivity','loadRecentActivity','memberActivityList','get_member_home_layout','applyHomeLayout','memberHomeCanvas'):
 if x not in mr:problems.append(f'member-experience.js: required workflow missing: {x}')
coach=(ROOT/'member-coach.js').read_text(encoding='utf-8')
for x in ('memberWeekPlan','member_class_schedule','workout_sessions','hybrid_member_weekly_goal','NEXT 7 DAYS'):
 if x not in coach:problems.append(f'member-coach.js: required weekly plan workflow missing: {x}')
pc=(ROOT/'member-preview-controls.js').read_text(encoding='utf-8')
for x in ('openPreviewPage','wireNavigation','memberPreviewAccountMenu','previewAccountSave','hybridOS_memberPreviewAccount'):
 if x not in pc:problems.append(f'member-preview-controls.js: required workflow missing: {x}')
social=(ROOT/'social.html').read_text(encoding='utf-8');enh=(ROOT/'social-enhancements.js').read_text(encoding='utf-8')
for x in ('updatePost','deletePost','updateComment','deleteComment','setPostReaction'):
 if x not in social or x not in enh:problems.append(f'social persistence bridge missing: {x}')
for x in (".eq('user_id',userId)","data-mine=\"${p.user_id===userId}\"","data-mine=\"${c.user_id===userId}\""):
 if x not in social:problems.append(f'social ownership guard missing: {x}')
if problems:raise SystemExit('Hybrid OS smoke checks failed:\n- '+'\n- '.join(problems))
print('Hybrid OS built-site smoke checks passed')
