# Changelog

本项目的版本变更记录遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的结构。

## [0.3.2] - 2026-09-17

### 改进

- 将 `Zotero URL` 的复制光标改为普通手形指针，去除 macOS 悬停时容易被误认为按钮图标的“+”标记。
- 保留点击复制行为和复制成功提示，不改变链接的实际功能。

## [0.3.1] - 2026-09-17

### 改进

- 将 `Zotero URL` 从大尺寸按钮改为“已存在”标签下方的紧凑文本链接，减少标识符列的视觉干扰。
- 链接沿用“已存在”标签的紫色视觉语言，并补充悬停、键盘焦点和深色模式样式。
- 使用独立链接样式，避免受到检索按钮等全局按钮规则影响。

## [0.3.0] - 2026-09-17

### 新增

- 文献题录导入完成后，自动调用 Zotero 原生“查找可用全文”，尝试附加可获取的 PDF。
- 全文查找与题录导入结果分开处理：全文查找失败时保留已导入题录，并在状态栏显示具体错误。
- “已存在”和刚导入的记录显示 `Zotero URL`，点击即可复制完整的 `zotero://select/...` 地址。
- 同时支持个人文库地址 `zotero://select/library/items/...` 和群组文库地址 `zotero://select/groups/.../items/...`。

### 改进

- 去重查询在确认 PMID 已存在时同时取得对应 Zotero 条目，避免为了生成链接再次检索。
- 成功导入或确认已存在后立即更新当前结果行并取消勾选；导入失败的记录不会被错误标记为“已存在”，可以直接重试。
- README 增加自动全文查找、Zotero URL 复制及其适用范围说明。

## [0.2.3] - 2026-08-20

### 改进

- 将重复文献的“已存在”徽标调整为深紫色样式，并适配深色模式。

## [0.2.2] - 2026-08-20

### 改进

- 摘要默认显示三行并以省略号截断，可展开查看全文并再次收起。
- 无摘要的检索结果不再显示占位文字。

## [0.2.1] - 2026-08-20

### 新增

- 在检索结果中显示最多三行 PubMed 摘要预览。
- 结构化摘要保留段落标签，无摘要时显示明确提示。

## [0.2.0] - 2026-08-19

### 新增

- 在 Zotero 工具菜单和文献工具栏中增加 PubMed 检索入口。
- 支持 PubMed 检索、排序、分页和跨页选择。
- 显示题名、作者、期刊、日期、PMID 与 DOI。
- 批量导入至当前文库或分类。
- 按 PMID 检查并跳过当前文库中的重复记录。
- 支持浅色和深色界面。

[0.2.0]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.2.0
[0.2.1]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.2.1
[0.2.2]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.2.2
[0.2.3]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.2.3
[0.3.0]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.3.0
[0.3.1]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.3.1
[0.3.2]: https://github.com/nkbaim/pubmed-importer/releases/tag/v0.3.2
