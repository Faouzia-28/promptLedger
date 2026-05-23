#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error

k = os.getenv("GROQ_API_KEY")
print("GROQ_API_KEY set:", bool(k))
if not k:
    print("No GROQ_API_KEY in environment. Exiting.")
    sys.exit(2)

url = "https://api.groq.com/openai/v1/chat/completions"
payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hello"}]}
headers = {"Authorization": f"Bearer {k}", "Content-Type": "application/json"}

print("Calling Groq endpoint...")
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=data, headers=headers, method="POST")

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        status = resp.status
        raw = resp.read().decode("utf-8", errors="replace")
        print("Status:", status)
        try:
            body = json.loads(raw)
            print(json.dumps(body, indent=2))
        except Exception:
            print(raw)
        print("\n--- Groq call succeeded.")
        sys.exit(0)
except urllib.error.HTTPError as e:
    raw = e.read().decode("utf-8", errors="replace")
    print("Status:", e.code)
    try:
        body = json.loads(raw)
        print(json.dumps(body, indent=2))
    except Exception:
        print(raw)
    if e.code == 401:
        print("\n--- Groq returned 401. The API key is invalid/expired or lacks permission.")
        sys.exit(1)
    print("\n--- Groq returned error status.")
    sys.exit(4)
except Exception as e:
    print("Exception while calling Groq:", repr(e))
    sys.exit(5)
