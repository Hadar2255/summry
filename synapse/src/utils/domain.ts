/** Stable hue per domain so the same field always gets the same color. */
export function domainHue(domain: string): number {
  let h = 0;
  const s = domain.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = [258, 168, 28, 338, 205, 88, 12, 290, 190, 46];
  return palette[h % palette.length];
}

export const DOMAIN_SUGGESTIONS = [
  'Computer Science',
  'Systems Architecture',
  'Philosophy',
  'Neuroscience',
  'Physiology',
  'Mathematics',
  'Economics',
  'Psychology',
  'Physics',
  'Biology',
  'History',
  'Design',
  'Linguistics'
];
