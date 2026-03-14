/**
 * @module infrastructure/audit
 * @description 项目问题与重复修改审计
 */

import type { AuditReport, ProgressData, TaskEntry } from '../domain/types';
import type { VerifyResult } from '../domain/repository';
import { collectOwnedFiles, type OwnedFilesState } from './runtime-state';

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

export function buildBaselineAudit(dirtyFiles: string[], verifyResult: VerifyResult): AuditReport {
  return {
    generatedAt: new Date().toISOString(),
    baseline: {
      dirtyFiles: [...dirtyFiles].sort(),
      verifyStatus: verifyResult.status ?? (verifyResult.passed ? 'passed' : 'failed'),
      notes: verifyResult.error ? [verifyResult.error] : [],
    },
    warnings: [],
    blockers: [],
  };
}

function detectRepeatedSummaryWarnings(tasks: TaskEntry[]): string[] {
  const warnings: string[] = [];
  const doneTasks = tasks.filter(task => task.status === 'done' && task.summary.trim().length > 0);
  for (let i = 0; i < doneTasks.length; i++) {
    for (let j = i + 1; j < doneTasks.length; j++) {
      if (similarity(doneTasks[i].summary, doneTasks[j].summary) > 0.9) {
        warnings.push(`任务 ${doneTasks[i].id} 与 ${doneTasks[j].id} 的完成摘要高度相似，可能存在重复修改`);
      }
    }
  }
  return [...new Set(warnings)];
}

function detectRepeatedFailureWarnings(tasks: TaskEntry[]): string[] {
  const failedTasks = tasks.filter(task => task.status === 'failed' && task.summary.trim().length > 0);
  const warnings: string[] = [];
  for (let i = 0; i < failedTasks.length; i++) {
    for (let j = i + 1; j < failedTasks.length; j++) {
      if (similarity(failedTasks[i].summary, failedTasks[j].summary) > 0.8) {
        warnings.push(`任务 ${failedTasks[i].id} 与 ${failedTasks[j].id} 出现相似失败模式`);
      }
    }
  }
  return [...new Set(warnings)];
}

function detectOverlap(ownedFiles: OwnedFilesState, tasks: TaskEntry[]): { warnings: string[]; blockers: string[] } {
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const fileToTasks = new Map<string, string[]>();
  for (const [taskId, files] of Object.entries(ownedFiles.byTask)) {
    for (const file of files) {
      fileToTasks.set(file, [...(fileToTasks.get(file) ?? []), taskId]);
    }
  }

  const warnings: string[] = [];
  const blockers: string[] = [];
  for (const [file, taskIds] of fileToTasks) {
    if (taskIds.length < 2) continue;
    const doneTaskIds = taskIds.filter(taskId => taskMap.get(taskId)?.status === 'done');
    const message = `文件 ${file} 被多个任务重复修改: ${taskIds.join(', ')}`;
    if (doneTaskIds.length >= 2) {
      blockers.push(message);
    } else {
      warnings.push(message);
    }
  }
  return { warnings, blockers };
}

export function buildIncrementalAudit(
  data: ProgressData,
  ownedFiles: OwnedFilesState,
  baseline: AuditReport | null,
): AuditReport {
  const overlap = detectOverlap(ownedFiles, data.tasks);
  const summaryWarnings = detectRepeatedSummaryWarnings(data.tasks);
  const failureWarnings = detectRepeatedFailureWarnings(data.tasks);
  const baselineWarnings = baseline?.baseline.dirtyFiles.length
    ? [`工作流启动前已有 ${baseline.baseline.dirtyFiles.length} 个脏文件基线，审计时将其视为历史问题`]
    : [];

  return {
    generatedAt: new Date().toISOString(),
    baseline: baseline?.baseline ?? {
      dirtyFiles: [],
      verifyStatus: 'not-found',
      notes: [],
    },
    warnings: [...new Set([...baselineWarnings, ...summaryWarnings, ...failureWarnings, ...overlap.warnings])],
    blockers: [...new Set(overlap.blockers)],
  };
}

export function formatAuditReport(report: AuditReport, asJson = false): string {
  if (asJson) {
    return JSON.stringify(report, null, 2);
  }

  const lines = [
    '**═══ 审计结果 ═══**',
    `生成时间: ${report.generatedAt}`,
    `基线脏文件: ${report.baseline.dirtyFiles.length}`,
    `基线验证: ${report.baseline.verifyStatus}`,
  ];

  if (report.warnings.length) {
    lines.push('', '警告:');
    lines.push(...report.warnings.map(item => `- ${item}`));
  }

  if (report.blockers.length) {
    lines.push('', '阻断项:');
    lines.push(...report.blockers.map(item => `- ${item}`));
  }

  if (!report.warnings.length && !report.blockers.length) {
    lines.push('', '未发现重复修改或新增阻断问题');
  }

  return lines.join('\n');
}

export function collectAllOwnedFiles(ownedFiles: OwnedFilesState): string[] {
  return collectOwnedFiles(ownedFiles);
}
