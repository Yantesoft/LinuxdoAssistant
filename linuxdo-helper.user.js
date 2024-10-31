// ==UserScript==
// @name         Linuxdo活跃
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Linuxdo小助手（可控制开关）
// @author       Cressida
// @match        https://linux.do/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // 配置对象
    const config = {
        scrollInterval: 300,    // 滚动间隔(毫秒)
        scrollStep: 880,         // 每次滚动的像素
        waitForElement: 20000,   // 找不到评论的最大时间
        waitingTime: 1           // 看完评论等待 N 秒进入新帖子
    };

    // 开关状态管理
    function getSwitchState() {
        return GM_getValue('linuxdoHelperEnabled', false);
    }

    function toggleSwitch() {
        const currentState = getSwitchState();
        GM_setValue('linuxdoHelperEnabled', !currentState);

        if (!currentState) {
            window.location.href = "https://linux.do/new"
        }
        console.log(`Linuxdo助手已${!currentState ? '启用' : '禁用'}`);
    }

    // 创建开关图标
    function createSwitchIcon() {
        const iconLi = document.createElement('li');
        iconLi.className = 'header-dropdown-toggle';
        const iconLink = document.createElement('a');
        iconLink.href = 'javascript:void(0)';
        iconLink.className = 'btn no-text icon btn-flat';
        iconLink.title = getSwitchState() ? '停止Linuxdo助手' : '启动Linuxdo助手';
        iconLink.tabIndex = 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'fa d-icon d-icon-rocket svg-icon prefix-icon svg-string');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', getSwitchState() ? '#pause' : '#play');
        svg.appendChild(use);
        iconLink.appendChild(svg);
        iconLi.appendChild(iconLink);

        // 点击事件
        iconLink.addEventListener('click', () => {
            toggleSwitch();
            const currentState = getSwitchState();
            use.setAttribute('href', currentState ? '#pause' : '#play');
            iconLink.title = currentState ? '停止Linuxdo助手' : '启动Linuxdo助手';
            iconLink.classList.toggle('active', currentState);
        });

        // 找到聊天图标并插入
        const chatIconLi = document.querySelector('li.search-dropdown.header-dropdown-toggle');
        if (chatIconLi) {
            chatIconLi.parentNode.insertBefore(iconLi, chatIconLi.nextSibling);
        }
    }

    // 等待元素出现
    function waitForElement(selector) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            const observer = new MutationObserver((mutations) => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            setTimeout(() => {
                observer.disconnect();
                reject(new Error('未找到：' + selector));
            }, config.waitForElement);
        });
    }

    // 获取原始链接
    function getRawLinks() {
        const rawLinkElements = document.querySelectorAll('.raw-link');
        return Array.from(rawLinkElements).map((element, index) => ({
            index: index + 1,
            href: element.href,
            text: element.textContent.trim()
        })).filter(link => link.href);
    }

    // 加载页面
    function loadPage(links) {
        if (!getSwitchState()) { return }
        const visitedLinks = JSON.parse(localStorage.getItem('visitedLinks') || '[]');
        const unvisitedLinks = links.filter(link => !visitedLinks.includes(link.href));
        
        if (unvisitedLinks.length === 0) {
            window.location.href = "https://linux.do/new";
            console.log("去看最新帖子");
            return;
        }

        const selectedLink = unvisitedLinks[Math.floor(Math.random() * unvisitedLinks.length)];
        visitedLinks.push(selectedLink.href);
        localStorage.setItem('visitedLinks', JSON.stringify(visitedLinks));
        window.location.href = selectedLink.href;
    }

    // 评论列表
    function scrollComment(CommentElement) {
        let count = 0;
        const scrollInterval = setInterval(() => {
            CommentElement.scrollTop += config.scrollStep;
            CommentElement.dispatchEvent(new Event('scroll'));

            const links = getRawLinks();
            if (links.length > 0) {
                count++;
                if (count * config.scrollInterval / 1000 >= config.waitingTime) {
                    clearInterval(scrollInterval);
                    loadPage(links);
                }
            }
        }, config.scrollInterval);
    }

    // 主执行函数
    function main() {
        createSwitchIcon();
        if (!getSwitchState()) return;

        try {
            start()
        } catch (error) {
            console.error('脚本执行出错:', error);
        }
    }
    async function start() {
        const Comment = await waitForElement('html.desktop-view.not-mobile-device.text-size-normal.no-touch.discourse-no-touch');
        scrollComment(Comment);
    }

    // 页面加载完成后执行
    if (document.readyState === 'complete') {
        main();
    } else {
        window.addEventListener('load', main);
    }
})();