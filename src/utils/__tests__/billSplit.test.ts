import { computeBillSplit, type SplittableItem } from '../billSplit';

const item = (id: string, price: number, selectedBy: string[]): SplittableItem => ({
  id,
  price,
  quantity: 1,
  selectedBy,
});

describe('computeBillSplit', () => {
  it('divides each item between the people who selected it', () => {
    const { shares, unassignedTotal } = computeBillSplit(
      [item('pizza', 600, ['a', 'b', 'c']), item('coke', 90, ['a'])],
      ['a', 'b', 'c'],
      0,
      0,
    );
    expect(shares.map((s) => s.itemsTotal)).toEqual([290, 200, 200]);
    expect(shares[0].itemIds).toEqual(['pizza', 'coke']);
    expect(shares[1].itemIds).toEqual(['pizza']);
    expect(unassignedTotal).toBe(0);
  });

  it('splits tax and service charge equally between everyone', () => {
    const { shares } = computeBillSplit([item('thali', 300, ['a'])], ['a', 'b'], 30, 20);
    expect(shares[0]).toMatchObject({ itemsTotal: 300, shareOfTax: 25, finalAmount: 325 });
    expect(shares[1]).toMatchObject({ itemsTotal: 0, shareOfTax: 25, finalAmount: 25 });
  });

  it('rounds to two decimal places', () => {
    const { shares } = computeBillSplit([item('cake', 100, ['a', 'b', 'c'])], ['a', 'b', 'c'], 0, 0);
    expect(shares.map((s) => s.itemsTotal)).toEqual([33.33, 33.33, 33.33]);
  });

  it('reports items nobody selected instead of losing them silently', () => {
    const { shares, unassignedTotal } = computeBillSplit([item('fries', 120, []), item('tea', 40, ['a'])], ['a'], 0, 0);
    expect(shares[0].finalAmount).toBe(40);
    expect(unassignedTotal).toBe(120);
  });

  it('ignores selections from people no longer in the split and duplicate selections', () => {
    const { shares } = computeBillSplit([item('dosa', 100, ['a', 'ghost', 'a'])], ['a', 'b'], 0, 0);
    expect(shares[0].itemsTotal).toBe(100);
    expect(shares[1].itemsTotal).toBe(0);
  });

  it('treats negative or invalid amounts as zero', () => {
    const { shares } = computeBillSplit([item('refund', -50, ['a'])], ['a'], Number.NaN, -10);
    expect(shares[0]).toMatchObject({ itemsTotal: 0, shareOfTax: 0, finalAmount: 0 });
  });

  it('returns no shares (and no NaN) when there are no people', () => {
    expect(computeBillSplit([item('x', 10, [])], [], 5, 5)).toEqual({ shares: [], unassignedTotal: 10 });
  });
});
