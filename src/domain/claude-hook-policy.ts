/**
 * @module domain/claude-hook-policy
 * @description Claude Code hooks 的共享策略
 */

/** 仍由 FlowPilot 接管的原生工具 */
export const BLOCKED_NATIVE_TOOLS = [
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Explore',
] as const;

const BLOCKED_NATIVE_TOOL_SET = new Set<string>(BLOCKED_NATIVE_TOOLS);

/** FlowPilot 注入的 PreToolUse matcher */
export const PRETOOL_GUARD_MATCHER = '*';

/** FlowPilot 注入的 PreToolUse command */
export const PRETOOL_GUARD_COMMAND = 'node "$CLAUDE_PROJECT_DIR"/flow.js hook pretool-guard';

/** Claude Code 显示给模型的 deny 原因 */
export const PRETOOL_GUARD_REASON = 'Use node flow.js commands instead of native task tools.';

interface ClaudeHookInput {
  hook_event_name?: unknown;
  tool_name?: unknown;
}

/** PreToolUse deny 的 Claude Code 输出结构 */
export interface ClaudePreToolHookDecision {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'deny';
    permissionDecisionReason: string;
  };
}

/** 判断某个工具是否需要由 FlowPilot 拦截 */
export function shouldDenyPreToolUse(toolName: unknown): toolName is string {
  return typeof toolName === 'string' && BLOCKED_NATIVE_TOOL_SET.has(toolName);
}

/** 解析 Claude Code hook stdin，并在需要时返回 deny 决策 */
export function evaluatePreToolHookInput(raw: string): ClaudePreToolHookDecision | null {
  if (!raw.trim()) {
    return null;
  }

  let parsed: ClaudeHookInput;
  try {
    parsed = JSON.parse(raw) as ClaudeHookInput;
  } catch {
    return null;
  }

  if (parsed.hook_event_name !== 'PreToolUse') {
    return null;
  }

  if (!shouldDenyPreToolUse(parsed.tool_name)) {
    return null;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: PRETOOL_GUARD_REASON,
    },
  };
}
