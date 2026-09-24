from __future__ import annotations
import json
import os
import time
import urllib.parse
import urllib.request

BASE=(os.environ.get('PAGES_URL') or 'https://perranporthafcmens.github.io/HybridOS/').rstrip('/')+'/'
EXPECTED=(os.environ.get('HYBRID_BUILD_SHA') or '').strip()
if not EXPECTED:
    raise SystemExit('HYBRID_BUILD_SHA is required')

def fetch(path: str):
    sep='&' if '?' in path else '?'
    url=urllib.parse.urljoin(BASE,path)+sep+'runtime_check='+EXPECTED[:12]
    req=urllib.request.Request(url,headers={
        'User-Agent':'HybridOne-runtime-check/1.0',
        'Cache-Control':'no-cache',
        'Pragma':'no-cache',
    })
    with urllib.request.urlopen(req,timeout=25) as res:
        body=res.read().decode('utf-8','replace')
        return res.status,res.geturl(),body

last_error=None
for attempt in range(1,49):
    try:
        status,final_url,body=fetch('deployment.json')
        manifest=json.loads(body)
        if status==200 and manifest.get('build_sha')==EXPECTED:
            print(f'Runtime revision verified: {EXPECTED}')
            print(f'Public deployment: {final_url}')
            break
        last_error=f'deployment manifest mismatch: status={status} build_sha={manifest.get("build_sha")!r}'
    except Exception as exc:
        last_error=str(exc)
    if attempt<48:
        time.sleep(5)
else:
    raise SystemExit('Public Pages deployment did not reach expected revision: '+str(last_error))

checks=[
    (
        'hybrid-hub-login.html',
        ('<title>Hybrid Hub · HybridOne</title>','Opening: Hybrid Hub','Sign in to Hybrid Hub'),
        ('Welcome to HybridOne','Use the login page for the gym you want to open.')
    ),
    (
        'puffin-performance-login.html',
        ('<title>Puffin Performance · HybridOne</title>','Opening: Puffin Performance','Sign in to Puffin Performance'),
        ('Welcome to HybridOne','Use the login page for the gym you want to open.')
    ),
    (
        'index.html?gym_id=242f57c2-6e37-4977-b3c5-1c87de7d0b98',
        ("const queryGymId=inviteParams.get('gym_id')||''","sessionStorage.setItem('hybrid-gym-id',queryGymId)"),
        ()
    ),
    (
        'index.html?gym_id=aec16956-3793-4543-873b-4412646ca1eb',
        ("const queryGymId=inviteParams.get('gym_id')||''","sessionStorage.setItem('hybrid-gym-id',queryGymId)"),
        ()
    ),
]

for path,required,forbidden in checks:
    status,final_url,body=fetch(path)
    if status!=200:
        raise SystemExit(f'{path}: unexpected HTTP status {status}')
    missing=[m for m in required if m not in body]
    bad=[m for m in forbidden if m in body]
    if missing or bad:
        raise SystemExit(f'{path}: runtime content mismatch; missing={missing}; forbidden={bad}; final_url={final_url}')
    print(f'Runtime route verified: {path} -> {final_url}')

print('HybridOne public dev runtime verification passed')
