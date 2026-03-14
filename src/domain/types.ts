/**
 * @module domain/types
 * @description 领域值对象与枚举
 */

/** 任务类型 - 决定子Agent调用哪个插件 */
export type TaskType = 'frontend' | 'backend' | 'general';

/** setup 目标客户端 */
export type SetupClient = 'claude' | 'codex' | 'cursor' | 'snow-cli' | 'other';

/** 任务实时阶段 */
export type TaskPhase = 'analysis' | 'implementation' | 'verification' | 'blocked';

/** 任务状态 */
export type TaskStatus = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

/** 工作流状态 */
export type WorkflowStatus = 'idle' | 'running' | 'reconciling' | 'finishing' | 'completed' | 'aborted';

/** 单个任务条目 */
export interface TaskEntry {
  /** 三位数编号如 "001" */
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  /** 依赖的前置任务ID列表 */
  deps: string[];
  /** 完成摘要 */
  summary: string;
  /** 失败重试次数 */
  retries: number;
  /** 子代理最近一次上报的实时阶段 */
  phase?: TaskPhase;
  /** 子代理最近一次上报的阶段时间 */
  phaseUpdatedAt?: string;
  /** 子代理最近一次上报的一句话进展 */
  phaseNote?: string;
  /** 任务激活时间戳 (ms) */
  activatedAt?: number;
}

/** 工作流全局状态 */
export interface ProgressData {
  name: string;
  status: WorkflowStatus;
  current: string | null;
  tasks: TaskEntry[];
  /** 工作流启动时间 ISO */
  startTime?: string;
}

/** 工作流规划来源 */
export type PlanningSource = 'explicit' | 'openspec-tasks' | 'openspec-docs' | 'analyzer' | 'legacy';

/** 工作流元数据 */
export interface WorkflowMeta {
  targetBranch?: string;
  workingBranch?: string;
  planningSource: PlanningSource;
  originalRequest: string;
  assumptions: string[];
  acceptanceCriteria: string[];
  openspecSources: string[];
  analyzerReportRef?: string;
  workflowType?: 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore';
}

/** 审计基线结果 */
export interface AuditBaseline {
  dirtyFiles: string[];
  verifyStatus: 'passed' | 'failed' | 'not-found';
  notes: string[];
}

/** 工作流审计报告 */
export interface AuditReport {
  generatedAt: string;
  baseline: AuditBaseline;
  warnings: string[];
  blockers: string[];
}

/** 验收项状态 */
export type ExpectationStatus = 'met' | 'unclear' | 'unmet';

/** 单条验收结果 */
export interface ExpectationItem {
  title: string;
  status: ExpectationStatus;
  evidence: string[];
}

/** 最终验收报告 */
export interface ExpectationReport {
  generatedAt: string;
  summary: string;
  items: ExpectationItem[];
}

/** 进化日志条目 */
export interface EvolutionEntry {
  timestamp: string;
  workflowName: string;
  configBefore: Record<string, unknown>;
  configAfter: Record<string, unknown>;
  suggestions: string[];
}

/** 工作流历史统计 */
export interface WorkflowStats {
  /** 工作流名称 */
  name: string;
  /** 总任务数 */
  totalTasks: number;
  /** 完成数 */
  doneCount: number;
  /** 跳过数 */
  skipCount: number;
  /** 失败数 */
  failCount: number;
  /** 总重试次数 */
  retryTotal: number;
  /** 按类型分布 { frontend: 3, backend: 5, general: 2 } */
  tasksByType: Record<string, number>;
  /** 按类型统计失败数 */
  failsByType: Record<string, number>;
  /** 每个任务的结果明细 */
  taskResults: { id: string; type: TaskType; status: TaskStatus; retries: number; summary?: string }[];
  /** 工作流开始时间 ISO */
  startTime: string;
  /** 工作流结束时间 ISO */
  endTime: string;
}
