import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateReleaseVersion } from '../src/infrastructure/release-utils';

const rawTag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? '';
if (!rawTag) {
  throw new Error('缺少 release tag，请传入 vX.Y.Z 或设置 GITHUB_REF_NAME');
}

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as { version?: string };
const packageVersion = packageJson.version ?? '';
const version = validateReleaseVersion(rawTag, packageVersion);

process.stdout.write(`Release version validated: ${version}\n`);
