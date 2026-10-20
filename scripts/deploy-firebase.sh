#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PROJECT_ID="${PROJECT_ID:-gen-lang-client-0444960702}"
export SITE_ID="${SITE_ID:-sideb-records}"
export REGION="${REGION:-us-central1}"
export SERVICE_NAME="${SERVICE_NAME:-side-b}"
export FIRESTORE_DATABASE_ID="${FIRESTORE_DATABASE_ID:-side-b}"
RUNTIME_ACCOUNT="${RUNTIME_ACCOUNT:-side-b-runtime@$PROJECT_ID.iam.gserviceaccount.com}"
QLOO_SECRET="${QLOO_SECRET:-side-b-qloo}"
ENV_FILE="${ENV_FILE:?Set ENV_FILE to a JSON/YAML runtime configuration file. No Qloo key in this file.}"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/side-b/app:$(git rev-parse --short HEAD)"
npm run typecheck
npm test
npm run build
gcloud builds submit . --tag="$IMAGE" --project="$PROJECT_ID" --quiet
gcloud run deploy "$SERVICE_NAME" --image="$IMAGE" --project="$PROJECT_ID" --region="$REGION" --service-account="$RUNTIME_ACCOUNT" --env-vars-file="$ENV_FILE" --set-secrets="QLOO_API_KEY=$QLOO_SECRET:latest" --min-instances=0 --max-instances=2 --memory=512Mi --cpu=1 --concurrency=40 --timeout=60 --allow-unauthenticated --quiet
python3 scripts/deploy-hosting.py
