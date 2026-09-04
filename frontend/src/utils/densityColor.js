export function densityColor(d) {
  if (d > 0.75) return '#ff3366'
  if (d > 0.5) return '#f97316'
  if (d > 0.3) return '#eab308'
  return '#00ff88'
}
