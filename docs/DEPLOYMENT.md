# Deployment and authentication

The canonical app is [https://sideb-records.web.app](https://sideb-records.web.app). It uses Firebase Hosting, a native Next.js standalone server on Cloud Run, Firebase Authentication with Google sign-in, and a named Firestore database. This guide describes that deployment model and how to create an independent instance.

## What you need

- Node.js 24.12 or later and npm.
- A Google Cloud project with Firebase enabled, billing configured for Cloud Run, and permission to provision the services below.
- Google Cloud CLI and Firebase CLI authenticated to your own project.
- A Firebase Hosting site, Firebase web app and Google authentication provider.
- A Firestore Native-mode database, a Cloud Run runtime service account and a Qloo API key suitable for your intended use.

The repository’s hosting identity belongs to the canonical instance. Do not deploy into that project when self-hosting. Set your own project, site and runtime values explicitly.

## Runtime topology

| Component         | Canonical configuration                              |
| ----------------- | ---------------------------------------------------- |
| Entry point       | Firebase Hosting, `sideb-records.web.app`            |
| Application       | Cloud Run service `side-b`, region `us-central1`     |
| Runtime           | Node.js 24, native Next.js 16 standalone server      |
| Instance controls | Minimum 0, maximum 2, concurrency 40, 512 MiB memory |
| Database          | Named Firestore database `side-b`                    |
| Authentication    | Firebase Authentication, Google provider             |
| Server secrets    | Qloo key in Google Secret Manager                    |

The container listens on the platform-provided `PORT`, defaulting to 8080 in the Docker image. The service is reachable through a Hosting rewrite. Scale-to-zero controls idle cost and can introduce a cold start. Maximum instances and request quotas bound exposure; they do not make hosting or upstream requests free.

## Configure a new Firebase project

1. Create or select your own Firebase-enabled Google Cloud project. Enable Cloud Run, Artifact Registry/Cloud Build as required by your deployment method, Firestore, Firebase Authentication, Firebase Hosting and Secret Manager.
2. Create the Firestore database in Native mode. Choose a database ID and location appropriate to your app. Configure `FIRESTORE_DATABASE_ID` to match it; `side-b` is the canonical name, not a required project identifier.
3. Register a Firebase web app and save its public web configuration. Enable the Google provider and set its support email. Use your canonical Hosting domain as `FIREBASE_AUTH_DOMAIN`, authorize that domain in Firebase Authentication, and configure the Google OAuth client with the matching HTTPS JavaScript origin and `https://YOUR_HOSTING_DOMAIN/__/auth/handler` redirect URI. The canonical instance uses `sideb-records.web.app`. Authorize your chosen local domain separately if testing sign-in locally.
4. Create a Firebase Hosting site. For a new instance, use your own available site ID.
5. Create a dedicated runtime service account. Grant only the Firestore access, Firebase Authentication session/revocation permissions and Qloo-secret read access required by the server. Browser Firestore rules do not constrain Admin SDK access, so runtime IAM is a separate boundary.
6. Use deployment credentials with permission to build and deploy the service, attach the runtime service account, publish Hosting and apply the Firestore rules. These credentials should not become the application’s runtime credentials.

The checked-in `firestore.rules` deny all browser document reads and writes. Deploy these to the intended named database. App access always goes through validated server APIs; do not change these rules to public read/write to make sign-in work.

## Environment and secrets

| Name                      | Value                                                  | Visibility                                |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `APP_ORIGIN`              | Exact canonical HTTPS origin, without a trailing slash | Server configuration                      |
| `GOOGLE_CLOUD_PROJECT`    | Your Firebase/Google Cloud project ID                  | Server configuration                      |
| `FIRESTORE_DATABASE_ID`   | Your named database, for example `side-b`              | Server configuration                      |
| `FIREBASE_WEB_API_KEY`    | Firebase web app’s API key                             | Public Firebase configuration             |
| `FIREBASE_AUTH_DOMAIN`    | Authorized Firebase authentication domain              | Public Firebase configuration             |
| `FIREBASE_WEB_APP_ID`     | Firebase web app ID                                    | Public Firebase configuration             |
| `QLOO_API_KEY`            | Your Qloo API key                                      | Secret Manager, server only               |
| `QLOO_API_BASE`           | Supported Qloo API server for your key                 | Server configuration                      |
| `FIRESTORE_EMULATOR_HOST` | Local emulator host and port                           | Development/test only; omit in production |

`/api/auth/config` exposes the Firebase web configuration required by the browser SDK. These values are not a Firestore credential. Access is enforced by authentication, server validation, rules and IAM. Never expose the Qloo key through a public configuration endpoint, a `NEXT_PUBLIC_` variable or a committed file.

`APP_ORIGIN` is required in production. Mutation routes reject absent or mismatched origins, including alternate deployment URLs. Set it to the public origin users will actually visit, and test the Hosting URL rather than only the Cloud Run URL.

The supported Qloo base URLs are `https://hackathon.api.qloo.com` and `https://api.qloo.com`. Use the server your key is licensed for. A temporary development key should not be assumed suitable for indefinite commercial operation.

Add a Qloo secret version through standard input rather than a command-line argument. Attach the secret to Cloud Run as `QLOO_API_KEY` and grant the runtime service account access. Avoid putting secret values in shell history, build logs or deployment source bundles.

## Build and deploy

The repository provides `Dockerfile`, `firebase.json`, `firestore.rules` and `scripts/deploy-firebase.sh`. The helper is intended to build/deploy Cloud Run, publish the Firebase Hosting rewrite and deploy the database rules. Review the script and your selected credentials before running it.

The deployment inputs are environment variables:

```sh
export PROJECT_ID=your-firebase-project
export SITE_ID=your-hosting-site
export REGION=us-central1
export SERVICE_NAME=side-b
export FIRESTORE_DATABASE_ID=side-b
export ENV_FILE=/absolute/path/to/side-b-runtime.json
bash scripts/deploy-firebase.sh
```

`ENV_FILE` is a JSON or YAML file of Cloud Run environment variables. For example:

```json
{
  "APP_ORIGIN": "https://your-hosting-site.web.app",
  "GOOGLE_CLOUD_PROJECT": "your-firebase-project",
  "FIRESTORE_DATABASE_ID": "side-b",
  "FIREBASE_WEB_API_KEY": "your-public-firebase-web-api-key",
  "FIREBASE_AUTH_DOMAIN": "your-hosting-site.web.app",
  "FIREBASE_WEB_APP_ID": "your-public-web-app-id",
  "QLOO_API_BASE": "https://api.qloo.com"
}
```

Keep it outside committed source. It contains no Qloo key or service-account private key. Use the Qloo server corresponding to your key. The helper expects an Artifact Registry Docker repository named `side-b` in the selected region, a runtime service account and a preconfigured Qloo secret. Optional `RUNTIME_ACCOUNT` and `QLOO_SECRET` variables override the defaults `side-b-runtime@PROJECT_ID.iam.gserviceaccount.com` and `side-b-qloo`. It attaches the latest Qloo secret version.

The helper runs typechecking, module tests and a native Next.js build, builds the container through Cloud Build, deploys Cloud Run, then calls `scripts/deploy-hosting.py` to publish the Hosting rewrite and deny-all Firestore rules. Its defaults include one CPU and a 60-second request timeout. The Python helper uses the current Google Cloud CLI login; it keeps the access token in memory. A deployment success is not an authentication or full workflow test. Set all deployment identity variables explicitly when forking, even if the script has defaults for the canonical instance.

For local production-mode verification:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
```

This starts native Next.js, normally on port 3000. It still needs a configured database and origin. The Docker image instead runs `.next/standalone/server.js`; it does not use the former Sites/Vinext/Cloudflare runtime.

## Local emulator workflow

Create an untracked `.env.local`:

```dotenv
APP_ORIGIN=http://127.0.0.1:3000
GOOGLE_CLOUD_PROJECT=demo-side-b
FIRESTORE_DATABASE_ID=side-b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
QLOO_API_KEY=your-own-key
QLOO_API_BASE=https://hackathon.api.qloo.com
```

Start the Firestore emulator in one terminal, with a supported Java runtime configured:

```sh
npx firebase-tools emulators:start --only firestore --project demo-side-b
```

Start `npm run dev` in another terminal and open `http://127.0.0.1:3000`. Do not run a second emulator on the same port. Emulator data is separate from production. Explicitly set the `demo-` project ID to avoid accidentally targeting the canonical instance.

For a self-contained persistence test run:

```sh
GOOGLE_CLOUD_PROJECT=demo-side-b-audit FIRESTORE_DATABASE_ID=side-b \
  npx firebase-tools emulators:exec --only firestore --project demo-side-b-audit \
  'node --import tsx --test tests/firestore.test.mjs'
```

With an emulator already running:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
GOOGLE_CLOUD_PROJECT=demo-side-b-audit FIRESTORE_DATABASE_ID=side-b \
  node --import tsx --test tests/firestore.test.mjs
```

The destructive fixture suite requires both an emulator host and a `demo-` project ID. It tests last-copy concurrency, repeated idempotency keys, cancellation and expiry, inventory/hold races, ownership, public redaction, workspace reset and shared quotas. Inspect current test output rather than assuming a previous verification applies to a changed deployment.

The Firestore emulator does not emulate Google sign-in. To exercise the complete account flow locally, configure your own Firebase web app and matching real project identity, authorize the local domain and supply development Admin SDK credentials through Application Default Credentials. Do not use production customer data for this check.

## Post-deployment checks

1. Open the canonical Hosting URL and create a private guest workspace.
2. Resolve an audience with live Qloo search, generate an edit and inspect evidence and warnings.
3. Publish a sample collection. Open it in a separate browser session, reserve a copy and verify the exact stock decrement from the owner workspace.
4. Retry the same reservation request and confirm it returns the original hold rather than consuming another copy. Verify last-copy contention and cancellation with the test suite.
5. Pause the collection, confirm the public page is unavailable and new holds fail, then resume it. Existing owner holds should remain manageable.
6. Sign in with Google. Verify that account data persists across sign-out/sign-in and is separate from guest data. Sign out and confirm return to the original browser guest workspace.
7. Inspect cookies and response headers. Production sessions must be HttpOnly and Secure. Public responses must not expose customer names, stock costs or private economics.
8. Confirm workspace deletion removes owned public collections and private records. Verify its outcome with a fresh request rather than relying only on the UI message.
9. Review Cloud Run, Firebase Authentication and Firestore errors, cost alerts and Qloo allowance usage.

The live workflow smoke test can be run against a local or public origin:

```sh
node scripts/smoke-test.mjs https://your-hosting-site.web.app
```

It creates and deletes test workspaces and consumes live Qloo requests. The smoke also checks the HTML cache policy and referenced boot assets. Browser authentication still needs a real interactive redirect check.

## Ongoing operations

Keep the Qloo secret in Secret Manager and redeploy revisions using the intended version. Keep the Hosting rewrite, `APP_ORIGIN`, Firebase auth domain and Google OAuth origin/callback aligned after domain changes. Preserve the force-dynamic layout and Hosting `Cache-Control: no-store` headers so old cached HTML cannot request removed build assets. Review Google authorized domains after changing the public hostname.

Configure budget alerts and monitor request errors, quota exhaustion and Firestore contention. Application quotas and a two-instance maximum are safeguards, not spending guarantees. Shared Firestore quotas protect the Qloo allowance across service instances.

Expired cached responses and quota windows are ignored by application logic. Their timestamp `cleanupAt` field supports Firestore TTL: enable a TTL policy for that field on both `api_cache` and `rate_limits` collection groups in the named database. TTL deletion is asynchronous and does not replace validity checks. Define a separate retention policy for abandoned guest workspaces. Customer pickup names also require an appropriate retention policy for a commercial deployment.

Workspace deletion removes application records, not the user’s Firebase Authentication account. Side B currently has no payment processing, email delivery, subscription billing or automated external-stock synchronization. Treat those as separate production integrations.
