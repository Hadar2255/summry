import { describe, expect, it } from 'vitest';
import { countSyllables, scanText, segmentText } from './jargon';

describe('scanText', () => {
  it('flags undefined acronyms but not defined ones', () => {
    const undefinedAcr = scanText('The LTP makes the link stronger.');
    expect(undefinedAcr.issues.some((i) => i.kind === 'acronym' && i.text === 'LTP')).toBe(true);
    const defined = scanText('Long-term potentiation (LTP) makes the link stronger. LTP needs repetition.');
    expect(defined.issues.some((i) => i.kind === 'acronym')).toBe(false);
  });

  it('flags jargon with plain-language suggestions', () => {
    const r = scanText('We leverage a robust paradigm to facilitate learning.');
    const jargon = r.issues.filter((i) => i.kind === 'jargon').map((i) => i.text.toLowerCase());
    expect(jargon).toEqual(expect.arrayContaining(['leverage', 'robust', 'paradigm', 'facilitate']));
    expect(r.issues.find((i) => i.text === 'leverage')?.suggestion).toBe('use');
  });

  it('flags long sentences', () => {
    const long = Array.from({ length: 32 }, (_, i) => `word${i}`).join(' ') + '.';
    const r = scanText(long);
    const issue = r.issues.find((i) => i.kind === 'long-sentence');
    expect(issue?.severity).toBe('high');
  });

  it('scores plain language higher than jargon-heavy text', () => {
    const plain = scanText('A bucket can only hold so much water. When it is full, you must pour slower. That is the whole idea.');
    const dense = scanText(
      'Backpressure essentially facilitates asynchronous flow-control methodology whereby heterogeneous distributed components operationalize bidirectional throughput negotiation via TCP.'
    );
    expect(plain.clarityScore).toBeGreaterThan(dense.clarityScore);
    expect(plain.readingGrade).toBeLessThan(dense.readingGrade);
  });

  it('segments cover the full text exactly', () => {
    const text = 'We basically utilize the API. It is fine.';
    const r = scanText(text);
    expect(segmentText(text, r.issues).map((s) => s.text).join('')).toBe(text);
  });
});

describe('countSyllables', () => {
  it('approximates English syllables', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('water')).toBe(2);
    expect(countSyllables('neuroplasticity')).toBeGreaterThanOrEqual(5);
  });
});
