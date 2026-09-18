from __future__ import annotations
import os,re,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'_site';VERSION=os.environ.get('GITHUB_SHA','dev')[:12];EXCLUDE={'.git','.github','scripts','_site'}
APP_PAGES=('index.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','staff.html','member.html','member-preview.html','member-memberships.html','integrations.html','social.html','onboarding.html');TENANT_PAGES=('index.html','member.html','member-preview.html','classes.html','staff.html','member-memberships.html','integrations.html','social.html');ADMIN_PAGES=('index.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html')
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
def clean_legacy_mobile_chrome():
 for n in ('member.html','member-preview.html','staff.html'):
  if(OUT/n).exists():write(n,re.sub(r'<nav class="bottom">.*?</nav>','',read(n),count=1,flags=re.S))
 write('classes.html',re.sub(r'<a class="mobile-back"[^>]*>.*?</a>','',read('classes.html'),count=1,flags=re.S))
def add_shared_runtime():
 for n in APP_PAGES:
  if not(OUT/n).exists():continue
  s=inject_head(read(n),'app-consistency.css',f'<link rel="stylesheet" href="./app-consistency.css?v={VERSION}">');s=inject_head(s,'app-stability.js',f'<script src="./app-stability.js?v={VERSION}"></script>');write(n,inject_body(s,'account-menu.js',f'<script src="./account-menu.js?v={VERSION}" defer></script>'))
def add_tenant_runtime():
 for n in TENANT_PAGES:
  if not(OUT/n).exists():continue
  s=inject_head(read(n),'tenant-branding.css',f'<link rel="stylesheet" href="./tenant-branding.css?v={VERSION}">');write(n,inject_body(s,'tenant-branding.js',f'<script src="./tenant-branding.js?v={VERSION}" defer></script>'))
def harden_member():
 css=f'<link rel="stylesheet" href="./member-experience.css?v={VERSION}">';coachcss=f'<link rel="stylesheet" href="./member-coach.css?v={VERSION}">';js=f'<script type="module" src="./member-experience.js?v={VERSION}"></script>';coachjs=f'<script type="module" src="./member-coach.js?v={VERSION}"></script>';s=read('member.html');s=inject_head(s,'member-experience.css',css);s=inject_head(s,'member-coach.css',coachcss);s=inject_body(s,'social-nav.js',f'<script src="./social-nav.js?v={VERSION}" defer></script>');s=inject_body(s,'member-experience.js',js);write('member.html',inject_body(s,'member-coach.js',coachjs));s=read('member-preview.html');s=inject_head(s,'member-experience.css',css);s=inject_head(s,'member-coach.css',coachcss)
 for a in ('social-nav.js','member-preview-classes.js','member-preview-controls.js'):s=inject_body(s,a,f'<script src="./{a}?v={VERSION}" defer></script>')
 s=inject_body(s,'member-experience.js',js);write('member-preview.html',inject_body(s,'member-coach.js',coachjs))
def add_admin_shell():
 for n in ADMIN_PAGES:
  s=read(n);s=inject_head(s,'admin-shell.css',f'<link rel="stylesheet" href="./admin-shell.css?v={VERSION}">');s=inject_head(s,'admin-pages.css',f'<link rel="stylesheet" href="./admin-pages.css?v={VERSION}">');s=inject_body(s,'shared-admin-nav.js',f'<script src="./shared-admin-nav.js?v={VERSION}" defer></script>')
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
def brand_member_preview():
 n='member-preview.html';s=read(n);s=s.replace('<title>Member Preview · Hybrid OS</title>','<title>Hybrid Hub · Member Preview</title>').replace('Puffin Performance','Hybrid Hub')
 if 'member-gym-logo' not in s:s=s.replace('<main class="main">','<main class="main"><div class="member-gym-logo"><img src="./assets/hybrid-hub-logo-horizontal.svg" alt="Hybrid Hub"></div>',1)
 write(n,s)
def build():copy_source();clean_legacy_mobile_chrome();add_shared_runtime();add_tenant_runtime();harden_member();add_admin_shell();add_staff_shell();add_scheduler_assets();add_social_runtime();brand_member_preview();print(f'Built Hybrid OS site in {OUT}')
if __name__=='__main__':build()
