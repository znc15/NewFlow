/**
 * @module infrastructure/skills-package-pipeline
 * @description skills 发布包源码树与渲染计划
 */

import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

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
  | 'force'
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

export interface SkillsPackageSkillSource {
  skillName: string;
  sourceDir: string;
}

const GENERATED_HEADER_BY_EXTENSION: Record<string, string> = {
  '.bat': `:: ${GENERATED_FILE_HEADER}`,
  '.cmd': `:: ${GENERATED_FILE_HEADER}`,
  '.md': `<!-- ${GENERATED_FILE_HEADER} -->`,
  '.ps1': `# ${GENERATED_FILE_HEADER}`,
  '.sh': `# ${GENERATED_FILE_HEADER}`,
  '.toml': `# ${GENERATED_FILE_HEADER}`,
  '.txt': GENERATED_FILE_HEADER,
};

const REQUIRED_RENDERED_FILES: Record<SkillsPackageId, string[]> = {
  codex: [
    'install.sh',
    'README.md',
    '.codex-home-claude-parity/skills/feature-dev/SKILL.md',
    '纯手动安装/README.md',
    '纯手动安装/context7-local-bundled/package.json',
  ],
  cursor: [
    'install_cursor_skills.sh',
    'README.md',
    '-Force/mcp.json',
    '-Force/run-context7.cmd',
    'skills/feature-dev/SKILL.md',
    'tests/wrapper-forwarding.ps1',
  ],
};

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
        kind: 'force',
        sourceRoot: 'packages/cursor/force',
        outputRoot: 'skills/cursor一键安装技能/-Force',
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

function copyDirectoryContents(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    cpSync(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
  }
}

function copySkillDirectory(sourceDir: string, targetRoots: string[], skillName: string): void {
  for (const targetRoot of targetRoots) {
    const targetSkillDir = join(targetRoot, skillName);
    mkdirSync(targetSkillDir, { recursive: true });
    copyDirectoryContents(sourceDir, targetSkillDir);
  }
}

function appendGeneratedHeader(targetPath: string): void {
  if (statSync(targetPath).isDirectory()) {
    for (const entry of readdirSync(targetPath)) {
      appendGeneratedHeader(join(targetPath, entry));
    }
    return;
  }

  const extension = extname(targetPath);
  const banner = GENERATED_HEADER_BY_EXTENSION[extension];
  if (!banner) {
    return;
  }

  const content = readFileSync(targetPath, 'utf8');
  if (content.includes(GENERATED_FILE_HEADER)) {
    return;
  }

  if (extension === '.sh' && content.startsWith('#!')) {
    const newlineIndex = content.indexOf('\n');
    if (newlineIndex === -1) {
      writeFileSync(targetPath, `${content}\n${banner}\n`);
      return;
    }

    writeFileSync(
      targetPath,
      `${content.slice(0, newlineIndex + 1)}${banner}\n${content.slice(newlineIndex + 1)}`,
    );
    return;
  }

  writeFileSync(targetPath, `${banner}\n${content}`);
}

function verifyRenderedSkillsPackages(outputRoot: string): void {
  for (const [packageId, packageRoot] of Object.entries(PUBLISHED_PACKAGE_ROOTS) as Array<[SkillsPackageId, string]>) {
    for (const relativePath of REQUIRED_RENDERED_FILES[packageId]) {
      const targetPath = join(outputRoot, packageRoot, relativePath);
      if (!existsSync(targetPath)) {
        throw new Error(`Missing rendered package file: ${packageRoot}/${relativePath}`);
      }
    }
  }
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
    'shared/skills/ui-ux-pro-max/SKILL.md',
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

/**
 * 将 skills-src 与技能快照渲染为发布包目录。
 */
export function renderSkillsPackages(
  repoRoot: string,
  outputRoot: string,
  skillSources: SkillsPackageSkillSource[],
): void {
  const plan = buildSkillsPackageRenderPlan(repoRoot);
  const sourceRoot = join(repoRoot, plan.sourceRoot);

  for (const entry of plan.packages) {
    for (const group of entry.fileGroups) {
      if (group.kind === 'skills' || group.kind === 'runtime') {
        continue;
      }
      const targetDir = join(outputRoot, group.outputRoot);
      copyDirectoryContents(join(sourceRoot, group.sourceRoot), targetDir);
      appendGeneratedHeader(targetDir);
    }

    if (entry.packageId === 'codex') {
      cpSync(
        join(sourceRoot, 'runtime/context7-local-bundled'),
        join(outputRoot, 'skills/codex一键安装技能/纯手动安装/context7-local-bundled'),
        { recursive: true },
      );
    }

    if (entry.packageId === 'cursor') {
      cpSync(
        join(sourceRoot, 'runtime/context7-local-bundled'),
        join(outputRoot, 'skills/cursor一键安装技能/-Force/context7-local'),
        { recursive: true },
      );
    }

    const sharedSkillsRoot = join(sourceRoot, 'shared/skills');
    for (const skillName of readdirSync(sharedSkillsRoot)) {
      copySkillDirectory(
        join(sharedSkillsRoot, skillName),
        entry.skillsRoots.map(targetRoot => join(outputRoot, targetRoot)),
        skillName,
      );
    }

    for (const skillSource of skillSources) {
      copySkillDirectory(
        skillSource.sourceDir,
        entry.skillsRoots.map(targetRoot => join(outputRoot, targetRoot)),
        skillSource.skillName,
      );
    }
  }
}

/**
 * 原子化同步正式发布包目录；任何阶段失败都回滚到原始状态。
 */
export function syncPublishedSkillsPackages(
  repoRoot: string,
  skillSources: SkillsPackageSkillSource[],
): void {
  const required = resolveRequiredPackageSources(repoRoot);
  if (required.missing.length > 0) {
    throw new Error(`Missing required package sources: ${required.missing.join(', ')}`);
  }

  const stageRoot = mkdtempSync(join(repoRoot, '.skills-package-stage-'));
  const renderedRoot = join(stageRoot, 'rendered');
  const backups = Object.entries(PUBLISHED_PACKAGE_ROOTS).map(([packageId, outputRoot]) => ({
    packageId: packageId as SkillsPackageId,
    targetRoot: join(repoRoot, outputRoot),
    renderedRoot: join(renderedRoot, outputRoot),
    backupRoot: join(stageRoot, `backup-${packageId}`),
  }));
  const restoredTargets: string[] = [];

  try {
    renderSkillsPackages(repoRoot, renderedRoot, skillSources);
    verifyRenderedSkillsPackages(renderedRoot);

    for (const entry of backups) {
      if (existsSync(entry.targetRoot)) {
        renameSync(entry.targetRoot, entry.backupRoot);
      }
    }

    for (const entry of backups) {
      mkdirSync(dirname(entry.targetRoot), { recursive: true });
      renameSync(entry.renderedRoot, entry.targetRoot);
      restoredTargets.push(entry.targetRoot);
    }

    for (const entry of backups) {
      rmSync(entry.backupRoot, { recursive: true, force: true });
    }
  } catch (error) {
    for (const entry of backups) {
      if (restoredTargets.includes(entry.targetRoot)) {
        rmSync(entry.targetRoot, { recursive: true, force: true });
      }
      if (existsSync(entry.backupRoot) && !existsSync(entry.targetRoot)) {
        renameSync(entry.backupRoot, entry.targetRoot);
      }
    }
    throw error;
  } finally {
    rmSync(stageRoot, { recursive: true, force: true });
  }
}
