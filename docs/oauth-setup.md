# OAuth Provider Setup

HornEval supports three OAuth providers: Google, GitHub, and HuggingFace. This guide covers how to configure each provider for production deployment.

## Prerequisites

- GCP project with Secret Manager enabled
- Cloud Run service deployed and accessible
- Custom domain configured (e.g., `eval.lesan.ai`)

## 1. Google OAuth

### Create OAuth Client

1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ Create Credentials** > **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User type: **External**
   - App name, support email, developer email
   - Authorized domain: `lesan.ai` (top-level private domain, not `eval.lesan.ai`)
4. Application type: **Web application**
5. Name: `HornEval`
6. **Authorized JavaScript origins**: `https://eval.lesan.ai`
7. **Authorized redirect URIs**: `https://eval.lesan.ai/api/auth/callback/google`
8. Click **Create** and copy the Client ID and Client Secret

### Store Secrets

```bash
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets versions add GOOGLE_CLIENT_ID --data-file=- --project=lesan-api
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | gcloud secrets versions add GOOGLE_CLIENT_SECRET --data-file=- --project=lesan-api
```

## 2. GitHub OAuth

### Create OAuth App

1. Go to your GitHub **organization** settings: `https://github.com/organizations/YOUR_ORG/settings/applications`
   - Use the organization-level app, not personal account (`github.com/settings/developers`)
2. Click **New OAuth App**
3. **Application name**: `HornEval`
4. **Homepage URL**: `https://eval.lesan.ai`
5. **Authorization callback URL**: `https://eval.lesan.ai/api/auth/callback/github`
6. **Enable Device Flow**: No (not needed for web apps)
7. Click **Register application** and copy the Client ID
8. Click **Generate a new client secret** and copy it

### Store Secrets

```bash
echo -n "YOUR_GITHUB_CLIENT_ID" | gcloud secrets versions add GITHUB_CLIENT_ID --data-file=- --project=lesan-api
echo -n "YOUR_GITHUB_CLIENT_SECRET" | gcloud secrets versions add GITHUB_CLIENT_SECRET --data-file=- --project=lesan-api
```

## 3. HuggingFace OAuth

### Create OAuth App

1. Go to [HuggingFace > Settings > Connected Applications](https://huggingface.co/settings/connected-applications)
   - HuggingFace does not support organization-level OAuth apps; use a personal account
2. Create a new OAuth application
3. **Redirect URI**: `https://eval.lesan.ai/api/auth/callback/huggingface`
4. Copy the Client ID and Client Secret

### Store Secrets

```bash
echo -n "YOUR_HF_CLIENT_ID" | gcloud secrets versions add HUGGINGFACE_CLIENT_ID --data-file=- --project=lesan-api
echo -n "YOUR_HF_CLIENT_SECRET" | gcloud secrets versions add HUGGINGFACE_CLIENT_SECRET --data-file=- --project=lesan-api
```

## 4. Grant Cloud Run Access to Secrets

Each new secret needs IAM permissions for the Cloud Run service account:

```bash
for SECRET in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET HUGGINGFACE_CLIENT_ID HUGGINGFACE_CLIENT_SECRET; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=lesan-api \
    --quiet
done
```

Replace `PROJECT_NUMBER` with your GCP project number (e.g., `233044980565`).

## 5. Deploy

Secrets are injected at runtime via `--set-secrets` in `cloudbuild.yaml`. After updating any secret, redeploy to pick up the new values:

```bash
gcloud builds submit --config=cloudbuild.yaml --project=lesan-api --substitutions=SHORT_SHA=$(git rev-parse --short HEAD)
```

Or deploy the existing image with updated secrets:

```bash
gcloud run deploy horneval \
  --image=europe-west3-docker.pkg.dev/lesan-api/horneval-repo/horneval:latest \
  --region=europe-west3 \
  --project=lesan-api \
  --set-secrets=BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest,BETTER_AUTH_URL=BETTER_AUTH_URL:latest,MONGODB_URI=MONGODB_URI:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GITHUB_CLIENT_ID=GITHUB_CLIENT_ID:latest,GITHUB_CLIENT_SECRET=GITHUB_CLIENT_SECRET:latest,HUGGINGFACE_CLIENT_ID=HUGGINGFACE_CLIENT_ID:latest,HUGGINGFACE_CLIENT_SECRET=HUGGINGFACE_CLIENT_SECRET:latest,LESAN_API_URL=LESAN_API_URL:latest,LESAN_API_KEY=LESAN_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars=APP_NAME=HornEval,APP_VERSION=0.1.0,APP_DESCRIPTION=Human\ Evaluation\ Platform,MONGODB_DB=horneval
```

## Important Notes

- **BETTER_AUTH_URL** must match the domain users access the app from. If users visit `https://eval.lesan.ai`, the secret must be `https://eval.lesan.ai` — not the Cloud Run URL. A mismatch causes `Invalid origin` errors (HTTP 403).
- **Authorized domain** in Google OAuth consent screen must be the top-level private domain (`lesan.ai`), not a subdomain.
- All callback URLs follow the pattern: `https://eval.lesan.ai/api/auth/callback/{provider}`
- Providers are conditionally enabled in `src/lib/auth.ts` — if the client ID/secret env vars are missing, that provider is silently disabled.
