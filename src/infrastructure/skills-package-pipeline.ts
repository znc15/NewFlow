/**
 * @module infrastructure/skills-package-pipeline
 * @description skills 发布包源码树与渲染计划
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const PACKAGE_SOURCE_ROOT = 'skills-src';

export const GENERATED_FILE_HEADER = 'GENERATED FILE - DO NOT EDIT';

export const PUBLISHED_PACKAGE_ROOTS = {
  codex: 'skills/codex一键安装技能',
  cursor: 'skills/cursor一键安装技能',
} as const;

export type SkillsPackageId = keyof typeof PUBLISHED_PACKAGE_ROOTS;

export type SkillsPackageFileGroupKind =
  | 'root'
  | 'manual'
  | 'tests'
  | 'runtime'
  | 'skills';

export interface SkillsPackageFileGroup {
  kind: SkillsPackageFileGroupKind;
  sourceRoot: string;
  outputRoot: string;
}

export interface SkillsPackagePlanEntry {
  packageId: SkillsPackageId;
  outputRoot: string;
  skillsRoots: string[];
  requiredSourceRoots: string[];
  fileGroups: SkillsPackageFileGroup[];
}

export interface SkillsPackageRenderPlan {
  repoRoot: string;
  sourceRoot: string;
  packages: SkillsPackagePlanEntry[];
}

export interface RequiredSkillsPackageSources {
  present: string[];
  missing: string[];
}

function buildCodexPlanEntry(): SkillsPackagePlanEntry {
  return {
    packageId: 'codex',
    outputRoot: PUBLISHED_PACKAGE_ROOTS.codex,
    skillsRoots: [
      'skills/codex一键安装技能/.codex-home-claude-parity/skills',
      'skills/codex一键安装技能/纯手动安装/skills',
    ],
    requiredSourceRoots: [
      'shared/skills',
      'shared/templates',
      'runtime',
    ],
    fileGroups: [
      {
        kind: 'root',
        sourceRoot: 'packages/codex/root',
        outputRoot: 'skills/codex一键安装技能',
      },
      {
        kind: 'manual',
        sourceRoot: 'packages/codex/manual',
        outputRoot: 'skills/codex一键安装技能/纯手动安装',
      },
      {
        kind: 'tests',
        sourceRoot: 'packages/codex/tests',
        outputRoot: 'skills/codex一键安装技能/tests',
      },
      {
        kind: 'runtime',
        sourceRoot: 'runtime',
        outputRoot: 'skills/codex一键安装技能/纯手动安装',
      },
      {
        kind: 'skills',
        sourceRoot: 'shared/skills',
        outputRoot: 'skills/codex一键安装技能/.codex-home-claude-parity/skills',
      },
    ],
  };
}

function buildCursorPlanEntry(): SkillsPackagePlanEntry {
  return {
    packageId: 'cursor',
    outputRoot: PUBLISHED_PACKAGE_ROOTS.cursor,
    skillsRoots: [
      'skills/cursor一键安装技能/-Force/skills',
      'skills/cursor一键安装技能/skills',
      'skills/cursor一键安装技能/纯手动安装/skills',
    ],
    requiredSourceRoots: [
      'shared/skills',
      'shared/templates',
      'runtime',
    ],
    fileGroups: [
      {
        kind: 'root',
        sourceRoot: 'packages/cursor/root',
        outputRoot: 'skills/cursor一键安装技能',
      },
      {
        kind: 'manual',
        sourceRoot: 'packages/cursor/manual',
        outputRoot: 'skills/cursor一键安装技能/纯手动安装',
      },
      {
        kind: 'tests',
        sourceRoot: 'packages/cursor/tests',
        outputRoot: 'skills/cursor一键安装技能/tests',
      },
      {
        kind: 'runtime',
        sourceRoot: 'runtime',
        outputRoot: 'skills/cursor一键安装技能/-Force',
      },
      {
        kind: 'skills',
        sourceRoot: 'shared/skills',
        outputRoot: 'skills/cursor一键安装技能/skills',
      },
    ],
  };
}

/**
 * 构建 skills 发布包渲染计划。
 */
export function buildSkillsPackageRenderPlan(repoRoot: string): SkillsPackageRenderPlan {
  return {
    repoRoot,
    sourceRoot: PACKAGE_SOURCE_ROOT,
    packages: [
      buildCodexPlanEntry(),
      buildCursorPlanEntry(),
    ],
  };
}

/**
 * 解析当前 skills 发布包源码树中的必需源文件。
 */
export function resolveRequiredPackageSources(repoRoot: string): RequiredSkillsPackageSources {
  const required = [
    'README.md',
    'shared/templates/generated-file-header.txt',
    'shared/skills/feature-dev/SKILL.md',
    'packages/codex/root/install.sh',
    'packages/codex/manual/README.md',
    'packages/codex/tests/script-completion-messages.ps1',
    'packages/cursor/root/install_cursor_skills.sh',
    'packages/cursor/manual/README.md',
    'packages/cursor/tests/wrapper-forwarding.ps1',
    'packages/cursor/force/mcp.json',
    'runtime/context7-local-bundled',
  ];
  const present: string[] = [];
  const missing: string[] = [];

  for (const relativePath of required) {
    const sourcePath = join(repoRoot, PACKAGE_SOURCE_ROOT, relativePath);
    if (existsSync(sourcePath)) {
      present.push(relativePath);
      continue;
    }
    missing.push(relativePath);
  }

  return {
    present,
    missing,
  };
}
