// Stage 3 test harness: disposable per-run Puffin Performance member personas for the membership-status browser test.
// Gym touched: Puffin Performance (test gym) ONLY. Never Hybrid Hub.
// Auth: GitHub Actions OIDC, locked to this repo, the dev branch, a GitHub-hosted runner and ONE workflow file.
// Deploy with verify_jwt=false (authorisation is the OIDC check below). Rollback = delete this function.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.0'

const PUFFIN='aec16956-3793-4543-873b-4412646ca1eb'
const AUD='hybridone-membership-personas'
const REPO='PerranporthAFCMens/HybridOS'
const REPO_ID='1373617651'
const SUFFIX='/.github/workflows/membership-personas-browser.yml@refs/heads/dev'
const KEYS=['active','paused','cancelled','pending','expired','superseded']
const EMAIL_RE=/^delivered\+persona-[a-z0-9]{6,20}-(active|paused|cancelled|pending|expired|superseded)@resend\.dev$/
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'))

async function check(req:Request){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
 const {payload}=await jwtVerify(token,JWKS,{issuer:'https://token.actions.githubusercontent.com',audience:AUD,algorithms:['RS256']})
 if(String(payload.repository||'')!==REPO||String(payload.repository_id||'')!==REPO_ID||String(payload.ref||'')!=='refs/heads/dev'||String(payload.runner_environment||'')!=='github-hosted'||!String(payload.workflow_ref||'').endsWith(SUFFIX)) throw new Error('OIDC rejected')
}
const iso=(offsetDays:number)=>new Date(Date.now()+offsetDays*86400000).toISOString()
const day=(offsetDays:number)=>iso(offsetDays).slice(0,10)

// Rows to create per persona. Newest created_at governs.
function membershipRows(key:string){
 switch(key){
  case 'active': return [{status:'active',starts_on:day(-30),ends_on:null,created_at:iso(0)}]
  case 'paused': return [{status:'paused',starts_on:day(-30),ends_on:null,created_at:iso(0)}]
  case 'cancelled': return [{status:'cancelled',starts_on:day(-60),ends_on:day(-1),created_at:iso(0)}]
  case 'pending': return [{status:'pending',starts_on:null,ends_on:null,created_at:iso(0)}]
  case 'expired': return [{status:'active',starts_on:day(-60),ends_on:day(-1),created_at:iso(0)}]
  case 'superseded': return [{status:'active',starts_on:day(-90),ends_on:null,created_at:iso(-2)},{status:'cancelled',starts_on:day(-90),ends_on:day(-1),created_at:iso(0)}]
 }
 throw new Error('Unknown persona')
}

async function findPersonaUsers(admin:any){
 const out:any[]=[]
 for(let p=1;p<=10;p++){
  const {data,error}=await admin.auth.admin.listUsers({page:p,perPage:200}); if(error) throw error
  for(const u of data.users){ if(EMAIL_RE.test(String(u.email||'').toLowerCase())) out.push(u) }
  if(data.users.length<200) break
 }
 return out
}
async function wipeUser(admin:any,id:string){
 for(const t of ['calendar_feed_tokens','class_bookings','memberships','gym_members']){
  const {error}=await admin.from(t).delete().eq('user_id',id).eq('gym_id',PUFFIN); if(error) throw new Error(t+': '+error.message)
 }
 const {error:pe}=await admin.from('profiles').delete().eq('id',id); if(pe) throw new Error('profiles: '+pe.message)
}

Deno.serve(async req=>{
 try{
  if(req.method!=='POST') return new Response('POST only',{status:405})
  await check(req)
  const body=await req.json()
  const action=String(body.action||'')
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})

  if(action==='cleanup'){
   const users=await findPersonaUsers(admin)
   for(const u of users){
    await wipeUser(admin,u.id)
    const {error}=await admin.auth.admin.deleteUser(u.id); if(error) throw error
   }
   return new Response(JSON.stringify({ok:true,cleaned:true,count:users.length}),{headers:{'content-type':'application/json'}})
  }

  if(action==='setup'){
   const run=String(body.run||''); const password=String(body.password||'')
   if(!/^[a-z0-9]{6,20}$/.test(run)) throw new Error('Bad run id')
   if(password.length<16) throw new Error('Password too short')
   // Remove stale personas from earlier runs first.
   for(const u of await findPersonaUsers(admin)){ await wipeUser(admin,u.id); const {error}=await admin.auth.admin.deleteUser(u.id); if(error) throw error }
   const personas:Record<string,{email:string,token:string}>={}
   for(const key of KEYS){
    const email=`delivered+persona-${run}-${key}@resend.dev`
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Persona '+key}})
    if(error||!data.user) throw error||new Error('User creation failed')
    const uid=data.user.id
    const {error:pe}=await admin.from('profiles').upsert({id:uid,display_name:'Persona '+key,first_name:'Persona',last_name:key,updated_at:new Date().toISOString()},{onConflict:'id'}); if(pe) throw new Error('profiles: '+pe.message)
    // Clear anything a signup trigger may have created for this user in Puffin, then insert exactly what the persona needs.
    for(const t of ['memberships','gym_members']){ const {error:de}=await admin.from(t).delete().eq('user_id',uid).eq('gym_id',PUFFIN); if(de) throw new Error(t+': '+de.message) }
    const {error:ge}=await admin.from('gym_members').insert({gym_id:PUFFIN,user_id:uid,role:'member',is_active:true,access_status:'active'}); if(ge) throw new Error('gym_members: '+ge.message)
    for(const row of membershipRows(key)){
     const {error:me}=await admin.from('memberships').insert({gym_id:PUFFIN,user_id:uid,...row}); if(me) throw new Error('memberships: '+me.message)
    }
    const {data:tok,error:te}=await admin.from('calendar_feed_tokens').insert({gym_id:PUFFIN,user_id:uid,is_active:true}).select('token').single(); if(te) throw new Error('calendar_feed_tokens: '+te.message)
    personas[key]={email,token:String(tok.token)}
   }
   return new Response(JSON.stringify({ok:true,personas}),{headers:{'content-type':'application/json'}})
  }
  throw new Error('Unsupported action')
 }catch(e){return new Response(JSON.stringify({ok:false,error:String((e as any)?.message||e)}),{status:403,headers:{'content-type':'application/json'}})}
})
