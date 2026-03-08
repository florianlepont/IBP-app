import { Injectable } from '@nestjs/common';

export type IbpValidationResult = {
  ok: boolean;
  errors: string[];
  scores: {
    ibp_peuplement_gestion: number;
    ibp_contexte: number;
    ibp_total: number;
  } | null;
};

type Factors = Record<string, unknown>;

const FACTOR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
const STANDARD_ALLOWED = new Set([0, 1, 2, 5]);
const IJ_ALLOWED = new Set([0, 2, 5]);

@Injectable()
export class IbpRulesService {
  validateDraft(factors: Factors | null | undefined): IbpValidationResult {
    const errors: string[] = [];
    const normalized = this.normalizeFactors(factors, errors, false);

    if (!normalized) {
      return { ok: false, errors, scores: null };
    }

    const scores = this.computeScores(normalized);
    return { ok: errors.length === 0, errors, scores };
  }

  validateSubmit(input: {
    region_version?: string | null;
    vegetation_stage?: string | null;
    expires_at?: string | null;
    factors?: Factors | null;
  }): IbpValidationResult {
    const errors: string[] = [];

    if (!input.region_version || !['ACA', 'M'].includes(input.region_version)) {
      errors.push('region_version is required and must be ACA or M');
    }

    if (!input.vegetation_stage || !input.vegetation_stage.trim()) {
      errors.push('vegetation_stage is required');
    }

    if (!input.expires_at) {
      errors.push('expires_at is required');
    } else if (new Date() > new Date(input.expires_at)) {
      errors.push('survey is expired and cannot be submitted');
    }

    const normalized = this.normalizeFactors(input.factors, errors, true);
    if (!normalized) {
      return { ok: false, errors, scores: null };
    }

    const scores = this.computeScores(normalized);
    return { ok: errors.length === 0, errors, scores };
  }

  private normalizeFactors(factors: Factors | null | undefined, errors: string[], requireAll: boolean): Record<string, number> | null {
    const raw = factors ?? {};
    const normalized: Record<string, number> = {};

    for (const key of FACTOR_KEYS) {
      const value = raw[key];

      if (value === undefined || value === null || value === '') {
        if (requireAll) {
          errors.push(`factor ${key} is required`);
        }
        continue;
      }

      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) {
        errors.push(`factor ${key} must be a number`);
        continue;
      }

      const allowed = key === 'I' || key === 'J' ? IJ_ALLOWED : STANDARD_ALLOWED;
      if (!allowed.has(num)) {
        const allowedValues = key === 'I' || key === 'J' ? '0,2,5' : '0,1,2,5';
        errors.push(`factor ${key} must be one of [${allowedValues}]`);
        continue;
      }

      normalized[key] = num;
    }

    return normalized;
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
}
