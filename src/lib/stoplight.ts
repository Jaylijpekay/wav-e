type Stoplight = 'groen' | 'oranje' | 'rood'

// Geeft het aantal dagen sinds een datum terug; null betekent dat er geen datum bekend is.
export function daysSince(datum: string | null | undefined): number | null {
  if (!datum) return null
  return Math.floor((Date.now() - new Date(datum).getTime()) / 86400000)
}

/*
 * Stoplicht logica:
 *
 * groen  = contact binnen 14 dagen - lid is op koers
 * oranje = 15 tot 28 dagen - aandacht nodig
 * rood   = 29 dagen of meer, of geen contact bekend - urgent
 *
 * De drempelwaarden (14 en 28 dagen) zijn gebaseerd op de coachingscyclus:
 * een EMS-trainer zou elke twee weken contact moeten hebben met actieve leden.
 * Bij geen datum (null) gaan we uit van het slechtste geval: rood.
 */
export function getStoplight(lastContactDays: number | null): Stoplight {
  if (lastContactDays === null || lastContactDays > 28) return 'rood'
  if (lastContactDays > 14) return 'oranje'
  return 'groen'
}

// Geeft de meest recente contactdatum terug uit contactmomenten en evaluaties.
export function getLatestContactDatum(
  contactDatum: string | null | undefined,
  evaluatieDatum: string | null | undefined
): string | null {
  return [contactDatum, evaluatieDatum]
    .filter((datum): datum is string => Boolean(datum))
    .sort()
    .reverse()[0] ?? null
}
