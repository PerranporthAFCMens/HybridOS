from __future__ import annotations
import re,subprocess,sys
from pathlib import Path
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '_site').resolve();problems=[]
for login_name in ('hybrid-hub-login.html','puffin-performance-login.html'):
 login_text=(ROOT/login_name).read_text(encoding='utf-8')
 if "location.replace('./admin.html?gym_id='" not in login_text:problems.append(f'{login_name}: gym login must enter admin shell')
 if "location.replace('./index.html?gym_id='" in login_text:problems.append(f'{login_name}: legacy direct dashboard redirect still present')
invite_text=(ROOT/'admin-invite.html').read_text(encoding='utf-8')
if 'href="./admin.html"' not in invite_text:problems.append('admin-invite.html: accepted staff invite must open admin shell')
# HybridOne is a CamelCase brand. Never ship the all-caps text variant in customer-facing source.
for brand_file in list(ROOT.glob('*.html'))+list(ROOT.glob('*.js'))+list((ROOT/'scripts').glob('*.py')):
 try: brand_text=brand_file.read_text(encoding='utf-8')
 except Exception: continue
 if 'HYBRIDONE' in brand_text: problems.append(f'{brand_file.name}: uppercase HybridOne branding found; use HybridOne')
CRITICAL={'join.html':['get_public_gym_join_options','join_public_gym_with_membership','Create member account','Choose your membership','await supabase.auth.signOut()','setMode(\'signup\')','exchangeCodeForSession','confirmed=1'],'index.html':['app-consistency.css','app-stability.js','shared-admin-nav.js','staff_access'],'member-view-settings.html':['app-consistency.css','app-stability.js','shared-admin-nav.js','Member home layout'],'member.html':['app-consistency.css','app-stability.js','social-nav.js','member-experience.css','member-experience.js','member-coach.css','member-coach.js','class-booking-access.js','social-notifications.js'],'member-preview.html':['app-consistency.css','app-stability.js','social-nav.js','member-preview-classes.js','member-preview-controls.js','member-experience.css','member-experience.js','member-coach.css','member-coach.js'],'classes.html':['app-consistency.css','app-stability.js','calendar-mobile.js','calendar-views.js','session-manager.js','class-admin-enhancements.js','class-admin-live-refresh.js'],'staff.html':['app-consistency.css','app-stability.js','staff-shell.js','staff-operations.css','staff-operations.js','full_access'],'social.html':['app-consistency.css','app-stability.js','social-enhancements.js','window.__hybridSocial'],'groups.html':['app-consistency.css','app-stability.js','Training Groups','groups.js'],'group-join.html':['join_training_group_by_code','preview_training_group_invite','Join group']}
JS=('supabase-request-guard.js','app-stability.js','social-nav.js','shared-admin-nav.js','admin-access-guard.js','admin-transition-diagnostics.js','account-menu.js','calendar-mobile.js','calendar-views.js','scheduling-engine.js','session-manager.js','tenant-branding.js','pb-workout-enhancements.js','gym-activities.js','class-booking-access.js','member-preview-classes.js','member-preview-controls.js','member-experience.js','member-coach.js','class-admin-enhancements.js','class-admin-live-refresh.js','staff-shell.js','staff-operations.js','social-enhancements.js','groups.js','admin-frame.js','admin-embed.js')
if not ROOT.exists():raise SystemExit(f'Build output does not exist: {ROOT}')

GUARDED_APP_PAGES=('index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','staff.html','member.html','member-preview.html','member-memberships.html','integrations.html','social.html','groups.html','onboarding.html','admin.html','communications.html')
for n in GUARDED_APP_PAGES:
 p=ROOT/n
 if not p.exists():problems.append(f'{n}: guarded app page missing');continue
 t=p.read_text(encoding='utf-8')
 if 'supabase-request-guard.js' not in t:problems.append(f'{n}: Supabase request guard missing')

guard=(ROOT/'supabase-request-guard.js').read_text(encoding='utf-8')
for x in ('maxRequests=100','windowMs=10000','cooldownMs=60000',"url.pathname.startsWith('/rest/v1/')","url.pathname.startsWith('/functions/v1/')"):
 if x not in guard:problems.append(f'supabase-request-guard.js: circuit-breaker contract missing: {x}')
social_notice=(ROOT/'social-notifications.js').read_text(encoding='utf-8')
for x in ('300000',"sessionStorage.getItem('hybrid-gym-id')",".eq('gym_id',selectedGymId)"):
 if x not in social_notice:problems.append(f'social-notifications.js: low-egress gym-bound polling missing: {x}')
landing=ROOT/'landing.html'
if not landing.exists():problems.append('landing.html: HybridOne marketing homepage missing')
else:
 lt=landing.read_text(encoding='utf-8')
 for x in ('HybridOne','The operating system for hybrid gyms','LOGO PLACEHOLDER','Book a demo'):
  if x not in lt:problems.append(f'landing.html: marketing content missing: {x}')
vercel=ROOT/'vercel.json'
if not vercel.exists():problems.append('vercel.json: HybridOne routes missing')
else:
 vt=vercel.read_text(encoding='utf-8')
 for x in ('/landing.html','/hybrid-hub','/puffin-performance','/app'):
  if x not in vt:problems.append(f'vercel.json: route missing: {x}')
for brand_page in ROOT.glob('*.html'):
 bt=brand_page.read_text(encoding='utf-8')
 if re.search(r'Hybrid OS|HYBRID OS|HYBRIDOS|HybridOS(?=$|[\\s<.,:;!?])',bt):
  problems.append(f'{brand_page.name}: legacy Hybrid OS branding returned')
# Core rendering assets are intentionally locked to the last known-good mobile/admin baseline.
# Any deliberate change to these files must update this list as part of the same reviewed change.
RENDER_BASELINE={
 'app-consistency.css':'3142106974312bf247de3e5373d68368c1da881d',
 'admin-pages.css':'b1eaff4b6188ca6d7554c777e4f87aade8c43fd7',
 'admin-shell.css':'c1009ad391e60ef38aad690f81653027ef78bbe9',
 'admin-frame.css':'e4ca8488bbc5f19de1bc6652ba49298b37fa62a5',
 'admin-embed.js':'d5f4f78aa65561794e82bb2ca8e1d7b8e56a1c24',
 'admin-frame.js':'d1dbb0df416d9745b9cedc14a35d3b6620ec89c7',
 'app-stability.js':'f5819ecd71e76985b7b7f410c2f25e9e7700a380',
 'shared-admin-nav.js':'ad4fbc29cd9b85ffe42d33ae5b918a3903f30761',
}
def git_blob_sha(path):
 import hashlib
 raw=path.read_bytes()
 return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
for asset,expected in RENDER_BASELINE.items():
 p=ROOT/asset
 if not p.exists():problems.append(f'missing locked rendering asset: {asset}');continue
 actual=git_blob_sha(p)
 if actual!=expected:problems.append(f'{asset}: rendering baseline changed ({actual}); review shell/mobile impact before updating the lock')
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
class_access=(ROOT/'class-booking-access.js').read_text(encoding='utf-8')
for x in ('get_class_booking_options','prepare_class_drop_in_purchase','Pay as you go','Membership options'):
 if x not in class_access:problems.append(f'class-booking-access.js: class pricing workflow missing: {x}')
class_setup=(ROOT/'class-setup.html').read_text(encoding='utf-8')
for x in ('Drop-in price (£)','drop_in_price_pence','dropInPrice'):
 if x not in class_setup:problems.append(f'class-setup.html: per-class pricing missing: {x}')
activity_picker=(ROOT/'gym-activities.js').read_text(encoding='utf-8')
for x in ('Bench Press','HYROX Sled Push','Start typing to search exercises and activities','HybridGymActivities','#pbExercise,.exerciseName'):
 if x not in activity_picker:problems.append(f'gym-activities.js: searchable activity catalogue missing: {x}')
for page_name in ('member.html','member-preview.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 if 'Training groups' not in page_text:problems.append(f'{page_name}: training groups navigation missing')

 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 if 'gym-activities.js?v=' not in page_text:problems.append(f'{page_name}: searchable activity picker not loaded')
admin_index=(ROOT/'index.html').read_text(encoding='utf-8')
for x in ('memberProfileSummary','role="button" tabindex="0"','Member record'):
 if x not in admin_index:problems.append(f'index.html: unified member workspace missing: {x}')
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
social_notice=(ROOT/'social-notifications.js').read_text(encoding='utf-8')
for x in ('hybrid-social-badge','New social activity','social_comment','social_reply','markRead'):
 if x not in social_notice:problems.append(f'social-notifications.js: unread social workflow missing: {x}')
for page_name in ('member.html','social.html','community.html','groups.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 if 'social-notifications.js?v=' not in page_text:problems.append(f'{page_name}: social notification runtime missing')
member_source=(ROOT/'member.html').read_text(encoding='utf-8')
for x in ('socialNotificationsToggle','social_notifications','Social replies & comments'):
 if x not in member_source:problems.append(f'member.html: social notification setting missing: {x}')
social=(ROOT/'social.html').read_text(encoding='utf-8');enh=(ROOT/'social-enhancements.js').read_text(encoding='utf-8')
for x in ('updatePost','deletePost','updateComment','deleteComment','setPostReaction'):
 if x not in social or x not in enh:problems.append(f'social persistence bridge missing: {x}')
for x in (".eq('user_id',userId)","data-mine=\"${p.user_id===userId}\"","data-mine=\"${c.user_id===userId}\""):
 if x not in social:problems.append(f'social ownership guard missing: {x}')
staff_perms=(ROOT/'staff-permissions.html').read_text(encoding='utf-8')
for x in ('Access levels','Staff assignments','staff_access_levels','assign_staff_access_level','manage_staff','Admin workspace','Owner controlled'):
 if x not in staff_perms:problems.append(f'staff-permissions.html: owner-controlled access levels missing: {x}')
admin_frame=(ROOT/'admin.html').read_text(encoding='utf-8')
for x in ('adminContentFrameA','adminContentFrameB','adminFrameNav','admin-frame.js','admin-frame.css'):
 if x not in admin_frame:problems.append(f'admin.html: persistent shell missing: {x}')
admin_frame_js=(ROOT/'admin-frame.js').read_text(encoding='utf-8')
for x in ('hybrid-admin-nav','embedded=1','history.pushState','adminContentFrameA','adminContentFrameB','swapTo','loadSeq',"addEventListener('message'",'shellVersion','embedded=1&v='):
 if x not in admin_frame_js:problems.append(f'admin-frame.js: persistent routing missing: {x}')
for x in ('hybrid-admin-ready','pendingSwap','completeSwap','Fallback only'):
 if x not in admin_frame_js:problems.append(f'admin-frame.js: embedded readiness handoff missing: {x}')
for x in ("matchMedia('(max-width:900px)').matches","location.replace('./'+requested)","const start=requested"):
 if x not in admin_frame_js:problems.append(f'admin-frame.js: mobile top-level handoff missing: {x}')
for x in ('workout-builder.html',"{key:'workouts'","if(file==='workout-builder.html')return'workouts'"):
 if x not in admin_frame_js:problems.append(f'admin-frame.js: admin registry/routes out of sync: {x}')
admin_frame_html=(ROOT/'admin.html').read_text(encoding='utf-8')
for x in ('admin-frame.css?v=','admin-frame.js?v=','shared-shell.js?v='):
 if x not in admin_frame_html:problems.append(f'admin.html: persistent shell asset is not cache-busted: {x}')
admin_frame_css=(ROOT/'admin-frame.css').read_text(encoding='utf-8')
for x in ('.admin-content-frame','.admin-content-frame.active','visibility:hidden'):
 if x not in admin_frame_css:problems.append(f'admin-frame.css: buffered frame styling missing: {x}')
for x in ('height:100dvh','env(safe-area-inset-top)','env(safe-area-inset-bottom)'):
 if x not in admin_frame_css:problems.append(f'admin-frame.css: parent mobile viewport ownership missing: {x}')

admin_frame_html=(ROOT/'admin.html').read_text(encoding='utf-8')
if 'viewport-fit=cover' in admin_frame_html:problems.append('admin.html: experimental full-bleed viewport returned')
if 'top:calc(env(safe-area-inset-top)' in admin_frame_css:problems.append('admin-frame.css: experimental safe-area menu offset returned')
admin_embed=(ROOT/'admin-embed.js').read_text(encoding='utf-8')
for x in ('admin-embedded','parent.postMessage','hybrid-admin-nav','hybrid-admin-ready','signalReady','requestAnimationFrame'):
 if x not in admin_embed:problems.append(f'admin-embed.js: embedded bridge missing: {x}')
for x in ('function appReady()','window.__hybridAppReady===true','!loadingVisible&&appVisible','MutationObserver','setInterval'):
 if x not in admin_embed:problems.append(f'admin-embed.js: true app-readiness gate missing: {x}')
admin_nav=(ROOT/'shared-admin-nav.js').read_text(encoding='utf-8')
for x in ("const adminPages=new Set","enterPersistentShell","shellUrlFor"):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: persistent router registry missing: {x}')
for x in ('enterPersistentShell','admin.html?view=','shellUrlFor'):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: persistent shell routing missing: {x}')
if "window.top!==window.self||window.matchMedia('(max-width:900px)').matches" not in admin_nav:problems.append('shared-admin-nav.js: mobile must stay outside persistent shell')
if "function markAdminHotNav(href){try{" not in admin_nav:problems.append('shared-admin-nav.js: smooth top-level admin handoff missing')
for x in ('markAdminHotNav','hybrid-admin-hot-nav','sessionStorage.setItem'):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: smooth admin hand-off missing: {x}')
for x in ("window.matchMedia('(max-width:900px)').matches","e.preventDefault();const href=a.href;closeMobile();requestAnimationFrame(()=>location.assign(href))"):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: explicit mobile drawer navigation missing: {x}')
for x in ("{key:'sign-out'","href:'./sign-out.html'"):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: global admin sign out missing: {x}')
auth_return=(ROOT/'auth-return.html')
if not auth_return.exists():problems.append('auth-return.html: secure gym Auth return page missing')
else:
 art=auth_return.read_text(encoding='utf-8')
 for x in ("params.get('gym_id')","sessionStorage.setItem('hybrid-gym-id'","mode==='recovery'","supabase.auth.updateUser({password})",".eq('gym_id',gymId)","maybeSingle()","Powered by HybridOne"):
  if x not in art:problems.append(f'auth-return.html: gym-bound secure return flow missing: {x}')
join_auth=(ROOT/'join.html').read_text(encoding='utf-8')
for x in ("redirectUrl.searchParams.set('gym_id',joinData.gym_id)","emailRedirectTo:redirect"):
 if x not in join_auth:problems.append(f'join.html: gym context missing from signup confirmation flow: {x}')
sign_out=(ROOT/'sign-out.html').read_text(encoding='utf-8')
for x in ('supabase.auth.signOut()',"location.replace('./')",'Signing you out'):
 if x not in sign_out:problems.append(f'sign-out.html: reliable sign out flow missing: {x}')
if 'Member memberships' in admin_nav:problems.append('shared-admin-nav.js: duplicate Member memberships tab returned')

for x in ('classes-group','services-group','staff-group','members-group','admin-context-tabs','HybridShell','Rooms & equipment','Service dependencies','Staff & working hours','Member view','Door access'):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: consolidated admin navigation missing: {x}')
for page_name in ('index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 nav_refs=re.findall(r'<script[^>]+src=["\']\.\/shared-admin-nav\.js(?:\?[^"\']*)?["\'][^>]*>\s*<\/script>',page_text,flags=re.I)
 if len(nav_refs)!=1:problems.append(f'{page_name}: expected exactly one admin nav runtime, found {len(nav_refs)}')
 elif '?v=' not in nav_refs[0]:problems.append(f'{page_name}: admin nav runtime is not cache-busted')

admin_access=(ROOT/'admin-access.html').read_text(encoding='utf-8')
for x in ('Owner controls','create_email_access_invite','create_shareable_access_invite','approve_email_owner_invite','approve_shareable_owner_invite','send-access-invite','Send invitation email','Generate secure invite link','propose_owner_promotion','approve_ownership_action','propose_owner_removal','remove_admin_access','revoke_admin_invite','delete_admin_invite','Owner · equal ownership','Ownership decisions','Promote to Owner'):
 if x not in admin_access:problems.append(f'admin-access.html: email-first Owner/Admin access workflow missing: {x}')
for x in ('Inviting to:','Signed in as','Gym context required',"new URLSearchParams(location.search).get('gym_id')",'requestedGymId','ownerGyms.find'):
 if x not in admin_access:problems.append(f'admin-access.html: explicit gym context guard missing: {x}')
for x in ('signOutBtn','supabase.auth.signOut()'):
 if x not in admin_access:problems.append(f'admin-access.html: sign out control missing: {x}')
if ".eq('is_active',true).limit(1)" in admin_access:problems.append('admin-access.html: ambiguous first-gym lookup returned')
if 'Create one-time invite' in admin_access:problems.append('admin-access.html: legacy one-time invite wording returned')
index_source=(ROOT/'index.html').read_text(encoding='utf-8')
for x in ('access_invite','invite_email','invite_gym','invite_role','Sign in to continue','Continue to invitation','inviteDestination','showInviteLanding'):
 if x not in index_source:problems.append(f'index.html: invite sign-in landing missing: {x}')
for x in ("sessionStorage.setItem('hybrid-gym-id'","gms.find(x=>x.gym_id===selectedGymId)"):
 if x not in index_source:problems.append(f'index.html: login gym context missing: {x}')
for x in ('./shared-shell.js','./shared-admin-nav.js'):
 if x not in index_source:problems.append(f'index.html: shared Owner/Admin navigation missing: {x}')
for x in ("location.pathname==='/'","location.replace('./landing.html')"):
 if x not in index_source:problems.append(f'index.html: production marketing-root fallback missing: {x}')
if ".eq('is_active',true).limit(1)" in index_source:problems.append('index.html: ambiguous first-gym lookup returned')
for context_file in ('staff.html','tenant-branding.js','admin-frame.js','member.html','integrations.html','social.html'):
 context_source=(ROOT/context_file).read_text(encoding='utf-8')
 if ".eq('is_active',true).limit(1)" in context_source:problems.append(f'{context_file}: ambiguous first-gym lookup returned')
 if "sessionStorage.getItem('hybrid-gym-id')" not in context_source:problems.append(f'{context_file}: explicit login gym context missing')
admin_access=(ROOT/'admin-access.html').read_text(encoding='utf-8')
if "i.status==='open'&&i.delivery_method!=='link'" not in admin_access:problems.append('admin-access.html: open email invites must remain resendable')
if "i.email_sent_at?'Resend email':'Send / retry email'" not in admin_access:problems.append('admin-access.html: resend label contract missing')
admin_frame_context=(ROOT/'admin-frame.js').read_text(encoding='utf-8')
for x in ("const explicitGymId=params.get('gym_id')||''","const storedGymId=sessionStorage.getItem('hybrid-gym-id')||''","!membership&&!explicitGymId&&!storedGymId&&gms.length===1"):
 if x not in admin_frame_context:problems.append(f'admin-frame.js: explicit gym context may fall back across tenants: {x}')
if "if(!membership&&gms.length===1)" in admin_frame_context:problems.append('admin-frame.js: unsafe single-membership cross-gym fallback returned')
for context_file,required,unsafe in (
 ('index.html',"!selected&&!queryGymId&&!storedGymId&&gms.length===1","if(!selected&&gms.length===1)"),
 ('staff.html',"!membership&&!storedGymId&&gm.data.length===1","if(!membership&&gm.data.length===1)"),
 ('tenant-branding.js',"!membership&&!storedGymId&&gm.length===1","if(!membership&&gm.length===1)")
):
 context_source=(ROOT/context_file).read_text(encoding='utf-8')
 if required not in context_source:problems.append(f'{context_file}: single-membership fallback is not limited to empty gym context')
 if unsafe in context_source:problems.append(f'{context_file}: unsafe cross-gym single-membership fallback returned')
for context_file in ('member.html','integrations.html','social.html'):
 context_source=(ROOT/context_file).read_text(encoding='utf-8')
 if ".eq('gym_id',selectedGymId)" not in context_source:problems.append(f'{context_file}: current gym is not bound to the membership lookup')
tenant_branding=(ROOT/'tenant-branding.js').read_text(encoding='utf-8')
shared_shell=(ROOT/'shared-shell.js').read_text(encoding='utf-8')
if "Puffin Performance" in tenant_branding:problems.append('tenant-branding.js: cross-gym name rewrite returned')
for x in ("HYBRID_HUB_ID","sessionStorage.getItem('hybrid-gym-id')"):
 if x not in tenant_branding:problems.append(f'tenant-branding.js: tenant-aware branding missing: {x}')
 if x not in shared_shell:problems.append(f'shared-shell.js: tenant-aware branding missing: {x}')
for login_name,gym_name,gym_id in (
 ('hybrid-hub-login.html','Hybrid Hub','242f57c2-6e37-4977-b3c5-1c87de7d0b98'),
 ('puffin-performance-login.html','Puffin Performance','aec16956-3793-4543-873b-4412646ca1eb')
):
 login=(ROOT/login_name)
 if not login.exists():problems.append(f'{login_name}: dedicated gym login page missing');continue
 lt=login.read_text(encoding='utf-8')
 for x in (gym_name,gym_id,"sessionStorage.setItem('hybrid-gym-id'","signInWithPassword","resetPasswordForEmail","signInWithOtp","shouldCreateUser:false","./auth-return.html"):
  if x not in lt:problems.append(f'{login_name}: gym-bound login/auth flow missing: {x}')
for context_page in ('community.html','classes.html','class-setup.html','workout-builder.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html','admin-access.html'):
 cp=(ROOT/context_page).read_text(encoding='utf-8')
 if 'hybrid-gym-id' not in cp:problems.append(f'{context_page}: login gym context not enforced')
sign_out=(ROOT/'sign-out.html').read_text(encoding='utf-8')
if "sessionStorage.removeItem('hybrid-gym-id')" not in sign_out:problems.append('sign-out.html: gym context is not cleared on sign out')
for template_name in ('supabase-email-invite-template.html','supabase-email-magic-link-template.html'):
 template=(ROOT/template_name)
 if not template.exists():problems.append(f'{template_name}: branded email template missing');continue
 tt=template.read_text(encoding='utf-8')
 for x in ('{{ .ConfirmationURL }}','{{ .Data.hybrid_email_brand_name }}','{{ .Data.hybrid_email_heading }}','{{ .Data.hybrid_email_body }}','{{ .Data.hybrid_email_button_label }}','{{ .Data.hybrid_email_accent }}','{{ .Data.hybrid_email_footer }}'):
  if x not in tt:problems.append(f'{template_name}: gym-configurable invite email content missing: {x}')

admin_invite=(ROOT/'admin-invite.html').read_text(encoding='utf-8')
for x in ('get_access_invite','claim_access_invite','Access activated','equal Owner','Set a password for future sign-ins','supabase.auth.updateUser','Different account signed in','Sign out and continue with invited email','supabase.auth.signOut()'):
 if x not in admin_invite:problems.append(f'admin-invite.html: email-first Admin/Owner acceptance workflow missing: {x}')
access_guard=(ROOT/'admin-access-guard.js').read_text(encoding='utf-8')
for x in ("['admin','owner'].includes(membership.role)","access_status!=='pending'","HybridAccess","readOnly:true","required Owner approval","Read-only until the required Owner approval"):
 if x not in access_guard:problems.append(f'admin-access-guard.js: pending Admin/Owner read-only guard missing: {x}')
for x in ("new URLSearchParams(location.search).get('gym_id')","sessionStorage.getItem('hybrid-gym-id')",".eq('gym_id',requestedGymId)",".maybeSingle()"):
 if x not in access_guard:problems.append(f'admin-access-guard.js: explicit gym-bound pending access guard missing: {x}')
if ".limit(1)" in access_guard:problems.append('admin-access-guard.js: ambiguous first-gym lookup returned')
for x in ('admin-access.html',"'admin-access'"):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: Admin access navigation missing: {x}')
for x in ('admin-access.html',):
 if x not in admin_frame_js:problems.append(f'admin-frame.js: Admin access route missing: {x}')

reporting=(ROOT/'reporting.html').read_text(encoding='utf-8')
for x in ('Report library','reportSearch','XLSX.writeFile','membership_register','member_lifecycle','joins_attrition_monthly','class_sessions','attendance_log','failed_payments','drop_in_sales','workout_assignments','pt_appointments'):
 if x not in reporting:problems.append(f'reporting.html: report library/export workflow missing: {x}')
if 'data-fmt="xls"' in reporting:problems.append('reporting.html: legacy fake Excel export returned')
social_nav=(ROOT/'social-nav.js').read_text(encoding='utf-8')
for x in ("dataset.shellIcon='social'","<span>Social</span>","HybridShell?.decorateNav"):
 if x not in social_nav:problems.append(f'social-nav.js: dedicated social icon missing: {x}')
shared_shell=(ROOT/'shared-shell.js').read_text(encoding='utf-8')
for x in ('HybridShell','hybrid-shell-brand','hybrid-shell-gym','hybrid-nav-icon','dashboard','workouts','pbs','membership','social:','groups:'):
 if x not in shared_shell:problems.append(f'shared-shell.js: central shell capability missing: {x}')
app_css=(ROOT/'app-consistency.css').read_text(encoding='utf-8')
for x in ('Centralised Hybrid OS sidebar shell','hybrid-shell-brand','hybrid-shell-gym','hybrid-nav-icon','grid-template-columns:254px'):
 if x not in app_css:problems.append(f'app-consistency.css: central shell styling missing: {x}')

admin_pages=('index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html')
for page_name in admin_pages:
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 for x in ('html.admin-embedded .side{display:none!important}','html.admin-embedded .shell,html.admin-embedded #app,html.admin-embedded #appView{display:block!important;grid-template-columns:1fr!important}','html.admin-embedded .main{min-height:100%!important;background:#f5f7fb!important}'):
  if x not in page_text:problems.append(f'{page_name}: original embedded admin shell guard missing: {x}')
 if 'html.admin-embedded .main{min-height:100dvh!important}' in page_text:problems.append(f'{page_name}: embedded child must not own 100dvh')
 if 'admin-mobile-contract.css' in page_text:problems.append(f'{page_name}: duplicate admin mobile contract returned')
 for asset in ('app-consistency.css','admin-shell.css','admin-pages.css','admin-embed.js','shared-admin-nav.js','admin-access-guard.js','admin-transition-diagnostics.js'):
  if page_text.count(asset)!=1:problems.append(f'{page_name}: expected exactly one {asset}, found {page_text.count(asset)}')
 css_order=[page_text.find('app-consistency.css'),page_text.find('admin-shell.css'),page_text.find('admin-pages.css')]
 if min(css_order)<0 or css_order!=sorted(css_order):problems.append(f'{page_name}: shared admin stylesheet order drifted')
communications=(ROOT/'communications.html').read_text(encoding='utf-8')
for x in ('Communications','Transactional','Marketing','gym_communication_settings','gym_email_templates','access_invite','{{gym_name}}','{{invited_by}}','{{role}}','Live preview'):
 if x not in communications:problems.append(f'communications.html: communications editor missing: {x}')
for x in ("{key:'communications'","href:'./communications.html'","if(p.endsWith('/communications.html'))return'communications'"):
 if x not in admin_nav:problems.append(f'shared-admin-nav.js: communications route missing: {x}')
for x in ("{key:'communications'","view:'communications.html'","if(file==='communications.html')return'communications'"):
 if x not in admin_frame_js:problems.append(f'admin-frame.js: communications route missing: {x}')
ops_source=(ROOT/'admin-operations.html').read_text(encoding='utf-8')
if 'class="operations-page"' not in ops_source:problems.append('admin-operations.html: operations page scope class missing')
ops_css=(ROOT/'admin-operations.css')
if not ops_css.exists():problems.append('admin-operations.css: page-scoped mobile stylesheet missing')
else:
 ops_css_text=ops_css.read_text(encoding='utf-8')
 for x in ('.operations-page .toolbar','.operations-page .rowtop','overflow-wrap:anywhere','@media(max-width:700px)'):
  if x not in ops_css_text:problems.append(f'admin-operations.css: operations mobile contract missing: {x}')
community=(ROOT/'community.html').read_text(encoding='utf-8')
for x in ('Member community','social_posts','social_comments','social_reactions','Post to community','sendComment','reply-comment','parent_comment_id','Add a comment'):
 if x not in community:problems.append(f'community.html: admin social feed missing: {x}')
ops=(ROOT/'admin-operations.html').read_text(encoding='utf-8')
for x in ('showOpsTab','location.hash.replace','history.replaceState','resources','services'):
 if x not in ops:problems.append(f'admin-operations.html: grouped-nav deep link support missing: {x}')

stability=(ROOT/'app-stability.js').read_text(encoding='utf-8')
for x in ('hybridNavigationMask','beginNavigation','HybridNavigation','adminFiles.indexOf(currentFile)','adminFiles.indexOf(targetFile)'):
 if x not in stability:problems.append(f'app-stability.js: admin navigation transition rule missing: {x}')
for x in ("document.documentElement.classList.contains('admin-embedded')","'workout-builder.html'","'gym-layout.html'"):
 if x not in stability:problems.append(f'app-stability.js: embedded admin transition isolation missing: {x}')
for page_name in ('index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html','staff.html','member.html','member-preview.html','social.html','groups.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 if 'hybrid-critical-shell' not in page_text:problems.append(f'{page_name}: critical first-paint shell missing')
 if '#hybridNavigationMask' not in page_text:problems.append(f'{page_name}: navigation mask critical CSS missing')
account=(ROOT/'account-menu.js').read_text(encoding='utf-8')
for x in ("storage.from('avatars')",'accountAvatarFile','staffPermissions.full_access','accountDateOfBirth','accountGender','date_of_birth','gender'):
 if x not in account:problems.append(f'account-menu.js: profile/portal workflow missing: {x}')
for page_name in ('member.html','member-preview.html','staff.html','social.html'):
 shell_page=(ROOT/page_name).read_text(encoding='utf-8')
 for x in ('data-shell-icon','Hybrid'):
  if x not in shell_page:problems.append(f'{page_name}: shared shell navigation missing: {x}')
groups_js=(ROOT/'groups.js').read_text(encoding='utf-8')
for x in ('create_training_group','get_training_group_dashboard','create_training_group_challenge','submit_training_group_challenge_result','Copy invite link'):
 if x not in groups_js:problems.append(f'groups.js: training groups workflow missing: {x}')
staff_page=(ROOT/'staff.html').read_text(encoding='utf-8')
for x in ("$('loading').classList.add('hidden');$('app').classList.remove('hidden');window.__hybridAppReady=true","Assigned classes failed","Staff portal failed to initialise"):
 if x not in staff_page:problems.append(f'staff.html: non-blocking startup guard missing: {x}')
if '<nav class="bottom">' in staff_page:problems.append('staff.html: retired mobile bottom navigation returned')
for x in ('staffTimetableLink','ownerPreviewNav','Back to Owner/Admin','Gym timetable',"supabase.from('class_sessions')"):
 if x not in staff_page:problems.append(f'staff.html: staff role-switch/timetable boundary missing: {x}')
if 'href="./classes.html"' in staff_page:problems.append('staff.html: Staff View must not link into Owner/Admin classes page')
member_exp_css=(ROOT/'member-experience.css').read_text(encoding='utf-8')
for x in ('Desktop member workspace','display:none!important','width:min(1220px,100%)','member-home-tile[data-home-key="hero"]'):
 if x not in member_exp_css:problems.append(f'member-experience.css: desktop member layout guard missing: {x}')
member_exp_js=(ROOT/'member-experience.js').read_text(encoding='utf-8')
for x in ('get_member_home_settings','applyHomeCta','primary_target','secondary_target','data-cta-page'):
 if x not in member_exp_js:problems.append(f'member-experience.js: member CTA runtime missing: {x}')
if 'get_member_home_layout' in member_exp_js:problems.append('member-experience.js: retired member layout RPC reference returned')
member_css=(ROOT/'member-experience.css').read_text(encoding='utf-8')
if '.member-home-tile[data-home-key="hero"]{grid-column:1/-1}' not in member_css:problems.append('member-experience.css: full-width member CTA missing')
admin_index=(ROOT/'index.html').read_text(encoding='utf-8')
for x in ('memberSearch','memberSort','registered_desc','registered_asc','memberJump','renderMemberDirectory','memberFilterLetter'):
 if x not in admin_index:problems.append(f'index.html: member directory control missing: {x}')
for x in ('Customer lifecycle','avgCustomerLifecycle','avgLiveTenure','genderLifecycleBreakdown','ageLifecycleBreakdown','renderLifecycleInsights','date_of_birth','gender'):
 if x not in admin_index:problems.append(f'index.html: lifecycle demographic reporting missing: {x}')
for x in ('Customer pulse','pulse-head','seasonality-grid','YOY SWING','seasonality at a glance','prior=year-1'):
 if x not in admin_index:problems.append(f'index.html: customer pulse view missing: {x}')
if 'stroke-dasharray="7 6"' in admin_index or 'yoy-grid' in admin_index:problems.append('index.html: retired customer comparison view returned')
if 'Last 30 days ·' in admin_index:problems.append('index.html: retired rolling customer movement chart copy returned')
workout_builder=(ROOT/'workout-builder.html').read_text(encoding='utf-8')
if 'admin-frame.css' in workout_builder:problems.append('workout-builder.html: iframe shell stylesheet must not load in top-level Admin page')
for x in ('Assign to member','Publish as WOD','workout_assignments','workout_wods','templateSnapshot'):
 if x not in workout_builder:problems.append(f'workout-builder.html: Workout V2 assignment/WOD boundary missing: {x}')
member_v2=(ROOT/'member-workouts-v2.js').read_text(encoding='utf-8')
for x in ('workout_assignments','workout_wods','Start workout','Complete workout',"source:'wod'"):
 if x not in member_v2:problems.append(f'member-workouts-v2.js: member Workout V2 boundary missing: {x}')
for page_name in ('member.html','member-preview.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 for x in ('member-workouts-v2.js','member-workouts-v2.css'):
  if x not in page_text:problems.append(f'{page_name}: Workout V2 runtime not isolated/mounted: {x}')
member_view=(ROOT/'member-view-settings.html').read_text(encoding='utf-8')
for x in ('requestAnimationFrame(frame)','reorderPreviewToMatch','member-layout-dragging','pointermove','pointerup','tile-placeholder','window.scrollBy','previewOrderWithPlaceholder','cta_config','ctaTitle','ctaPrimaryTarget','ctaSecondaryTarget','Gym call to action'):
 if x not in member_view:problems.append(f'member-view-settings.html: drag stability guard missing: {x}')
admin_ops=(ROOT/'admin-operations.html').read_text(encoding='utf-8')
for x in ('showOpsTab','history.replaceState'):
 if x not in admin_ops:problems.append(f'admin-operations.html: direct internal admin switch missing: {x}')

for page_name in ('index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','communications.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 for x in ('hybrid-admin-hot-nav','admin-hot-nav','html.admin-hot-nav #loading'):
  if x not in page_text:problems.append(f'{page_name}: admin hot first-paint missing: {x}')
 if 'html.admin-hot-nav #app.hidden,html.admin-hot-nav #appView.hidden{display:grid!important}' not in page_text:problems.append(f'{page_name}: smooth destination shell reveal missing')
for page_name in ('index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html'):
 page_text=(ROOT/page_name).read_text(encoding='utf-8')
 for x in ('admin-embed.js?v=','admin-embedded'):
  if x not in page_text:problems.append(f'{page_name}: embedded admin mode missing: {x}')
member_view=(ROOT/'member-view-settings.html').read_text(encoding='utf-8')
if 'href="./member-preview.html" target="_top"' not in member_view:problems.append('member-view-settings.html: preview must escape persistent admin frame')
member_preview=(ROOT/'member-preview.html').read_text(encoding='utf-8')
if './admin.html?view=member-view-settings.html' not in member_preview:problems.append('member-preview.html: Back to admin must return to persistent admin shell')
if problems:raise SystemExit('HybridOne smoke checks failed:\n- '+'\n- '.join(problems))
print('HybridOne built-site smoke checks passed')

admin_css=(ROOT/'admin-shell.css').read_text(encoding='utf-8')
if '@view-transition' in admin_css or 'view-transition-name' in admin_css:problems.append('admin-shell.css: cross-document admin view transitions must stay disabled')
