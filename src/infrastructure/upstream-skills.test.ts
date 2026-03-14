import { describe, expect, it } from 'vitest';
import { PACKAGE_SOURCE_ROOT } from './skills-package-pipeline';
import {
  LOCAL_ONLY_SKILLS,
  PACKAGED_SKILL_ROOTS,
  UPSTREAM_SKILL_SOURCES,
  buildSkillSyncPlan,
  getTrackedUpstreamSkillNames,
} from './upstream-skills';

describe('upstream-skills', () => {
  it('defines all packaged skill roots that receive synced snapshots', () => {
    expect(PACKAGE_SOURCE_ROOT).toBe('skills-src');
    expect(PACKAGED_SKILL_ROOTS).toEqual([
      'skills/codex一键安装技能/.codex-home-claude-parity/skills',
      'skills/codex一键安装技能/纯手动安装/skills',
      'skills/cursor一键安装技能/-Force/skills',
      'skills/cursor一键安装技能/skills',
      'skills/cursor一键安装技能/纯手动安装/skills',
    ]);
  });

  it('tracks the expected upstream repos and key skills', () => {
    expect(UPSTREAM_SKILL_SOURCES.map(source => source.repo)).toEqual([
      'obra/superpowers',
      'anthropics/skills',
      'openai/skills',
      'nextlevelbuilder/ui-ux-pro-max-skill',
    ]);
    expect(getTrackedUpstreamSkillNames()).toEqual(expect.arrayContaining([
      'brainstorming',
      'frontend-design',
      'playwright',
      'ui-ux-pro-max',
      'using-superpowers',
    ]));
  });

  it('keeps locally maintained skills outside upstream sync', () => {
    expect(LOCAL_ONLY_SKILLS).toEqual(expect.arrayContaining([
      'feature-dev',
      'code-review',
      'superpowers',
    ]));
    expect(getTrackedUpstreamSkillNames()).not.toEqual(expect.arrayContaining([
      'feature-dev',
      'code-review',
      'superpowers',
    ]));
  });

  it('builds a sync plan that targets every packaged root for every tracked skill', () => {
    const plan = buildSkillSyncPlan();
    const playwright = plan.find(entry => entry.skillName === 'playwright');
    const frontendDesign = plan.find(entry => entry.skillName === 'frontend-design');
    const uiUx = plan.find(entry => entry.skillName === 'ui-ux-pro-max');

    expect(playwright).toMatchObject({
      repo: 'openai/skills',
      sourceSubpath: 'skills/.curated/playwright',
    });
    expect(frontendDesign).toMatchObject({
      repo: 'anthropics/skills',
      sourceSubpath: 'skills/frontend-design',
    });
    expect(uiUx).toMatchObject({
      repo: 'nextlevelbuilder/ui-ux-pro-max-skill',
      sourceSubpath: 'src/ui-ux-pro-max',
    });
    expect(playwright?.targetRoots).toHaveLength(PACKAGED_SKILL_ROOTS.length);
    expect(uiUx?.targetRoots).toEqual(PACKAGED_SKILL_ROOTS);
  });
});
