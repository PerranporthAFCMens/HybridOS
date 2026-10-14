// admin-create-staff-with-level: creates a staff or coach login and gives it a role and access level in one gym.
//
// The owner's or admin's own sign-in (JWT) calls it: { gym_id, email, display_name, role: 'staff' | 'coach', access_level_id }.
// The database function it calls (provision_staff_membership_with_level) checks that the caller may do this in that gym.
//
// A NEW login is created with a long random password that nobody ever sees: it is not returned, not shown and not emailed.
// The person chooses their own password from the link in the welcome email (notify-staff-welcome sends it), which is the same
// one-time link as "Forgot password?". Someone who already has a HybridOne login keeps their password and is only given the role.
//
// This function was live-only until 14 October 2026; this is its copy in the repository. Changes from the live version 6:
// no temporary password any more, and the lookup of an existing login reads every page of users, not only the first 1000.
import { createClient } from 'jsr:@supabase/supabase-js@2'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors })

/** 24 random bytes as text: far stronger than anyone could type, and thrown away. */
const unknownPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let createdUserId: string | null = null
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!token) return reply(401, { error: 'Unauthorised' })

    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !user) return reply(401, { error: 'Unauthorised' })

    const body = await req.json()
    const gymId = String(body.gym_id || '')
    const email = String(body.email || '').trim().toLowerCase()
    const displayName = String(body.display_name || '').trim()
    const role = body.role === 'coach' ? 'coach' : 'staff'
    const accessLevelId = String(body.access_level_id || '')
    if (!gymId || !email || !displayName || !accessLevelId) return reply(400, { error: 'Name, email and access level are required' })

    const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: auth } } })

    // Is there already a login for this address? Read every page, so it still works when there are thousands of members.
    let staffUser: { id: string } | null = null
    for (let page = 1; page <= 50 && !staffUser; page++) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (listErr) throw listErr
      staffUser = list.users.find((u) => u.email?.toLowerCase() === email) ?? null
      if (list.users.length < 1000) break
    }

    if (!staffUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: unknownPassword(),
        email_confirm: true,
        user_metadata: { display_name: displayName, full_name: displayName },
      })
      if (error) throw error
      staffUser = data.user
      createdUserId = data.user.id
    }

    const { error: provisionErr } = await userClient.rpc('provision_staff_membership_with_level', {
      target_gym_id: gymId,
      target_user_id: staffUser.id,
      target_display_name: displayName,
      target_role: role,
      target_level_id: accessLevelId,
    })
    if (provisionErr) throw provisionErr

    return reply(200, { ok: true, user_id: staffUser.id, email, existing_user: !createdUserId })
  } catch (e) {
    // A login made by this call is removed again if the rest failed, so nothing half-made is left behind.
    if (createdUserId) {
      try {
        const url = Deno.env.get('SUPABASE_URL')!
        const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
        await admin.auth.admin.deleteUser(createdUserId)
      } catch { /* nothing more to do */ }
    }
    return reply(500, { error: String((e as { message?: string })?.message || e) })
  }
})
