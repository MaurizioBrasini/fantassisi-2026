export function calculatePoints(
  voterTeam: string,
  voterSite: string,
  recipientTeam: string,
  recipientSite: string
): number {
  if (voterTeam === recipientTeam) {
    return voterSite === recipientSite ? 1 : 2;
  } else {
    return 3;
  }
}

export function getTeam(year: number): string {
  return year <= 2 ? "Matricole" : "Veterani";
}

export function getClass(school: string, site: string, year: number): string {
  return `${school} ${site} ${year}°`;
}