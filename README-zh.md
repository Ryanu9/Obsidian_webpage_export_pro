# Webpage HTML Export

[English](README.md) | 简体中文

将 Obsidian 笔记导出为 HTML 网页。支持单个文件、Canvas 画布或整个仓库的导出。直接访问导出的 HTML 文件，让你可以在任何地方发布你的数字花园。专注于灵活性、功能性和样式一致性。

演示/文档：[docs.obsidianweb.net](https://docs.obsidianweb.net/)

![image](https://github.com/KosmosisDire/obsidian-webpage-export/assets/39423700/b8e227e4-b12c-47fb-b341-5c5c2f092ffa)

![image](https://github.com/KosmosisDire/obsidian-webpage-export/assets/39423700/06f29e1a-c067-45e7-9882-f9d6aa83776f)

> [!NOTE]  
> 虽然插件功能完整，但仍在持续开发中，更新之间可能会有较大的变化，可能会影响你的工作流程！Bug 也不少见，请报告你发现的任何问题，我正在努力使插件更加稳定。

## 功能特性

- 🔍 **全文搜索** - 快速查找笔记内容
- 📁 **文件导航树** - 清晰的目录结构
- 📑 **文档大纲** - 文章结构一目了然
- 🕸️ **图谱视图** - 可视化知识关联
- 🌓 **主题切换** - 支持亮色/暗色模式
- 📱 **移动端优化** - 响应式设计，适配各种设备
- 🔌 **插件兼容** - 支持大多数插件（Dataview、Tasks 等）
- 📦 **单文件导出** - 可选将 HTML 和依赖打包为单个文件
- 🖼️ **图片放大** - 点击图片可全屏查看，支持缩放和拖拽

## 使用指南

查看详细使用文档：https://docs.obsidianweb.net/

### 基本用法

1. 在 Obsidian 中打开要导出的笔记
2. 打开命令面板（`Ctrl/Cmd + P`）
3. 搜索 "Webpage Export" 并选择导出选项
4. 选择导出位置和选项
5. 完成导出

### 导出选项

| 选项 | 描述 |
|------|------|
| 单个文件 | 导出当前打开的笔记 |
| 整个仓库 | 导出仓库中的所有笔记 |
| Canvas | 导出 Canvas 画布文件 |

## 安装

### 从社区插件安装

从 Obsidian 社区插件安装：[在 Obsidian 中打开](https://obsidian.md/plugins?id=webpage-html-export)

### 手动安装

1. 从 [最新发布](https://github.com/KosmosisDire/obsidian-webpage-export/releases/latest) 下载 `.zip` 文件
2. 解压到：`{仓库文件夹}/.obsidian/plugins/`
3. 重新加载 Obsidian

### Beta 版本安装

方法一：按照上述步骤下载 Beta 版本

方法二：使用 BRAT 插件

1. 安装 [BRAT 插件](https://obsidian.md/plugins?id=obsidian42-brat)
2. 打开 BRAT 设置
3. 选择"添加 Beta 插件"
4. 输入仓库地址：`https://github.com/KosmosisDire/obsidian-webpage-export`
5. 点击"添加插件"

## 新增功能

### 图片放大功能

点击文章中的图片可以全屏查看，支持以下交互：

| 交互方式 | 桌面端 | 移动端 |
|---------|--------|--------|
| 点击放大 | ✅ | ✅ |
| 滚轮缩放 | ✅ | ❌ |
| 拖拽移动 | ✅ | ✅ |
| 双指缩放 | ❌ | ✅ |
| ESC 关闭 | ✅ | ✅ |
| 点击遮罩关闭 | ✅ | ✅ |

## 参与贡献

请只为已创建 Issue 并被接受的功能进行开发！
贡献指南即将推出。

## 支持项目

这个插件需要大量工作来维护和添加功能。如果你想支持这个插件的持续开发：

<a href="https://www.buymeacoffee.com/nathangeorge"><img src="https://img.buymeacoffee.com/button-api/?text=请我喝杯咖啡&emoji=☕&slug=nathangeorge&button_colour=3ebba4&font_colour=ffffff&font_family=Poppins&outline_colour=ffffff&coffee_colour=FFDD00"></a>

或者使用 PayPal：

<a href="https://www.paypal.com/donate/?business=HHQBAXQQXT84Q&no_recurring=0&item_name=Hey+%F0%9F%91%8B+I+am+a+Computer+Science+student+working+on+obsidian+plugins.+Thanks+for+your+support%21&currency_code=USD"><img src="https://pics.paypal.com/00/s/MGNjZDA4MDItYzk3MC00NTQ1LTg4ZDAtMzM5MTc4ZmFlMGIy/file.PNG" style="width: 150px;"></a>

## 测试

本项目使用 BrowserStack 进行测试。
[BrowserStack](https://www.browserstack.com/open-source) 为开源项目提供免费的 Web 测试服务。

## 许可证

MIT License

---

如有问题或建议，欢迎提交 [Issue](https://github.com/KosmosisDire/obsidian-webpage-export/issues)！

## 新增功能
- 图片缩放
