# GitHub Actions Secrets Setup Guide

Add these secrets to your GitHub repository settings (`https://github.com/your-username/promptledger/settings/secrets/actions`):

## AWS / SSH Configuration

- **AWS_PRIVATE_KEY**: Private key for SSH access to EC2 instances
  - Generate locally: `ssh-keygen -t rsa -b 4096 -f deploy_key`
  - Copy the private key content into the GitHub secret value
  - Add the public key to your Terraform / instance bootstrap as needed

## Instance Configuration

- **BACKEND_INSTANCE_IP**: Public IP of backend EC2 instance
  - Get from Terraform output: `terraform output backend_ip`
  - Update after each deployment

- **FRONTEND_INSTANCE_IP**: Public IP of frontend EC2 instance
  - Get from Terraform output: `terraform output frontend_ip`

## API Configuration

- **API_URL**: Backend API URL for frontend environment
  - Format: `http://BACKEND_INSTANCE_IP:8000/api/v1`
  - Example: `http://54.x.x.x:8000/api/v1`

## Notifications

- **SLACK_WEBHOOK**: Slack webhook URL for deployment notifications
  - Create at: https://api.slack.com/messaging/webhooks
  - Format: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX`

## GitHub OAuth (Optional, for secrets manager integration)

- **GITHUB_CLIENT_ID**: GitHub OAuth client ID
- **GITHUB_CLIENT_SECRET**: GitHub OAuth client secret

## Setup Instructions

1. Generate SSH key pair:
   ```bash
   ssh-keygen -t rsa -b 4096 -f deploy_key
   cat deploy_key | base64  # Copy to clipboard
   ```

2. Add to GitHub Secrets:
  - Go to: https://github.com/YOUR_USERNAME/promptledger/settings/secrets/actions
  - Click "New repository secret"
  - Add each secret above

3. After each `terraform apply`, update:
   - BACKEND_INSTANCE_IP
   - FRONTEND_INSTANCE_IP

4. Test the workflow:
   - Push a commit to main branch
   - Watch GitHub Actions tab for workflow execution
