/**
 * Math Answer Normalizer + Comparator
 * Handles: integers, decimals, fractions, algebraic equivalence, trig values, units
 */

// ─── Normalization ─────────────────────────────────────────────────────────────

export function normalizeAnswer(raw: string): string {
  let s = raw.trim().toLowerCase();

  // Strip LaTeX wrappers
  s = s.replace(/^\$|\$$/g, '');
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  s = s.replace(/\\cdot/g, '*').replace(/\\times/g, '*');
  s = s.replace(/\\pi/g, 'pi').replace(/\\theta/g, 'theta');
  s = s.replace(/\\sqrt/g, 'sqrt');

  // Strip units (allow only at end)
  s = s.replace(/([a-zA-Z]+)$/, '');
  s = s.replace(/\s+/g, '');

  // Remove trailing plus/minus sign ambiguity
  s = s.replace(/^\+/, '');

  // Handle common words
  s = s.replace(/no solution/g, 'nosolution');
  s = s.replace(/all real numbers/g, 'allrealnumbers');
  s = s.replace(/infinitely many solutions/g, 'infinitelymanysolutions');
  s = s.replace(/undefined/g, 'undefined');

  return s;
}

export function normalizeNumeric(raw: string): number | null {
  const s = normalizeAnswer(raw);
  if (!s || s === 'null' || s === 'undefined' || s === 'nosolution') return null;

  // Try direct float
  const direct = parseFloat(s);
  if (!isNaN(direct) && isFinite(direct)) return direct;

  // Fraction: a/b
  const fracMatch = s.match(/^\(?([+-]?\d+)\)?\/?\(?([+-]?\d+)\)?$/);
  if (fracMatch) {
    const [, num, den] = fracMatch;
    const n = parseInt(num), d = parseInt(den);
    if (d !== 0) return n / d;
  }

  // Mixed fraction: a b/c
  const mixedMatch = s.match(/^([+-]?\d+)\s+\(?([+-]?\d+)\)?\/?\(?([+-]?\d+)\)?$/);
  if (mixedMatch) {
    const [, whole, num, den] = mixedMatch;
    const w = parseInt(whole), n = parseInt(num), d = parseInt(den);
    if (d !== 0) return w + n / d;
  }

  // Evaluate simple math expressions (only safe chars)
  if (/^[0-9+\-*/(). sqrtpi]+$/.test(s)) {
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${s}`)();
      if (typeof result === 'number' && isFinite(result)) return result;
    } catch {
      // ignore
    }
  }

  return null;
}

// ─── Comparison ────────────────────────────────────────────────────────────────

export interface CompareResult {
  is_correct: boolean | null; // null = uncertain, needs manual review
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Compare a student's answer to the answer key.
 * Returns { is_correct, confidence, reason }
 */
export function compareAnswers(
  studentRaw: string,
  keyRaw: string,
  opts: { tolerance?: number; allowEquivalence?: boolean } = {}
): CompareResult {
  const { tolerance = 0.001, allowEquivalence = true } = opts;

  const student = normalizeAnswer(studentRaw);
  const key = normalizeAnswer(keyRaw);

  // ── Trivial cases ──────────────────────────────────────────────────────────
  if (!studentRaw.trim()) {
    return { is_correct: null, confidence: 'low', reason: 'No answer provided' };
  }

  if (student === key) {
    return { is_correct: true, confidence: 'high', reason: 'Exact match' };
  }

  // ── Numeric comparison ────────────────────────────────────────────────────
  const sNum = normalizeNumeric(studentRaw);
  const kNum = normalizeNumeric(keyRaw);

  if (sNum !== null && kNum !== null) {
    const diff = Math.abs(sNum - kNum);
    if (diff <= tolerance) {
      return { is_correct: true, confidence: 'high', reason: `Within ±${tolerance}` };
    }
    if (diff <= Math.abs(kNum) * 0.01) {
      return { is_correct: true, confidence: 'medium', reason: 'Within 1% tolerance' };
    }
    return { is_correct: false, confidence: 'high', reason: `Numeric mismatch: ${sNum} vs ${kNum}` };
  }

  // ── Algebraic equivalence (basic) ────────────────────────────────────────
  if (allowEquivalence) {
    const eqResult = checkAlgebraicEquivalence(student, key);
    if (eqResult !== null) return eqResult;
  }

  // ── Trig special angles ─────────────────────────────────────────────────────
  const trigResult = checkTrigSpecialValue(studentRaw, keyRaw);
  if (trigResult !== null) return trigResult;

  // ── Can't determine ─────────────────────────────────────────────────────────
  return { is_correct: null, confidence: 'low', reason: 'Could not compare — needs manual review' };
}

function checkAlgebraicEquivalence(a: string, b: string): CompareResult | null {
  // Both must be non-numeric strings at this point
  if (/^\-?[0-9.]+$/.test(a) || /^\-?[0-9.]+$/.test(b)) return null;

  // Remove spaces and sort terms (crude equivalence for simple linear/quadratic)
  const sortTerms = (s: string) =>
    s.replace(/\*/g, '').replace(/[()]/g, '').split(/([+-])/)
      .filter(Boolean).sort().join('');

  const aSorted = sortTerms(a);
  const bSorted = sortTerms(b);

  if (aSorted === bSorted) {
    return { is_correct: true, confidence: 'medium', reason: 'Algebraic equivalence (sorted terms)' };
  }

  // Check: ax vs xa, 2x vs x*2
  const expand = (s: string) =>
    s.replace(/(\d)([a-z])/g, '$2*$1')
     .replace(/([a-z])(\d)/g, '$1*$2')
     .replace(/\s+/g, '');

  if (expand(a) === expand(b)) {
    return { is_correct: true, confidence: 'medium', reason: 'Algebraic equivalence (expanded)' };
  }

  return null;
}

function checkTrigSpecialValue(studentRaw: string, keyRaw: string): CompareResult | null {
  const TRIG_TABLE: Record<string, Record<string, number>> = {
    sin: { 0: 0, 30: 0.5, 45: Math.SQRT2 / 2, 60: Math.SQRT3 / 2, 90: 1, 180: 0, 270: -1 },
    cos: { 0: 1, 30: Math.SQRT3 / 2, 45: Math.SQRT2 / 2, 60: 0.5, 90: 0, 180: -1, 270: 0 },
    tan: { 0: 0, 30: 1 / Math.SQRT3, 45: 1, 60: Math.SQRT3, 90: Infinity, 180: 0 },
  };

  const TRIG_RAD: Record<string, Record<string, number>> = {
    sin: { 0: 0, 'pi/6': 0.5, 'pi/4': Math.SQRT2 / 2, 'pi/3': Math.SQRT3 / 2, 'pi/2': 1, 'pi': 0, '3pi/2': -1 },
    cos: { 0: 1, 'pi/6': Math.SQRT3 / 2, 'pi/4': Math.SQRT2 / 2, 'pi/3': 0.5, 'pi/2': 0, 'pi': -1, '3pi/2': 0 },
    tan: { 0: 0, 'pi/6': 1 / Math.SQRT3, 'pi/4': 1, 'pi/3': Math.SQRT3, 'pi/2': Infinity, 'pi': 0 },
  };

  const match = studentRaw.match(/^(sin|cos|tan)\(([^)]+)\)/i);
  if (!match) return null;

  const [, fn, arg] = match;
  const fnLower = fn.toLowerCase();
  const argNorm = normalizeAnswer(arg);

  // Try degree lookup
  const deg = parseFloat(argNorm);
  if (!isNaN(deg) && TRIG_TABLE[fnLower]?.[deg] !== undefined) {
    const sNum = normalizeNumeric(studentRaw);
    const kNum = normalizeNumeric(keyRaw);
    if (sNum !== null && kNum !== null && Math.abs(sNum - kNum) < 0.001) {
      return { is_correct: true, confidence: 'high', reason: 'Trig special angle match' };
    }
  }

  // Try radian lookup
  if (TRIG_RAD[fnLower]?.[argNorm] !== undefined) {
    const sNum = normalizeNumeric(studentRaw);
    const kNum = normalizeNumeric(keyRaw);
    if (sNum !== null && kNum !== null && Math.abs(sNum - kNum) < 0.001) {
      return { is_correct: true, confidence: 'high', reason: 'Trig radian match' };
    }
  }

  return null;
}
