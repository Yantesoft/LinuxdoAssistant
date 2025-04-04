# Linuxdo活跃助手

## 简介

这是一个用于 Tampermonkey 的用户脚本，自动浏览 Linux.do 论坛的帖子，解放双手看帖子，快速升三级。

![image](https://github.com/user-attachments/assets/d512be09-2068-42ed-a063-825a30f8a3c8)

觉得好用请留下 start ☆ 谢谢！

## 安装

### 前置条件

- 浏览器（Chrome、Firefox 等）
- Tampermonkey 浏览器插件

### 安装步骤

1. 安装 Tampermonkey 浏览器插件
2. 创建新的用户脚本
3. 复制 `linuxdo-helper.user.js` 的全部代码
4. 保存并启用脚本

## 使用方法

1. 打开 Linux.do 论坛
2. 在导航栏的搜索按钮后多出一个按钮，点击此处开始
3. 脚本将自动开始浏览帖子


## 配置参数

可在脚本中修改以下配置：

```javascript
const config = {
    scrollInterval: 300,    // 滚动间隔(毫秒)
    scrollStep: 880,         // 每次滚动的像素
    waitForElement: 20000,   // 找不到评论的最大时间
    waitingTime: 1           // 看完评论等待 N 秒进入新帖子
};
```




## 许可证

MIT License

## 贡献

欢迎提交 Issues 和 Pull Requests

## 作者

Cressida

## 免责声明

本脚本仅供学习和交流使用，请遵守论坛规则和网络道德。
