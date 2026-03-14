import { describe, expect, it } from 'vitest';
import { isStableSemver, normalizeReleaseTag, validateReleaseVersion } from './release-utils';

describe('release-utils', () => {
  it('normalizes refs/tags/vX.Y.Z to X.Y.Z', () => {
    expect(normalizeReleaseTag('refs/tags/v1.2.3')).toBe('1.2.3');
    expect(normalizeReleaseTag('v2.0.1')).toBe('2.0.1');
    expect(normalizeReleaseTag('3.4.5')).toBe('3.4.5');
  });

  it('accepts only stable x.x.x versions', () => {
    expect(isStableSemver('1.2.3')).toBe(true);
    expect(isStableSemver('0.0.1')).toBe(true);
    expect(isStableSemver('1.2')).toBe(false);
    expect(isStableSemver('1.2.3-beta.1')).toBe(false);
    expect(isStableSemver('v1.2.3')).toBe(false);
  });

  it('validates matching stable tag and package version', () => {
    expect(() => validateReleaseVersion('refs/tags/v1.2.3', '1.2.3')).not.toThrow();
  });

  it('rejects non-stable tags and mismatched versions', () => {
    expect(() => validateReleaseVersion('refs/tags/v1.2.3-beta.1', '1.2.3-beta.1')).toThrow(/x\.x\.x/);
    expect(() => validateReleaseVersion('refs/tags/v1.2.4', '1.2.3')).toThrow(/package\.json/);
  });
});
