/**
 * @see https://stackoverflow.com/a/365853/740553
 */
export function getDistanceBetweenPoints(lat1: number, long1: number, lat2: number, long2: number, R = 6371): number {
  const dLat = lat2 - lat1;
  const dLong = long2 - long1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLong / 2) * Math.sin(dLong / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
