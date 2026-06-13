// ==UserScript==
// @name         Linuxdo 阅读助手
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @description  Linuxdo 阅读小助手
// @author       Cressida
// @match        https://linux.do/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/556858/Linuxdo%20%E9%98%85%E8%AF%BB%E5%8A%A9%E6%89%8B.user.js
// @updateURL https://update.greasyfork.org/scripts/556858/Linuxdo%20%E9%98%85%E8%AF%BB%E5%8A%A9%E6%89%8B.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 常量定义 ====================

    /** 默认配置参数 */
    const DEFAULT_CONFIG = {
        scrollInterval: 300,      // 基础滚动间隔(毫秒)
        scrollStep: 880,          // 基础每次滚动像素
        waitForElement: 2000,     // 找不到评论的最大等待时间(毫秒)
        waitingTime: 1000         // 看完评论等待时间(毫秒)
    };

    /** 随机延时配置 */
    const RANDOM_DELAY_CONFIG = {
        scrollIntervalJitter: 0.80,     // 滚动间隔随机波动 ±45%
        scrollStepJitter: 0.50,         // 滚动距离随机波动 ±30%
        waitingTimeJitter: 0.80,        // 看完评论等待时间随机波动 ±80%
        waitForElementJitter: 0,     // 等待元素超时时间随机波动 ±35%

        pageJumpDelayMin: 800,          // 跳转帖子前最小等待
        pageJumpDelayMax: 3500,         // 跳转帖子前最大等待

        newPostsDelayMin: 1200,         // 没有新链接时返回 new 页面最小等待
        newPostsDelayMax: 5000,         // 没有新链接时返回 new 页面最大等待

        enableJumpDelayMin: 500,        // 开启助手后跳转最小等待
        enableJumpDelayMax: 1800,       // 开启助手后跳转最大等待

        startScrollDelayMin: 500,       // 找到评论区域后，开始滚动的最小等待
        startScrollDelayMax: 1600       // 找到评论区域后，开始滚动的最大等待
    };

    /** 速度滑块配置 */
    const SPEED_SLIDER_CONFIG = {
        min: 0.1,
        max: 5.0,
        step: 0.1,
        default: 1.0
    };

    /** 话题优先模式配置 */
    const TOPIC_FIRST_CONFIG = {
        minScrollCount: 0,
        maxScrollCount: 3
    };

    /** 元素选择器配置 */
    const SELECTORS = {
        chatButton: 'li.chat-header-icon',
        chatLink: 'a[href="/chat"]',
        headerButtons: '.header-buttons',
        headerIcons: '.d-header-icons',
        headerDropdown: 'ul.header-dropdown-toggle',
        header: 'header.d-header',
        commentList: 'html.desktop-view.not-mobile-device.text-size-normal.no-touch.discourse-no-touch',
        rawLinks: '.raw-link'
    };

    /** 存储键名 */
    const STORAGE_KEYS = {
        enabled: 'linuxdoHelperEnabled',
        baseConfig: 'linuxdoHelperBaseConfig',
        speedRatio: 'linuxdoHelperSpeedRatio',
        topicFirstMode: 'linuxdoHelperTopicFirstMode',
        visitedLinks: 'visitedLinks'
    };

    /** 页面URL */
    const URLS = {
        newPosts: 'https://linux.do/new'
    };

    /** 元素等待超时时间（毫秒） */
    const ELEMENT_WAIT_TIMEOUT = 2000;

    // ==================== 随机工具函数 ====================

    /**
     * 获取随机整数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number}
     */
    function randomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 按比例随机波动数值
     * @param {number} value - 原始值
     * @param {number} jitter - 波动比例，例如 0.3 表示 ±30%
     * @param {number} minValue - 最小值
     * @returns {number}
     */
    function randomByJitter(value, jitter = 0.3, minValue = 1) {
        const min = value * (1 - jitter);
        const max = value * (1 + jitter);
        return Math.max(minValue, Math.round(randomInt(min, max)));
    }

    /**
     * 受速度比例影响的随机延时
     * 速度越快，延时越短
     * @param {number} min - 最小延时
     * @param {number} max - 最大延时
     * @returns {number}
     */
    function randomDelay(min, max) {
        const ratio = getSpeedRatio();
        const realMin = Math.max(50, Math.round(min / ratio));
        const realMax = Math.max(realMin + 1, Math.round(max / ratio));
        return randomInt(realMin, realMax);
    }

    /**
     * 获取当前标签页级别的数据
     * @param {string} key - 存储键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 存储值
     */
    function getTabValue(key, defaultValue) {
        const rawValue = sessionStorage.getItem(key);

        if (rawValue === null) {
            return defaultValue;
        }

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return defaultValue;
        }
    }

    /**
     * 保存当前标签页级别的数据
     * @param {string} key - 存储键名
     * @param {*} value - 存储值
     */
    function setTabValue(key, value) {
        sessionStorage.setItem(key, JSON.stringify(value));
    }

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
            scrollInterval: Math.max(80, Math.round(baseConfig.scrollInterval / ratio)),
            scrollStep: Math.max(50, Math.round(baseConfig.scrollStep * ratio)),
            waitForElement: Math.max(500, Math.round(baseConfig.waitForElement / ratio)),
            waitingTime: Math.max(300, Math.round(baseConfig.waitingTime / ratio))
        };
    }

    // 初始化基础配置
    baseConfig = getBaseConfig();

    // ==================== 开关状态管理 ====================

    /**
     * 获取当前标签页的助手运行状态
     * @returns {boolean} 当前标签页是否启用
     */
    function getSwitchState() {
        return getTabValue(STORAGE_KEYS.enabled, false);
    }

    /**
     * 切换助手开关状态
     */
    function toggleSwitch() {
        const currentState = getSwitchState();
        const newState = !currentState;

        setTabValue(STORAGE_KEYS.enabled, newState);

        if (newState) {
            const delay = randomDelay(
                RANDOM_DELAY_CONFIG.enableJumpDelayMin,
                RANDOM_DELAY_CONFIG.enableJumpDelayMax
            );

            console.log(`Linuxdo助手已启用，${delay}ms 后跳转到最新页面`);

            setTimeout(() => {
                if (getSwitchState()) {
                    window.location.href = URLS.newPosts;
                }
            }, delay);
        } else {
            stopScrolling();
            console.log('Linuxdo助手已禁用');
        }
    }

    /**
     * 获取话题优先模式状态
     * @returns {boolean} 是否启用话题优先
     */
    function getTopicFirstMode() {
        return GM_getValue(STORAGE_KEYS.topicFirstMode, false);
    }

    /**
     * 保存话题优先模式状态
     * @param {boolean} enabled - 是否启用话题优先
     */
    function saveTopicFirstMode(enabled) {
        GM_setValue(STORAGE_KEYS.topicFirstMode, enabled);
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

        iconLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            toggleSwitch();

            const newState = getSwitchState();
            const use = svg.querySelector('use');

            if (use) {
                use.setAttribute('href', newState ? '#pause' : '#play');
            }

            iconLink.title = newState ? '停止Linuxdo助手' : '启动Linuxdo助手';
            iconLink.classList.toggle('active', newState);

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
            const timeout = randomByJitter(
                ELEMENT_WAIT_TIMEOUT,
                RANDOM_DELAY_CONFIG.waitForElementJitter,
                800
            );

            const chatButton = await Promise.race([
                waitForElement(SELECTORS.chatButton),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), timeout)
                )
            ]).catch(() => null);

            if (chatButton) {
                return chatButton;
            }
        } catch (e) {
            // 忽略错误，继续尝试直接查找
        }

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
        if (document.getElementById('linuxdo-helper-switch')) {
            return;
        }

        buttonElement.id = 'linuxdo-helper-switch';

        const chatButton = document.querySelector(SELECTORS.chatButton);

        if (chatButton?.parentNode) {
            chatButton.parentNode.insertBefore(buttonElement, chatButton.nextSibling);
            return;
        }

        const fallbackPosition = findFallbackInsertPosition();

        if (fallbackPosition?.parentNode) {
            fallbackPosition.parentNode.insertBefore(buttonElement, fallbackPosition.nextSibling);
            return;
        }

        const header = document.querySelector(SELECTORS.header) || document.querySelector('header');

        if (header) {
            const headerList = header.querySelector('ul') || header.querySelector('nav');

            if (headerList) {
                headerList.appendChild(buttonElement);
            } else {
                header.insertBefore(buttonElement, header.firstChild);
            }
        } else {
            console.log('【错误】未找到按钮插入位置！');
        }
    }

    /**
     * 创建并插入开关图标到页面
     */
    async function createSwitchIcon() {
        const switchButton = createSwitchButton();

        await findChatButton();

        insertSwitchButton(switchButton);
    }

    /**
     * 注入悬浮面板样式，支持亮色/暗色主题
     */
    function injectFloatingPanelStyles() {
        if (document.getElementById('linuxdo-helper-panel-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'linuxdo-helper-panel-style';
        style.textContent = `
            #linuxdo-speed-slider {
                --linuxdo-helper-bg: var(--secondary, #ffffff);
                --linuxdo-helper-text: var(--primary, #333333);
                --linuxdo-helper-muted: var(--primary-medium, #666666);
                --linuxdo-helper-border: var(--primary-low, rgba(0, 0, 0, 0.12));
                --linuxdo-helper-slider-bg: var(--primary-low, #dddddd);

                background: var(--linuxdo-helper-bg);
                color: var(--linuxdo-helper-text);
                border: 1px solid var(--linuxdo-helper-border);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                color-scheme: light dark;
            }

            #linuxdo-speed-slider .linuxdo-helper-label,
            #linuxdo-speed-slider .linuxdo-helper-topic-first {
                color: var(--linuxdo-helper-text);
            }

            #linuxdo-speed-slider .linuxdo-helper-value {
                color: var(--linuxdo-helper-muted);
            }

            #linuxdo-speed-slider input[type="range"] {
                background: var(--linuxdo-helper-slider-bg);
            }

            @media (prefers-color-scheme: dark) {
                #linuxdo-speed-slider {
                    --linuxdo-helper-bg: var(--secondary, #1f2328);
                    --linuxdo-helper-text: var(--primary, #f0f0f0);
                    --linuxdo-helper-muted: var(--primary-medium, #b8b8b8);
                    --linuxdo-helper-border: var(--primary-low, rgba(255, 255, 255, 0.14));
                    --linuxdo-helper-slider-bg: var(--primary-low, #3a3f45);

                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * 创建悬浮速度滑块
     * @returns {HTMLElement} 滑块容器元素
     */
    function createFloatingSpeedSlider() {
        injectFloatingPanelStyles();

        const existingSlider = document.getElementById('linuxdo-speed-slider');

        if (existingSlider) {
            existingSlider.remove();
        }

        const container = document.createElement('div');

        container.id = 'linuxdo-speed-slider';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            border-radius: 8px;
            padding: 16px;
            z-index: 9999;
            min-width: 200px;
            display: ${getSwitchState() ? 'block' : 'none'};
        `;

        const label = document.createElement('div');
        label.className = 'linuxdo-helper-label';
        label.textContent = '阅读速度';
        label.style.cssText = 'font-size: 14px; font-weight: 500; margin-bottom: 10px;';
        container.appendChild(label);

        const sliderWrapper = document.createElement('div');
        sliderWrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';

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
            outline: none;
            cursor: pointer;
        `;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'linuxdo-helper-value';
        valueDisplay.textContent = getSpeedRatio().toFixed(1) + 'x';
        valueDisplay.style.cssText = 'min-width: 45px; text-align: right; font-size: 14px; font-weight: 500;';

        slider.addEventListener('input', () => {
            const ratio = parseFloat(slider.value);

            valueDisplay.textContent = ratio.toFixed(1) + 'x';
            saveSpeedRatio(ratio);

            restartScrolling();
        });

        sliderWrapper.appendChild(slider);
        sliderWrapper.appendChild(valueDisplay);
        container.appendChild(sliderWrapper);

        const topicFirstWrapper = document.createElement('label');
        topicFirstWrapper.className = 'linuxdo-helper-topic-first';
        topicFirstWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            font-size: 14px;
            cursor: pointer;
            user-select: none;
        `;

        const topicFirstCheckbox = document.createElement('input');
        topicFirstCheckbox.type = 'checkbox';
        topicFirstCheckbox.checked = getTopicFirstMode();
        topicFirstCheckbox.style.cssText = 'cursor: pointer;';

        const topicFirstText = document.createElement('span');
        topicFirstText.textContent = '话题优先';

        topicFirstCheckbox.addEventListener('change', () => {
            saveTopicFirstMode(topicFirstCheckbox.checked);
            restartScrolling();
        });

        topicFirstWrapper.appendChild(topicFirstCheckbox);
        topicFirstWrapper.appendChild(topicFirstText);
        container.appendChild(topicFirstWrapper);

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
            const element = document.querySelector(selector);

            if (element) {
                resolve(element);
                return;
            }

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

            const timeout = randomByJitter(
                getConfig().waitForElement,
                RANDOM_DELAY_CONFIG.waitForElementJitter,
                500
            );

            setTimeout(() => {
                observer.disconnect();
                console.log('【错误】未找到元素：', selector);
                reject(new Error('未找到：' + selector));
            }, timeout);
        });
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
    let currentScrollTimer = null;

    /** 当前评论元素引用 */
    let currentCommentElement = null;

    /**
     * 随机延时后跳转
     * @param {string} url - 目标地址
     * @param {number} minDelay - 最小延时
     * @param {number} maxDelay - 最大延时
     * @param {string} message - 日志信息
     */
    function jumpWithRandomDelay(url, minDelay, maxDelay, message = '准备跳转') {
        const delay = randomDelay(minDelay, maxDelay);

        console.log(`${message}，${delay}ms 后执行`);

        setTimeout(() => {
            if (getSwitchState()) {
                window.location.href = url;
            }
        }, delay);
    }

    /**
     * 加载并跳转到新页面
     * @param {Array<Object>} links - 可用链接列表
     */
    function loadPage(links) {
        if (!getSwitchState()) {
            return;
        }

        const visitedLinks = getTabValue(STORAGE_KEYS.visitedLinks, []);

        const unvisitedLinks = links.filter(
            link => !visitedLinks.includes(link.href)
        );

        if (unvisitedLinks.length === 0) {
            jumpWithRandomDelay(
                URLS.newPosts,
                RANDOM_DELAY_CONFIG.newPostsDelayMin,
                RANDOM_DELAY_CONFIG.newPostsDelayMax,
                '没有未访问链接，去看最新帖子'
            );
            return;
        }

        const randomIndex = Math.floor(Math.random() * unvisitedLinks.length);
        const selectedLink = unvisitedLinks[randomIndex];

        visitedLinks.push(selectedLink.href);
        setTabValue(STORAGE_KEYS.visitedLinks, visitedLinks);

        jumpWithRandomDelay(
            selectedLink.href,
            RANDOM_DELAY_CONFIG.pageJumpDelayMin,
            RANDOM_DELAY_CONFIG.pageJumpDelayMax,
            `准备进入帖子：${selectedLink.text || selectedLink.href}`
        );
    }

    /**
     * 停止当前滚动
     */
    function stopScrolling() {
        if (currentScrollTimer) {
            clearTimeout(currentScrollTimer);
            currentScrollTimer = null;
        }

        currentCommentElement = null;
    }

    /**
     * 滚动评论区域并自动跳转
     * @param {HTMLElement} commentElement - 评论容器元素
     */
    function scrollComment(commentElement) {
        stopScrolling();

        currentCommentElement = commentElement;

        let linkWaitStartTime = null;
        let currentRequiredWaitingTime = null;
        let currentScrollCount = 0;
        let currentMaxScrollCount = null;

        if (getTopicFirstMode()) {
            currentMaxScrollCount = randomInt(
                TOPIC_FIRST_CONFIG.minScrollCount,
                TOPIC_FIRST_CONFIG.maxScrollCount
            );

            console.log(`话题优先模式已开启，本帖最多滚动 ${currentMaxScrollCount} 次`);
        }

        const doScroll = () => {
            if (!getSwitchState()) {
                stopScrolling();
                return;
            }

            if (!currentCommentElement || currentCommentElement !== commentElement) {
                return;
            }

            const currentConfig = getConfig();

            if (getTopicFirstMode() && currentScrollCount >= currentMaxScrollCount) {
                console.log(`话题优先模式达到滚动次数 ${currentScrollCount}/${currentMaxScrollCount}，准备换下一个帖子`);
                stopScrolling();
                loadPage(getRawLinks());
                return;
            }

            const randomStep = randomByJitter(
                currentConfig.scrollStep,
                RANDOM_DELAY_CONFIG.scrollStepJitter,
                80
            );

            const scrollTarget = document.scrollingElement || commentElement;

            scrollTarget.scrollTop += randomStep;
            scrollTarget.dispatchEvent(new Event('scroll'));
            currentScrollCount += 1;

            const links = getRawLinks();

            if (getTopicFirstMode() && currentScrollCount >= currentMaxScrollCount) {
                console.log(`话题优先模式达到滚动次数 ${currentScrollCount}/${currentMaxScrollCount}，准备换下一个帖子`);
                stopScrolling();
                loadPage(links);
                return;
            }

            if (links.length > 0) {
                if (linkWaitStartTime === null) {
                    linkWaitStartTime = Date.now();

                    currentRequiredWaitingTime = randomByJitter(
                        currentConfig.waitingTime,
                        RANDOM_DELAY_CONFIG.waitingTimeJitter,
                        500
                    );

                    console.log(`发现链接，随机等待 ${currentRequiredWaitingTime}ms 后跳转`);
                }

                const waitedTime = Date.now() - linkWaitStartTime;

                if (waitedTime >= currentRequiredWaitingTime) {
                    stopScrolling();
                    loadPage(links);
                    return;
                }
            } else {
                linkWaitStartTime = null;
                currentRequiredWaitingTime = null;
            }

            const nextInterval = randomByJitter(
                currentConfig.scrollInterval,
                RANDOM_DELAY_CONFIG.scrollIntervalJitter,
                120
            );

            currentScrollTimer = setTimeout(doScroll, nextInterval);
        };

        const firstDelay = randomByJitter(
            getConfig().scrollInterval,
            RANDOM_DELAY_CONFIG.scrollIntervalJitter,
            120
        );

        currentScrollTimer = setTimeout(doScroll, firstDelay);
    }

    /**
     * 重新启动滚动（用于速度改变时立即生效）
     */
    function restartScrolling() {
        const element = currentCommentElement;

        if (element) {
            scrollComment(element);
        }
    }

    /**
     * 启动自动滚动功能
     */
    async function startAutoScroll() {
        try {
            const commentElement = await waitForElement(SELECTORS.commentList);

            console.log('找到评论列表元素:', commentElement);

            const delay = randomDelay(
                RANDOM_DELAY_CONFIG.startScrollDelayMin,
                RANDOM_DELAY_CONFIG.startScrollDelayMax
            );

            console.log(`随机等待 ${delay}ms 后开始滚动`);

            setTimeout(() => {
                if (getSwitchState()) {
                    scrollComment(commentElement);
                }
            }, delay);
        } catch (error) {
            console.error('启动自动滚动失败:', error);
        }
    }

    // ==================== 主程序入口 ====================

    /**
     * 主初始化函数
     */
    async function main() {
        await createSwitchIcon();

        createFloatingSpeedSlider();

        if (!getSwitchState()) {
            return;
        }

        startAutoScroll();
    }

    if (document.readyState === 'complete') {
        main();
    } else {
        window.addEventListener('load', main);
    }
})();
