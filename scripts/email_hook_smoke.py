from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / 'supabase' / 'functions' / 'send-auth-email' / 'index.ts'
problems = []

if not HOOK.exists():
    problems.append('send-auth-email Edge Function source is missing')
else:
    text = HOOK.read_text(encoding='utf-8')
    required = (
        'SEND_EMAIL_HOOK_SECRET',
        'RESEND_API_KEY',
        'standardwebhooks@1.0.0',
        "@supabase/supabase-js@2.116.0",
        "redirect.searchParams.get('gym_id')",
        "redirect.searchParams.get('access_invite')",
        "emailData.email_action_type === 'signup'",
        "admin.rpc('get_auth_email_context'",
        "admin.rpc('get_auth_email_template'",
        'https://api.resend.com/emails',
        "'Idempotency-Key'",
        "DEFAULT_FROM = 'noreply@hybridone.co.uk'",
    )
    for marker in required:
        if marker not in text:
            problems.append(f'send-auth-email: required contract missing: {marker}')

    forbidden = (
        ".eq('email', user.email)",
        ".eq('email',user.email)",
        "senderEmail = user.email",
        "RESEND_API_KEY = 're_",
        "admin.from('gyms')",
        "admin.from('gym_members')",
        "admin.from('gym_communication_settings')",
        "admin.from('gym_email_templates')",
        "admin.from('gym_admin_invites')",
        "admin.from('profiles')",
        "admin.from('membership_plans')",
    )
    for marker in forbidden:
        if marker in text:
            problems.append(f'send-auth-email: unsafe tenant/secret/direct-table pattern found: {marker}')

if problems:
    print('EMAIL HOOK SMOKE FAILED')
    for problem in problems:
        print('-', problem)
    raise SystemExit(1)

print('Email hook smoke passed')
