function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function calculateCalories(distanceKm, timeMinutes, weightKg = 70) {
  return Math.round(9.8 * weightKg * (timeMinutes / 60));
}

export function estimateSteps(distanceKm) {
  return Math.floor(distanceKm / 0.000762);
}

export function calculatePace(distanceKm, timeMinutes) {
  if (distanceKm < 0.01) return 0;
  return timeMinutes / distanceKm;
}