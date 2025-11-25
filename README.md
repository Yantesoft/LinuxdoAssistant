# Linuxdo 自动阅读助手 2.0

> 一个智能的 Linuxdo 论坛自动阅读工具，帮助你高效浏览帖子，提升活跃度

## 📋 目录

- [功能特性](#功能特性)
- [安装方法](#安装方法)
- [使用指南](#使用指南)
- [功能说明](#功能说明)
- [配置参数](#配置参数)
- [更新日志](#更新日志)
- [常见问题](#常见问题)
- [技术支持](#技术支持)

## ✨ 功能特性

### ▶️ 核心功能

- **自动滚动阅读**：自动滚动帖子内容，无需手动操作
- **智能跳转**：阅读完成后自动跳转到新帖子
- **去重机制**：自动记录已访问的帖子，避免重复阅读
- **一键控制**：简单的开关按钮，随时启动或停止

### 🎛️ 高级功能

- **实时速度调节**：页面右下角悬浮速度滑块，实时调整阅读速度（0.1x - 5.0x）
- **即时生效**：速度调整后立即生效，无需刷新页面
- **状态持久化**：所有设置自动保存，下次使用无需重新配置
- **智能等待**：自动检测评论加载，等待合适时机跳转

## 📦 安装方法

### 前置要求

- 浏览器：Chrome、Firefox、Edge 等现代浏览器
- 用户脚本管理器：Tampermonkey 或 Violentmonkey

### 安装步骤

1. **安装油猴脚本管理器**
   - Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - Edge: [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)


2. **修改油猴设置**
   - 进入油猴的管理面板，点击设置
   - **配置模式** 改为 高级
   ![设置为高级](https://github.com/Yantesoft/LinuxdoAssistant/blob/main/step1.png?raw=true)
   - 往下拉，在安全里面，**修改内容安全策略（CSP）头信息**修改为 全部移除
   ![修改SCP模式](https://github.com/Yantesoft/LinuxdoAssistant/blob/main/step2.png?raw=true)

3. **安装脚本**
    - 前往Greasy Fork点击安装按钮: [Tampermonkey](https://greasyfork.org/zh-CN/scripts/556858-linuxdo%E6%B4%BB%E8%B7%83)

3. **验证安装**
   - 访问 [Linuxdo 论坛](https://linux.do)
   - 在页面顶部导航栏应该能看到火箭图标（▶️）控制按钮

## 📖 使用指南

### 基本使用

1. **启动助手**
   - 点击页面顶部导航栏的火箭图标（▶️）
   - 图标变为暂停图标（⏸️）表示已启动
   - 助手会自动跳转到新帖子页面并开始滚动

2. **停止助手**
   - 再次点击暂停图标（⏸️）
   - 图标变回播放图标（▶️）表示已停止
   - 滚动和自动跳转会立即停止

3. **调整速度**
   - 启动助手后，页面右下角会显示速度滑块
   - 拖动滑块调整阅读速度（0.1x - 5.0x）
   - 速度调整后立即生效，无需刷新页面

### 速度说明

- **0.1x - 0.5x**：慢速阅读，适合仔细阅读内容
- **0.5x - 1.0x**：正常速度，接近手动阅读速度
- **1.0x - 2.0x**：快速浏览，适合快速了解内容
- **2.0x - 5.0x**：极速模式，适合快速刷活跃度

## 🔧 功能说明

### 自动滚动机制

- 助手会自动向下滚动帖子内容
- 滚动速度由配置参数和速度滑块共同决定
- 每次滚动后会触发页面事件，确保内容正常加载

### 智能跳转逻辑

1. 检测页面中的链接（`.raw-link` 元素）
2. 过滤掉已访问的链接
3. 随机选择一个未访问的链接
4. 等待指定时间后自动跳转
5. 记录已访问的链接到本地存储

### 去重系统

- 使用 `localStorage` 存储已访问的帖子链接
- 自动过滤已访问的帖子
- 当所有帖子都已访问时，自动跳转到新帖子页面


## 📄 许可证

本项目仅供学习交流使用，请遵守 Linuxdo 论坛的使用规则。

## 👤 作者

**Cressida**

---

**注意**：使用本助手时请遵守论坛规则，合理使用自动化功能。






