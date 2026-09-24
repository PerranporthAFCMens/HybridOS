import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Content-Type':'application/json'
}

function token(){
  const bytes=new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  let stage='start'
  try{
    stage='authenticate_request'
    const auth=req.headers.get('Authorization')||''
    const jwt=auth.replace(/^Bearer\s+/i,'')
    if(!jwt) return new Response(JSON.stringify({error:'Unauthorised'}),{status:401,headers:cors})

    const url=Deno.env.get('SUPABASE_URL')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})

    const {data:{user},error:userErr}=await admin.auth.getUser(jwt)
    if(userErr||!user) return new Response(JSON.stringify({error:'Unauthorised'}),{status:401,headers:cors})

    stage='read_request'
    const body=await req.json()
    const inviteId=String(body.invite_id||'')
    if(!inviteId) return new Response(JSON.stringify({error:'Invite ID is required'}),{status:400,headers:cors})

    stage='authorise_invite'
    const {data:rows,error:contextErr}=await admin.rpc('get_email_invite_send_context',{
      target_invite_id:inviteId,
      requesting_user_id:user.id
    })
    if(contextErr) throw contextErr
    const invite=rows?.[0]
    if(!invite) return new Response(JSON.stringify({error:'Invite not found'}),{status:404,headers:cors})

    if(invite.status!=='open'){
      const msg=invite.status==='awaiting_approval'
        ?'This Owner invite is still waiting for the other Owner approval(s).'
        :'This invite is not ready to send.'
      return new Response(JSON.stringify({error:msg,status:invite.status}),{status:409,headers:cors})
    }
    if(new Date(invite.expires_at).getTime()<=Date.now()){
      return new Response(JSON.stringify({error:'Invite has expired'}),{status:410,headers:cors})
    }

    stage='prepare_invite_token'
    const raw=token()
    const {data:prepared,error:prepErr}=await admin.rpc('prepare_email_invite_token',{
      target_invite_id:inviteId,
      new_token:raw
    })
    if(prepErr) throw prepErr
    const info=prepared?.[0]
    if(!info) throw new Error('Invite could not be prepared')

    const params=new URLSearchParams({
      access_invite:raw,
      invite_email:String(info.email),
      invite_gym:String(info.gym_name),
      invite_role:String(info.invite_role),
      gym_id:String(invite.gym_id)
    })
    const redirectTo='https://www.hybridone.co.uk/app?'+params.toString()

    stage='lookup_recipient'
    let existing=null
    for(let page=1;page<=10&&!existing;page++){
      const {data:list,error:listErr}=await admin.auth.admin.listUsers({page,perPage:200})
      if(listErr) throw listErr
      existing=list.users.find(u=>u.email?.toLowerCase()===String(info.email).toLowerCase())||null
      if(list.users.length<200) break
    }

    stage='send_auth_email'
    if(existing){
      const {error:mailErr}=await admin.auth.signInWithOtp({
        email:info.email,
        options:{emailRedirectTo:redirectTo,shouldCreateUser:false}
      })
      if(mailErr) throw mailErr
    }else{
      const {error:mailErr}=await admin.auth.admin.inviteUserByEmail(info.email,{redirectTo})
      if(mailErr) throw mailErr
    }

    stage='mark_invite_sent'
    const {error:markErr}=await admin.rpc('mark_email_invite_sent',{target_invite_id:inviteId})
    if(markErr) throw markErr

    return new Response(JSON.stringify({
      ok:true,
      email:info.email,
      role:info.invite_role,
      gym_name:info.gym_name,
      delivery:existing?'magic_link':'invite',
      redirect_to:redirectTo
    }),{headers:cors})
  }catch(e){
    return new Response(JSON.stringify({ok:false,stage,error:String(e?.message||e)}),{status:200,headers:cors})
  }
})