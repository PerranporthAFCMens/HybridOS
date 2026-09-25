from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
problems=[]

required_files=[
    'PROJECT_STATE.json',
    'PROJECT_CONTROL.md',
    'ENVIRONMENT.md',
    'STATUS.md',
    'AUTH_TEST_MATRIX.md',
    '.github/workflows/dev-runtime.yml',
    '.github/workflows/protected-routing-browser.yml',
    'scripts/runtime_pages_check.py',
    'HANDOVER.md',
    'README.md',
]
for name in required_files:
    if not (ROOT/name).exists():
        problems.append(f'missing project control file: {name}')

if not problems:
    state=json.loads((ROOT/'PROJECT_STATE.json').read_text(encoding='utf-8'))
    required_top={'schema_version','verified_at_utc','repository','branches','release_gate','production','development','supabase','current_auth_status'}
    missing=required_top-set(state)
    if missing:
        problems.append('PROJECT_STATE.json missing keys: '+', '.join(sorted(missing)))

    if state.get('repository')!='PerranporthAFCMens/HybridOS':
        problems.append('PROJECT_STATE.json repository mismatch')

    supabase=state.get('supabase',{})
    if supabase.get('project_id')!='mzgnhmeydhhpzgxlgudh':
        problems.append('PROJECT_STATE.json Supabase project mismatch')
    if supabase.get('hybrid_hub_gym_id')!='242f57c2-6e37-4977-b3c5-1c87de7d0b98':
        problems.append('PROJECT_STATE.json Hybrid Hub gym id mismatch')
    if supabase.get('puffin_performance_gym_id')!='aec16956-3793-4543-873b-4412646ca1eb':
        problems.append('PROJECT_STATE.json Puffin gym id mismatch')

    env=(ROOT/'ENVIRONMENT.md').read_text(encoding='utf-8')
    for value in (
        state['development']['hybrid_hub_login'],
        state['development']['puffin_performance_login'],
        state['production']['hybrid_hub_login'],
        state['production']['puffin_performance_login'],
        state['supabase']['auth_email_hook']['endpoint'],
    ):
        if value not in env:
            problems.append(f'ENVIRONMENT.md missing authoritative route/endpoint: {value}')

    status=(ROOT/'STATUS.md').read_text(encoding='utf-8')
    if state['branches']['production_main_sha'] not in status:
        problems.append('STATUS.md missing production main checkpoint')
    if state['branches']['verified_dev_application_sha'] not in status:
        problems.append('STATUS.md missing verified dev application checkpoint')

    matrix=(ROOT/'AUTH_TEST_MATRIX.md').read_text(encoding='utf-8')
    for n in range(1,19):
        if f'| {n} |' not in matrix:
            problems.append(f'AUTH_TEST_MATRIX.md missing scenario {n}')
    if 'Do **not** remove the production hold' not in matrix:
        problems.append('AUTH_TEST_MATRIX.md missing production release gate')

    runtime_workflow=(ROOT/'.github/workflows/dev-runtime.yml').read_text(encoding='utf-8')
    runtime_script=(ROOT/'scripts/runtime_pages_check.py').read_text(encoding='utf-8')
    protected_routing_workflow=(ROOT/'.github/workflows/protected-routing-browser.yml').read_text(encoding='utf-8')
    if 'HybridOne dev runtime verification' not in runtime_workflow:
        problems.append('dev runtime workflow name/contract missing')
    if 'deployment.json' not in runtime_script or 'hybrid-hub-login.html' not in runtime_script or 'puffin-performance-login.html' not in runtime_script:
        problems.append('runtime Pages verification contract incomplete')
    for marker in ('HybridOne protected routing browser','return_to','admin-access.html','hybrid-hub-login.html','puffin-performance-login.html'):
        if marker not in protected_routing_workflow:
            problems.append(f'protected routing browser contract missing: {marker}')

    control=(ROOT/'PROJECT_CONTROL.md').read_text(encoding='utf-8')
    for marker in ('Definition of "fixed"','Mandatory read order','URL rule','State-update rule'):
        if marker not in control:
            problems.append(f'PROJECT_CONTROL.md missing rule: {marker}')

    readme=(ROOT/'README.md').read_text(encoding='utf-8')
    handover=(ROOT/'HANDOVER.md').read_text(encoding='utf-8')
    for marker in ('PROJECT_STATE.json','PROJECT_CONTROL.md','ENVIRONMENT.md','STATUS.md'):
        if marker not in readme:
            problems.append(f'README.md missing project control reference: {marker}')
        if marker not in handover:
            problems.append(f'HANDOVER.md missing project control reference: {marker}')

if problems:
    print('PROJECT CONTROL CHECK FAILED')
    for p in problems:
        print('-',p)
    raise SystemExit(1)

print('Project control check passed')
