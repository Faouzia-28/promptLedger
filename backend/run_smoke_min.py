import json,uuid,httpx,sys
base='http://127.0.0.1:8001'
result={}
try:
    h=httpx.get(f'{base}/health', timeout=10)
    result['health']={'status':h.status_code,'body':h.json() if h.status_code==200 else h.text[:200]}
    email=f'min_{uuid.uuid4().hex[:8]}@example.com'
    pwd='TestPass123!'
    reg=httpx.post(f'{base}/api/v1/auth/register', json={'org_name':'Min Smoke','email':email,'password':pwd}, timeout=30)
    result['register']={'status':reg.status_code}
    if reg.status_code<300:
        tok=reg.json().get('access_token')
        result['register']['token']=tok
    else:
        result['register']['error']=reg.text[:200]
    with open('smoke_min_result.json','w',encoding='utf-8') as f:
        f.write(json.dumps(result, indent=2))
    print('wrote smoke_min_result.json')
except Exception as e:
    print('error', e)
    with open('smoke_min_result.json','w',encoding='utf-8') as f:
        f.write(json.dumps({'error':str(e)}))
    sys.exit(1)
