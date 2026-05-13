type Stoplight = 'groen' | 'oranje' | 'rood'

// Returns the number of days between a given date string and today.
// Returns null if date is null or undefined.
export function daysSince(datum: string | null | undefined): number | null {
  if (!datum) return null
  return Math.floor((Date.now() - new Date(datum).getTime()) / 86400000)
}

// Stoplight thresholds:
// groen  = contact within 14 days - on track
// oranje = 15-28 days - attention needed
// rood   = 29+ days or no contact on record - urgent
// Source: coaching cycle spec, WAV-e v2.0
export function getStoplight(lastContactDays: number | null): Stoplight {
  if (lastContactDays === null || lastContactDays > 28) return 'rood'
  if (lastContactDays > 14) return 'oranje'
  return 'groen'
}

// Returns the combined latest contact date from contact_momenten and evaluaties.
// Takes the most recent datum from either source.
// Returns null if both are absent.
export function getLatestContactDatum(
  contactDatum: string | null | undefined,
  evaluatieDatum: string | null | undefined
): string | null {
  return [contactDatum, evaluatieDatum]
    .filter((datum): datum is string => Boolean(datum))
    .sort()
    .reverse()[0] ?? null
}
