/**
 * @module infrastructure/expectation
 * @description 最终验收与预期达成检查
 */

import type { ExpectationItem, ExpectationReport, ProgressData, WorkflowMeta, TaskEntry } from '../domain/types';
import type { VerifyResult } from '../domain/repository';

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

function normalizeCriterion(criterion: string): string {
  return criterion
    .replace(/\s*已完成并有验证证据\s*$/u, '')
    .replace(/\s*已完成\s*$/u, '')
    .trim();
}

function findRelatedTasks(criterion: string, tasks: TaskEntry[]): TaskEntry[] {
  const normalizedCriterion = normalizeCriterion(criterion);
  return tasks
    .filter(task => task.status === 'done')
    .filter((task) => {
      const haystack = `${task.title} ${task.summary} ${task.description}`;
      return haystack.includes(normalizedCriterion) || similarity(haystack, normalizedCriterion) > 0.18;
    })
    .sort((a, b) => b.summary.length - a.summary.length);
}

export function evaluateExpectations(
  meta: WorkflowMeta | null,
  data: ProgressData,
  verifyResult: VerifyResult,
): ExpectationReport {
  const criteria = meta?.acceptanceCriteria.length
    ? meta.acceptanceCriteria
    : data.tasks.map(task => `${task.title} 已完成并有验证证据`);
  const items: ExpectationItem[] = criteria.map((criterion) => {
    const relatedTasks = findRelatedTasks(criterion, data.tasks);
    const evidence = relatedTasks.map(task => `任务 ${task.id}: ${task.summary || task.title}`);
    if (relatedTasks.length > 0 && verifyResult.passed) {
      return { title: criterion, status: 'met', evidence: [...evidence, `验证状态: ${verifyResult.status ?? 'passed'}`] };
    }
    if (relatedTasks.length > 0) {
      return { title: criterion, status: 'unclear', evidence: [...evidence, verifyResult.error || '缺少明确验证结果'] };
    }
    return { title: criterion, status: 'unmet', evidence: ['未找到直接支撑该验收项的任务产出'] };
  });

  const unmet = items.filter(item => item.status === 'unmet').length;
  const unclear = items.filter(item => item.status === 'unclear').length;
  const summary = unmet > 0
    ? `仍有 ${unmet} 条验收项未达成`
    : unclear > 0
      ? `仍有 ${unclear} 条验收项缺少充分证据`
      : '所有验收项均已达成';

  return {
    generatedAt: new Date().toISOString(),
    summary,
    items,
  };
}

export function formatExpectationReport(report: ExpectationReport): string {
  const lines = [
    '**═══ 预期达成检查 ═══**',
    report.summary,
  ];
  for (const item of report.items) {
    lines.push('');
    lines.push(`- [${item.status}] ${item.title}`);
    lines.push(...item.evidence.map(entry => `  - ${entry}`));
  }
  return lines.join('\n');
}

export function buildFollowUpTasks(
  report: ExpectationReport,
  data: ProgressData,
): Array<Pick<TaskEntry, 'title' | 'description' | 'type' | 'deps'>> {
  const doneTasks = data.tasks.filter(task => task.status === 'done');
  return report.items
    .filter(item => item.status !== 'met')
    .map((item) => {
      const relatedTasks = doneTasks.filter(task => similarity(`${task.title} ${task.summary}`, item.title) > 0.18);
      const inferredType = relatedTasks[0]?.type ?? 'general';
      return {
        title: `补齐验收项：${item.title}`,
        description: item.evidence.join('\n'),
        type: inferredType,
        deps: relatedTasks.map(task => task.id),
      };
    });
}
