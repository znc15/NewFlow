/**
 * @module infrastructure/analyzer
 * @description 内置自动分析器 - 生成任务清单、验收标准与单任务分析摘要
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ProgressData, TaskEntry, WorkflowMeta } from '../domain/types';

const ANALYZER_REPORT_FILE = 'analyzer-report.json';

export interface AnalyzerReport {
  generatedAt: string;
  planningSource: WorkflowMeta['planningSource'];
  workflowType: NonNullable<WorkflowMeta['workflowType']>;
  workflowTitle: string;
  originalRequest: string;
  assumptions: string[];
  acceptanceCriteria: string[];
  openspecSources: string[];
  tasksMarkdown: string;
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const m of text.toLowerCase().matchAll(/[a-z0-9_]+|[\u4e00-\u9fff]/g)) {
    tokens.add(m[0]);
  }
  return tokens;
}

function similarity(a: string, b: string): number {
  const sa = tokenize(a);
  const sb = tokenize(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const token of sa) {
    if (sb.has(token)) inter++;
  }
  return inter / (sa.size + sb.size - inter);
}

function deriveTaskType(text: string): TaskEntry['type'] {
  const normalized = text.toLowerCase();
  if (/(ui|页面|前端|组件|样式|交互|视图|路由)/.test(normalized)) return 'frontend';
  if (/(接口|api|服务|数据库|后端|鉴权|任务|队列|支付|回调|存储|schema)/.test(normalized)) return 'backend';
  return 'general';
}

function deriveWorkflowType(text: string): NonNullable<WorkflowMeta['workflowType']> {
  const normalized = text.toLowerCase();
  if (/(修复|fix|bug|异常|回归|错误|失败)/.test(normalized)) return 'fix';
  if (/(重构|refactor|整理|抽象)/.test(normalized)) return 'refactor';
  if (/(文档|readme|说明)/.test(normalized)) return 'docs';
  if (/(测试|用例|验收)/.test(normalized)) return 'test';
  if (/(脚手架|配置|维护|chore)/.test(normalized)) return 'chore';
  return 'feat';
}

function deriveWorkflowTitle(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .split(/[。！？!?\n]/)[0]
    .trim();
  return cleaned.slice(0, 40) || '自动分析工作流';
}

function splitRequirements(text: string): string[] {
  const parts = text
    .split(/\n+/)
    .flatMap(line => line.split(/[；;。！？!?,，]/))
    .map(part => part.trim())
    .filter(part => part.length > 0);

  const results: string[] = [];
  for (const part of parts) {
    if (!results.some(existing => similarity(existing, part) > 0.85)) {
      results.push(part);
    }
  }
  return results.slice(0, 6);
}

function buildTasksMarkdown(title: string, requirements: string[]): string {
  const tasks = requirements.length > 0 ? requirements : ['梳理需求并完成实现'];
  const lines = [`# ${title}`, '', '内置分析器自动生成的任务清单', ''];
  for (const [index, requirement] of tasks.entries()) {
    const taskType = deriveTaskType(requirement);
    lines.push(`${index + 1}. [${taskType}] ${requirement}`);
    lines.push(`  自动分析关注点：${requirement}`);
  }
  return lines.join('\n');
}

function buildAcceptanceCriteria(requirements: string[]): string[] {
  if (requirements.length === 0) return ['核心目标已实现并通过验证'];
  return requirements.map(item => `${item} 已完成并有明确验证证据`);
}

function buildAssumptions(input: string): string[] {
  const assumptions: string[] = [];
  if (!/(不要|禁止|不能|must not|禁止)/i.test(input)) {
    assumptions.push('默认尽量复用项目现有技术栈与目录结构');
  }
  if (!/(兼容|migration|迁移|回滚)/i.test(input)) {
    assumptions.push('默认不引入破坏性迁移，优先走增量改造');
  }
  return assumptions;
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function findLatestOpenSpecTasks(basePath: string): Promise<{ path: string; content: string } | null> {
  const changesDir = join(basePath, 'openspec', 'changes');
  let entries;
  try {
    entries = await readdir(changesDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates: Array<{ path: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(changesDir, entry.name, 'tasks.md');
    try {
      const fileStat = await stat(path);
      candidates.push({ path, mtimeMs: fileStat.mtimeMs });
    } catch {
      // ignore missing tasks
    }
  }

  const latest = candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!latest) return null;
  const content = await readTextFile(latest.path);
  return content ? { path: latest.path, content } : null;
}

async function collectOpenSpecDocs(basePath: string): Promise<Array<{ path: string; content: string }>> {
  const result: Array<{ path: string; content: string }> = [];
  const changesDir = join(basePath, 'openspec', 'changes');
  let entries;
  try {
    entries = await readdir(changesDir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const relativePath of ['proposal.md', 'design.md', 'spec.md']) {
      const fullPath = join(changesDir, entry.name, relativePath);
      const content = await readTextFile(fullPath);
      if (content) {
        result.push({ path: fullPath, content });
      }
    }
  }
  return result;
}

async function saveAnalyzerReport(basePath: string, report: AnalyzerReport): Promise<void> {
  const runtimeDir = join(basePath, '.workflow');
  await mkdir(runtimeDir, { recursive: true });
  const path = join(runtimeDir, ANALYZER_REPORT_FILE);
  await writeFile(path, JSON.stringify(report, null, 2) + '\n', 'utf-8');
}

export async function loadAnalyzerReport(basePath: string): Promise<AnalyzerReport | null> {
  return readTextFile(join(basePath, '.workflow', ANALYZER_REPORT_FILE)).then(raw => raw ? JSON.parse(raw) as AnalyzerReport : null).catch(() => null);
}

export async function analyzeTasks(basePath: string, input: string): Promise<AnalyzerReport> {
  const trimmedInput = input.trim();
  const openSpecTasks = await findLatestOpenSpecTasks(basePath);
  if (!trimmedInput && openSpecTasks) {
    const report: AnalyzerReport = {
      generatedAt: new Date().toISOString(),
      planningSource: 'openspec-tasks',
      workflowType: 'feat',
      workflowTitle: deriveWorkflowTitle(openSpecTasks.content),
      originalRequest: openSpecTasks.content,
      assumptions: ['默认采用 OpenSpec 生成的任务清单'],
      acceptanceCriteria: buildAcceptanceCriteria(splitRequirements(openSpecTasks.content)),
      openspecSources: [openSpecTasks.path],
      tasksMarkdown: openSpecTasks.content,
    };
    await saveAnalyzerReport(basePath, report);
    return report;
  }

  const openSpecDocs = await collectOpenSpecDocs(basePath);
  const projectDocs = (await Promise.all([
    readTextFile(join(basePath, 'README.md')),
    readTextFile(join(basePath, 'AGENTS.md')),
    readTextFile(join(basePath, 'CLAUDE.md')),
  ])).filter((content): content is string => Boolean(content && content.trim()));
  const combinedInput = [
    trimmedInput,
    ...openSpecDocs.map(doc => doc.content),
    ...projectDocs,
  ].filter(Boolean).join('\n');

  const requirements = splitRequirements(combinedInput);
  const workflowTitle = deriveWorkflowTitle(trimmedInput || openSpecDocs[0]?.content || projectDocs[0] || '自动分析工作流');
  const report: AnalyzerReport = {
    generatedAt: new Date().toISOString(),
    planningSource: openSpecDocs.length > 0 ? 'openspec-docs' : 'analyzer',
    workflowType: deriveWorkflowType(trimmedInput || combinedInput),
    workflowTitle,
    originalRequest: trimmedInput || workflowTitle,
    assumptions: buildAssumptions(combinedInput),
    acceptanceCriteria: buildAcceptanceCriteria(requirements),
    openspecSources: openSpecDocs.map(doc => doc.path),
    tasksMarkdown: buildTasksMarkdown(workflowTitle, requirements),
  };
  await saveAnalyzerReport(basePath, report);
  return report;
}

export function analyzeSingleTask(data: ProgressData, task: TaskEntry, meta: WorkflowMeta | null): string {
  const lines = [
    `# 任务 ${task.id} 分析`,
    '',
    `- 标题: ${task.title}`,
    `- 类型: ${task.type}`,
    `- 依赖: ${task.deps.length ? task.deps.join(', ') : '无'}`,
    `- 当前状态: ${task.status}`,
    '',
    '## 目标',
    task.description || task.title,
    '',
    '## 关键假设',
    ...(meta?.assumptions.length ? meta.assumptions.map(item => `- ${item}`) : ['- 默认沿用项目现有实现方式']),
    '',
    '## 风险',
    ...(task.deps.length
      ? [`- 依赖任务 ${task.deps.join(', ')} 的上下文与实现可能影响当前方案`]
      : ['- 需要先确认修改边界，避免与其他任务重复改同一文件']),
    '',
    '## 建议验证项',
    ...(meta?.acceptanceCriteria.length
      ? meta.acceptanceCriteria.slice(0, 3).map(item => `- ${item}`)
      : [`- ${task.title} 已完成并有明确验证证据`]),
    '',
    '## 工作流摘要',
    `${data.name} · ${data.tasks.filter(entry => entry.status === 'done').length}/${data.tasks.length} 已完成`,
  ];
  return lines.join('\n');
}
