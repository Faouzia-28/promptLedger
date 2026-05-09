# 🚀 START HERE: AWS Deployment

Welcome! You're 3 simple steps away from having PromptLedger live on AWS.

## Step 1: Choose Your Guide

**Option A: I want copy-paste commands (fastest)**
→ Open: `deploy/QUICK_START_CHECKLIST.md`
- Print it out
- Follow each checkbox
- ~1 hour total

**Option B: I want detailed explanations**
→ Open: `deploy/DEPLOYMENT_GUIDE_DETAILED.md`
- Read through each phase
- Understand what each command does
- ~1.5 hours total (includes learning)

**Option C: I want the full reference**
→ Open: `deploy/DEPLOYMENT_RUNBOOK.md`
- Complete architecture documentation
- Troubleshooting section
- Scaling and next steps

---

## What You'll Need Ready

1. **GitHub account** (you have this)
2. **AWS account** (need to create/verify it exists)
3. **Terraform installed** locally
4. **AWS CLI** configured with credentials
5. **SSH key** (will generate if needed)

That's it!

---

## What Gets Deployed

3 free-tier EC2 instances:
- **Frontend**: Next.js app (port 3000)
- **Backend**: FastAPI + Celery + PostgreSQL (port 8000)
- **Logs**: ELK Stack for centralized logging (port 5601 Kibana)

All in Singapore region, all within AWS free-tier limits.

**Monthly cost: $0**

---

## Timeline

| Phase | Time |
|-------|------|
| Pre-flight checks | 5 min |
| GitHub OAuth setup | 5 min |
| Terraform config | 5 min |
| AWS deployment | 15 min |
| Instance startup | 10-15 min |
| Configuration | 10 min |
| Testing | 10 min |
| GitHub Actions | 5 min |
| **TOTAL** | **~1 hour** |

---

## Key Files

All deployment files are in `deploy/`:

```
deploy/
├── QUICK_START_CHECKLIST.md       ← Start here if in a hurry
├── DEPLOYMENT_GUIDE_DETAILED.md   ← Start here for detailed steps
├── DEPLOYMENT_RUNBOOK.md          ← Reference + troubleshooting
├── DEPLOYMENT_CHECKLIST.md        ← 10-phase verification checklist
├── GITHUB_OAUTH_SETUP.md          ← GitHub app creation steps
├── GITHUB_ACTIONS_SECRETS.md      ← CI/CD secrets setup
├── backend.env.template           ← Backend environment variables
└── frontend.env.template          ← Frontend environment variables

aws/terraform/
├── main.tf                         ← AWS infrastructure (VPC, EC2, S3)
├── variables.tf                    ← Terraform input variables
├── terraform.tfvars.example        ← Fill this in with your values
├── user_data_frontend.sh           ← Frontend startup script
├── user_data_backend.sh            ← Backend startup script
└── user_data_logs.sh               ← Logs stack startup script

.github/workflows/
└── deploy.yml                      ← GitHub Actions CI/CD pipeline
```

---

## Let's Go!

### Right Now (Before Starting):

1. Make sure AWS CLI is working:
   ```
   aws sts get-caller-identity
   ```
   Should show your AWS account info.

2. Make sure Terraform is installed:
   ```
   terraform --version
   ```
   Should show version 1.0 or higher.

3. Ensure your git repo is clean:
   ```
   git status
   ```
   Should show "nothing to commit".

### Then Pick Your Path:

**Fast Track** → `deploy/QUICK_START_CHECKLIST.md`

**Learning Track** → `deploy/DEPLOYMENT_GUIDE_DETAILED.md`

---

## Questions While Deploying?

- **How do I get the GitHub OAuth credentials?**
  → See: `deploy/GITHUB_OAUTH_SETUP.md`

- **Something failed, how do I debug?**
  → See: `deploy/DEPLOYMENT_RUNBOOK.md` (Troubleshooting section)

- **How do I cleanup after testing?**
  → Run: `terraform destroy` in `aws/terraform/`

- **How do I make code changes auto-deploy?**
  → See: `deploy/GITHUB_ACTIONS_SECRETS.md`

---

## Success Looks Like:

After ~1 hour, you'll have:

✅ Frontend running at `http://FRONTEND_IP:3000`
✅ Backend running at `http://BACKEND_IP:8000`
✅ Kibana logs at `http://LOGS_IP:5601`
✅ GitHub Actions auto-deploying on push
✅ All within AWS free-tier ($0/month)

---

**Pick your guide above and get started! 🚀**
