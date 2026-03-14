import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { analyzeTasks } from './analyzer';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'flow-analyzer-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeProjectFile(relativePath: string, content: string): Promise<void> {
  const target = join(dir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf-8');
}

describe('analyzeTasks adaptive openspec gate', () => {
  it('在空项目中优先采用 openspec tasks', async () => {
    await writeProjectFile(
      'openspec/changes/auth/tasks.md',
      ['# 登录流程', '', '## 1. 设计', '- [ ] 1.1 [backend] 设计认证接口'].join('\n'),
    );

    const report = await analyzeTasks(dir, '');

    expect(report.planningSource).toBe('openspec-tasks');
    expect(report.openspecSources).toEqual([join(dir, 'openspec/changes/auth/tasks.md')]);
    expect(report.tasksMarkdown).toContain('[backend] 设计认证接口');
  });

  it('在 markdown-only 的稀疏项目中融合 openspec docs', async () => {
    await writeProjectFile('README.md', '# 项目说明\n\n这里只有文档');
    await writeProjectFile('docs/notes.md', '# 设计记录');
    await writeProjectFile(
      'openspec/changes/auth/proposal.md',
      '# 登录提案\n\n实现邮箱密码登录与会话保持',
    );

    const report = await analyzeTasks(dir, '实现登录功能');

    expect(report.planningSource).toBe('openspec-docs');
    expect(report.openspecSources).toEqual([join(dir, 'openspec/changes/auth/proposal.md')]);
    expect(report.tasksMarkdown).toContain('实现登录功能');
  });

  it('在已有代码的项目中默认不使用 openspec', async () => {
    await writeProjectFile('README.md', '# 项目说明');
    await writeProjectFile('src/index.ts', 'export const ready = true;\n');
    await writeProjectFile(
      'openspec/changes/auth/proposal.md',
      '# 登录提案\n\n实现邮箱密码登录与会话保持',
    );

    const report = await analyzeTasks(dir, '实现登录功能');

    expect(report.planningSource).toBe('analyzer');
    expect(report.openspecSources).toEqual([]);
  });

  it('允许 agent 通过 USE_OPENSPEC 显式启用 openspec', async () => {
    await writeProjectFile('src/index.ts', 'export const ready = true;\n');
    await writeProjectFile(
      'openspec/changes/auth/tasks.md',
      ['# 登录流程', '', '## 1. 设计', '- [ ] 1.1 [backend] 设计认证接口'].join('\n'),
    );

    const report = await analyzeTasks(dir, '[USE_OPENSPEC] 实现登录功能');

    expect(report.planningSource).toBe('openspec-tasks');
    expect(report.originalRequest).toBe('实现登录功能');
    expect(report.originalRequest).not.toContain('USE_OPENSPEC');
  });

  it('允许 agent 通过 NO_OPENSPEC 显式跳过 openspec', async () => {
    await writeProjectFile('README.md', '# 项目说明\n\n这里只有文档');
    await writeProjectFile(
      'openspec/changes/auth/proposal.md',
      '# 登录提案\n\n实现邮箱密码登录与会话保持',
    );

    const report = await analyzeTasks(dir, '[NO_OPENSPEC] 实现登录功能');

    expect(report.planningSource).toBe('analyzer');
    expect(report.openspecSources).toEqual([]);
    expect(report.originalRequest).toBe('实现登录功能');
  });
});
