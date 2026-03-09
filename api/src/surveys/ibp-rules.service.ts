import { Injectable } from '@nestjs/common';
import { FactorCanonical } from './surveys.types';

export type IbpValidationIssue = {
  factor?: string;
  code: string;
  message: string;
  blocking: boolean;
};

export type IbpValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  issues: IbpValidationIssue[];
  factor_scores: Record<string, number> | null;
  factor_results: Record<string, FactorCanonical> | null;
  scores: {
    ibp_peuplement_gestion: number;
    ibp_contexte: number;
    ibp_total: number;
  } | null;
};

type Factors = Record<string, unknown>;
type RegionVersion = 'ACA' | 'M';

type NormalizeContext = {
  issues: IbpValidationIssue[];
  factorResults: Record<string, FactorCanonical>;
};

const FACTOR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
const STANDARD_ALLOWED = new Set([0, 1, 2, 5]);
const IJ_ALLOWED = new Set([0, 2, 5]);

@Injectable()
export class IbpRulesService {
  validateDraft(factors: Factors | null | undefined, regionVersion?: string | null, vegetationStage?: string | null): IbpValidationResult {
    const issues: IbpValidationIssue[] = [];
    const factorResults: Record<string, FactorCanonical> = {};

    const thresholdRegion = this.resolveThresholdRegion(this.normalizeRegion(regionVersion), vegetationStage ?? undefined);
    const normalized = this.normalizeFactors(
      factors,
      {
        issues,
        factorResults
      },
      false,
      thresholdRegion,
      vegetationStage ?? undefined
    );

    if (!normalized) {
      return this.formatResult(issues, null, null, factorResults);
    }

    this.addNonBlockingConsistencyWarnings(normalized, issues);
    this.applyWarningsToCanonicalFactors(issues, factorResults);

    const scores = this.computeScores(normalized);
    return this.formatResult(issues, scores, normalized, factorResults);
  }

  validateSubmit(input: {
    region_version?: string | null;
    vegetation_stage?: string | null;
    expires_at?: string | null;
    factors?: Factors | null;
  }): IbpValidationResult {
    const issues: IbpValidationIssue[] = [];
    const factorResults: Record<string, FactorCanonical> = {};

    const region = this.normalizeRegion(input.region_version);
    if (!region) {
      issues.push(this.issue('region_version_required', 'region_version is required and must be ACA or M', true));
    }

    if (!input.vegetation_stage || !input.vegetation_stage.trim()) {
      issues.push(this.issue('vegetation_stage_required', 'vegetation_stage is required', true));
    }

    if (!input.expires_at) {
      issues.push(this.issue('expires_at_required', 'expires_at is required', true));
    } else if (new Date() > new Date(input.expires_at)) {
      issues.push(this.issue('survey_expired', 'survey is expired and cannot be submitted', true));
    }

    const thresholdRegion = this.resolveThresholdRegion(region, input.vegetation_stage ?? undefined);
    const normalized = this.normalizeFactors(
      input.factors,
      {
        issues,
        factorResults
      },
      true,
      thresholdRegion,
      input.vegetation_stage ?? undefined
    );

    if (!normalized) {
      return this.formatResult(issues, null, null, factorResults);
    }

    this.addNonBlockingConsistencyWarnings(normalized, issues);
    this.applyWarningsToCanonicalFactors(issues, factorResults);

    const scores = this.computeScores(normalized);
    return this.formatResult(issues, scores, normalized, factorResults);
  }

  private normalizeFactors(
    factors: Factors | null | undefined,
    context: NormalizeContext,
    requireAll: boolean,
    regionVersion?: RegionVersion,
    vegetationStage?: string
  ): Record<string, number> | null {
    const raw = factors ?? {};
    const normalized: Record<string, number> = {};

    for (const key of FACTOR_KEYS) {
      const value = raw[key];

      if (value === undefined || value === null || value === '') {
        if (requireAll) {
          context.issues.push(this.issue('factor_required', `factor ${key} is required`, true, key));
        }
        continue;
      }

      const score = this.resolveFactorScore(key, value, regionVersion, vegetationStage, context);
      if (score === null) {
        context.issues.push(this.issue('factor_invalid_raw', `factor ${key} has invalid raw input`, true, key));
        continue;
      }

      if (!this.isAllowedScore(key, score)) {
        const allowedValues = key === 'I' || key === 'J' ? '0,2,5' : '0,1,2,5';
        context.issues.push(this.issue('factor_invalid_score', `factor ${key} must resolve to one of [${allowedValues}]`, true, key));
        continue;
      }

      normalized[key] = score;
      context.factorResults[key] = {
        factor_id: `factor_${key.toLowerCase()}`,
        observed_value_raw: value,
        selected_class: this.toClass(score),
        score_points: score,
        warnings: []
      };
    }

    return normalized;
  }

  private resolveFactorScore(
    key: string,
    rawValue: unknown,
    regionVersion: RegionVersion | undefined,
    vegetationStage: string | undefined,
    context: NormalizeContext
  ): number | null {
    const direct = this.asNumber(rawValue);
    if (direct !== null) {
      return direct;
    }

    if (!this.isObject(rawValue)) {
      return null;
    }

    switch (key) {
      case 'A':
        return this.scoreFactorA(rawValue, regionVersion, vegetationStage);
      case 'B':
        return this.scoreFactorB(rawValue);
      case 'C':
      case 'D':
        return this.scoreFactorCD(rawValue);
      case 'E':
        return this.scoreFactorE(rawValue);
      case 'F':
        return this.scoreFactorF(rawValue, context);
      case 'G':
        return this.scoreFactorG(rawValue, regionVersion, vegetationStage);
      case 'H':
        return this.scoreFactorH(rawValue);
      case 'I':
      case 'J':
        return this.scoreFactorIJ(rawValue);
      default:
        return null;
    }
  }

  private scoreFactorA(raw: Record<string, unknown>, region?: RegionVersion, stage?: string): number | null {
    const count = this.pickNumber(raw, ['native_genus_count', 'autochthonous_genus_count', 'count']);
    if (count === null) return null;

    const isSubalpin = region === 'ACA' && stage === 'subalpin';
    if (isSubalpin) {
      if (count <= 0) return 0;
      if (count === 1) return 1;
      if (count === 2) return 2;
      return 5;
    }

    if (count <= 1) return 0;
    if (count === 2) return 1;
    if (count <= 4) return 2;
    return 5;
  }

  private scoreFactorB(raw: Record<string, unknown>): number | null {
    const strataCount = this.pickNumber(raw, ['strata_count', 'count']);
    const coverPercent = this.pickNumber(raw, ['covered_autochthonous_percent', 'native_cover_percent']);

    if (strataCount === null || coverPercent === null) return null;

    let score = 0;
    if (strataCount <= 1) score = 0;
    else if (strataCount === 2) score = 1;
    else if (strataCount <= 4) score = 2;
    else score = 5;

    if (coverPercent < 50 && score > 2) {
      score = 2;
    }

    return score;
  }

  private scoreFactorCD(raw: Record<string, unknown>): number | null {
    const bmgCount = this.pickNumber(raw, ['bmg_count']);
    const bmmCount = this.pickNumber(raw, ['bmm_count']);
    const surfaceHa = this.pickNumber(raw, ['surface_ha']);

    if (bmgCount === null || bmmCount === null || surfaceHa === null || surfaceHa <= 0) return null;

    const bmgPerHa = bmgCount / surfaceHa;
    const bmmPerHa = bmmCount / surfaceHa;

    if (bmgPerHa < 1 && bmmPerHa < 1) return 0;
    if (bmgPerHa < 1 && bmmPerHa >= 1) return 1;
    if (bmgPerHa < 3) return 2;
    return 5;
  }

  private scoreFactorE(raw: Record<string, unknown>): number | null {
    const tgbCount = this.pickNumber(raw, ['tgb_count']);
    const gbCount = this.pickNumber(raw, ['gb_count']);
    const surfaceHa = this.pickNumber(raw, ['surface_ha']);

    if (tgbCount === null || gbCount === null || surfaceHa === null || surfaceHa <= 0) return null;

    const tgbPerHa = tgbCount / surfaceHa;
    const gbPerHa = gbCount / surfaceHa;

    if (tgbPerHa < 1 && gbPerHa < 1) return 0;
    if (tgbPerHa < 1 && gbPerHa >= 1) return 1;
    if (tgbPerHa < 5) return 2;
    return 5;
  }

  private scoreFactorF(raw: Record<string, unknown>, context: NormalizeContext): number | null {
    const treesPerHa = this.pickNumber(raw, ['trees_per_ha']);
    if (treesPerHa !== null) {
      if (treesPerHa < 2) return 0;
      if (treesPerHa < 3) return 1;
      if (treesPerHa < 8) return 2;
      return 5;
    }

    const groups = raw.dmh_group_counts;
    if (!Array.isArray(groups)) return null;

    let cappedTotal = 0;
    for (const g of groups) {
      const n = this.asNumber(g);
      if (n === null) return null;
      if (n > 2) {
        context.issues.push(this.issue('factor_f_group_capped', 'factor F group count capped to 2 trees/ha', false, 'F'));
      }
      cappedTotal += Math.min(2, Math.max(0, n));
    }

    if (cappedTotal < 2) return 0;
    if (cappedTotal < 3) return 1;
    if (cappedTotal < 8) return 2;
    return 5;
  }

  private scoreFactorG(raw: Record<string, unknown>, region?: RegionVersion, stage?: string): number | null {
    const directPercent = this.pickNumber(raw, ['open_flowering_percent', 'flowering_percent']);
    let percent = directPercent;

    if (percent === null) {
      const openArea = this.pickNumber(raw, ['flowering_open_area_m2', 'open_area_m2']);
      const describedArea = this.pickNumber(raw, ['described_area_m2']);
      if (openArea !== null && describedArea !== null && describedArea > 0) {
        percent = (openArea / describedArea) * 100;
      }
    }

    if (percent === null) return null;

    const isSubalpin = region === 'ACA' && stage === 'subalpin';
    if (percent <= 0) return 0;

    if (isSubalpin) {
      return percent < 1 ? 2 : 5;
    }

    return percent < 1 || percent > 5 ? 2 : 5;
  }

  private scoreFactorH(raw: Record<string, unknown>): number | null {
    const n = this.pickNumber(raw, ['class_score', 'score']);
    if (n !== null) return n;

    const cls = typeof raw.class === 'string' ? raw.class.trim().toLowerCase() : '';
    if (!cls) return null;

    if (['recent', '0'].includes(cls)) return 0;
    if (['partial', '2'].includes(cls)) return 2;
    if (['ancient', '5'].includes(cls)) return 5;
    return null;
  }

  private scoreFactorIJ(raw: Record<string, unknown>): number | null {
    const count = this.pickNumber(raw, ['type_count', 'count']);
    if (count === null) return null;
    if (count <= 0) return 0;
    if (count === 1) return 2;
    return 5;
  }

  private addNonBlockingConsistencyWarnings(factors: Record<string, number>, issues: IbpValidationIssue[]): void {
    if ((factors.B ?? 0) >= 2 && (factors.A ?? 0) === 0) {
      issues.push(this.issue('consistency_a_b', 'factor_b indicates complex strata while factor_a is very low; please double-check', false, 'A'));
    }

    if ((factors.F ?? 0) >= 5 && (factors.E ?? 0) === 0) {
      issues.push(this.issue('consistency_e_f', 'factor_f is high while factor_e is 0; possible but should be checked', false, 'F'));
    }
  }

  private applyWarningsToCanonicalFactors(issues: IbpValidationIssue[], factorResults: Record<string, FactorCanonical>): void {
    for (const issue of issues) {
      if (issue.blocking || !issue.factor) continue;
      const canonical = factorResults[issue.factor];
      if (!canonical) continue;
      canonical.warnings.push(issue.message);
    }
  }

  private computeScores(factors: Record<string, number>) {
    const value = (k: string) => factors[k] ?? 0;

    const ibp_peuplement_gestion = value('A') + value('B') + value('C') + value('D') + value('E') + value('F') + value('G');
    const ibp_contexte = value('H') + value('I') + value('J');

    return {
      ibp_peuplement_gestion,
      ibp_contexte,
      ibp_total: ibp_peuplement_gestion + ibp_contexte
    };
  }

  private resolveThresholdRegion(region: RegionVersion | undefined, stage: string | undefined): RegionVersion | undefined {
    if (stage === 'montagnard_mediterraneen') {
      return 'ACA';
    }
    return region;
  }

  private normalizeRegion(region?: string | null): RegionVersion | undefined {
    if (region === 'ACA' || region === 'M') {
      return region;
    }
    return undefined;
  }

  private isAllowedScore(key: string, score: number): boolean {
    return key === 'I' || key === 'J' ? IJ_ALLOWED.has(score) : STANDARD_ALLOWED.has(score);
  }

  private pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
    for (const k of keys) {
      const n = this.asNumber(obj[k]);
      if (n !== null) return n;
    }
    return null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private issue(code: string, message: string, blocking: boolean, factor?: string): IbpValidationIssue {
    return { code, message, blocking, factor };
  }

  private toClass(score: number): 'S0' | 'S1' | 'S2' | 'S5' {
    if (score === 0) return 'S0';
    if (score === 1) return 'S1';
    if (score === 2) return 'S2';
    return 'S5';
  }

  private formatResult(
    issues: IbpValidationIssue[],
    scores: IbpValidationResult['scores'],
    factorScores: Record<string, number> | null,
    factorResults: Record<string, FactorCanonical>
  ): IbpValidationResult {
    const errors = issues.filter((i) => i.blocking).map((i) => i.message);
    const warnings = issues.filter((i) => !i.blocking).map((i) => i.message);

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      issues,
      factor_scores: factorScores,
      factor_results: Object.keys(factorResults).length > 0 ? factorResults : null,
      scores
    };
  }
}
