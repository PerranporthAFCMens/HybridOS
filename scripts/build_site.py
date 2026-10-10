from __future__ import annotations
import json,os,re,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'_site'
def checked_out_sha():
 try:return subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
 except Exception:return ''
BUILD_SHA=(os.environ.get('HYBRID_BUILD_SHA') or os.environ.get('VERCEL_GIT_COMMIT_SHA') or checked_out_sha() or os.environ.get('GITHUB_SHA') or 'dev');VERSION=BUILD_SHA[:12];EXCLUDE={'.git','.github','scripts','_site','web'}
APP_PAGES=('index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','staff.html','member.html','member-preview.html','member-memberships.html','integrations.html','social.html','groups.html','onboarding.html','communications.html');TENANT_PAGES=('index.html','member.html','member-preview.html','classes.html','staff.html','member-memberships.html','integrations.html','social.html','groups.html');ADMIN_PAGES=('index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html','communications.html')
def copy_source():
 if OUT.exists():shutil.rmtree(OUT)
 OUT.mkdir()
 for i in ROOT.iterdir():
  if i.name in EXCLUDE:continue
  shutil.copytree(i,OUT/i.name) if i.is_dir() else shutil.copy2(i,OUT/i.name)
def read(n):return(OUT/n).read_text(encoding='utf-8')
def write(n,t):(OUT/n).write_text(t,encoding='utf-8')
def inject_head(t,a,m):
 if a in t:return t
 if '</head>' not in t:raise RuntimeError(f'Cannot inject {a}: missing </head>')
 return t.replace('</head>',m+'</head>',1)
def inject_body(t,a,m):
 if a in t:return t
 if '</body>' not in t:raise RuntimeError(f'Cannot inject {a}: missing </body>')
 return t.replace('</body>',m+'</body>',1)

CRITICAL_SHELL_STYLE='''<style id="hybrid-critical-shell">
html,body{margin:0;min-height:100%;background:#0B1020}
#loading{position:fixed;inset:0;z-index:9998;min-height:100vh;color:transparent!important;background:linear-gradient(90deg,#0B1020 0 253px,#232C44 253px 254px,#0B1020 254px 100%);overflow:hidden}
#loading::before{content:"";position:absolute;left:24px;top:24px;width:132px;height:33px;background:url(./assets/brand/logo/svg/hybridone-logo-on-dark.svg) left center/contain no-repeat}
#loading::after{content:"";position:absolute;left:284px;right:30px;top:30px;height:190px;border-radius:16px;background:linear-gradient(100deg,#121A2E 20%,#1A2338 36%,#121A2E 52%);background-size:220% 100%;animation:hybridCriticalShimmer 1.05s linear infinite;box-shadow:0 220px 0 #121A2E,0 430px 0 #121A2E}
#hybridNavigationMask{position:fixed;inset:0;z-index:9999;display:grid;grid-template-columns:254px minmax(0,1fr);background:#0B1020;opacity:0;pointer-events:none;transition:opacity .08s linear}
#hybridNavigationMask.show{opacity:1}
.hybrid-nav-mask-side{background:#0B1020;border-right:1px solid #232C44;padding:26px 18px}.hybrid-nav-mask-brand{width:132px;height:33px;background:url(./assets/brand/logo/svg/hybridone-logo-on-dark.svg) left center/contain no-repeat;font-size:0;color:transparent}.hybrid-nav-mask-gym{height:138px;margin-top:24px;border-radius:16px;background:#121A2E;border:1px solid #232C44}.hybrid-nav-mask-lines{display:grid;gap:9px;margin-top:18px}.hybrid-nav-mask-lines i{display:block;height:45px;border-radius:10px;background:#121A2E}.hybrid-nav-mask-main{padding:30px}.hybrid-nav-mask-bar{width:46%;height:34px;border-radius:10px;background:#121A2E}.hybrid-nav-mask-card{height:190px;margin-top:22px;border-radius:16px;background:linear-gradient(100deg,#121A2E 20%,#1A2338 36%,#121A2E 52%);background-size:220% 100%;animation:hybridCriticalShimmer 1.05s linear infinite}.hybrid-nav-mask-card.short{height:150px}
@keyframes hybridCriticalShimmer{to{background-position:-220% 0}}
@media(max-width:900px){#loading{background:#0B1020}#loading::before{display:none}#loading::after{left:14px;right:14px;top:20px;height:150px}#hybridNavigationMask{grid-template-columns:1fr}.hybrid-nav-mask-side{display:none}.hybrid-nav-mask-main{padding:20px 14px}.hybrid-nav-mask-bar{width:62%}}
@media(prefers-reduced-motion:reduce){#loading::after,.hybrid-nav-mask-card{animation:none}#hybridNavigationMask{transition:none}}
html.admin-hot-nav #loading{display:none!important}
html.admin-hot-nav #app.hidden,html.admin-hot-nav #appView.hidden{display:grid!important}
html.admin-embedded #loading{background:#0B1020!important}
html.admin-embedded #loading::before{display:none!important}
html.admin-embedded #loading::after{left:30px!important}
html.admin-embedded .side{display:none!important}
html.admin-embedded .shell,html.admin-embedded #app,html.admin-embedded #appView{display:block!important;grid-template-columns:1fr!important}
html.admin-embedded .main{min-height:100%!important;background:#0B1020!important}
html.admin-embedded .admin-mobile-menu-btn,html.admin-embedded .admin-mobile-backdrop{display:none!important}
@media(max-width:900px){html.admin-hot-nav #app.hidden{display:block!important}html.admin-embedded #loading::after{left:14px!important}}
</style>'''
def clean_legacy_class_mobile_back():
 write('classes.html',re.sub(r'<a class="mobile-back"[^>]*>.*?</a>','',read('classes.html'),count=1,flags=re.S))
def add_shared_runtime():
 for n in APP_PAGES:
  if not(OUT/n).exists():continue
  s=read(n)
  s=re.sub(r'(name="viewport" content="[^"]*?)"',lambda m:m.group(1)+('' if 'viewport-fit' in m.group(1) else ',viewport-fit=cover')+'"',s,count=1)
  if 'hybrid-critical-shell' not in s:s=s.replace('</head>',CRITICAL_SHELL_STYLE+'</head>',1)
  s=inject_head(s,'gym-context.js',f'<script src="./gym-context.js?v={VERSION}"></script>');s=inject_head(s,'app-consistency.css',f'<link rel="stylesheet" href="./app-consistency.css?v={VERSION}">');s=inject_head(s,'app-stability.js',f'<script src="./app-stability.js?v={VERSION}"></script>');s=inject_body(s,'shared-shell.js',f'<script src="./shared-shell.js?v={VERSION}" defer></script>');s=inject_body(s,'gym-switcher.js',f'<script src="./gym-switcher.js?v={VERSION}" defer></script>');write(n,inject_body(s,'account-menu.js',f'<script src="./account-menu.js?v={VERSION}" defer></script>'))
def add_tenant_runtime():
 for n in TENANT_PAGES:
  if not(OUT/n).exists():continue
  s=inject_head(read(n),'tenant-branding.css',f'<link rel="stylesheet" href="./tenant-branding.css?v={VERSION}">');write(n,inject_body(s,'tenant-branding.js',f'<script src="./tenant-branding.js?v={VERSION}" defer></script>'))
def harden_member():
 css=f'<link rel="stylesheet" href="./member-experience.css?v={VERSION}">';coachcss=f'<link rel="stylesheet" href="./member-coach.css?v={VERSION}">';js=f'<script type="module" src="./member-experience.js?v={VERSION}"></script>';coachjs=f'<script type="module" src="./member-coach.js?v={VERSION}"></script>';activities=f'<script src="./gym-activities.js?v={VERSION}" defer></script>';classaccess=f'<script type="module" src="./class-booking-access.js?v={VERSION}"></script>';socialnotice=f'<script type="module" src="./social-notifications.js?v={VERSION}"></script>';s=read('member.html');s=inject_head(s,'member-experience.css',css);s=inject_head(s,'member-coach.css',coachcss);s=inject_body(s,'social-nav.js',f'<script src="./social-nav.js?v={VERSION}" defer></script>');s=inject_body(s,'gym-activities.js',activities);s=inject_body(s,'class-booking-access.js',classaccess);s=inject_body(s,'social-notifications.js',socialnotice);s=inject_body(s,'member-experience.js',js);write('member.html',inject_body(s,'member-coach.js',coachjs));s=read('member-preview.html');s=inject_head(s,'member-experience.css',css);s=inject_head(s,'member-coach.css',coachcss)
 for a in ('social-nav.js','member-preview-classes.js','member-preview-controls.js'):s=inject_body(s,a,f'<script src="./{a}?v={VERSION}" defer></script>')
 s=inject_body(s,'gym-activities.js',activities);s=inject_body(s,'member-experience.js',js);write('member-preview.html',inject_body(s,'member-coach.js',coachjs))
def replace_exact(t,old,new,label):
 if t.count(old)!=1:raise RuntimeError(f'member.html membership-status patch failed: expected exactly one match for {label} (found {t.count(old)}); member.html changed, update add_member_access_guard()')
 return t.replace(old,new,1)
def add_member_access_guard():
 # UI stage of the membership-status rules. The newest membership row for the selected gym governs (see gym-context.js getMembershipAccess).
 for n in ('member.html','social.html','groups.html','integrations.html'):
  write(n,inject_head(read(n),'member-access-guard.js',f'<script src="./member-access-guard.js?v={VERSION}"></script>'))
 s=read('member.html')
 if 'HybridMemberAccessReady' in s:return
 old_lookup="const mr=await supabase.from('memberships').select('id,status,membership_plans(name,description,price_pence,billing_interval)').eq('user_id',session.user.id).eq('gym_id',gym.id).in('status',['active','paused','pending']).order('created_at',{ascending:false}).limit(1);membership=mr.data?.[0]||null;"
 new_lookup="if(guarded&&!memberAccess.privileged){membership=memberAccess.membership}else{"+old_lookup+"}"
 gate="window.HybridGymContext.setGym(gm.data.gym_id);gym=gm.data.gyms;"
 new_gate=gate+"const memberAccess=await Promise.resolve(window.HybridMemberAccessReady).catch(()=>null);const sameGym=!!(memberAccess&&memberAccess.resolved&&(!gym||memberAccess.gymId===gym.id));if(sameGym&&memberAccess.blocked)return;const guarded=!!(gym&&sameGym&&memberAccess.access!=='none');const bootAccess=guarded?memberAccess.access:'active';"
 old_load="await Promise.all([loadClasses(),loadWorkouts(),loadPBs(),refreshClassSettings()])}init()"
 new_load="await Promise.all(bootAccess==='pending'?[]:bootAccess==='paused'?[loadWorkouts(),loadPBs()]:[loadClasses(),loadWorkouts(),loadPBs(),refreshClassSettings()])}init()"
 s=replace_exact(s,gate,new_gate,'selected-gym startup gate')
 s=replace_exact(s,old_lookup,new_lookup,'membership lookup')
 s=replace_exact(s,old_load,new_load,'startup loading')
 write('member.html',s)
def version_admin_frame_assets():
 s=read('admin.html')
 s=re.sub(r'href=["\']\.\/admin-frame\.css(?:\?[^"\']*)?["\']',f'href="./admin-frame.css?v={VERSION}"',s,count=1)
 s=re.sub(r'src=["\']\.\/admin-frame\.js(?:\?[^"\']*)?["\']',f'src="./admin-frame.js?v={VERSION}"',s,count=1)
 s=re.sub(r'src=["\']\.\/gym-context\.js(?:\?[^"\']*)?["\']',f'src="./gym-context.js?v={VERSION}"',s,count=1)
 s=re.sub(r'src=["\']\.\/shared-shell\.js(?:\?[^"\']*)?["\']',f'src="./shared-shell.js?v={VERSION}"',s,count=1)
 s=re.sub(r'src=["\']\.\/account-menu\.js(?:\?[^"\']*)?["\']',f'src="./account-menu.js?v={VERSION}"',s,count=1)
 s=inject_body(s,'gym-switcher.js',f'<script src="./gym-switcher.js?v={VERSION}" defer></script>')
 write('admin.html',s)
def add_admin_shell():
 for n in ADMIN_PAGES:
  s=read(n)
  s=re.sub(r'<script[^>]+src=["\']\.\/shared-admin-nav\.js(?:\?[^"\']*)?["\'][^>]*>\s*<\/script>','',s,flags=re.I)
  s=s.replace('<head>','<head><script>(function(){try{var q=new URLSearchParams(location.search);if(q.get("embedded")==="1")document.documentElement.classList.add("admin-embedded");if(sessionStorage.getItem("hybrid-admin-hot-nav")==="1"){document.documentElement.classList.add("admin-hot-nav");sessionStorage.removeItem("hybrid-admin-hot-nav")}}catch(e){}})();</script>',1)
  # Source pages have accumulated different shared stylesheet links. Rebuild the shared
  # cascade deterministically so every admin page renders app -> shell -> page overrides.
  for asset in ('app-consistency.css','admin-shell.css','admin-pages.css'):
   s=re.sub(r'<link[^>]+href=["\']\.\/'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>','',s,flags=re.I)
  shared_css=''.join(f'<link rel="stylesheet" href="./{asset}?v={VERSION}">' for asset in ('app-consistency.css','admin-shell.css','admin-pages.css'))
  s=s.replace('</head>',shared_css+'</head>',1)
  if n=='admin-operations.html':s=inject_head(s,'admin-operations.css',f'<link rel="stylesheet" href="./admin-operations.css?v={VERSION}">')
  s=inject_body(s,'admin-embed.js',f'<script src="./admin-embed.js?v={VERSION}" defer></script>');s=inject_body(s,'shared-admin-nav.js',f'<script src="./shared-admin-nav.js?v={VERSION}" defer></script>');s=inject_body(s,'admin-access-guard.js',f'<script src="./admin-access-guard.js?v={VERSION}" defer></script>');s=inject_body(s,'admin-transition-diagnostics.js',f'<script src="./admin-transition-diagnostics.js?v={VERSION}" defer></script>')
  if n=='index.html':s=s.replace('<section id="authView" class="auth">','<section id="authView" class="auth hidden">',1)
  write(n,s)
def add_staff_shell():
 s=read('staff.html');s=inject_head(s,'staff-operations.css',f'<link rel="stylesheet" href="./staff-operations.css?v={VERSION}">');s=inject_body(s,'staff-shell.js',f'<script src="./staff-shell.js?v={VERSION}" defer></script>');write('staff.html',inject_body(s,'staff-operations.js',f'<script src="./staff-operations.js?v={VERSION}" defer></script>'))
def add_scheduler_assets():
 s=read('classes.html')
 for a in ('calendar-mobile.css','calendar-views.css','session-manager.css'):s=inject_head(s,a,f'<link rel="stylesheet" href="./{a}?v={VERSION}">')
 for a in ('scheduling-engine.js','calendar-mobile.js','calendar-views.js','session-manager.js','class-admin-enhancements.js','class-admin-live-refresh.js'):s=inject_body(s,a,f'<script src="./{a}?v={VERSION}" defer></script>')
 write('classes.html',s);s=read('admin-operations.html');write('admin-operations.html',inject_body(s,'operations-scheduling-link.js',f'<script src="./operations-scheduling-link.js?v={VERSION}" defer></script>'))
def add_social_runtime():
 s=read('social.html');needle="$('app').classList.remove('hidden');await loadFeed()}";bridge="$('app').classList.remove('hidden');window.__hybridSocial={sb,userId:()=>userId,gymId:()=>gymId,updatePost:async(id,body)=>{const{error}=await sb.from('social_posts').update({body,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId);if(error)throw error;await loadFeed()},deletePost:async(id)=>{const{error}=await sb.from('social_posts').delete().eq('id',id).eq('user_id',userId);if(error)throw error;await loadFeed()},updateComment:async(id,body)=>{const{error}=await sb.from('social_comments').update({body,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId);if(error)throw error;await loadFeed()},deleteComment:async(id)=>{const{error}=await sb.from('social_comments').delete().eq('id',id).eq('user_id',userId);if(error)throw error;await loadFeed()},setPostReaction:async(id,reaction)=>{const{data:mine,error:q}=await sb.from('social_reactions').select('id').eq('post_id',id).eq('user_id',userId).maybeSingle();if(q)throw q;if(mine){const{error}=await sb.from('social_reactions').update({reaction}).eq('id',mine.id);if(error)throw error}else{const{error}=await sb.from('social_reactions').insert({gym_id:gymId,user_id:userId,post_id:id,reaction});if(error)throw error}await loadFeed()}};await loadFeed()}"
 if needle not in s:raise RuntimeError('social init bridge mount changed')
 s=s.replace(needle,bridge,1);s=s.replace('<article class="post" data-post="${p.id}">','<article class="post" data-post="${p.id}" data-mine="${p.user_id===userId}">',1);s=s.replace('<div class="comment">${avatarHtml(c.user_id)}','<div class="comment" data-comment="${c.id}" data-mine="${c.user_id===userId}">${avatarHtml(c.user_id)}',1);write('social.html',inject_body(s,'social-enhancements.js',f'<script src="./social-enhancements.js?v={VERSION}" defer></script>'))
def add_social_notification_runtime():
 for n in ('social.html','community.html','groups.html'):
  s=read(n);s=inject_body(s,'social-notifications.js',f'<script type="module" src="./social-notifications.js?v={VERSION}"></script>');write(n,s)
def brand_member_preview():
 n='member-preview.html';s=read(n);s=s.replace('<title>Member Preview · HybridOne</title>','<title>Hybrid Hub · Member Preview</title>').replace('Puffin Performance','Hybrid Hub')
 if 'member-gym-logo' not in s:s=s.replace('<main class="main">','<main class="main"><div class="member-gym-logo"><img src="./assets/hybrid-hub-logo-horizontal.svg" alt="Hybrid Hub"></div>',1)
 write(n,s)
def finalise_ui_contract():
 # Canonical visual primitives must be the final stylesheet on every product
 # surface. Page/specialist CSS owns feature geometry; app-consistency owns
 # the shared HybridOne look and feel.
 for n in tuple(dict.fromkeys(APP_PAGES+('admin.html',))):
  if not (OUT/n).exists():continue
  s=read(n)
  s=re.sub(r'<link[^>]+href=["\']\.\/app-consistency\.css(?:\?[^"\']*)?["\'][^>]*>','',s,flags=re.I)
  s=s.replace('</head>',f'<link rel="stylesheet" href="./app-consistency.css?v={VERSION}"></head>',1)
  write(n,s)
BRAND_HEAD='<meta name="theme-color" content="#0B1020"><link rel="icon" href="./assets/brand/icons/favicon.ico" sizes="any"><link rel="icon" href="./assets/brand/icons/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="./assets/brand/icons/apple-touch-icon.png"><link rel="manifest" href="./assets/brand/icons/site.webmanifest">'
BRAND_SOCIAL='<meta property="og:title" content="HybridOne"><meta property="og:description" content="Your gym. Your members. One operating system."><meta property="og:image" content="https://www.hybridone.co.uk/assets/brand/social/og-image-1200x630.png"><meta name="twitter:card" content="summary_large_image">'
def add_brand_layer():
 # One brand layer on every built page: tab icon, app icon, manifest, theme colour, fonts and tokens (BRAND.md).
 for f in sorted(OUT.glob('*.html')):
  s=f.read_text(encoding='utf-8')
  if '</head>' not in s:continue
  s=re.sub(r'<meta[^>]+name=["\']theme-color["\'][^>]*>','',s,flags=re.I)
  s=re.sub(r'<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]*>','',s,flags=re.I)
  s=re.sub(r'<link[^>]+rel=["\']apple-touch-icon["\'][^>]*>','',s,flags=re.I)
  s=re.sub(r'<link[^>]+rel=["\']manifest["\'][^>]*>','',s,flags=re.I)
  extra=BRAND_SOCIAL if f.name in ('landing.html','index.html','login.html','join.html') and 'og:title' not in s else ''
  css=f'<link rel="preload" href="./assets/brand/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="./assets/brand/brand.css?v={VERSION}">' if 'assets/brand/brand.css' not in s else ''
  # App pages load the shared stylesheet last, so brand tokens go first; standalone pages (sign-in, join, invites) take them last.
  if 'app-consistency.css' in s:s=s.replace('</head>',BRAND_HEAD+extra+'</head>',1);s=(re.sub(r'(<meta[^>]+charset[^>]*>)',lambda m:m.group(1)+css,s,count=1) if re.search(r'<meta[^>]+charset',s,flags=re.I) else s.replace('<head>','<head>'+css,1)) if css else s
  else:s=s.replace('</head>',BRAND_HEAD+extra+css+'</head>',1)
  f.write_text(s,encoding='utf-8')
def write_deployment_manifest():
 (OUT/'deployment.json').write_text(json.dumps({'build_sha':BUILD_SHA,'build_version':VERSION},indent=2)+'\n',encoding='utf-8')
def site_root():
 # Where the site lives. '/' on hybridone.co.uk and in the local checks; the dev preview is a GitHub Pages project site under /<repository name>/.
 explicit=os.environ.get('VITE_SITE_ROOT')
 if explicit:return explicit if explicit.endswith('/') else explicit+'/'
 if os.environ.get('GITHUB_WORKFLOW')=='HybridOne dev preview' and os.environ.get('GITHUB_REPOSITORY'):return '/'+os.environ['GITHUB_REPOSITORY'].split('/')[1]+'/'
 return '/'
def build_next_app():
 # New TypeScript/React app (REBUILD_PLAN.md): web/ -> _site/next/. Vite writes straight into _site/next.
 web=ROOT/'web'
 if not web.exists():return
 site=site_root();env={**os.environ,'CI':'1','VITE_SITE_ROOT':site}
 subprocess.run(['npm','ci','--no-audit','--no-fund'],cwd=web,check=True,env=env)
 subprocess.run(['npm','run','build'],cwd=web,check=True,env=env)
 if not(OUT/'next'/'index.html').exists():raise RuntimeError('web build did not produce _site/next/index.html')
 # Live (Vercel) hands app addresses to the app with rewrites in vercel.json. GitHub Pages cannot, so the dev preview answers an unknown address with the app's page instead.
 if site!='/':shutil.copy2(OUT/'next'/'index.html',OUT/'404.html')
def build():copy_source();clean_legacy_class_mobile_back();version_admin_frame_assets();add_shared_runtime();add_tenant_runtime();harden_member();add_member_access_guard();add_admin_shell();add_staff_shell();add_scheduler_assets();add_social_runtime();add_social_notification_runtime();brand_member_preview();finalise_ui_contract();add_brand_layer();build_next_app();write_deployment_manifest();print(f'Built HybridOne site in {OUT} from {BUILD_SHA}')
if __name__=='__main__':build()
