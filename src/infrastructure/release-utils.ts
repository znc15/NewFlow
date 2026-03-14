/**
 * @module infrastructure/release-utils
 * @description 发布版本校验工具
 */

const STABLE_SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** 将 Git tag 规范化为纯 x.x.x 版本号 */
export function normalizeReleaseTag(tag: string): string {
  return tag.replace(/^refs\/tags\//, '').replace(/^v/, '');
}

/** 是否为稳定的 x.x.x 版本 */
export function isStableSemver(version: string): boolean {
  return STABLE_SEMVER_RE.test(version);
}

/** 校验 release tag 与 package.json 版本是否一致 */
export function validateReleaseVersion(rawTag: string, packageVersion: string): string {
  const version = normalizeReleaseTag(rawTag);
  if (!isStableSemver(version)) {
    throw new Error(`仅支持稳定版本发布，tag 必须满足 x.x.x 或 vX.Y.Z，当前收到: ${rawTag}`);
  }
  if (!isStableSemver(packageVersion)) {
    throw new Error(`package.json version 必须满足 x.x.x，当前为: ${packageVersion}`);
  }
  if (version !== packageVersion) {
    throw new Error(`release tag 版本 ${version} 与 package.json version ${packageVersion} 不一致`);
  }
  return version;
}
