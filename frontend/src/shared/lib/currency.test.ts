import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('formats whole pounds with the £ symbol and two decimals', () => {
    expect(formatCurrency(1500)).toBe('£1,500.00');
  });

  it('uses UK grouping convention', () => {
    expect(formatCurrency(123456.5)).toBe('£123,456.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('£0.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(1770.005)).toBe('£1,770.01');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-250)).toBe('-£250.00');
  });
});
