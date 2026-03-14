/**
 * @module test-support/git
 * @description Git 测试辅助：显式固定默认分支，避免测试输出 branch hint
 */

import { execFileSync } from 'node:child_process';

/** 生成安静的 git init 参数，避免 Git 3.0 默认分支提示污染测试输出 */
export function gitInitArgs(defaultBranch = 'main'): string[] {
  return ['-c', `init.defaultBranch=${defaultBranch}`, 'init'];
}

/** 初始化测试仓库，并显式声明默认分支 */
export function initGitRepoQuiet(repoDir: string, defaultBranch = 'main'): void {
  execFileSync('git', gitInitArgs(defaultBranch), { cwd: repoDir, stdio: 'pipe' });
}
