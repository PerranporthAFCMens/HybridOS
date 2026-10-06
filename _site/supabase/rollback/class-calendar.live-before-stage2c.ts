import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, service, { auth: { persistSession: false } });

function icsEscape(v:string){return (v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function icsDate(v:string){return new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}

Deno.serve(async (req:Request)=>{
  const u=new URL(req.url); const token=u.searchParams.get('token');
  if(!token) return new Response('Missing calendar token',{status:400});
  const {data:t,error:te}=await admin.from('calendar_feed_tokens').select('gym_id,user_id,is_active,gyms(name)').eq('token',token).maybeSingle();
  if(te||!t||!t.is_active) return new Response('Calendar feed not found',{status:404});
  const {data,error}=await admin.from('class_bookings').select('session_id,status,class_sessions(name,description,starts_at,ends_at,is_cancelled)').eq('gym_id',t.gym_id).eq('user_id',t.user_id).eq('status','booked');
  if(error) return new Response('Could not load calendar',{status:500});
  const now=Date.now()-86400000;
  const events=(data||[]).filter((b:any)=>b.class_sessions&&!b.class_sessions.is_cancelled&&new Date(b.class_sessions.ends_at).getTime()>=now);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hybrid OS//Class Bookings//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${icsEscape((t as any).gyms?.name||'Hybrid OS')} Classes`];
  for(const b of events as any[]){const s=b.class_sessions;lines.push('BEGIN:VEVENT',`UID:${b.session_id}@hybridos`,`DTSTAMP:${icsDate(new Date().toISOString())}`,`DTSTART:${icsDate(s.starts_at)}`,`DTEND:${icsDate(s.ends_at)}`,`SUMMARY:${icsEscape(s.name)}`,`DESCRIPTION:${icsEscape(s.description||'Booked via Hybrid OS')}`,'STATUS:CONFIRMED','END:VEVENT')}
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n'),{headers:{'content-type':'text/calendar; charset=utf-8','cache-control':'no-store'}})
});
