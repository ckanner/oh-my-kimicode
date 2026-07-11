import { describe, it, expect } from 'vitest';
import { languageIdFromExtension } from '../../../src/components/lsp/language-id.js';

describe('languageIdFromExtension', () => {
  it('maps ts to typescript', () => {
    expect(languageIdFromExtension('ts')).toBe('typescript');
  });
  it('maps js to javascript', () => {
    expect(languageIdFromExtension('js')).toBe('javascript');
  });
  it('maps py to python', () => {
    expect(languageIdFromExtension('py')).toBe('python');
  });
  it('maps go to go', () => {
    expect(languageIdFromExtension('go')).toBe('go');
  });
  it('maps rs to rust', () => {
    expect(languageIdFromExtension('rs')).toBe('rust');
  });
  it('maps unknown to plaintext', () => {
    expect(languageIdFromExtension('xyz')).toBe('plaintext');
  });
});
