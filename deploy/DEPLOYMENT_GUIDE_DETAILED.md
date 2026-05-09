# PromptLedger AWS Deployment - Detailed Step-by-Step Guide

## PHASE 1: Pre-Flight Checks (5 minutes)

### Step 1.1: Verify Prerequisites

```bash
# Check Terraform installed
terraform --version
# Should output: Terraform v1.x.x or higher

# Check AWS CLI installed
aws --version
# Should output: aws-cli/2.x.x

# Check Git
git --version
# Should output: git version 2.x.x

# Check AWS credentials are configured
aws sts get-caller-identity
# Should output: Account, UserId, Arn
```

**If any tool is missing:**
- Terraform: https://www.terraform.io/downloads.html
- AWS CLI: https://aws.amazon.com/cli/
- Git: https://git-scm.com/download/

### Step 1.2: Ensure Repo is Clean

```bash
cd d:\Desktop\promptledger

# Check git status
git status
# Should show: "nothing to commit, working tree clean"

# If you have uncommitted changes:
git add .
git commit -m "pre-deployment checkpoint"
```

### Step 1.3: Generate SSH Key for Deployment

```bash
# Generate SSH key (if you don't already have one)
ssh-keygen -t rsa -b 4096 -f "$HOME/.ssh/promptledger_deploy" -N ""

# Verify key was created
ls -la ~/.ssh/promptledger_deploy*
# Should show: promptledger_deploy (private key), promptledger_deploy.pub (public key)

# Copy public key to clipboard (you'll add it to Terraform)
cat ~/.ssh/promptledger_deploy.pub
```

---

## PHASE 2: Create GitHub OAuth App (5 minutes)

### Step 2.1: Create GitHub OAuth Application

1. Go to: https://github.com/settings/developers
2. Click **"New OAuth App"** button
3. Fill in the form:
   - **Application name**: `PromptLedger`
   - **Homepage URL**: `http://localhost:3000` (we'll update this later)
   - **Application description**: `Demo app for prompt ledger`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback` (we'll update after deployment)
4. Click **"Register application"**

### Step 2.2: Copy OAuth Credentials

- Copy **Client ID** (e.g., `abc123def456`)
- Click **"Generate a new client secret"**
- Copy **Client Secret** (e.g., `gho_xxx...`)

**Save these in a safe place** — you'll need them in a moment.

---

## PHASE 3: Prepare Terraform Configuration (5 minutes)

### Step 3.1: Setup Terraform Directory

```bash
cd d:\Desktop\promptledger\aws\terraform

# Verify files exist
ls -la
# Should see: main.tf, variables.tf, terraform.tfvars.example, user_data_*.sh
```

### Step 3.2: Create terraform.tfvars

```bash
# Copy example to actual config
Copy-Item terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
notepad terraform.tfvars
```

Replace the placeholders with:
```hcl
aws_region             = "ap-southeast-1"
environment            = "dev"
project_name           = "promptledger"
instance_type          = "t2.micro"
ssh_cidr_blocks        = ["0.0.0.0/0"]

# Replace with your GitHub OAuth credentials
github_client_id       = "YOUR_GITHUB_CLIENT_ID_HERE"
github_client_secret   = "YOUR_GITHUB_CLIENT_SECRET_HERE"
```

**Save the file.**

### Step 3.3: Verify Terraform Configuration

```bash
# Check syntax
terraform fmt -check

# Validate configuration
terraform validate
# Should output: "Success! The configuration is valid."
```

---

## PHASE 4: Deploy AWS Infrastructure (15-20 minutes)

### Step 4.1: Initialize Terraform

```bash
# Download provider plugins
terraform init
# Should output: "Terraform has been successfully configured!"
```

### Step 4.2: Review Deployment Plan

```bash
# Generate and review the plan
terraform plan -out=tfplan

# Review output — you should see:
# - aws_vpc
# - aws_subnet
# - aws_internet_gateway
# - aws_security_group (x3: frontend, backend, logs)
# - aws_s3_bucket
# - aws_instance (x3: frontend, backend, logs)
# - aws_iam_role
# - etc.

# Confirm plan looks correct before applying
```

### Step 4.3: Deploy Infrastructure

```bash
# Apply the plan (this will create all AWS resources)
terraform apply tfplan

# Wait 2-3 minutes for creation...
# You should see output like:
# aws_vpc.main: Creating...
# aws_instance.logs: Creating...
# aws_instance.backend: Creating...
# aws_instance.frontend: Creating...
# Apply complete! Resources: 20 added, 0 changed, 0 destroyed.
```

### Step 4.4: Capture Output Values

After `terraform apply` completes, Terraform will output:

```
Outputs:

backend_ip = "54.x.x.x"
backend_url = "http://54.x.x.x:8000"
frontend_ip = "54.y.y.y"
frontend_url = "http://54.y.y.y:3000"
kibana_url = "http://54.z.z.z:5601"
logs_ip = "54.z.z.z"
s3_bucket_name = "promptledger-uploads-dev-123456789012"
```

**Copy these IPs and URLs to a text file** — you'll need them for all the following steps.

```bash
# Get outputs anytime with:
terraform output -json > deployment_info.json
cat deployment_info.json
```

---

## PHASE 5: Wait for Instance Initialization (10-15 minutes)

The EC2 instances are now running, but the user_data scripts are still setting them up. **Wait at least 10 minutes** before proceeding.

### Step 5.1: Monitor Instance Startup

```bash
# Check instance status
aws ec2 describe-instances \
  --region ap-southeast-1 \
  --query 'Reservations[].Instances[].{Name:Tags[?Key==`Name`]|[0].Value, Status:State.Name, IP:PublicIpAddress}' \
  --output table

# Should show Status: "running" for all 3 instances
```

### Step 5.2: SSH into Backend Instance to Check Initialization

```bash
# SSH into backend instance (replace IP with your backend_ip)
ssh -i ~/.ssh/promptledger_deploy ubuntu@54.x.x.x

# Check if initialization is complete
tail -f /var/log/user-data.log
# Keep watching until you see: "Backend init completed at..."
# (Press Ctrl+C to exit)
```

Once you see "completed", the instance is ready. Proceed to next phase.

---

## PHASE 6: Verify Instance Health (5 minutes)

### Step 6.1: Backend Health Check

```bash
# Test backend API is running
curl http://54.x.x.x:8000/health
# Should return: {"status":"ok"}

# Test metrics endpoint
curl http://54.x.x.x:8000/metrics
# Should return: Prometheus metrics (lots of lines starting with #)
```

### Step 6.2: Frontend Accessibility

```bash
# Test frontend is running
curl http://54.y.y.y:3000
# Should return: HTML content (Next.js app)
```

### Step 6.3: Kibana Dashboard

Open in browser:
```
http://54.z.z.z:5601
```

You should see the Kibana welcome page.

---

## PHASE 7: Update GitHub OAuth Callback URL (2 minutes)

Now that you have the frontend IP, update the GitHub OAuth app:

1. Go to: https://github.com/settings/developers
2. Click on your **"PromptLedger"** app
3. Update **Authorization callback URL** to:
   ```
   http://54.y.y.y:3000/api/auth/github/callback
   ```
4. Click **"Update application"**

---

## PHASE 8: Configure Backend Instance (5 minutes)

### Step 8.1: SSH into Backend Instance

```bash
ssh -i ~/.ssh/promptledger_deploy ubuntu@54.x.x.x
```

### Step 8.2: Verify Environment File

```bash
# Check if .env was created by user_data script
cd /opt/promptledger/backend
cat .env | head -20
# Should show: SECRET_KEY, DATABASE_URL, REDIS_URL, etc.
```

### Step 8.3: Configure Database (PostgreSQL Locally)

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql-15

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE promptledger_db;
CREATE USER promptledger WITH PASSWORD 'password';
ALTER ROLE promptledger SET client_encoding TO 'utf8';
ALTER ROLE promptledger SET default_transaction_isolation TO 'read committed';
ALTER ROLE promptledger SET default_transaction_deferrable TO on;
ALTER ROLE promptledger SET default_transaction_level TO 'read committed';
ALTER USER promptledger SUPERUSER;
GRANT ALL PRIVILEGES ON DATABASE promptledger_db TO promptledger;
EOF

# Verify database was created
sudo -u postgres psql -l | grep promptledger_db
```

### Step 8.4: Update Backend Environment

```bash
# Edit .env to ensure PostgreSQL connection is correct
nano backend/.env
```

Find and update:
```
DATABASE_URL=postgresql+asyncpg://promptledger:password@localhost:5432/promptledger_db
```

**Save (Ctrl+X, Y, Enter)**

### Step 8.5: Run Database Migrations

```bash
# Activate Python environment
source venv/bin/activate

# Run Alembic migrations
alembic upgrade head
# Should output: "Done. Target database is at migration [timestamp]."
```

### Step 8.6: Restart Backend Services

```bash
# Restart all services
pm2 restart all
pm2 logs
# Should show: "promptledger-api", "promptledger-celery", "promptledger-beat" all started
```

Press **Ctrl+C** to exit logs.

### Step 8.7: Exit Backend Instance

```bash
exit
```

---

## PHASE 9: Configure Frontend Instance (5 minutes)

### Step 9.1: SSH into Frontend Instance

```bash
ssh -i ~/.ssh/promptledger_deploy ubuntu@54.y.y.y
```

### Step 9.2: Create Frontend Environment File

```bash
cd /opt/promptledger/frontend

# Create .env.local with backend IP
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://54.x.x.x:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://54.x.x.x:8000
EOF
```

Replace `54.x.x.x` with your **backend_ip**.

### Step 9.3: Rebuild Frontend

```bash
# Install dependencies
npm ci

# Build with new environment
NEXT_PUBLIC_API_URL=http://54.x.x.x:8000/api/v1 npm run build
# This will take 2-3 minutes...
```

### Step 9.4: Restart Frontend Service

```bash
# Restart with PM2
pm2 restart promptledger-frontend
pm2 logs promptledger-frontend
# Should show: "ready - started server on ..."
```

Press **Ctrl+C** to exit.

### Step 9.5: Exit Frontend Instance

```bash
exit
```

---

## PHASE 10: Setup Kibana Dashboard (2 minutes)

### Step 10.1: Open Kibana

Open in browser: `http://54.z.z.z:5601`

### Step 10.2: Create Index Pattern

1. Click **"Management"** (gear icon on left)
2. Click **"Stack Management"**
3. Click **"Index Patterns"**
4. Click **"Create index pattern"**
5. In the text box, enter: `logs-*`
6. Click **"Next step"**
7. In **"Time field"**, select `@timestamp`
8. Click **"Create index pattern"**

Now you can view backend logs in Kibana.

---

## PHASE 11: End-to-End Testing (10 minutes)

### Step 11.1: Test Frontend Application

Open in browser: `http://54.y.y.y:3000`

You should see the PromptLedger login page.

### Step 11.2: Sign In with GitHub

1. Click **"Sign in with GitHub"**
2. You'll be redirected to GitHub OAuth consent screen
3. Click **"Authorize [your-app]"**
4. You should be redirected back to the app (now logged in)

### Step 11.3: Create a Behavior Unit

1. Click **"New Unit"**
2. Fill in:
   - **Unit Name**: `test-unit`
   - **Description**: `Test unit`
3. Click **"Create"**

You should see the new unit in your dashboard.

### Step 11.4: Verify Backend Logging

1. Open Kibana: `http://54.z.z.z:5601`
2. Go to **"Discover"**
3. You should see structured logs from your unit creation
4. Filter by `logger: "app.api.units"` or `level: "INFO"`

### Step 11.5: Check Backend Metrics

Open: `http://54.x.x.x:8000/metrics`

You should see Prometheus metrics like:
```
# HELP fastapi_requests_total Total requests
# TYPE fastapi_requests_total counter
fastapi_requests_total{method="GET",path_template="/api/v1/units",status_code="200"} 1.0
```

---

## PHASE 12: Setup GitHub Actions for Automated Deployment (5 minutes)

### Step 12.1: Add GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/promptledger/settings/secrets/actions`

Click **"New repository secret"** and add these secrets one by one:

**Secret 1: AWS_PRIVATE_KEY**
```
Name: AWS_PRIVATE_KEY
Value: (paste the contents of ~/.ssh/promptledger_deploy — the PRIVATE key)
```

**Secret 2: BACKEND_INSTANCE_IP**
```
Name: BACKEND_INSTANCE_IP
Value: 54.x.x.x
```

**Secret 3: FRONTEND_INSTANCE_IP**
```
Name: FRONTEND_INSTANCE_IP
Value: 54.y.y.y
```

**Secret 4: API_URL**
```
Name: API_URL
Value: http://54.x.x.x:8000/api/v1
```

**Secret 5: AWS_ROLE_ARN** (optional, for advanced CI/CD)
```
Name: AWS_ROLE_ARN
Value: arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/deploy-role
# Get YOUR_AWS_ACCOUNT_ID from: aws sts get-caller-identity --query Account
```

### Step 12.2: Test GitHub Actions

Push a test commit:
```bash
cd d:\Desktop\promptledger
git add .
git commit -m "trigger deployment"
git push origin main
```

Watch the deployment:
1. Go to: `https://github.com/YOUR_USERNAME/promptledger/actions`
2. Click the workflow run
3. Watch the build, test, and deploy steps

After ~5 minutes, the deployment should complete successfully.

---

## PHASE 13: Verify Automated Deployment Worked (2 minutes)

Make a small code change to verify automation:

```bash
# Edit a file in the frontend
cd d:\Desktop\promptledger\frontend
echo "// test" >> app/layout.tsx

# Commit and push
git add .
git commit -m "test deployment automation"
git push origin main

# Check GitHub Actions tab
# After ~5 minutes, changes should be live at http://54.y.y.y:3000
```

---

## PHASE 14: Monitoring & Cleanup

### Monitor Logs Continuously

```bash
# SSH into instances and watch logs
ssh -i ~/.ssh/promptledger_deploy ubuntu@54.x.x.x
pm2 logs
```

Or use Kibana dashboard for centralized logging.

### When Done Testing: Cleanup (Optional)

```bash
# Destroy all AWS resources
cd d:\Desktop\promptledger\aws\terraform
terraform destroy

# Confirm: type "yes"
# All EC2 instances, VPC, S3, security groups will be deleted
# This stops any potential AWS charges
```

---

## 🎉 Success!

Your app is now:
- ✅ Deployed on 3 AWS free-tier EC2 instances
- ✅ Running Next.js frontend
- ✅ Running FastAPI backend with Celery
- ✅ Collecting logs in ELK stack
- ✅ Auto-deploying on git push via GitHub Actions

**Total deployment time**: 45-60 minutes  
**Monthly AWS cost**: $0 (within free-tier)

---

## Quick Reference URLs

After deployment, bookmark these:

| Service | URL |
|---------|-----|
| **Frontend App** | http://54.y.y.y:3000 |
| **Backend API** | http://54.x.x.x:8000/api/v1 |
| **API Health** | http://54.x.x.x:8000/health |
| **Metrics** | http://54.x.x.x:8000/metrics |
| **Kibana Logs** | http://54.z.z.z:5601 |
| **GitHub Actions** | https://github.com/YOUR_USERNAME/promptledger/actions |

---

## Troubleshooting

See `DEPLOYMENT_RUNBOOK.md` for common issues.

---

**Ready to start? Begin with PHASE 1.**
