import { taxBreakdown } from '../modules/sales/invoice-html';

describe('taxBreakdown', () => {
  it('groups net + VAT by rate, highest rate first', () => {
    const rows = taxBreakdown([
      { quantity: 2, unitPrice: 100, discount: 0, taxRatePct: 20, lineTotal: 240 },
      { quantity: 1, unitPrice: 50, discount: 0, taxRatePct: 0, lineTotal: 50 },
      { quantity: 1, unitPrice: 100, discount: 20, taxRatePct: 20, lineTotal: 96 },
    ]);

    expect(rows).toEqual([
      { rate: 20, net: 280, vat: 56 }, // (200 net + 16 VAT) + (80 net + 16 VAT)
      { rate: 0, net: 50, vat: 0 },
    ]);
  });

  it('returns a single group for a single-rate invoice', () => {
    const rows = taxBreakdown([
      { quantity: 1, unitPrice: 119, discount: 0, taxRatePct: 20, lineTotal: 142.8 },
    ]);
    expect(rows).toEqual([{ rate: 20, net: 119, vat: 23.8 }]);
  });
});
