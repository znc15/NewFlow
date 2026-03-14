# NewFlow 总览

## 一图看懂

```mermaid
flowchart TD
    A[用户需求 / 文档 / OpenSpec] --> B[node flow.js analyze --tasks]
    B --> C[node flow.js init]
    C --> D[node flow.js next --batch]
    D --> E[子代理并行执行]
    E --> F[node flow.js checkpoint]
    F --> G{全部任务完成?}
    G -- 否 --> D
    G -- 是 --> H[node flow.js review]
    H --> I[node flow.js audit]
    I --> J[node flow.js finish]
    J --> K{预期全部达标?}
    K -- 否 --> L[自动补 follow-up tasks]
    L --> D
    K -- 是 --> M[目标分支单条中文规范提交]
```

## 推荐日常流程

```mermaid
flowchart LR
    S[setup: node flow.js init] --> R[在客户端描述需求]
    R --> A[analyze]
    A --> N[next / next --batch]
    N --> C[checkpoint]
    C --> V{还有任务?}
    V -- 是 --> N
    V -- 否 --> RE[review]
    RE --> AU[audit]
    AU --> F[finish]
```

## 工作流状态

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running: init
    Running --> Reconciling: resume 检测到残留变更
    Reconciling --> Running: adopt / restart / skip
    Running --> Finishing: review
    Finishing --> Running: audit 或 expectation 未通过
    Finishing --> Idle: finish 成功
    Running --> Aborted: abort
    Aborted --> Idle
```

## 规划输入优先级

| 优先级 | 来源 | 说明 |
|---|---|---|
| 1 | 显式传入的任务列表 | 你直接 pipe 给 `init` 的内容 |
| 2 | `openspec/changes/*/tasks.md` | 自动选择最近活跃的 OpenSpec 任务文件 |
| 3 | OpenSpec proposal/spec/design | 自动作为分析上下文 |
| 4 | 内置分析器 | `node flow.js analyze --tasks` 自动生成 |

## 目录结构

```mermaid
graph LR
    A[client / agent] --> B[flow.js]
    B --> C[".workflow/ 运行态"]
    B --> D[".flowpilot/ 持久化"]
    B --> E[Git]

    C --> C1[progress.md]
    C --> C2[tasks.md]
    C --> C3[context/task-xxx.md]
    C --> C4[summary.md]

    D --> D1[config.json]
    D --> D2[memory.json]
    D --> D3[history/]
    D --> D4[evolution/]
```

| 路径 | 用途 |
|---|---|
| `.workflow/progress.md` | 主代理只读的当前任务状态 |
| `.workflow/tasks.md` | 当前工作流任务定义 |
| `.workflow/context/task-xxx.md` | 单任务产出和决策 |
| `.workflow/summary.md` | 滚动摘要 |
| `.flowpilot/config.json` | 持久配置 |
| `.flowpilot/memory.json` | 长期记忆 |
| `.flowpilot/history/` | 历史统计 |
| `.flowpilot/evolution/` | Reflect / Experiment / Review 记录 |

## Git 策略

### 当前行为

| 项目 | 策略 |
|---|---|
| 任务级提交 | 只存在于内部运行分支 |
| 目标分支历史 | 最终只保留一条中文规范提交 |
| 提交风格 | 中文 Conventional Commits 风格 |
| 提交正文 | 自动列出变更摘要、详细修改、涉及文件、验证与验收结果 |

### 收尾门禁

```mermaid
flowchart LR
    A[verify] --> B[review]
    B --> C[audit]
    C --> D[expectation gate]
    D --> E{全部达标?}
    E -- 否 --> F[自动补任务继续跑]
    E -- 是 --> G[squash 到目标分支]
```

这意味着：

- `finish` 不再只是“跑测试”
- 如果检测到重复修改、问题引入或预期未达成，工作流不会结束
- 只有所有门禁通过，才会生成最终提交并回到待命状态

## OpenSpec 集成

NewFlow 已将 OpenSpec 作为一等输入源：

- 有 `tasks.md` 时优先直接使用
- 只有 proposal/spec/design 时会自动融合为分析上下文
- OpenSpec checkbox 任务格式会被自动识别
- 最终 expectation gate 会优先参考 OpenSpec 中的验收信息

## 适合什么场景

| 场景 | 是否适合 |
|---|---|
| 多任务、可并行的功能开发 | 很适合 |
| 容易中断、需要恢复的长流程开发 | 很适合 |
| 需要保留长期记忆和阶段产出的项目 | 很适合 |
| 想把最终 Git 历史压成干净提交 | 很适合 |
| 只想临时改一行代码 | 不一定值得上完整工作流 |
