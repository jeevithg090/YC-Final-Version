/** Pure bill-splitting maths used by the Smart Bill Splitter screen. */

export interface SplittableItem {
  id: string;
  /** Line total (rate × quantity). */
  price: number;
  quantity: number;
  /** IDs of the people sharing this item. */
  selectedBy: string[];
}

export interface PersonShare {
  personId: string;
  /** Sum of this person's share of the items they selected. */
  itemsTotal: number;
  /** Equal share of tax and service charge. */
  shareOfTax: number;
  /** `itemsTotal + shareOfTax`. */
  finalAmount: number;
  /** IDs of the items this person shares. */
  itemIds: string[];
}

export interface BillSplitResult {
  shares: PersonShare[];
  /** Total of items nobody has selected (not charged to anyone). */
  unassignedTotal: number;
}

const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const safeAmount = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * Splits a bill between people.
 *
 * Each item's line total (`price`) is divided equally between the people who
 * selected it. Tax and service charge are divided equally between everyone.
 * Amounts are rounded to two decimal places.
 */
export function computeBillSplit(
  items: SplittableItem[],
  personIds: string[],
  taxAmount: number,
  serviceChargeAmount: number,
): BillSplitResult {
  const validIds = new Set(personIds);
  const taxShare =
    personIds.length > 0 ? (safeAmount(taxAmount) + safeAmount(serviceChargeAmount)) / personIds.length : 0;

  const itemsTotals = new Map<string, number>(personIds.map((id) => [id, 0]));
  const itemIds = new Map<string, string[]>(personIds.map((id) => [id, []]));
  let unassignedTotal = 0;

  for (const item of items) {
    const sharers = [...new Set(item.selectedBy)].filter((id) => validIds.has(id));
    const lineTotal = safeAmount(item.price);
    if (sharers.length === 0) {
      unassignedTotal += lineTotal;
      continue;
    }
    const share = lineTotal / sharers.length;
    for (const id of sharers) {
      itemsTotals.set(id, (itemsTotals.get(id) ?? 0) + share);
      itemIds.get(id)?.push(item.id);
    }
  }

  return {
    shares: personIds.map((personId) => {
      const itemsTotal = itemsTotals.get(personId) ?? 0;
      return {
        personId,
        itemsTotal: roundCurrency(itemsTotal),
        shareOfTax: roundCurrency(taxShare),
        finalAmount: roundCurrency(itemsTotal + taxShare),
        itemIds: itemIds.get(personId) ?? [],
      };
    }),
    unassignedTotal: roundCurrency(unassignedTotal),
  };
}
