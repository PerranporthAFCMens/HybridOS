// Undo for the 14 October 2026 change to the admin-create-staff-with-level function: this is the live version 6 exactly as it was
// before (it made a temporary password and returned it). To go back, deploy this file as the function (JWT required).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Content-Type':'application/json'
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  let createdUserId:string|null=null
  try{
    const auth=req.headers.get('Authorization')||''
    const token=auth.replace(/^Bearer\s+/i,'')
    if(!token) return new Response(JSON.stringify({error:'Unauthorised'}),{status:401,headers:cors})

    const url=Deno.env.get('SUPABASE_URL')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:{user},error:userErr}=await admin.auth.getUser(token)
    if(userErr||!user) return new Response(JSON.stringify({error:'Unauthorised'}),{status:401,headers:cors})

    const body=await req.json()
    const gymId=String(body.gym_id||'')
    const email=String(body.email||'').trim().toLowerCase()
    const displayName=String(body.display_name||'').trim()
    const role=body.role==='coach'?'coach':'staff'
    const accessLevelId=String(body.access_level_id||'')
    if(!gymId||!email||!displayName||!accessLevelId){
      return new Response(JSON.stringify({error:'Name, email and access level are required'}),{status:400,headers:cors})
    }

    const userClient=createClient(url,anon,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:auth}}
    })

    let staffUser:any=null
    const {data:list,error:listErr}=await admin.auth.admin.listUsers({page:1,perPage:1000})
    if(listErr) throw listErr
    staffUser=list.users.find(u=>u.email?.toLowerCase()===email)

    let tempPassword:string|null=null
    if(!staffUser){
      tempPassword='Hybrid'+crypto.randomUUID().replace(/-/g,'').slice(0,10)+'!'
      const {data,error}=await admin.auth.admin.createUser({
        email,
        password:tempPassword,
        email_confirm:true,
        user_metadata:{display_name:displayName,full_name:displayName}
      })
      if(error) throw error
      staffUser=data.user
      createdUserId=staffUser.id
    }

    const {error:provisionErr}=await userClient.rpc('provision_staff_membership_with_level',{
      target_gym_id:gymId,
      target_user_id:staffUser.id,
      target_display_name:displayName,
      target_role:role,
      target_level_id:accessLevelId
    })
    if(provisionErr) throw provisionErr

    return new Response(JSON.stringify({
      ok:true,
      user_id:staffUser.id,
      email,
      temp_password:tempPassword,
      existing_user:!tempPassword
    }),{headers:cors})
  }catch(e){
    if(createdUserId){
      try{
        const url=Deno.env.get('SUPABASE_URL')!
        const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
        await admin.auth.admin.deleteUser(createdUserId)
      }catch{}
    }
    return new Response(JSON.stringify({error:String(e?.message||e)}),{status:500,headers:cors})
  }
})
