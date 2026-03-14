# skills-src

`skills-src/` 是 skills 发布包的唯一可编辑源码目录。

维护约定：

- 共享本地技能放在 `shared/skills/`
- 共享生成模板放在 `shared/templates/`
- 产品差异化脚本和文档放在 `packages/codex/` 与 `packages/cursor/`
- 共享运行时快照放在 `runtime/`
- `skills/codex一键安装技能/` 与 `skills/cursor一键安装技能/` 视为生成产物，不直接手改
