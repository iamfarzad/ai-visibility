# Slice 2: GSC Ingestion + Finding Normalization — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the placeholder GSC handler with a real Google Search Console connector that fetches search analytics, normalizes findings, and writes them to the database.

**Architecture:** New `packages/gsc-connector` wraps GSC REST API (search analytics + URL inspection). Worker handler calls it, normalizes results into `findings` table rows with real severity scoring. API gets a `POST /api/projects/:id/ingest-gsc` trigger. Dogfood target: farzadbayat.com.

**Tech Stack:** TypeScript, @googleapis/webmasters (or REST fetch), @ai-visibility/db, @ai-visibility/types

---

### Task 1: Scaffold `packages/gsc-connector`

**Objective:** Create the package with package.json, tsconfig, and type definitions.

**Files:**
- Create: `packages/gsc-connector/package.json`
- Create: `packages/gsc-connector/tsconfig.json`
- Create: `packages/gsc-connector/index.ts`

**Step 1: package.json**

```json
{
  "name": "@ai-visibility/gsc-connector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@ai-visibility/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

**Step 2: tsconfig.json** — extends root, `outDir: dist`, `rootDir: .`, composite true.

**Step 3: index.ts** — Export skeleton:

```typescript
export interface GSCConnectorConfig {
  siteUrl: string;
  credentials: {
    clientEmail: string;
    privateKey: string;
  };
}

export interface SearchAnalyticsRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dimensions?: Array<'query' | 'page' | 'country' | 'device' | 'searchAppearance'>;
  rowLimit?: number;
}

export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export class GSCConnector {
  constructor(private config: GSCConnectorConfig) {}
  async getSearchAnalytics(params: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]>;
  async inspectUrl(url: string): Promise<{indexStatus: string; lastCrawled?: string; coverageState?: string}>;
  async listSitemaps(): Promise<string[]>;
}
```

**Step 4: Build** — `pnpm --filter @ai-visibility/gsc-connector build`
**Step 5: Commit** — `git commit -m "feat: scaffold gsc-connector package"`

---

### Task 2: Implement GSC REST client (search analytics)

**Objective:** Real OAuth2 JWT flow, fetch GSC search analytics via REST API.

**Files:**
- Modify: `packages/gsc-connector/index.ts`

**Step 1: Implement OAuth2 JWT token exchange**

```typescript
async getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: this.config.credentials.clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');
  
  // Sign with private key (use Node crypto)
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const signature = sign.sign(this.config.credentials.privateKey, 'base64url');
  
  const jwt = `${header}.${claim}.${signature}`;
  
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  const data = await res.json();
  return data.access_token;
}
```

**Step 2: Implement getSearchAnalytics()**

```typescript
async getSearchAnalytics(params: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]> {
  const token = await this.getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.config.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions ?? ['query', 'page'],
        rowLimit: params.rowLimit ?? 1000,
      }),
    }
  );
  const data = await res.json();
  return data.rows ?? [];
}
```

**Step 3: Implement inspectUrl()**

Uses `POST /v3/sites/{siteUrl}/urlInspection/index:inspect` with `{inspectionUrl: url, siteUrl: this.config.siteUrl}`.

**Step 4: Build + verify** — `pnpm --filter @ai-visibility/gsc-connector build`
**Step 5: Commit**

---

### Task 3: Add finding normalization logic

**Objective:** Convert raw GSC rows into typed findings with severity scoring.

**Files:**
- Create: `packages/gsc-connector/normalize.ts`

**Normalization rules:**

| GSC Signal | Finding Type | Severity |
|---|---|---|
| Position > 20 + impressions > 100 | `low_ctr_opportunity` | low |
| Position 4-10 + impressions > 500 | `near_top_miss` | medium |
| Position 11-20 + impressions > 500 | `page_two_trap` | medium |
| Click drop > 50% vs prior period | `click_collapse` | high |
| Index coverage = 'Excluded' for indexed URL | `indexing_loss` | critical |
| Coverage state = 'Submitted and indexed' → 'Discovered - currently not indexed' | `deindexed` | critical |

**Output**: `NormalizedFinding[]` with `{issueType, severity, evidenceJson}` — matches `findings` table schema.

**Step 1: Write normalize.ts** with `normalizeSearchAnalytics(rows, priorPeriod?)` and `normalizeUrlInspection(result)`.
**Step 2: Export from index.ts**
**Step 3: Build**
**Step 4: Commit**

---

### Task 4: Wire worker handler (replace placeholder)

**Objective:** Replace the `handleIngestGSC` placeholder with real GSC connector call + normalize + insert.

**Files:**
- Modify: `apps/worker/src/index.ts:60-70`

**Step 1: Import GSCConnector**

```typescript
import { GSCConnector, normalizeSearchAnalytics, normalizeUrlInspection } from '@ai-visibility/gsc-connector';
```

**Step 2: Build connector from env vars**

```typescript
function getGSCConnector(): GSCConnector {
  return new GSCConnector({
    siteUrl: process.env.GSC_SITE_URL ?? 'sc-domain:farzadbayat.com',
    credentials: {
      clientEmail: process.env.GSC_CLIENT_EMAIL!,
      privateKey: (process.env.GSC_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
  });
}
```

**Step 3: Implement real handler**

- Fetch last 30 days search analytics
- Fetch prior 30 days for comparison (click drop detection)
- Run normalizeSearchAnalytics(rows, priorRows)
- Insert normalized findings into DB
- Return `{success: true, count: N, findings: [...]}`

**Step 4: Build + typecheck**
**Step 5: Commit**

---

### Task 5: Add API trigger endpoint

**Objective:** `POST /api/projects/:projectId/ingest-gsc` enqueues a Cloud Tasks job.

**Files:**
- Modify: `apps/api/src/index.ts`

**Step 1: Add route**

```typescript
app.post('/api/projects/:projectId/ingest-gsc', async (request: any, reply: any) => {
  const projectId = parseInt(request.params.projectId);
  const correlationId = crypto.randomUUID();
  
  await enqueueTask({
    jobType: 'ingest_gsc',
    projectId,
    correlationId,
    retryCount: 0,
  });
  
  return reply.status(202).send({ correlationId, status: 'queued' });
});
```

**Step 2: Build**
**Step 3: Commit**

---

### Task 6: Add env var documentation

**Objective:** Document all new env vars needed.

**Files:**
- Create: `.env.example`

```
DATABASE_URL=postgresql://localhost:5432/ai_visibility
GSC_SITE_URL=sc-domain:farzadbayat.com
GSC_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

**Step 1: Write .env.example**
**Step 2: Commit**

---

### Task 7: Full build smoke test

**Objective:** Verify entire monorepo builds clean with new packages.

```bash
pnpm install
pnpm run build
```

**Expected:** All 7 packages build successfully (types → db → policies → gsc-connector → github-connector → api → web → worker).

**Step 1: Run build**
**Step 2: Fix any issues**
**Step 3: Commit final fixes**

---

### Task 8: Update CHANGELOG and push

**Step 1: Update CHANGELOG.md** — mark Slice 2 as COMPLETE, add details.
**Step 2: git push**
**Step 3: Verify repo visible at github.com/iamfarzad/ai-visibility**
