import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_FILE_HEADER,
  PACKAGE_SOURCE_ROOT,
  PUBLISHED_PACKAGE_ROOTS,
  buildSkillsPackageRenderPlan,
  renderSkillsPackages,
  resolveRequiredPackageSources,
} from './skills-package-pipeline';

function createSkillFixture(rootDir: string, skillName: string): string {
  const skillDir = join(rootDir, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `# ${skillName}\n\nfixture for ${skillName}\n`);
  return skillDir;
}

describe('skills-package-pipeline', () => {
  it('uses skills-src as the single editable source root', () => {
    expect(PACKAGE_SOURCE_ROOT).toBe('skills-src');
    expect(PUBLISHED_PACKAGE_ROOTS).toEqual({
      codex: 'skills/codex一键安装技能',
      cursor: 'skills/cursor一键安装技能',
    });
  });

  it('builds render entries for both published package directories', () => {
    const plan = buildSkillsPackageRenderPlan('/repo');
    const codex = plan.packages.find(entry => entry.packageId === 'codex');
    const cursor = plan.packages.find(entry => entry.packageId === 'cursor');

    expect(plan.sourceRoot).toBe('skills-src');
    expect(plan.packages.map(entry => entry.packageId)).toEqual([
      'codex',
      'cursor',
    ]);
    expect(codex).toMatchObject({
      outputRoot: 'skills/codex一键安装技能',
      skillsRoots: [
        'skills/codex一键安装技能/.codex-home-claude-parity/skills',
        'skills/codex一键安装技能/纯手动安装/skills',
      ],
    });
    expect(cursor).toMatchObject({
      outputRoot: 'skills/cursor一键安装技能',
      skillsRoots: [
        'skills/cursor一键安装技能/-Force/skills',
        'skills/cursor一键安装技能/skills',
        'skills/cursor一键安装技能/纯手动安装/skills',
      ],
    });
  });

  it('marks generated files and separates template source groups', () => {
    const plan = buildSkillsPackageRenderPlan('/repo');

    expect(GENERATED_FILE_HEADER).toContain('GENERATED FILE - DO NOT EDIT');
    for (const entry of plan.packages) {
      expect(entry.requiredSourceRoots).toEqual(expect.arrayContaining([
        'shared/skills',
        'shared/templates',
        'runtime',
      ]));
      expect(entry.fileGroups.map(group => group.kind)).toEqual(expect.arrayContaining([
        'root',
        'manual',
        'tests',
        'runtime',
        'skills',
      ]));
    }
  });

  it('resolves required package template files from skills-src', () => {
    const required = resolveRequiredPackageSources(process.cwd());

    expect(required.present).toEqual(expect.arrayContaining([
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
    ]));
    expect(required.missing).toEqual([]);
  });

  it('renders codex and cursor package trees from skills-src plus upstream skills', () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'skills-package-render-'));
    const upstreamRoot = mkdtempSync(join(tmpdir(), 'skills-package-upstream-'));

    try {
      const skillSources = [
        {
          skillName: 'brainstorming',
          sourceDir: createSkillFixture(upstreamRoot, 'brainstorming'),
        },
        {
          skillName: 'playwright',
          sourceDir: createSkillFixture(upstreamRoot, 'playwright'),
        },
      ];

      renderSkillsPackages(process.cwd(), outputRoot, skillSources);

      expect(existsSync(join(outputRoot, 'skills/codex一键安装技能/install.sh'))).toBe(true);
      expect(existsSync(join(outputRoot, 'skills/cursor一键安装技能/install_cursor_skills.sh'))).toBe(true);
      expect(existsSync(join(outputRoot, 'skills/codex一键安装技能/纯手动安装/README.md'))).toBe(true);
      expect(existsSync(join(outputRoot, 'skills/cursor一键安装技能/tests/wrapper-forwarding.ps1'))).toBe(true);
      expect(readFileSync(join(
        outputRoot,
        'skills/codex一键安装技能/.codex-home-claude-parity/skills/brainstorming/SKILL.md',
      ), 'utf8')).toContain('fixture for brainstorming');
      expect(readFileSync(join(
        outputRoot,
        'skills/cursor一键安装技能/skills/playwright/SKILL.md',
      ), 'utf8')).toContain('fixture for playwright');
      expect(existsSync(join(
        outputRoot,
        'skills/cursor一键安装技能/skills/feature-dev/SKILL.md',
      ))).toBe(true);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
      rmSync(upstreamRoot, { recursive: true, force: true });
    }
  });
});
