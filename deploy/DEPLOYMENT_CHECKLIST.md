# AWS Deployment Checklist

## Phase 1: Pre-Deployment Setup (Do This First)

- [ ] Create AWS account (or use existing account)
- [ ] Create GitHub OAuth app (https://github.com/settings/developers)
  - Copy Client ID and Client Secret
- [ ] Generate SSH key pair for deployment
  - `ssh-keygen -t rsa -b 4096 -f deploy_key`
- [ ] Install Terraform locally (`terraform >= 1.0`)
- [ ] Configure AWS CLI (`aws configure`)
- [ ] Clone repo locally and ensure all changes are committed to main branch

## Phase 2: Infrastructure Deployment (10-15 minutes)

1. **Prepare Terraform**
   - [ ] Copy `aws/terraform/terraform.tfvars.example` to `terraform.tfvars`
   - [ ] Fill in terraform.tfvars:
     ```hcl
     github_client_id       = "YOUR_GITHUB_CLIENT_ID"
     github_client_secret   = "YOUR_GITHUB_CLIENT_SECRET"
     aws_region             = "ap-southeast-1"  # Singapore (free-tier eligible)
     ssh_cidr_blocks        = ["YOUR_IP/32"]    # Your public IP for SSH
     ```

2. **Validate and Deploy**
   ```bash
   cd aws/terraform
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```
   
   - Terraform will create:
     - [ ] VPC + Subnet + Internet Gateway
     - [ ] 3 EC2 instances (frontend, backend, logs) - t2.micro free-tier
     - [ ] S3 bucket for file uploads
     - [ ] IAM roles and security groups
     - [ ] Outputs: IP addresses, URLs, S3 bucket name

3. **Wait for Initialization**
   - [ ] Wait 5-10 minutes for EC2 user_data scripts to complete
   - [ ] Monitor logs: `tail -f /var/log/user-data.log` on each instance (via SSH)

## Phase 3: Verification (Smoke Tests)

1. **Backend Health Check**
   ```bash
   curl http://<BACKEND_IP>:8000/health
   # Should return: {"status": "ok"}
   ```

2. **Frontend Accessibility**
   ```bash
   curl http://<FRONTEND_IP>:3000
   # Should return HTML with Next.js app
   ```

3. **Kibana Dashboard**
   - [ ] Open browser: `http://<LOGS_IP>:5601`
   - [ ] Create index pattern: `logs-*`
   - [ ] View backend logs in Kibana

## Phase 4: Configuration

1. **Frontend Environment Setup**
   ```bash
   ssh -i deploy_key ubuntu@<FRONTEND_IP>
   cd /opt/promptledger/frontend
   nano .env.local
   # Add:
   NEXT_PUBLIC_API_URL=http://<BACKEND_IP>:8000/api/v1
   NEXT_PUBLIC_WS_URL=ws://<BACKEND_IP>:8000
   npm run build
   pm2 restart promptledger-frontend
   ```

2. **Backend Database Setup**
   ```bash
   ssh -i deploy_key ubuntu@<BACKEND_IP>
   
   # Option A: PostgreSQL locally
   sudo apt-get install -y postgresql-15
   sudo systemctl start postgresql
   sudo -u postgres createdb promptledger_db
   
   # Option B: Use managed RDS (better for production)
   # Create RDS instance in AWS Console and update DATABASE_URL in .env
   
   # Run migrations
   cd /opt/promptledger/backend
   source venv/bin/activate
   alembic upgrade head
   
   # Edit .env with DB connection
   nano .env
   # Restart services
   pm2 restart all
   ```

## Phase 5: End-to-End Testing

- [ ] Open frontend in browser: `http://<FRONTEND_IP>:3000`
- [ ] Click "Sign in with GitHub"
- [ ] Verify GitHub OAuth redirect and login
- [ ] Create a new behavior unit
- [ ] View dashboard and alerts
- [ ] Check Kibana for structured logs: `http://<LOGS_IP>:5601`

## Phase 6: CI/CD Setup (GitHub Actions)

1. **Add GitHub Secrets**
   - [ ] Go to: https://github.com/YOUR_USERNAME/promptledger/settings/secrets/actions
   - [ ] Add secrets (see `deploy/GITHUB_ACTIONS_SECRETS.md`):
     - `AWS_ROLE_ARN`
     - `AWS_PRIVATE_KEY` (base64 encoded)
     - `BACKEND_INSTANCE_IP`
     - `FRONTEND_INSTANCE_IP`
     - `API_URL`
     - `SLACK_WEBHOOK` (optional)

2. **Test Deployment Pipeline**
   - [ ] Push a commit to main branch
   - [ ] Watch GitHub Actions tab for workflow execution
   - [ ] Verify deployment completed successfully
   - [ ] Check instances for updated code: `cd /opt/promptledger && git log --oneline -1`

## Phase 7: Monitoring & Alerts

- [ ] Set up CloudWatch alarms for:
  - [ ] High CPU usage on any instance
  - [ ] Low disk space
  - [ ] Network issues
  
- [ ] Configure Slack alerts (optional):
  - [ ] Backend errors and exceptions
  - [ ] Deployment notifications
  - [ ] Health check failures

## Phase 8: Backup & Disaster Recovery

- [ ] Enable EBS snapshots for data persistence
- [ ] Set up daily database backups:
  ```bash
  # On backend instance
  cd /opt/promptledger/backend
  ./scripts/backup_restore.ps1 -Action Backup
  ```

- [ ] Store backups in S3:
  ```bash
  aws s3 cp backup.sql s3://promptledger-uploads-dev-<account>/backups/
  ```

## Phase 9: Security Hardening (Optional, for Production)

- [ ] Enable HTTPS with SSL certificate (ACM + ALB)
- [ ] Add AWS WAF for DDoS protection
- [ ] Enable VPC Flow Logs for network monitoring
- [ ] Rotate SSH keys and secrets regularly
- [ ] Restrict SSH access to specific IPs (update `ssh_cidr_blocks`)

## Phase 10: Cleanup (When Done Testing)

```bash
cd aws/terraform
terraform destroy
# Confirm destruction of all resources
```

---

## Quick Reference URLs

After deployment, bookmark these:

- **Frontend App**: http://<FRONTEND_IP>:3000
- **Backend API**: http://<BACKEND_IP>:8000/api/v1
- **API Health**: http://<BACKEND_IP>:8000/health
- **API Metrics**: http://<BACKEND_IP>:8000/metrics
- **Kibana Dashboard**: http://<LOGS_IP>:5601
- **GitHub Actions**: https://github.com/YOUR_USERNAME/promptledger/actions

## Troubleshooting

See `DEPLOYMENT_RUNBOOK.md` for common issues and solutions.

---

**Total Deployment Time**: 30-45 minutes from start to end-to-end testing
**Monthly AWS Free-Tier Cost**: $0 (within 12-month free tier)
