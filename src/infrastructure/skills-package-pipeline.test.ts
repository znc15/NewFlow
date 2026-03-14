import { describe, expect, it } from 'vitest';
import {
  GENERATED_FILE_HEADER,
  PACKAGE_SOURCE_ROOT,
  PUBLISHED_PACKAGE_ROOTS,
  buildSkillsPackageRenderPlan,
  resolveRequiredPackageSources,
} from './skills-package-pipeline';

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
});
