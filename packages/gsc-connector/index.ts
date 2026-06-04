/**
 * Google Search Console connector.
 * OAuth2 JWT authentication → Search Analytics + URL Inspection.
 * Zero external deps — Node crypto + fetch.
 */

import * as crypto from 'node:crypto';

export { normalizeSearchAnalytics, normalizeUrlInspection, deduplicateFindings } from './normalize.js';
export type { NormalizedFinding } from './normalize.js';

export interface GSCConnectorConfig {
  siteUrl: string; // e.g. "sc-domain:farzadbayat.com" or "https://farzadbayat.com/"
  credentials: {
    clientEmail: string; // service account email
    privateKey: string;  // PEM RSA private key (with \n newlines)
  };
}

export interface SearchAnalyticsRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dimensions?: Array<'query' | 'page' | 'country' | 'device' | 'searchAppearance'>;
  rowLimit?: number;
  dimensionFilterGroups?: unknown[];
}

export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export interface UrlInspectionResult {
  indexStatus: string;
  coverageState?: string;
  lastCrawled?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  crawledAs?: string;
  userCanonical?: string;
}

export interface SiteInfo {
  siteUrl: string;
  permissionLevel: string;
}

export class GSCConnector {
  private cachedToken?: { accessToken: string; expiresAt: number };

  constructor(private config: GSCConnectorConfig) {}

  /**
   * Exchange a service-account JWT for an OAuth2 access token.
   * No external dependencies — raw Node crypto + fetch.
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: this.config.credentials.clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claim}`);
    const signature = sign.sign(this.config.credentials.privateKey, 'base64url');

    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GSC auth failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    return data.access_token;
  }

  /**
   * Fetch search analytics from GSC.
   * Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
   */
  async getSearchAnalytics(params: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]> {
    const token = await this.getAccessToken();
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.config.siteUrl)}/searchAnalytics/query`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions ?? ['query', 'page'],
        rowLimit: params.rowLimit ?? 1000,
        ...(params.dimensionFilterGroups ? { dimensionFilterGroups: params.dimensionFilterGroups } : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GSC searchAnalytics query failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as { rows?: SearchAnalyticsRow[] };
    return data.rows ?? [];
  }

  /**
   * Inspect a specific URL's indexing status.
   * Docs: https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
   */
  async inspectUrl(inspectionUrl: string): Promise<UrlInspectionResult> {
    const token = await this.getAccessToken();
    const url = `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl,
        siteUrl: this.config.siteUrl,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GSC URL inspection failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as {
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          lastCrawlTime?: string;
          robotsTxtState?: string;
          pageFetchState?: string;
          crawledAs?: string;
          userCanonical?: string;
        };
      };
    };

    const result = data.inspectionResult?.indexStatusResult ?? {};
    return {
      indexStatus: result.verdict ?? 'UNKNOWN',
      coverageState: result.coverageState,
      lastCrawled: result.lastCrawlTime,
      robotsTxtState: result.robotsTxtState,
      pageFetchState: result.pageFetchState,
      crawledAs: result.crawledAs,
      userCanonical: result.userCanonical,
    };
  }

  /**
   * List all sitemaps submitted to GSC for this site.
   */
  async listSitemaps(): Promise<Array<{ path: string; lastSubmitted: string; isPending: boolean; warnings?: string }>> {
    const token = await this.getAccessToken();
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.config.siteUrl)}/sitemaps`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GSC sitemaps list failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as {
      sitemap?: Array<{ path: string; lastSubmitted: string; isPending: boolean; warnings?: string }>;
    };
    return data.sitemap ?? [];
  }

  /**
   * Verify site ownership — lightweight check that credentials + siteUrl are valid.
   */
  async verifyAccess(): Promise<SiteInfo> {
    const token = await this.getAccessToken();
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.config.siteUrl)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GSC site access failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as SiteInfo;
    return data;
  }
}
