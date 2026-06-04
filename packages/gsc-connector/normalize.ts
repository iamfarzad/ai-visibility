/**
 * Finding normalization — converts raw GSC data into typed findings
 * with severity scoring for the findings table.
 */

import { Severity } from '@ai-visibility/types';
import type { SearchAnalyticsRow, UrlInspectionResult } from './index.js';

export interface NormalizedFinding {
  issueType: string;
  severity: Severity;
  evidenceJson: Record<string, unknown>;
}

/**
 * Normalize search analytics rows into actionable findings.
 * Compares current period against prior period to detect anomalies.
 */
export function normalizeSearchAnalytics(
  rows: SearchAnalyticsRow[],
  priorRows: SearchAnalyticsRow[] = [],
): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];

  // Build prior period lookup keyed by "query|page"
  const priorMap = new Map<string, SearchAnalyticsRow>();
  for (const row of priorRows) {
    priorMap.set(row.keys.join('|'), row);
  }

  for (const row of rows) {
    const key = row.keys.join('|');

    // ─── Position-based findings ──────────────────────────────────────────

    // Page 3+ with meaningful impressions → low CTR opportunity
    if (row.position > 20 && row.impressions >= 100) {
      findings.push({
        issueType: 'low_ctr_opportunity',
        severity: Severity.LOW,
        evidenceJson: {
          query: key,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          position: row.position,
        },
      });
    }

    // Positions 4-10 with 500+ impressions → near top, could optimize
    if (row.position >= 4 && row.position <= 10 && row.impressions >= 500) {
      findings.push({
        issueType: 'near_top_miss',
        severity: Severity.MEDIUM,
        evidenceJson: {
          query: key,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          position: row.position,
          gap: row.position - 3, // positions to top 3
        },
      });
    }

    // Page 2 (positions 11-20) with 500+ impressions → page two trap
    if (row.position >= 11 && row.position <= 20 && row.impressions >= 500) {
      findings.push({
        issueType: 'page_two_trap',
        severity: Severity.MEDIUM,
        evidenceJson: {
          query: key,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          position: row.position,
        },
      });
    }

    // ─── Click drop detection (requires prior period) ─────────────────────

    const prior = priorMap.get(key);
    if (prior && prior.clicks > 0) {
      const clickDrop = ((prior.clicks - row.clicks) / prior.clicks) * 100;
      if (clickDrop > 50) {
        findings.push({
          issueType: 'click_collapse',
          severity: Severity.HIGH,
          evidenceJson: {
            query: key,
            priorClicks: prior.clicks,
            currentClicks: row.clicks,
            priorImpressions: prior.impressions,
            currentImpressions: row.impressions,
            dropPercent: Math.round(clickDrop),
            priorPosition: prior.position,
            currentPosition: row.position,
          },
        });
      }
    }

    // ─── High position with zero clicks but impressions → SERP ghost ──────

    if (row.position <= 10 && row.impressions >= 50 && row.clicks === 0) {
      findings.push({
        issueType: 'serp_ghost',
        severity: Severity.LOW,
        evidenceJson: {
          query: key,
          impressions: row.impressions,
          position: row.position,
          ctr: 0,
        },
      });
    }
  }

  return findings;
}

/**
 * Normalize URL inspection results into findings.
 * Flags index coverage issues as critical or high severity.
 */
export function normalizeUrlInspection(
  url: string,
  result: UrlInspectionResult,
): NormalizedFinding | null {
  const coverageState = result.coverageState ?? '';

  // Critical: previously indexed page got deindexed
  if (coverageState.includes('currently not indexed') || coverageState.includes('Excluded')) {
    return {
      issueType: 'indexing_loss',
      severity: Severity.CRITICAL,
      evidenceJson: {
        url,
        coverageState,
        indexStatus: result.indexStatus,
        lastCrawled: result.lastCrawled,
        robotsTxtState: result.robotsTxtState,
        pageFetchState: result.pageFetchState,
        crawledAs: result.crawledAs,
      },
    };
  }

  // High: page is discovered but not yet indexed
  if (coverageState === 'Discovered - currently not indexed') {
    return {
      issueType: 'discovered_not_indexed',
      severity: Severity.HIGH,
      evidenceJson: {
        url,
        coverageState,
        indexStatus: result.indexStatus,
        lastCrawled: result.lastCrawled,
      },
    };
  }

  // Medium: page is indexed but marked as duplicate/alternate
  if (coverageState.includes('Duplicate') || coverageState.includes('Alternate')) {
    return {
      issueType: 'duplicate_canonical',
      severity: Severity.MEDIUM,
      evidenceJson: {
        url,
        coverageState,
        indexStatus: result.indexStatus,
        userCanonical: result.userCanonical,
      },
    };
  }

  return null;
}

/**
 * Deduplicate findings by merging evidence for the same issueType + query.
 * Keeps the highest severity across duplicates.
 */
export function deduplicateFindings(findings: NormalizedFinding[]): NormalizedFinding[] {
  const severityRank = { [Severity.CRITICAL]: 4, [Severity.HIGH]: 3, [Severity.MEDIUM]: 2, [Severity.LOW]: 1 };
  const map = new Map<string, NormalizedFinding>();

  for (const f of findings) {
    const queryKey = (f.evidenceJson.query as string) ?? (f.evidenceJson.url as string) ?? JSON.stringify(f.evidenceJson);
    const dedupKey = `${f.issueType}|${queryKey}`;
    const existing = map.get(dedupKey);

    if (!existing || severityRank[f.severity] > severityRank[existing.severity]) {
      map.set(dedupKey, f);
    }
  }

  return Array.from(map.values());
}
