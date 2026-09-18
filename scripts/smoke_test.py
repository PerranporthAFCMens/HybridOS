from __future__ import annotations
import re,subprocess,sys
from pathlib import Path
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '_site').resolve();problems=[]
CRITICAL={'join.html':['get_public_gym_join_options','join_public_gym_with_membership','Create member account','Choose your membership','await supabase.auth.signOut()','setMode(\'signup\')','exchangeCodeForSession','confirmed=1'],'index.html':['app-consistency.css','app-stability.js','shared-admin-nav.js','staff_access'],'member-view-settings.html':['app-consistency.css','app-stability.js','shared-admin-nav.js','Member home layout'],'member.html':['app-consistency.css','app-stability.js','social-nav.js','member-experience.css','member-experience.js','member-coach.css','member-coach.js'],'member-preview.html':['app-consistency.css','app-stability.js','social-nav.js','member-preview-classes.js','member-preview-controls.js','member-experience.css','member-experience.js','member-coach.css','member-coach.js'],'classes.html':['app-consistency.css','app-stability.js','calendar-mobile.js','calendar-views.js','session-manager.js','class-admin-enhancements.js','class-admin-live-refresh.js'],'staff.html':['app-consistency.css','app-stability.js','staff-shell.js','staff-operations.css','staff-operations.js','full_access'],'social.html':['app-consistency.css','app-stability.js','social-enhancements.js','window.__hybridSocial']}
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
 for i,m in enumerate(re.finditer(r'<script([^>]*)>(.*?)</script>',t,flags=re.S|re.I),1):
  attrs,body=m.group(1),m.group(2)
  if re.search(r'\bsrc\s*=',attrs,flags=re.I) or not body.strip():continue
  tm=re.search(r'\btype\s*=\s*["\']([^"\']+)["\']',attrs,flags=re.I)
  if tm and tm.group(1).lower() not in ('module','text/javascript','application/javascript'):continue
  tmp=ROOT/f'.smoke-inline-{page.stem}-{i}.mjs'
  tmp.write_text(body,encoding='utf-8')
  r=subprocess.run(['node','--check',str(tmp)],capture_output=True,text=True)
  tmp.unlink(missing_ok=True)
  if r.returncode:problems.append(f'{page.name}: inline JavaScript syntax error: {r.stderr.strip()}')
 if page.name!='classes.html' and ('class-admin-enhancements.js' in t or 'class-admin-live-refresh.js' in t):problems.append(f'{page.name}: class admin runtime leaked')
 if page.name!='member-preview.html' and ('member-preview-classes.js' in t or 'member-preview-controls.js' in t):problems.append(f'{page.name}: preview runtime leaked')
 if page.name not in ('member.html','member-preview.html') and ('member-experience.js' in t or 'member-experience.css' in t or 'member-coach.js' in t or 'member-coach.css' in t):problems.append(f'{page.name}: member runtime leaked')
 if page.name!='social.html' and 'social-enhancements.js' in t:problems.append(f'{page.name}: social runtime leaked')
member=(ROOT/'member.html').read_text(encoding='utf-8')
for x in ('.userchip{position:fixed;top:16px;right:14px','.top h1{font-size:28px','padding:82px 14px 36px'):
 if x not in member:problems.append(f'member.html: compact mobile member header missing: {x}')
if "const membershipShort=$('membershipShort');if(membershipShort)membershipShort.textContent=" not in member:problems.append('member.html: safe membership summary missing')
if "?.textContent=" in member:problems.append('member.html: invalid optional-chain assignment present')
mr=(ROOT/'member-experience.js').read_text(encoding='utf-8')
for x in ('member_class_schedule','member_book_class','member_cancel_class','pt_appointments','workout_sessions','personal_bests','memberProgressSnapshot','loadProgress','memberWeeklyGoal','loadWeeklyGoal','hybrid_member_weekly_goal','memberRecentActivity','loadRecentActivity','memberActivityList','get_member_home_settings','applyHomeLayout','memberHomeCanvas'):
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
staff_perms=(ROOT/'staff-permissions.html').read_text(encoding='utf-8')
for x in ('own_calendar','full_access','Full access','Own calendar only'):
 if x not in staff_perms:problems.append(f'staff-permissions.html: access ladder missing: {x}')
admin_nav=(ROOT/'shared-admin-nav.js').read_text(encoding='utf-8')
for x in ('classes-group','services-group','staff-group','members-group','admin-context-tabs','HybridShell','Member memberships','Rooms & equipment','Service dependencies','Staff & working hours','Member view','Door access'):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: consolidated admin navigation missing: {x}')
for page_name in ('index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 nav_refs=re.findall(r'<script[^>]+src=["\']\.\/shared-admin-nav\.js(?:\?[^"\']*)?["\'][^>]*>\s*<\/script>',page_text,flags=re.I)
 if len(nav_refs)!=1:problems.append(f'{page_name}: expected exactly one admin nav runtime, found {len(nav_refs)}')
 elif '?v=' not in nav_refs[0]:problems.append(f'{page_name}: admin nav runtime is not cache-busted')
shared_shell=(ROOT/'shared-shell.js').read_text(encoding='utf-8')
for x in ('HybridShell','hybrid-shell-brand','hybrid-shell-gym','hybrid-nav-icon','dashboard','workouts','pbs','membership'):
 if x not in shared_shell:problems.append(f'shared-shell.js: central shell capability missing: {x}')
app_css=(ROOT/'app-consistency.css').read_text(encoding='utf-8')
for x in ('Centralised Hybrid OS sidebar shell','hybrid-shell-brand','hybrid-shell-gym','hybrid-nav-icon','grid-template-columns:254px'):
 if x not in app_css:problems.append(f'app-consistency.css: central shell styling missing: {x}')
community=(ROOT/'community.html').read_text(encoding='utf-8')
for x in ('Member community','social_posts','social_comments','social_reactions','Post to community'):
 if x not in community:problems.append(f'community.html: admin social feed missing: {x}')
ops=(ROOT/'admin-operations.html').read_text(encoding='utf-8')
for x in ('showOpsTab','location.hash.replace','history.replaceState','resources','services'):
 if x not in ops:problems.append(f'admin-operations.html: grouped-nav deep link support missing: {x}')
stability=(ROOT/'app-stability.js').read_text(encoding='utf-8')
for x in ('hybridNavigationMask','beginNavigation','HybridNavigation'):
 if x not in stability:problems.append(f'app-stability.js: smooth navigation mask missing: {x}')
for page_name in ('index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html','staff.html','member.html','member-preview.html','social.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 if 'hybrid-critical-shell' not in page_text:problems.append(f'{page_name}: critical first-paint shell missing')
 if '#hybridNavigationMask' not in page_text:problems.append(f'{page_name}: navigation mask critical CSS missing')
account=(ROOT/'account-menu.js').read_text(encoding='utf-8')
for x in ("storage.from('avatars')",'accountAvatarFile','staffPermissions.full_access'):
 if x not in account:problems.append(f'account-menu.js: profile/portal workflow missing: {x}')
for page_name in ('member.html','member-preview.html','staff.html','social.html'):
 shell_page=(ROOT/page_name).read_text(encoding='utf-8')
 for x in ('data-shell-icon','Hybrid'):
  if x not in shell_page:problems.append(f'{page_name}: shared shell navigation missing: {x}')
staff_page=(ROOT/'staff.html').read_text(encoding='utf-8')
for x in ("$('loading').classList.add('hidden');$('app').classList.remove('hidden');window.__hybridAppReady=true","Assigned classes failed","Staff portal failed to initialise"):
 if x not in staff_page:problems.append(f'staff.html: non-blocking startup guard missing: {x}')
if '<nav class="bottom">' in staff_page:problems.append('staff.html: retired mobile bottom navigation returned')
member_exp_css=(ROOT/'member-experience.css').read_text(encoding='utf-8')
for x in ('Desktop member workspace','display:none!important','width:min(1220px,100%)','member-home-tile[data-home-key="hero"]'):
 if x not in member_exp_css:problems.append(f'member-experience.css: desktop member layout guard missing: {x}')
member_exp_js=(ROOT/'member-experience.js').read_text(encoding='utf-8')
for x in ('get_member_home_settings','applyHomeCta','primary_target','secondary_target','data-cta-page'):
 if x not in member_exp_js:problems.append(f'member-experience.js: member CTA runtime missing: {x}')
if 'get_member_home_layout' in member_exp_js:problems.append('member-experience.js: retired member layout RPC reference returned')
member_css=(ROOT/'member-experience.css').read_text(encoding='utf-8')
if '.member-home-tile[data-home-key="hero"]{grid-column:1/-1}' not in member_css:problems.append('member-experience.css: full-width member CTA missing')
member_view=(ROOT/'member-view-settings.html').read_text(encoding='utf-8')
for x in ('requestAnimationFrame(frame)','reorderPreviewToMatch','member-layout-dragging','pointermove','pointerup','tile-placeholder','window.scrollBy','previewOrderWithPlaceholder','cta_config','ctaTitle','ctaPrimaryTarget','ctaSecondaryTarget','Gym call to action'):
 if x not in member_view:problems.append(f'member-view-settings.html: drag stability guard missing: {x}')
if problems:raise SystemExit('Hybrid OS smoke checks failed:\n- '+'\n- '.join(problems))
print('Hybrid OS built-site smoke checks passed')
