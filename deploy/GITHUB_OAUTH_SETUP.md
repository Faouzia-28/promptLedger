# GitHub OAuth Setup Guide

## Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: PromptLedger (or your app name)
   - **Homepage URL**: `http://your-frontend-ip:3000` (or your domain)
   - **Authorization callback URL**: `http://your-frontend-ip:3000/api/auth/github/callback`
4. Copy the **Client ID** and **Client Secret**

## Step 2: Store in Terraform Variables

In `aws/terraform/terraform.tfvars`:
```hcl
github_client_id       = "your-client-id-here"
github_client_secret   = "your-client-secret-here"
```

## Step 3: Update Backend Endpoints

The backend should have these OAuth endpoints configured in `backend/app/api/auth.py`:

- `POST /api/v1/auth/login/github`: Initiates GitHub OAuth flow
- `POST /api/v1/auth/callback/github`: Handles GitHub OAuth callback
- These are auto-configured if `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set

## Step 4: Test Flow

1. Frontend visits `/login` page
2. User clicks "Sign in with GitHub"
3. Redirects to GitHub OAuth consent screen
4. After approval, redirects back to callback URL with auth code
5. Backend exchanges code for access token
6. Backend creates/updates user and returns JWT
7. Frontend stores JWT in localStorage and uses for API requests

## Security Notes

- **Never commit secrets** to version control
- Use GitHub's environment secrets for CI/CD
- Rotate secrets regularly
- Use HTTPS in production (SSL certificate on ALB or instance)
- Restrict callback URL to exact domain
