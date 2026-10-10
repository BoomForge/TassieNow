/**
 * Rank genuine near-term calendar starts above year-long/ongoing programmes.
 *
 * Events that start on the selected day or weekend and market occurrences
 * happening that day are shown first. This prevents "1 Jan–31 Dec" records
 * from hiding a local show happening right now.
 */
export function rankEventDiscovery(items,from,to=from) {
  function dateOf(item) {
    return item.occurrenceDate || (item.startDate >= from ? item.startDate : from);
  }
  function tier(item) {
    if (item.occurrenceDate && item.occurrenceDate >= from && item.occurrenceDate <= to) return 0;
    if (item.startDate >= from && item.startDate <= to) return 0;
    return 1;
  }
  return [...items].sort((a,b)=>
    tier(a)-tier(b) ||
    dateOf(a).localeCompare(dateOf(b)) ||
    Number(Boolean(a.occurrenceDate))-Number(Boolean(b.occurrenceDate)) ||
    a.name.localeCompare(b.name)
  );
}
