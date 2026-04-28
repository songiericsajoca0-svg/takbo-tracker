function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateCalories(distanceKm, timeMinutes, weightKg = 70) {
  const metValue = 9.8;
  const hours = timeMinutes / 60;
  return Math.round(metValue * weightKg * hours);
}

export function estimateSteps(distanceKm) {
  const stepLengthKm = 0.000762;
  return Math.floor(distanceKm / stepLengthKm);
}

export function calculatePace(distanceKm, timeMinutes) {
  if (distanceKm < 0.01) return 0;
  return timeMinutes / distanceKm;
}