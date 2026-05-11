@echo off
set SSH=C:\Windows\System32\OpenSSH\ssh.exe
"%SSH%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -i "C:\Users\Faouzia V\.ssh\promptledger_deploy" ubuntu@54.255.141.96 "bash -lc 'set -e; sudo chown -R ubuntu:ubuntu /opt/promptledger; git config --global --add safe.directory /opt/promptledger; cd /opt/promptledger; git pull origin main; sudo docker-compose -f docker-compose.prod.yml up -d --build api; sudo docker-compose -f docker-compose.prod.yml ps; curl -sS http://127.0.0.1:8000/health'"
