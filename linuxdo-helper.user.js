// ==UserScript==
// @name         Linuxdo活跃
// @namespace    http://tampermonkey.net/
// @version      2.0.1
// @description  Linuxdo小助手（可控制开关）
// @author       Cressida
// @match        https://linux.do/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 常量定义 ====================
    
    /** 默认配置参数 */
    const DEFAULT_CONFIG = {
        scrollInterval: 300,      // 滚动间隔(毫秒)
        scrollStep: 880,          // 每次滚动的像素
        waitForElement: 2000,    // 找不到评论的最大等待时间(毫秒)
        waitingTime: 1000        // 看完评论等待时间(毫秒)
    };

    /** 速度滑块配置 */
    const SPEED_SLIDER_CONFIG = {
        min: 0.1,
        max: 5.0,
        step: 0.1,
        default: 1.0
    };

    /** 元素选择器配置 */
    const SELECTORS = {
        chatButton: 'li.chat-header-icon',
        chatLink: 'a[href="/chat"]',
        headerButtons: '.header-buttons',
        headerIcons: '.d-header-icons',
        headerDropdown: 'ul.header-dropdown-toggle',
        header: 'header.d-header',
        commentList: 'html.desktop-view.not-mobile-device',
        rawLinks: '.raw-link'
    };

    /** 存储键名 */
    const STORAGE_KEYS = {
        enabled: 'linuxdoHelperEnabled',
        baseConfig: 'linuxdoHelperBaseConfig',
        speedRatio: 'linuxdoHelperSpeedRatio',
        visitedLinks: 'visitedLinks'
    };

    /** 页面URL */
    const URLS = {
        newPosts: 'https://linux.do/new'
    };

    /** 元素等待超时时间（毫秒） */
    const ELEMENT_WAIT_TIMEOUT = 2000;

    // ==================== 配置管理 ====================

    /** 基础配置（用于速度比例计算） */
    let baseConfig = null;

    /**
     * 获取基础配置（从存储中读取，如果没有则使用默认值）
     * @returns {Object} 基础配置对象
     */
    function getBaseConfig() {
        const savedConfig = GM_getValue(STORAGE_KEYS.baseConfig, null);
        return savedConfig ? savedConfig : { ...DEFAULT_CONFIG };
    }

    /**
     * 保存基础配置
     * @param {Object} newConfig - 新的基础配置
     */
    function saveBaseConfig(newConfig) {
        GM_setValue(STORAGE_KEYS.baseConfig, newConfig);
        baseConfig = newConfig;
    }

    /**
     * 获取速度比例
     * @returns {number} 速度比例（0.1 - 5.0）
     */
    function getSpeedRatio() {
        return GM_getValue(STORAGE_KEYS.speedRatio, SPEED_SLIDER_CONFIG.default);
    }

    /**
     * 保存速度比例
     * @param {number} ratio - 速度比例
     */
    function saveSpeedRatio(ratio) {
        GM_setValue(STORAGE_KEYS.speedRatio, ratio);
    }

    /**
     * 获取实际使用的配置（基础配置 × 速度比例）
     * @returns {Object} 计算后的配置对象
     */
    function getConfig() {
        if (!baseConfig) {
            baseConfig = getBaseConfig();
        }
        const ratio = getSpeedRatio();
        return {
            scrollInterval: Math.round(baseConfig.scrollInterval / ratio),
            scrollStep: Math.round(baseConfig.scrollStep * ratio),
            waitForElement: Math.round(baseConfig.waitForElement / ratio),
            waitingTime: Math.round(baseConfig.waitingTime / ratio)
        };
    }

    // 初始化基础配置
    baseConfig = getBaseConfig();

    // ==================== 开关状态管理 ====================

    /**
     * 获取助手开关状态
     * @returns {boolean} 是否启用
     */
    function getSwitchState() {
        return GM_getValue(STORAGE_KEYS.enabled, false);
    }

    /**
     * 切换助手开关状态
     */
    function toggleSwitch() {
        const currentState = getSwitchState();
        const newState = !currentState;
        GM_setValue(STORAGE_KEYS.enabled, newState);

        if (newState) {
            // 启用时跳转到新帖子页面
            window.location.href = URLS.newPosts;
        }
        console.log(`Linuxdo助手已${newState ? '启用' : '禁用'}`);
    }

    // ==================== UI 组件创建 ====================

    /**
     * 创建SVG图标元素
     * @param {string} iconHref - 图标引用（如 '#play' 或 '#pause'）
     * @returns {SVGElement} SVG元素
     */
    function createSVGIcon(iconHref) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'fa d-icon d-icon-rocket svg-icon prefix-icon svg-string');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', iconHref);
        svg.appendChild(use);
        
        return svg;
    }

    /**
     * 创建控制开关按钮
     * @returns {HTMLElement} 开关按钮的 li 元素
     */
    function createSwitchButton() {
        const iconLi = document.createElement('li');
        iconLi.className = 'header-dropdown-toggle';
        
        const iconLink = document.createElement('a');
        iconLink.href = '#';
        iconLink.className = 'btn no-text icon btn-flat';
        iconLink.tabIndex = 0;
        
        const isEnabled = getSwitchState();
        iconLink.title = isEnabled ? '停止Linuxdo助手' : '启动Linuxdo助手';
        
        const svg = createSVGIcon(isEnabled ? '#pause' : '#play');
        iconLink.appendChild(svg);
        iconLi.appendChild(iconLink);

        // 点击事件处理
        iconLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            toggleSwitch();
            
            // 更新按钮状态
            const newState = getSwitchState();
            const use = svg.querySelector('use');
            use.setAttribute('href', newState ? '#pause' : '#play');
            iconLink.title = newState ? '停止Linuxdo助手' : '启动Linuxdo助手';
            iconLink.classList.toggle('active', newState);
            
            // 更新悬浮滑块显示状态
            updateFloatingSliderVisibility();
        });

        return iconLi;
    }

    /**
     * 查找聊天按钮元素
     * @returns {Promise<HTMLElement|null>} 聊天按钮元素或null
     */
    async function findChatButton() {
        try {
            // 尝试等待聊天按钮出现
            const chatButton = await Promise.race([
                waitForElement(SELECTORS.chatButton),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), ELEMENT_WAIT_TIMEOUT)
                )
            ]).catch(() => null);
            
            if (chatButton) {
                return chatButton;
            }
        } catch (e) {
            // 等待失败，继续尝试直接查找
        }
        
        // 直接查找聊天按钮
        return document.querySelector(SELECTORS.chatButton) || 
               document.querySelector(SELECTORS.chatLink)?.closest('li');
    }

    /**
     * 查找备用插入位置
     * @returns {HTMLElement|null} 备用位置元素或null
     */
    function findFallbackInsertPosition() {
        return document.querySelector(SELECTORS.headerButtons) || 
               document.querySelector(SELECTORS.headerIcons) ||
               document.querySelector(SELECTORS.headerDropdown)?.parentElement;
    }

    /**
     * 将开关按钮插入到页面中
     * @param {HTMLElement} buttonElement - 开关按钮元素
     */
    function insertSwitchButton(buttonElement) {
        // 优先插入到聊天按钮旁边
        const chatButton = document.querySelector(SELECTORS.chatButton);
        if (chatButton?.parentNode) {
            chatButton.parentNode.insertBefore(buttonElement, chatButton.nextSibling);
            return;
        }

        // 备用方案：插入到其他header按钮位置
        const fallbackPosition = findFallbackInsertPosition();
        if (fallbackPosition?.parentNode) {
            fallbackPosition.parentNode.insertBefore(buttonElement, fallbackPosition.nextSibling);
            return;
        }

        // 最后方案：插入到header中
        const header = document.querySelector(SELECTORS.header) || document.querySelector('header');
        if (header) {
            const headerList = header.querySelector('ul') || header.querySelector('nav');
            if (headerList) {
                headerList.appendChild(buttonElement);
            } else {
                header.insertBefore(buttonElement, header.firstChild);
            }
        } else {
            console.log("【错误】未找到按钮插入位置！");
        }
    }

    /**
     * 创建并插入开关图标到页面
     */
    async function createSwitchIcon() {
        const switchButton = createSwitchButton();
        await findChatButton(); // 等待聊天按钮加载
        insertSwitchButton(switchButton);
    }

    /**
     * 创建悬浮速度滑块
     * @returns {HTMLElement} 滑块容器元素
     */
    function createFloatingSpeedSlider() {
        // 如果已存在，先移除
        const existingSlider = document.getElementById('linuxdo-speed-slider');
        if (existingSlider) {
            existingSlider.remove();
        }

        // 创建容器
        const container = document.createElement('div');
        container.id = 'linuxdo-speed-slider';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            min-width: 200px;
            display: ${getSwitchState() ? 'block' : 'none'};
        `;

        // 创建标签
        const label = document.createElement('div');
        label.textContent = '阅读速度';
        label.style.cssText = 'font-size: 14px; color: #333; font-weight: 500; margin-bottom: 10px;';
        container.appendChild(label);

        // 创建滑块容器
        const sliderWrapper = document.createElement('div');
        sliderWrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        // 创建滑块
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = SPEED_SLIDER_CONFIG.min;
        slider.max = SPEED_SLIDER_CONFIG.max;
        slider.step = SPEED_SLIDER_CONFIG.step;
        slider.value = getSpeedRatio();
        slider.style.cssText = `
            flex: 1;
            height: 6px;
            border-radius: 3px;
            background: #ddd;
            outline: none;
            cursor: pointer;
        `;

        // 创建数值显示
        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = getSpeedRatio().toFixed(1) + 'x';
        valueDisplay.style.cssText = 'min-width: 45px; text-align: right; font-size: 14px; color: #666; font-weight: 500;';

        // 滑块值变化事件
        slider.addEventListener('input', () => {
            const ratio = parseFloat(slider.value);
            valueDisplay.textContent = ratio.toFixed(1) + 'x';
            saveSpeedRatio(ratio);
            
            // 如果正在滚动，立即应用新速度
            restartScrolling();
        });

        // 组装元素
        sliderWrapper.appendChild(slider);
        sliderWrapper.appendChild(valueDisplay);
        container.appendChild(sliderWrapper);
        document.body.appendChild(container);

        return container;
    }

    /**
     * 更新悬浮滑块的显示状态
     */
    function updateFloatingSliderVisibility() {
        const slider = document.getElementById('linuxdo-speed-slider');
        if (slider) {
            slider.style.display = getSwitchState() ? 'block' : 'none';
        }
    }

    // ==================== DOM 工具函数 ====================

    /**
     * 等待指定元素出现在页面中
     * @param {string} selector - CSS选择器
     * @returns {Promise<HTMLElement>} 找到的元素
     */
    function waitForElement(selector) {
        return new Promise((resolve, reject) => {
            // 先尝试直接查找
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            // 使用MutationObserver监听DOM变化
            const observer = new MutationObserver(() => {
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

            // 超时处理
            setTimeout(() => {
                observer.disconnect();
                console.log("【错误】未找到元素：", selector);
                reject(new Error('未找到：' + selector));
            }, getConfig().waitForElement);
        });
    }

    /**
     * 获取页面滚动容器（兼容不同浏览器/页面滚动实现）
     * @returns {HTMLElement|null} 滚动容器元素
     */
    function getScrollContainer() {
        return document.scrollingElement || document.documentElement || document.body;
    }

    /**
     * 获取页面中的原始链接列表
     * @returns {Array<Object>} 链接对象数组，包含index、href、text
     */
    function getRawLinks() {
        const linkElements = document.querySelectorAll(SELECTORS.rawLinks);
        return Array.from(linkElements)
            .map((element, index) => ({
                index: index + 1,
                href: element.href,
                text: element.textContent.trim()
            }))
            .filter(link => link.href);
    }

    // ==================== 核心功能 ====================

    /** 当前运行的滚动定时器引用 */
    let currentScrollInterval = null;
    
    /** 当前评论元素引用 */
    let currentCommentElement = null;

    /**
     * 加载并跳转到新页面
     * @param {Array<Object>} links - 可用链接列表
     */
    function loadPage(links) {
        if (!getSwitchState()) {
            return;
        }

        const visitedLinks = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.visitedLinks) || '[]'
        );
        const unvisitedLinks = links.filter(
            link => !visitedLinks.includes(link.href)
        );

        // 如果没有未访问的链接，跳转到新帖子页面
        if (unvisitedLinks.length === 0) {
            window.location.href = URLS.newPosts;
            console.log("去看最新帖子");
            return;
        }

        // 随机选择一个未访问的链接
        const randomIndex = Math.floor(Math.random() * unvisitedLinks.length);
        const selectedLink = unvisitedLinks[randomIndex];
        
        // 记录已访问
        visitedLinks.push(selectedLink.href);
        localStorage.setItem(STORAGE_KEYS.visitedLinks, JSON.stringify(visitedLinks));
        
        // 跳转
        window.location.href = selectedLink.href;
    }

    /**
     * 停止当前滚动
     */
    function stopScrolling() {
        if (currentScrollInterval) {
            clearInterval(currentScrollInterval);
            currentScrollInterval = null;
        }
        currentCommentElement = null;
    }

    /**
     * 滚动评论区域并自动跳转
     * @param {HTMLElement} commentElement - 评论容器元素
     */
    function scrollComment(commentElement) {
        // 停止之前的滚动
        stopScrolling();
        
        // 保存当前评论元素引用
        currentCommentElement = commentElement;
        
        // 记录开始等待链接的时间
        let linkWaitStartTime = null;
        
        // 获取最新配置
        const config = getConfig();
        
        const scrollInterval = setInterval(() => {
            // 每次滚动时重新获取配置，确保速度改变立即生效
            const currentConfig = getConfig();
            
            // 滚动
            commentElement.scrollTop += currentConfig.scrollStep;
            commentElement.dispatchEvent(new Event('scroll'));

            // 检查是否有链接
            const links = getRawLinks();
            if (links.length > 0) {
                // 记录开始等待的时间
                if (linkWaitStartTime === null) {
                    linkWaitStartTime = Date.now();
                }
                
                // 计算已等待时间（毫秒）
                const waitedTime = Date.now() - linkWaitStartTime;
                
                if (waitedTime >= currentConfig.waitingTime) {
                    stopScrolling();
                    loadPage(links);
                }
            } else {
                // 没有链接时重置等待时间
                linkWaitStartTime = null;
            }
        }, config.scrollInterval);
        
        // 保存 interval 引用
        currentScrollInterval = scrollInterval;
    }
    
    /**
     * 重新启动滚动（用于速度改变时立即生效）
     */
    function restartScrolling() {
        if (currentCommentElement) {
            scrollComment(currentCommentElement);
        }
    }

    /**
     * 启动自动滚动功能
     */
    async function startAutoScroll() {
        try {
            // 等待进入桌面端视图（避免移动端/未初始化完成时误触发）
            await waitForElement(SELECTORS.commentList);

            const scrollContainer = getScrollContainer();
            if (!scrollContainer) {
                throw new Error('未找到滚动容器元素');
            }

            console.log('找到滚动容器元素:', scrollContainer);
            scrollComment(scrollContainer);
        } catch (error) {
            console.error('启动自动滚动失败:', error);
        }
    }

    // ==================== 主程序入口 ====================

    /**
     * 主初始化函数
     */
    async function main() {
        // 创建控制开关按钮
        await createSwitchIcon();
        
        // 创建悬浮速度滑块
        createFloatingSpeedSlider();
        
        // 如果助手未启用，不执行后续操作
        if (!getSwitchState()) {
            return;
        }

        // 启动自动滚动
        startAutoScroll();
    }

    // 页面加载完成后执行
    if (document.readyState === 'complete') {
        main();
    } else {
        window.addEventListener('load', main);
    }
})();



