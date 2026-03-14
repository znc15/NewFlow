/**
 * @module infrastructure/upstream-skills
 * @description 上游技能仓库同步配置与工具
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { type SkillsPackageSkillSource, syncPublishedSkillsPackages } from './skills-package-pipeline';

export interface UpstreamSkillSource {
  repo: string;
  ref: string;
  sourceSubpath: string;
  skillNames: string[];
}

export interface SkillSyncPlanEntry {
  skillName: string;
  repo: string;
  ref: string;
  sourceSubpath: string;
  targetRoots: string[];
}

/** 所有发布包里需要保持同步的技能根目录 */
export const PACKAGED_SKILL_ROOTS = [
  'skills/codex一键安装技能/.codex-home-claude-parity/skills',
  'skills/codex一键安装技能/纯手动安装/skills',
  'skills/cursor一键安装技能/-Force/skills',
  'skills/cursor一键安装技能/skills',
  'skills/cursor一键安装技能/纯手动安装/skills',
] as const;

/** 目前仍由仓库本地维护、暂不从上游自动覆盖的技能 */
export const LOCAL_ONLY_SKILLS = [
  'feature-dev',
  'code-review',
  'superpowers',
] as const;

/** 上游技能仓库来源映射（基于 skills.sh 查询结果固化，运行时直接从 GitHub 同步以提高稳定性） */
export const UPSTREAM_SKILL_SOURCES: readonly UpstreamSkillSource[] = [
  {
    repo: 'obra/superpowers',
    ref: 'main',
    sourceSubpath: 'skills',
    skillNames: [
      'brainstorming',
      'dispatching-parallel-agents',
      'executing-plans',
      'finishing-a-development-branch',
      'receiving-code-review',
      'requesting-code-review',
      'subagent-driven-development',
      'systematic-debugging',
      'test-driven-development',
      'using-git-worktrees',
      'using-superpowers',
      'verification-before-completion',
      'writing-plans',
      'writing-skills',
    ],
  },
  {
    repo: 'anthropics/skills',
    ref: 'main',
    sourceSubpath: 'skills',
    skillNames: [
      'frontend-design',
    ],
  },
  {
    repo: 'openai/skills',
    ref: 'main',
    sourceSubpath: 'skills/.curated',
    skillNames: [
      'playwright',
    ],
  },
  {
    repo: 'nextlevelbuilder/ui-ux-pro-max-skill',
    ref: 'main',
    sourceSubpath: 'src',
    skillNames: [
      'ui-ux-pro-max',
    ],
  },
] as const;

export function getTrackedUpstreamSkillNames(): string[] {
  return UPSTREAM_SKILL_SOURCES.flatMap(source => source.skillNames);
}

export function buildSkillSyncPlan(): SkillSyncPlanEntry[] {
  return UPSTREAM_SKILL_SOURCES.flatMap(source =>
    source.skillNames.map((skillName) => ({
      skillName,
      repo: source.repo,
      ref: source.ref,
      sourceSubpath: `${source.sourceSubpath}/${skillName}`,
      targetRoots: [...PACKAGED_SKILL_ROOTS],
    })),
  );
}

function cloneRepo(repo: string, ref: string): string {
  const workDir = mkdtempSync(join(tmpdir(), 'newflow-skill-sync-'));
  const repoDir = join(workDir, repo.replace(/[\\/]/g, '__'));
  execFileSync('git', ['clone', '--depth', '1', '--branch', ref, `https://github.com/${repo}.git`, repoDir], {
    stdio: 'pipe',
  });
  return repoDir;
}

export function syncUpstreamSkills(basePath: string, logger: (message: string) => void = console.log): void {
  const plan = buildSkillSyncPlan();
  const repoCache = new Map<string, string>();
  const skillSources: SkillsPackageSkillSource[] = [];

  try {
    for (const entry of plan) {
      const cacheKey = `${entry.repo}@${entry.ref}`;
      let repoDir = repoCache.get(cacheKey);
      if (!repoDir) {
        logger(`同步上游仓库: ${entry.repo}@${entry.ref}`);
        repoDir = cloneRepo(entry.repo, entry.ref);
        repoCache.set(cacheKey, repoDir);
      }

      const sourceDir = join(repoDir, entry.sourceSubpath);
      if (!existsSync(sourceDir)) {
        throw new Error(`上游技能路径不存在: ${entry.repo}/${entry.sourceSubpath}`);
      }

      skillSources.push({
        skillName: entry.skillName,
        sourceDir,
      });
      logger(`已收集技能源: ${entry.skillName} <- ${entry.repo}/${entry.sourceSubpath}`);
    }

    syncPublishedSkillsPackages(basePath, skillSources);
    logger('已生成 Codex / Cursor 技能发布包');
  } finally {
    for (const repoDir of repoCache.values()) {
      rmSync(join(repoDir, '..'), { recursive: true, force: true });
    }
  }
}
