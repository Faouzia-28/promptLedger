# Quick Start Checklist (Copy & Paste Version)

Print this out and check off as you go. **Total time: ~1 hour**

---

## ✅ PRE-FLIGHT (5 min)

- [ ] Verify Terraform: `terraform --version`
- [ ] Verify AWS CLI: `aws --version` & `aws sts get-caller-identity`
- [ ] Git is clean: `git status` (should be "working tree clean")
- [ ] Generate SSH key:
  ```
  ssh-keygen -t rsa -b 4096 -f "$HOME/.ssh/promptledger_deploy" -N ""
  ```
- [ ] Save SSH public key path: `~/.ssh/promptledger_deploy.pub`

---

## ✅ GITHUB OAUTH (5 min)

- [ ] Go to: https://github.com/settings/developers
- [ ] Click "New OAuth App"
- [ ] Fill form:
  - Name: `PromptLedger`
  - Homepage: `http://localhost:3000`
  - Callback: `http://localhost:3000/api/auth/github/callback`
- [ ] Copy **Client ID**: `_______________`
- [ ] Copy **Client Secret**: `_______________`

---

## ✅ TERRAFORM SETUP (5 min)

- [ ] Navigate: `cd d:\Desktop\promptledger\aws\terraform`
- [ ] Copy config: `Copy-Item terraform.tfvars.example terraform.tfvars`
- [ ] Edit: `notepad terraform.tfvars`
- [ ] Fill in:
  ```
  github_client_id       = "YOUR_CLIENT_ID"
  github_client_secret   = "YOUR_CLIENT_SECRET"
  aws_region             = "ap-southeast-1"
  instance_type          = "t2.micro"
  ssh_cidr_blocks        = ["0.0.0.0/0"]
  ```
- [ ] Validate: `terraform validate`

---

## ✅ DEPLOY AWS (15-20 min)

- [ ] Initialize: `terraform init`
- [ ] Plan: `terraform plan -out=tfplan`
- [ ] Review plan output (look for 3 EC2 instances, VPC, S3)
- [ ] Deploy: `terraform apply tfplan`
- [ ] Wait for: "Apply complete! Resources: 20 added..."
- [ ] **COPY THESE OUTPUTS TO A TEXT FILE:**
  - Frontend IP: `__________________`
  - Backend IP: `__________________`
  - Logs IP: `__________________`
  - S3 Bucket: `__________________`

---

## ✅ WAIT FOR STARTUP (10-15 min)

- [ ] **WAIT AT LEAST 10 MINUTES** before proceeding
- [ ] Check instance status:
  ```
  aws ec2 describe-instances --region ap-southeast-1 \
    --query 'Reservations[].Instances[].{Name:Tags[?Key==`Name`]|[0].Value, Status:State.Name}' \
    --output table
  ```
- [ ] All should show `running`
- [ ] Check backend initialization:
  ```
  ssh -i ~/.ssh/promptledger_deploy ubuntu://BACKEND_IP
  tail -f /var/log/user-data.log
  # Wait for: "Backend init completed at..."
  exit
  ```

---

## ✅ VERIFY INSTANCES (5 min)

- [ ] Backend health: `curl http://BACKEND_IP:8000/health`
  - Expected: `{"status":"ok"}`
- [ ] Backend metrics: `curl http://BACKEND_IP:8000/metrics`
  - Expected: Prometheus output
- [ ] Frontend: `curl http://FRONTEND_IP:3000`
  - Expected: HTML content
- [ ] Kibana: Open `http://LOGS_IP:5601`
  - Expected: Kibana welcome page

---

## ✅ UPDATE GITHUB OAUTH (2 min)

- [ ] Go to: https://github.com/settings/developers
- [ ] Click your "PromptLedger" app
- [ ] Update **Authorization callback URL** to:
  ```
  http://FRONTEND_IP:3000/api/auth/github/callback
  ```
- [ ] Click "Update application"

---

## ✅ CONFIGURE BACKEND (5 min)

- [ ] SSH: `ssh -i ~/.ssh/promptledger_deploy ubuntu@BACKEND_IP`
- [ ] Install PostgreSQL:
  ```
  sudo apt-get update && sudo apt-get install -y postgresql-15
  sudo systemctl start postgresql
  ```
- [ ] Create database:
  ```
  sudo -u postgres psql << EOF
  CREATE DATABASE promptledger_db;
  CREATE USER promptledger WITH PASSWORD 'password';
  ALTER USER promptledger SUPERUSER;
  GRANT ALL PRIVILEGES ON DATABASE promptledger_db TO promptledger;
  EOF
  ```
- [ ] Update .env: `nano backend/.env`
  - Ensure: `DATABASE_URL=postgresql+asyncpg://promptledger:password@localhost:5432/promptledger_db`
- [ ] Run migrations:
  ```
  cd /opt/promptledger/backend
  source venv/bin/activate
  alembic upgrade head
  ```
- [ ] Restart: `pm2 restart all`
- [ ] Exit: `exit`

---

## ✅ CONFIGURE FRONTEND (5 min)

- [ ] SSH: `ssh -i ~/.ssh/promptledger_deploy ubuntu@FRONTEND_IP`
- [ ] Create .env:
  ```
  cd /opt/promptledger/frontend
  cat > .env.local << EOF
  NEXT_PUBLIC_API_URL=http://BACKEND_IP:8000/api/v1
  NEXT_PUBLIC_WS_URL=ws://BACKEND_IP:8000
  EOF
  ```
- [ ] Rebuild:
  ```
  npm ci
  NEXT_PUBLIC_API_URL=http://BACKEND_IP:8000/api/v1 npm run build
  ```
- [ ] Restart: `pm2 restart promptledger-frontend`
- [ ] Exit: `exit`

---

## ✅ KIBANA SETUP (2 min)

- [ ] Open: `http://LOGS_IP:5601`
- [ ] Click "Management" (gear icon)
- [ ] Click "Stack Management"
- [ ] Click "Index Patterns"
- [ ] Click "Create index pattern"
- [ ] Enter: `logs-*`
- [ ] Click "Next step"
- [ ] Select Time field: `@timestamp`
- [ ] Click "Create index pattern"

---

## ✅ END-TO-END TEST (10 min)

- [ ] Open frontend: `http://FRONTEND_IP:3000`
- [ ] Click "Sign in with GitHub"
- [ ] Authorize app in GitHub OAuth screen
- [ ] Should be logged in
- [ ] Create a unit:
  - [ ] Click "New Unit"
  - [ ] Fill: Name = `test-unit`
  - [ ] Click "Create"
- [ ] Check Kibana logs:
  - [ ] Open `http://LOGS_IP:5601`
  - [ ] Go to "Discover"
  - [ ] Should see structured logs
- [ ] Check metrics: `curl http://BACKEND_IP:8000/metrics`

---

## ✅ GITHUB ACTIONS SETUP (5 min)

- [ ] Go to: https://github.com/YOUR_USERNAME/promptledger/settings/secrets/actions
- [ ] Add secrets (click "New repository secret" each time):
  - [ ] `AWS_PRIVATE_KEY` = contents of `~/.ssh/promptledger_deploy`
  - [ ] `BACKEND_INSTANCE_IP` = BACKEND_IP
  - [ ] `FRONTEND_INSTANCE_IP` = FRONTEND_IP
  - [ ] `API_URL` = `http://BACKEND_IP:8000/api/v1`

---

## ✅ TEST AUTOMATED DEPLOYMENT (5 min)

- [ ] Push test commit:
  ```
  cd d:\Desktop\promptledger
  git add .
  git commit -m "trigger deployment"
  git push origin main
  ```
- [ ] Watch: https://github.com/YOUR_USERNAME/promptledger/actions
- [ ] Should see workflow running
- [ ] After ~5 min: should complete with ✅

---

## 🎉 YOU'RE DONE!

**Your app is live!**

### Bookmark these URLs:
- Frontend: `http://FRONTEND_IP:3000`
- Backend: `http://BACKEND_IP:8000/api/v1`
- Kibana: `http://LOGS_IP:5601`
- Health: `http://BACKEND_IP:8000/health`
- Metrics: `http://BACKEND_IP:8000/metrics`

### Next steps:
- [ ] Test the app thoroughly
- [ ] Make a code change and verify GitHub Actions auto-deploys
- [ ] Monitor logs in Kibana
- [ ] Add custom domain (optional)
- [ ] Setup SSL certificate (optional)

### When done (cleanup):
```
cd d:\Desktop\promptledger\aws\terraform
terraform destroy
# Type: yes
```

---

**Questions?** See `DEPLOYMENT_RUNBOOK.md` or `DEPLOYMENT_GUIDE_DETAILED.md`
