// Stage 3 test harness: disposable per-run Puffin Performance member personas for the membership-status browser test.
// Gym touched: Puffin Performance (test gym) ONLY. Never Hybrid Hub.
// Auth: GitHub Actions OIDC, locked to this repo, the dev branch, a GitHub-hosted runner and ONE workflow file.
// Table writes go through public.hybridone_membership_persona_setup/cleanup (migration 20261006120000).
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
 const {error}=await admin.rpc('hybridone_membership_persona_cleanup',{target_user_id:id}); if(error) throw new Error('cleanup rpc: '+error.message)
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
    // All table writes happen inside a locked SECURITY DEFINER helper (the service role has no direct write grants).
    const {data:token,error:re}=await admin.rpc('hybridone_membership_persona_setup',{target_user_id:uid,persona:key}); if(re||!token) throw new Error('setup rpc: '+(re?.message||'no token'))
    personas[key]={email,token:String(token)}
   }
   return new Response(JSON.stringify({ok:true,personas}),{headers:{'content-type':'application/json'}})
  }
  throw new Error('Unsupported action')
 }catch(e){return new Response(JSON.stringify({ok:false,error:String((e as any)?.message||e)}),{status:403,headers:{'content-type':'application/json'}})}
})
