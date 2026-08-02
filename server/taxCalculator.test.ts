import { describe, it, expect } from 'vitest';
import { calculateTax, compareRegimes } from './taxCalculator';

describe('calculateTax - new regime', () => {
  it('charges zero tax for income within the nil slab', () => {
    const result = calculateTax({ annualIncome: 400000, regime: 'new' });
    expect(result.totalTaxPayable).toBe(0);
  });

  it('applies the Section 87A rebate so tax is zero up to ~₹12.75L gross income', () => {
    const result = calculateTax({ annualIncome: 1275000, regime: 'new' });
    expect(result.totalTaxPayable).toBe(0);
  });

  it('charges tax once taxable income crosses the ₹12L rebate threshold', () => {
    const result = calculateTax({ annualIncome: 1400000, regime: 'new' });
    expect(result.totalTaxPayable).toBeGreaterThan(0);
  });

  it('matches a hand-calculated example at ₹18.75L gross (₹18L taxable)', () => {
    // 0-4L: 0 | 4-8L: 5% of 4L = 20,000 | 8-12L: 10% of 4L = 40,000
    // 12-16L: 15% of 4L = 60,000 | 16-18L: 20% of 2L = 40,000 => 160,000
    // + 4% cess (6,400) = 166,400
    const result = calculateTax({ annualIncome: 1875000, regime: 'new' });
    expect(result.totalTaxPayable).toBe(166400);
  });
});

describe('calculateTax - old regime', () => {
  it('applies the ₹12,500 rebate up to ₹5L taxable income', () => {
    const result = calculateTax({ annualIncome: 550000, regime: 'old' }); // 5L taxable after 50k std deduction
    expect(result.totalTaxPayable).toBe(0);
  });

  it('reduces tax when itemized deductions are provided', () => {
    const withoutDeductions = calculateTax({ annualIncome: 1000000, regime: 'old' });
    const withDeductions = calculateTax({ annualIncome: 1000000, regime: 'old', deductions: 150000 });
    expect(withDeductions.totalTaxPayable).toBeLessThan(withoutDeductions.totalTaxPayable);
  });
});

describe('compareRegimes', () => {
  it('returns a valid recommendation with non-negative savings', () => {
    const result = compareRegimes(1000000, 200000);
    expect(['old', 'new']).toContain(result.betterRegime);
    expect(result.savings).toBeGreaterThanOrEqual(0);
  });

  it('throws on negative income', () => {
    expect(() => calculateTax({ annualIncome: -1000, regime: 'new' })).toThrow();
  });
});