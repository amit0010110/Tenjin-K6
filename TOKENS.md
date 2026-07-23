# Token & Authentication Guide

How to authenticate external applications with Graphana k6.

---

## Token Types Overview

| Token | Prefix | Created Via | Best For | Storage |
|-------|--------|-------------|----------|---------|
| **JWT** | *(no prefix)* | `POST /login`, `POST /signup` | Interactive UI sessions | Memory (short-lived) |
| **Personal Access Token (PAT)** | `gp6_` | `POST /pats` | CLI tools, scripts, SDKs | SHA-256 hash in DB |
| **API Key (Webhook)** | `gk6_` | `POST /keys` | CI/CD pipelines, external integrations | Plaintext in DB |

All three are sent the same way: **`Authorization` header**.

---

## 1. Personal Access Tokens (PAT)

Best for: automated scripts, CLI tools, API clients, third-party integrations.

### Create a PAT

You need a JWT (from login) to create a PAT:

```
POST /api/v1/pats
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "my-cli-tool",
  "scopes": ["*"],
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "my-cli-tool",
  "token": "gp6_a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "scopes": "[\"*\"]",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "createdAt": "2025-07-10T12:00:00.000Z"
}
```

> ⚠️ The `token` value is returned **only at creation**. Save it immediately.

### Use a PAT in requests

```bash
curl -H "Authorization: Bearer gp6_a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890" \
  https://your-host.com/api/v1/projects
```

### List / Revoke PATs

```bash
# List all PATs (token values are never returned)
GET /api/v1/pats
Authorization: Bearer <jwt>

# Revoke a PAT
DELETE /api/v1/pats/:id
Authorization: Bearer <jwt>
```

### PAT Format

```
gp6_<64 hex characters>
```

The 64 hex chars = 32 random bytes. The token is hashed with SHA-256 before storage.

---

## 2. API Keys (Webhook / CI/CD)

Best for: GitHub Actions, Jenkins, GitLab CI, or any pipeline that needs to trigger tests.

### Create an API Key

```
POST /api/v1/keys
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "github-actions"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "github-actions",
  "key": "gk6_a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "createdAt": "2025-07-10T12:00:00.000Z"
}
```

> ⚠️ Same as PATs — the `key` value is returned **only at creation**.

### Trigger a test via webhook

```bash
curl -X POST https://your-host.com/api/v1/trigger \
  -H "Authorization: gk6_a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Content-Type: application/json" \
  -d '{"configId": "your-config-uuid"}'
```

**Response:**
```json
{
  "runId": "uuid",
  "status": "pending"
}
```

### GitHub Actions Example

```yaml
# .github/workflows/load-test.yml
name: Run k6 Load Test
on:
  push:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger k6 test
        run: |
          curl -X POST https://your-host.com/api/v1/trigger \
            -H "Authorization: ${{ secrets.K6_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"configId": "${{ secrets.K6_CONFIG_ID }}"}'
```

### API Key Format

```
gk6_<64 hex characters>
```

### List / Delete API Keys

```bash
# List all keys
GET /api/v1/keys
Authorization: Bearer <jwt>

# Delete a key
DELETE /api/v1/keys/:id
Authorization: Bearer <jwt>
```

---

## 3. JWT (Session Tokens)

Best for: browser sessions, short-lived interactive use.

### Login

```
POST /api/v1/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "email": "user@example.com", "name": "John", "role": "user" }
}
```

### Use in requests

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://your-host.com/api/v1/projects
```

### JWT Payload

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "user",
  "iat": 1720600000,
  "exp": 1720603600
}
```

JWTs expire after the configured TTL (default: 1 hour). Use a PAT for long-lived access.

---

## 4. Authentication Flow (Internal)

When a request hits the API, the auth middleware processes it in this order:

```
Request with Authorization header
│
├─ "Bearer <token>"
│  ├─ Try JWT verification
│  │  ├─ Success → authenticate as JWT user
│  │  └─ Fail → fall through
│  └─ Try PAT lookup (SHA-256 hash match)
│     ├─ Found + not expired → authenticate as PAT owner
│     └─ Not found → 401 Invalid or expired token
│
├─ "<gk6_ key>"  (only on /trigger endpoint)
│  └─ Direct lookup in api_keys table
│
└─ No header → dev mode (local development only)
   └─ Authenticate as admin dev user
```

---

## 5. Quick Reference

| Action | Endpoint | Auth Required |
|--------|----------|---------------|
| Login | `POST /api/v1/login` | None |
| Signup | `POST /api/v1/signup` | None |
| Create PAT | `POST /api/v1/pats` | JWT |
| List PATs | `GET /api/v1/pats` | JWT |
| Revoke PAT | `DELETE /api/v1/pats/:id` | JWT |
| Create API Key | `POST /api/v1/keys` | JWT |
| List API Keys | `GET /api/v1/keys` | JWT |
| Delete API Key | `DELETE /api/v1/keys/:id` | JWT |
| Trigger via Webhook | `POST /api/v1/trigger` | API Key (`gk6_`) |
| All other API calls | `GET/POST/PUT/DELETE /api/v1/*` | JWT or PAT |

### cURL Templates

```bash
# With JWT (from login)
TOKEN="eyJhbGciOiJIUzI1NiIs..."
curl -H "Authorization: Bearer $TOKEN" https://host/api/v1/projects

# With PAT (created via /pats)
PAT="gp6_a1b2c3d4e5f67890abcdef..."
curl -H "Authorization: Bearer $PAT" https://host/api/v1/projects

# With API Key (created via /keys, webhook trigger only)
KEY="gk6_a1b2c3d4e5f67890abcdef..."
curl -X POST -H "Authorization: $KEY" -H "Content-Type: application/json" \
  -d '{"configId":"..."}' https://host/api/v1/trigger
```

---

## 6. Security Notes

- PAT tokens are hashed with **SHA-256** before storage — the plaintext is irretrievable after creation
- API Keys are stored as **plaintext** (unique constraint) for fast lookup in the webhook flow
- JWT expiration is handled server-side (`exp` claim); PAT expiration is checked in the middleware against the `expiresAt` field
- The dev bypass (no auth header) only works when `NODE_ENV` is not `production` — ensure your production deployment requires authentication
- Use PATs with `expiresAt` for automated systems to enforce credential rotation
