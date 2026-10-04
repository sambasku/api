import { ANONIM_USERNAME } from '@/shared/constants/anonim';

const MENTION_REGEX = /@([a-zA-Z0-9_.-]{3,30})/g;

export function extractMentions(text: string): string[] {
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];

  // Remove the '@' prefix and deduplicate
  const usernames = Array.from(new Set(matches.map((m) => m.slice(1))));

  // Filter out system users
  return usernames.filter((u) => u !== ANONIM_USERNAME);
}
