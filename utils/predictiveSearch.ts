export interface SuggestionRecord {
  application?: string;
  vendor?: string;
  department?: string;
  sourceBoardName?: string;
}

function sanitize(value: string | undefined | null): string | null {
  const text = String(value || '').trim();
  return text.length > 0 ? text : null;
}

export function buildSuggestionCorpus(records: SuggestionRecord[]): string[] {
  const seen = new Map<string, string>();

  for (const record of records) {
    const candidates = [
      sanitize(record.application),
      sanitize(record.vendor),
      sanitize(record.department),
      sanitize(record.sourceBoardName),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const key = candidate.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, candidate);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

function getMatchScore(queryLower: string, valueLower: string): number | null {
  if (valueLower.startsWith(queryLower)) {
    return 0;
  }

  if (valueLower.includes(` ${queryLower}`)) {
    return 1;
  }

  if (valueLower.includes(queryLower)) {
    return 2;
  }

  return null;
}

export function getPredictiveSuggestions(
  rawQuery: string,
  corpus: string[],
  limit = 6,
): string[] {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return [];

  const ranked = corpus
    .map((candidate) => {
      const score = getMatchScore(query, candidate.toLowerCase());
      return { candidate, score };
    })
    .filter((entry): entry is { candidate: string; score: number } => entry.score != null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.candidate.length !== b.candidate.length) return a.candidate.length - b.candidate.length;
      return a.candidate.localeCompare(b.candidate);
    });

  return ranked.slice(0, Math.max(0, limit)).map((entry) => entry.candidate);
}
