// server/taxCalculator.ts
// Indian income tax calculator — FY 2025-26 / FY 2026-27 (AY 2026-27 / 2027-28)
// Individual taxpayer, below 60 years. Real slab-based computation — no LLM involved.

export type TaxRegime = 'old' | 'new';

export interface TaxCalculationInput {
  annualIncome: number;      // gross annual income in INR
  regime: TaxRegime;
  deductions?: number;       // old regime only: total itemized deductions (80C, 80D, HRA, etc.)
}

export interface BracketResult {
  from: number;
  to: number | null;
  rate: number;
  taxInBracket: number;
}

export interface TaxCalculationResult {
  regime: TaxRegime;
  grossIncome: number;
  standardDeduction: number;
  itemizedDeductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate: number;
  taxAfterRebate: number;
  cess: number;
  totalTaxPayable: number;
  effectiveTaxRate: number;
  bracketBreakdown: BracketResult[];
  assumptions: string[];
}

interface Slab {
  from: number;
  to: number | null;
  rate: number;
}

const NEW_REGIME_SLABS: Slab[] = [
  { from: 0, to: 400000, rate: 0 },
  { from: 400000, to: 800000, rate: 0.05 },
  { from: 800000, to: 1200000, rate: 0.10 },
  { from: 1200000, to: 1600000, rate: 0.15 },
  { from: 1600000, to: 2000000, rate: 0.20 },
  { from: 2000000, to: 2400000, rate: 0.25 },
  { from: 2400000, to: null, rate: 0.30 },
];

const OLD_REGIME_SLABS: Slab[] = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 0.05 },
  { from: 500000, to: 1000000, rate: 0.20 },
  { from: 1000000, to: null, rate: 0.30 },
];

const NEW_REGIME_STANDARD_DEDUCTION = 75000;
const OLD_REGIME_STANDARD_DEDUCTION = 50000;
const NEW_REGIME_REBATE_LIMIT = 1200000; // rebate applies if taxable income <= this
const NEW_REGIME_REBATE_MAX = 60000;
const OLD_REGIME_REBATE_LIMIT = 500000;
const OLD_REGIME_REBATE_MAX = 12500;
const CESS_RATE = 0.04; // Health & Education Cess

function calculateSlabTax(taxableIncome: number, slabs: Slab[]) {
  let tax = 0;
  const breakdown: BracketResult[] = [];
  for (const slab of slabs) {
    if (taxableIncome <= slab.from) break;
    const upper = slab.to === null ? taxableIncome : Math.min(taxableIncome, slab.to);
    const taxableInSlab = Math.max(0, upper - slab.from);
    const taxInSlab = taxableInSlab * slab.rate;
    tax += taxInSlab;
    if (taxableInSlab > 0) {
      breakdown.push({ from: slab.from, to: slab.to, rate: slab.rate, taxInBracket: Math.round(taxInSlab) });
    }
  }
  return { tax, breakdown };
}

export function calculateTax(input: TaxCalculationInput): TaxCalculationResult {
  const { annualIncome, regime, deductions = 0 } = input;

  if (!Number.isFinite(annualIncome) || annualIncome < 0) {
    throw new Error('annualIncome must be a non-negative number');
  }

  const assumptions = [
    'Applies to FY 2025-26 / FY 2026-27, individual taxpayer below 60 years.',
    'Surcharge on income above ₹50L is not included — slab tax + cess only.',
    'Capital gains are taxed separately at special rates and are not covered here.',
  ];

  let standardDeduction: number;
  let itemizedDeductions = 0;
  let slabs: Slab[];
  let rebateLimit: number;
  let rebateMax: number;

  if (regime === 'new') {
    standardDeduction = NEW_REGIME_STANDARD_DEDUCTION;
    slabs = NEW_REGIME_SLABS;
    rebateLimit = NEW_REGIME_REBATE_LIMIT;
    rebateMax = NEW_REGIME_REBATE_MAX;
    assumptions.push('New regime does not allow 80C/80D/HRA deductions — only the standard deduction applies.');
  } else {
    standardDeduction = OLD_REGIME_STANDARD_DEDUCTION;
    itemizedDeductions = Math.max(0, deductions);
    slabs = OLD_REGIME_SLABS;
    rebateLimit = OLD_REGIME_REBATE_LIMIT;
    rebateMax = OLD_REGIME_REBATE_MAX;
    assumptions.push('Old regime itemized deductions are capped at whatever value you pass in — verify your actual eligible amount.');
  }

  const taxableIncome = Math.max(0, annualIncome - standardDeduction - itemizedDeductions);
  const { tax: taxBeforeRebate, breakdown } = calculateSlabTax(taxableIncome, slabs);

  const rebate = taxableIncome <= rebateLimit ? Math.min(taxBeforeRebate, rebateMax) : 0;
  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);
  const cess = taxAfterRebate * CESS_RATE;
  const totalTaxPayable = Math.round(taxAfterRebate + cess);
  const effectiveTaxRate = annualIncome > 0
    ? Number(((totalTaxPayable / annualIncome) * 100).toFixed(2))
    : 0;

  return {
    regime,
    grossIncome: annualIncome,
    standardDeduction,
    itemizedDeductions,
    taxableIncome,
    taxBeforeRebate: Math.round(taxBeforeRebate),
    rebate: Math.round(rebate),
    taxAfterRebate: Math.round(taxAfterRebate),
    cess: Math.round(cess),
    totalTaxPayable,
    effectiveTaxRate,
    bracketBreakdown: breakdown,
    assumptions,
  };
}

export function compareRegimes(annualIncome: number, oldRegimeDeductions: number = 0) {
  const newResult = calculateTax({ annualIncome, regime: 'new' });
  const oldResult = calculateTax({ annualIncome, regime: 'old', deductions: oldRegimeDeductions });
  const betterRegime: TaxRegime = newResult.totalTaxPayable <= oldResult.totalTaxPayable ? 'new' : 'old';
  const savings = Math.abs(newResult.totalTaxPayable - oldResult.totalTaxPayable);
  return { new: newResult, old: oldResult, betterRegime, savings };
}