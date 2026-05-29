// =============================================================================
// SPARK APP — Content Moderation Scoring
// Provides keyword-heuristic ML risk scoring (0.0 – 1.0).
// Optionally uses Google Perspective API when VITE_PERSPECTIVE_API_KEY is set.
// =============================================================================

// ---------------------------------------------------------------------------
// Keyword heuristic categories with weighted scores
// ---------------------------------------------------------------------------

const HIGH_RISK_PATTERNS: RegExp[] = [
  // Threats / violence
  /\b(kill|murder|shoot|bomb|terrorist|attack)\b/i,
  // Hate speech signals
  /\b(hate|racist|slur|bigot)\b/i,
  // NSFW / explicit
  /\b(porn|nude|xxx|explicit|nsfw)\b/i,
  // Spam signals
  /\b(click here|buy now|free money|crypto|bitcoin|invest now|guaranteed profit)\b/i,
  // Self-harm
  /\b(suicide|self.harm|cut myself|end my life)\b/i,
];

const MEDIUM_RISK_PATTERNS: RegExp[] = [
  /\b(idiot|stupid|dumb|loser|pathetic|shut up)\b/i,
  /\b(scam|fake|fraud|cheat|liar)\b/i,
  /\b(drugs|weed|marijuana|alcohol|drunk)\b/i,
  // Excessive caps (shouting)
  /[A-Z]{8,}/,
  // Repeated punctuation (aggressive tone)
  /[!?]{4,}/,
];

const SPAM_URL_PATTERN = /https?:\/\/(?!stbrittosacademy\.edu\.in)[^\s]+/gi;

// ---------------------------------------------------------------------------
// Heuristic scorer
// ---------------------------------------------------------------------------

export interface ModerationScore {
  score: number;          // 0.0 (safe) – 1.0 (high risk)
  level: 'safe' | 'medium' | 'high';
  flags: string[];        // human-readable reasons
  source: 'heuristic' | 'perspective';
}

export function computeHeuristicScore(title: string, body: string): ModerationScore {
  const text = `${title} ${body}`.toLowerCase();
  const flags: string[] = [];
  let score = 0.0;

  // Check high-risk patterns (each adds 0.4, capped)
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      flags.push(`High-risk term detected: "${match?.[0] ?? 'unknown'}"`);
      score = Math.min(score + 0.4, 1.0);
    }
  }

  // Check medium-risk patterns (each adds 0.15)
  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      flags.push(`Potentially inappropriate: "${match?.[0] ?? 'unknown'}"`);
      score = Math.min(score + 0.15, 1.0);
    }
  }

  // External URL check (adds 0.1)
  const urlMatches = text.match(SPAM_URL_PATTERN);
  if (urlMatches && urlMatches.length > 0) {
    flags.push(`External URL(s) detected: ${urlMatches.length}`);
    score = Math.min(score + 0.1 * urlMatches.length, 1.0);
  }

  // Very short body (possible spam)
  if (body.trim().length < 20) {
    flags.push('Unusually short post body');
    score = Math.min(score + 0.05, 1.0);
  }

  const level: ModerationScore['level'] =
    score >= 0.7 ? 'high' : score >= 0.3 ? 'medium' : 'safe';

  return { score: parseFloat(score.toFixed(4)), level, flags, source: 'heuristic' };
}

// ---------------------------------------------------------------------------
// Perspective API scorer (optional, async)
// Set VITE_PERSPECTIVE_API_KEY in your .env to enable.
// Falls back to heuristic if the API key is absent or the call fails.
// ---------------------------------------------------------------------------

export async function computeModerationScore(
  title: string,
  body: string
): Promise<ModerationScore> {
  const perspectiveKey = import.meta.env.VITE_PERSPECTIVE_API_KEY;

  if (perspectiveKey) {
    try {
      const text = `${title}\n\n${body}`;
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${perspectiveKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: { text },
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              SPAM: {},
              THREAT: {},
            },
          }),
        }
      );

      if (!response.ok) throw new Error(`Perspective API error: ${response.status}`);

      const data = await response.json();
      const toxicity: number = data.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
      const severeToxicity: number = data.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value ?? 0;
      const spam: number = data.attributeScores?.SPAM?.summaryScore?.value ?? 0;
      const threat: number = data.attributeScores?.THREAT?.summaryScore?.value ?? 0;

      // Weighted composite score
      const score = Math.min(
        toxicity * 0.4 + severeToxicity * 0.3 + threat * 0.2 + spam * 0.1,
        1.0
      );

      const flags: string[] = [];
      if (toxicity > 0.5) flags.push(`Toxicity: ${(toxicity * 100).toFixed(0)}%`);
      if (severeToxicity > 0.4) flags.push(`Severe toxicity: ${(severeToxicity * 100).toFixed(0)}%`);
      if (threat > 0.4) flags.push(`Threat signal: ${(threat * 100).toFixed(0)}%`);
      if (spam > 0.5) flags.push(`Spam signal: ${(spam * 100).toFixed(0)}%`);

      const level: ModerationScore['level'] =
        score >= 0.7 ? 'high' : score >= 0.3 ? 'medium' : 'safe';

      return { score: parseFloat(score.toFixed(4)), level, flags, source: 'perspective' };
    } catch (err) {
      console.warn('[Moderation] Perspective API failed, falling back to heuristic:', err);
    }
  }

  // Fallback: heuristic
  return computeHeuristicScore(title, body);
}

// ---------------------------------------------------------------------------
// Helpers for UI rendering
// ---------------------------------------------------------------------------

export function getRiskColor(level: ModerationScore['level']): string {
  switch (level) {
    case 'high':   return 'text-red-600 dark:text-red-400';
    case 'medium': return 'text-amber-600 dark:text-amber-400';
    case 'safe':   return 'text-emerald-600 dark:text-emerald-400';
  }
}

export function getRiskBg(level: ModerationScore['level']): string {
  switch (level) {
    case 'high':   return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
    case 'medium': return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
    case 'safe':   return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
  }
}

export function getRiskLabel(level: ModerationScore['level']): string {
  switch (level) {
    case 'high':   return '🔴 High Risk';
    case 'medium': return '🟡 Medium Risk';
    case 'safe':   return '🟢 Safe';
  }
}
