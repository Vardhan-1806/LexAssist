# LexAssist deployment guide

LexAssist is a Node.js/Express application backed by MongoDB. The checked-in Railway configuration starts `node server.js` and uses `/api/health` for its deployment health check.

## 1. Prepare MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user with access limited to the LexAssist database. Use a unique, strong password.
3. Configure Atlas network access for the Railway service's outbound address or a private connection supported by your plan. Avoid `0.0.0.0/0`; Atlas documents that this allows access from anywhere and can expose the database to unauthorized access. See [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
4. Copy the application's connection string. Keep it private and add it only as a Railway variable.

## 2. Create the Railway service

1. Connect the GitHub repository to Railway and select the reviewed LexAssist branch.
2. Use the repository root as the service root directory. Railway can detect the Node.js app from `package.json`; its start command is also set in `railway.json`.
3. Add these service variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | Atlas connection string |
   | `JWT_SECRET` | Unique random value with at least 32 characters |
   | `SESSION_SECRET` | Different unique random value with at least 32 characters |
   | `CLIENT_URL` | `https://` plus the generated Railway domain |
   | `UPLOAD_DIR` | `/app/uploads` |

   Railway injects `PORT`; the app listens on that port. Never commit production secrets or paste them into chat.

4. Generate a Railway domain under the service's networking settings. Set `CLIENT_URL` to that HTTPS origin and redeploy the variable changes. Railway applies variable edits as staged changes that require deployment. See [Railway variables](https://docs.railway.com/variables).
5. Keep the health check set to `/api/health`. Railway requires a successful 2xx response for the check to pass. See [Railway health checks](https://docs.railway.com/deployments/healthchecks).

## 3. Persist uploaded documents

Add a Railway volume mounted at `/app/uploads`. `UPLOAD_DIR` must match the mount path. Uploaded legal documents are served through authenticated ownership checks or an expiring share token; they are not exposed as a public static directory. Without a persistent volume, uploaded files can be lost when the service is replaced.

For an existing deployment, copy its current `uploads` contents to the persistent volume before changing `UPLOAD_DIR`. Mounting a new, empty volume over a populated directory hides the previous files until they are migrated.

## 4. Optional integrations

- Set `OPENAI_API_KEY` only if the deployment should use the OpenAI-backed assistant. Otherwise, the app uses its configured fallback behavior.
- Set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, and `EMAIL_PASS` only when email delivery is configured. Use provider app credentials, never an account password.

## 5. First deployment checks

1. Confirm `/api/health` returns `{"status":"ok", ...}` and the landing page loads.
2. Use a disposable staging database and test account to check registration, login, case creation, and lawyer discovery.
3. Upload a non-sensitive sample file. Confirm an unauthenticated request cannot fetch its private file path, its owner can open it, and an expiring share link works only until its expiry.
4. Check Railway logs for database, mail, and application errors.

Do not seed the public deployment with demo accounts or real legal documents. Use only fictitious, non-sensitive data in a public showcase. The app is an educational project and must not be presented as a substitute for advice from a qualified lawyer.

## Local environment

Copy `.env.example` to `.env` for local development and fill it with local or disposable credentials. `.env` is ignored by Git. Use distinct production secrets in Railway.
