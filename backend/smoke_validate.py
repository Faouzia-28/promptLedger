import uuid
import json
import httpx

base = "http://127.0.0.1:8001"
result = {}

# Health
h = httpx.get(f"{base}/health", timeout=20)
result["health"] = {"status": h.status_code, "body": h.json() if h.status_code == 200 else h.text[:200]}

email = f"prod_{uuid.uuid4().hex[:8]}@example.com"
password = "TestPass123!"
org_name = f"Prod Backlog Org {uuid.uuid4().hex[:4]}"

reg = httpx.post(
    f"{base}/api/v1/auth/register",
    json={"org_name": org_name, "email": email, "password": password},
    timeout=30,
)
result["register"] = {"status": reg.status_code}
if reg.status_code < 300:
    reg_json = reg.json()
    token = reg_json.get("access_token")
    user = reg_json.get("user", {})
    result["register"]["user_id"] = user.get("id")
    result["register"]["org_id"] = user.get("org_id")
else:
    result["register"]["error"] = reg.text[:300]
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

login = httpx.post(
    f"{base}/api/v1/auth/login",
    json={"email": email, "password": password},
    timeout=30,
)
result["login"] = {"status": login.status_code}

headers = {"Authorization": f"Bearer {token}"}
headers_json = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

unit = httpx.post(
    f"{base}/api/v1/units",
    headers=headers_json,
    json={"name": "Prod Unit", "description": "from smoke test", "unit_type": "prompt"},
    timeout=30,
)
result["create_unit"] = {"status": unit.status_code}
if unit.status_code < 300:
    unit_id = unit.json().get("id")
    result["create_unit"]["unit_id"] = unit_id
else:
    result["create_unit"]["error"] = unit.text[:300]
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

v1 = httpx.post(
    f"{base}/api/v1/units/{unit_id}/versions",
    headers=headers_json,
    json={"content": {"system_prompt": "You are helpful."}, "config": {"temperature": 0.2}, "git_branch": "main", "git_commit": "abc111"},
    timeout=30,
)
result["create_v1"] = {"status": v1.status_code, "version_id": v1.json().get("id") if v1.status_code < 300 else None}

v2 = httpx.post(
    f"{base}/api/v1/units/{unit_id}/versions",
    headers=headers_json,
    json={"content": {"system_prompt": "You are concise and helpful."}, "config": {"temperature": 0.1}, "git_branch": "main", "git_commit": "abc222"},
    timeout=30,
)
result["create_v2"] = {"status": v2.status_code, "version_id": v2.json().get("id") if v2.status_code < 300 else None}

es = httpx.post(
    f"{base}/api/v1/evals/sets",
    headers=headers_json,
    json={
        "unit_id": unit_id,
        "name": "Smoke Set",
        "cases": [
            {"input": "hi", "expected_output": "hello"},
            {"input": "refund", "expected_output": "help refund process"}
        ],
    },
    timeout=30,
)
result["create_eval_set"] = {"status": es.status_code, "eval_set_id": es.json().get("id") if es.status_code < 300 else None}

eval_set_id = result["create_eval_set"]["eval_set_id"]

diff = httpx.get(
    f"{base}/api/v1/units/{unit_id}/diff/1/2",
    headers=headers,
    params={"eval_set_id": eval_set_id},
    timeout=180,
)
result["diff"] = {"status": diff.status_code}
if diff.status_code < 300:
    dj = diff.json()
    result["diff"]["has_semantic_diff"] = bool(dj.get("semantic_diff"))
else:
    result["diff"]["error"] = diff.text[:300]

ev = httpx.post(
    f"{base}/api/v1/evals/runs",
    headers=headers,
    params={"version_id": result["create_v2"]["version_id"], "eval_set_id": eval_set_id},
    timeout=30,
)
result["create_eval_run"] = {"status": ev.status_code}
if ev.status_code < 300:
    result["create_eval_run"]["run_id"] = ev.json().get("run_id")
else:
    result["create_eval_run"]["error"] = ev.text[:300]

audit = httpx.get(f"{base}/api/v1/compliance/audit-log", headers=headers, timeout=30)
result["audit_log"] = {"status": audit.status_code}
if audit.status_code < 300:
    result["audit_log"]["count"] = len(audit.json())
else:
    result["audit_log"]["error"] = audit.text[:300]

export = httpx.get(
    f"{base}/api/v1/compliance/export",
    headers=headers,
    params={"export_format": "json"},
    timeout=30,
)
result["export_json"] = {"status": export.status_code}
if export.status_code < 300:
    ej = export.json()
    result["export_json"]["format"] = ej.get("format")
    result["export_json"]["has_payload"] = bool(ej.get("payload"))
else:
    result["export_json"]["error"] = export.text[:300]

json_text = json.dumps(result, indent=2)
print(json_text)
try:
    with open('smoke_result.json', 'w', encoding='utf-8') as f:
        f.write(json_text)
except Exception:
    pass
