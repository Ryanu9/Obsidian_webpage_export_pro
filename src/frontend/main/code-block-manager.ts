import { delay } from "./utils";
import { ensureContrast } from "./color-utils";

export class CodeBlockManager {
    private containerEl: HTMLElement;
    private processedContainers: HTMLElement[] = [];
    private observer: IntersectionObserver | null = null;

    // 静态方法：更新高亮样式（用于设置预览）
    public static updateHighlightStyles(options: any) {
        const styleId = "code-block-highlight-styles";
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
        }

        // 从 hex 颜色字符串转换为 RGB
        const hexColor = options?.highlightLineColor || "#464646";
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2) || "46", 16);
        const g = parseInt(hex.substring(2, 4) || "46", 16);
        const b = parseInt(hex.substring(4, 6) || "46", 16);
        const opacity = options?.highlightLineOpacity ?? 0.5;

        style.textContent = `
            /* >>>>空格 高亮背景 */
            .markdown-rendered pre code .highlight-line,
            .markdown-rendered pre .highlight-line {
                background-color: rgba(${r}, ${g}, ${b}, ${opacity});
	            display: inline-block;
	            box-sizing: border-box;
	            padding: 0 0;
            }
            /* 预览容器中的高亮样式 */
            .code-block-highlight-preview pre code .highlight-line,
            .code-block-highlight-preview pre .highlight-line,
            .code-block-highlight-preview .highlight-line {
                background-color: rgba(${r}, ${g}, ${b}, ${opacity}) ;
	            display: block;
	            box-sizing: border-box;
	            padding: 0;
                margin: 0;
                line-height: inherit;
            }
            .code-block-highlight-preview pre code .highlight-line span,
            .code-block-highlight-preview pre .highlight-line span {
                display: inline;
            }
        `;
    }

    private getTranslation(key: string, defaultValue: string): string {
        try {
            // Try to get i18n from window (if exposed)
            const i18n = (window as any).i18n;
            if (i18n?.codeBlock?.[key]) {
                return i18n.codeBlock[key];
            }
        } catch (e) {
            // Fallback to default if i18n is not available
        }
        return defaultValue;
    }

    private getCodeBlockOptions(): any {
        try {
            // Try to get code block options from metadata
            const metadata = (window as any).ObsidianSite?.metadata;
            if (metadata?.featureOptions?.codeBlock) {
                return metadata.featureOptions.codeBlock;
            }
        } catch (e) {
            // Fallback to defaults if metadata is not available
        }
        // Return default values
        return {
            showLineNumbers: true,
            defaultCollapse: true,
            collapseThreshold: 30,
            defaultWrap: false,
            showBottomExpandButton: true,
            enableHighlightLine: true,
            highlightLineColor: "#464646",
            highlightLineOpacity: 0.5,
        };
    }

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
        this.initObserver();
    }

    private initObserver() {
        if (typeof IntersectionObserver === 'undefined') return;

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const container = entry.target as HTMLElement;
                    this.lazyProcessCodeBlock(container);
                    this.observer?.unobserve(container);
                }
            });
        }, {
            rootMargin: '200px 0px', // 提前 200px 开始渲染，提升体验
        });
    }

    private lazyProcessCodeBlock(container: HTMLElement) {
        if (container.getAttribute('data-lazy-processed') === 'true') return;

        const pre = container.querySelector('pre');
        if (!pre) return;

        this.processHighlightBackground(pre);
        this.addLineNumbers(pre);
        this.createHeader(pre);
        this.adjustContrast(container);

        container.setAttribute('data-lazy-processed', 'true');
    }

    public async init() {
        this.injectStyles();
        // Delay slightly to ensure DOM is ready if needed, similar to other features
        await delay(10);
        this.initCodeBlocks();
        this.setupThemeObserver();
    }


    private injectStyles() {
        const styleId = "code-block-styles";
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
        }

        const options = this.getCodeBlockOptions();

        style.textContent = `
            /* Code Block Header and Features Styles */
            .code-block-container {
                position: relative;
                margin-bottom: 1em;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                overflow: hidden;
                background-color: var(--code-background);
                --code-ui-color: #888;
                --code-ui-color-muted: #777;
            }

            .code-block-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1px 12px;
                background-color: var(--code-background);
                font-family: var(--font-interface);
                user-select: none;
            }

            .code-block-header__title {
                font-size: 0.85em;
                font-weight: 500;
                color: var(--code-ui-color) !important;
                text-transform: capitalize;
                user-select: none;
            }

            .code-block-controls {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .code-block-button {
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                color: var(--code-ui-color) !important;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.2s, filter 0.2s;
            }

            .code-block-button:hover {
                background-color: var(--background-modifier-hover) !important;
                filter: brightness(1.2);
            }

            .code-block-button svg {
                width: 16px;
                height: 16px;
            }

            .copy-button span {
                font-size: 1em;
                margin-left: 4px;
            }

            /* pre 基础样式 */
            .markdown-rendered pre {
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                background: transparent !important;
                font-family: var(--font-monospace, 'Consolas', monospace);
                display: block;
                position: relative;
                overflow: visible;
            }

            .markdown-rendered pre.has-line-numbers {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 0;
            }

            /* code 元素基础样式 */
            .markdown-rendered pre code,
            .markdown-rendered pre.language-ansi > span,
            .markdown-rendered pre .ansi-content-wrapper {
                padding: 1em !important;
                overflow-x: auto;
                display: block !important;
                white-space: pre !important;
                word-wrap: normal !important;
                font-family: inherit;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                transform: none !important;
                z-index: auto !important;
                background-color: var(--code-background);
            }

            /* 有行号时 code 占据 grid 第二列 */
            .markdown-rendered pre.has-line-numbers code,
            .markdown-rendered pre.has-line-numbers.language-ansi > span,
            .markdown-rendered pre.has-line-numbers .ansi-content-wrapper {
                grid-column: 2;
                grid-row: 1;
                min-width: 0;
            }

            /* code 内部语法高亮元素 */
            .markdown-rendered pre code * {
                display: inline;
                white-space: pre;
                position: static !important;
                background-color: transparent;
            }

            /* 换行模式 */
            .markdown-rendered pre.wrap-code code,
            .markdown-rendered pre.wrap-code.language-ansi > span,
            .markdown-rendered pre.wrap-code .ansi-content-wrapper {
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
                word-break: break-all !important;
                min-width: 0 !important;
                overflow-x: visible !important;
                overflow-wrap: break-word !important;
            }

            .markdown-rendered pre.wrap-code code * {
                white-space: pre-wrap !important;
            }

            /* 行号 */
            .line-numbers-wrapper {
                grid-column: 1;
                text-align: right;
                padding: 1em 0.8em 1em 1em;
                border-right: 1px solid var(--background-modifier-border);
                color: var(--code-ui-color-muted);
                user-select: none;
                font-family: inherit;
                background-color: var(--code-background);
                min-width: 2.5em;
            }

            .line-number {
                display: block;
                line-height: inherit;
                font-size: inherit;
            }

            .line-continuation::before {
                content: "";
                display: inline-block;
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background-color: var(--text-faint);
                opacity: 0.5;
                vertical-align: middle;
            }

            /* 折叠样式 */
            .code-block-container.collapsed pre {
                overflow-y: hidden;
                position: relative;
            }

            .code-block-container.collapsed pre::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: calc(3 * var(--code-line-height, 1.6) * 1em + 1em);
                background: linear-gradient(to bottom, transparent 0%, var(--code-background) 100%);
                pointer-events: none;
                z-index: 10;
            }

            /* 底部展开按钮 */
            .bottom-expand-button {
                position: absolute;
                bottom: 12px;
                right: 12px;
                z-index: 10;
                width: 36px;
                height: 36px;
                background: var(--background-modifier-hover) !important;
                color: var(--code-ui-color);
                border: 1px solid var(--background-modifier-border);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: box-shadow 0.3s ease, transform 0.3s ease;
            }

            .bottom-expand-button:hover {
                filter: brightness(1.2);
            }

            .bottom-expand-button svg {
                width: 20px;
                height: 20px;
                display: block;
            }

            /* ANSI Colors */
            .ansi-black-fg { color: black; }
            .ansi-red-fg { color: red; }
            .ansi-green-fg { color: green; }
            .ansi-yellow-fg { color: #d6d620; }
            .ansi-blue-fg { color: blue; }
            .ansi-magenta-fg { color: magenta; }
            .ansi-cyan-fg { color: cyan; }
            .ansi-white-fg { color: white; }
            .ansi-bright-black-fg { color: gray; }

            /* YAML / Frontmatter 排除 */
            .yaml-properties-container pre {
                display: block !important;
                grid-template-columns: 1fr !important;
            }
            .yaml-properties-container .line-numbers-wrapper {
                display: none !important;
            }

            .markdown-rendered pre.frontmatter,
            .markdown-rendered pre.yaml-frontmatter,
            .markdown-rendered pre[data-frontmatter] {
                display: none !important;
            }
        `;

        // 初始化高亮样式
        CodeBlockManager.updateHighlightStyles(options);
    }

    private initCodeBlocks() {
        const codeBlocks = Array.from(this.containerEl.querySelectorAll('pre code'));
        const ansiBlocks = Array.from(this.containerEl.querySelectorAll('pre.ansi-block'));

        // Combine and dedup
        const allPreElements = new Set([
            ...codeBlocks.map(c => c.parentElement as HTMLPreElement),
            ...ansiBlocks.map(b => b as HTMLPreElement)
        ].filter(el => el));

        allPreElements.forEach(pre => {
            if (!pre) return;
            if (pre.getAttribute('data-processed') === 'true') return; // Avoid re-processing

            // Skip code blocks inside YAML properties container
            if (pre.closest('.yaml-properties-container')) {
                return;
            }

            // Skip frontmatter elements (they should not have line numbers)
            if (pre.classList.contains('frontmatter') ||
                pre.classList.contains('yaml-frontmatter') ||
                pre.hasAttribute('data-frontmatter')) {
                return;
            }

            const oldCopyButton = pre.querySelector('button.copy-code-button');
            if (oldCopyButton) {
                oldCopyButton.remove();
            }

            this.handleAnsiBlock(pre);
            this.processLanguage(pre);
            this.prepareContainer(pre);

            const container = pre.parentElement as HTMLElement;

            // 立即处理折叠相关的布局，避免懒加载时产生布局抖动(Layout Shift)
            const options = this.getCodeBlockOptions();
            const lines = this.getLineCount(pre);
            const threshold = options.collapseThreshold || 30;
            if (lines > threshold && options.defaultCollapse) {
                this.setupCollapse(pre, container);
            }

            // 如果支持 IntersectionObserver 则使用懒加载，否则立即渲染
            if (this.observer) {
                this.observer.observe(container);
            } else {
                this.lazyProcessCodeBlock(container);
            }

            pre.setAttribute('data-processed', 'true');
        });
    }

    private handleAnsiBlock(pre: HTMLPreElement) {
        if (pre.classList.contains('ansi-block')) {
            // 检查内容是否已经包裹在唯一的内容 span 中（排除行号容器）
            const children = Array.from(pre.children).filter(c => !c.classList.contains('line-numbers-wrapper'));
            const hasProperWrapper = children.length === 1 && children[0].tagName === 'SPAN' && !children[0].classList.contains('line-number');

            if (!hasProperWrapper) {
                const wrapper = document.createElement('span');
                wrapper.className = 'ansi-content-wrapper';
                // 移动所有原始子节点到包装器中
                while (pre.firstChild) {
                    wrapper.appendChild(pre.firstChild);
                }
                pre.appendChild(wrapper);
            }
            pre.classList.add('language-ansi');
        }
    }

    // >>>>空格 高亮背景
    private processHighlightBackground(preElement: HTMLPreElement) {
        const options = this.getCodeBlockOptions();
        if (!options.enableHighlightLine) return;

        const codeElement = this.getCodeElement(preElement);
        if (!codeElement) return;

        const linesHTML = codeElement.innerHTML.split('\n');

        const newLinesHTML = linesHTML.map((lineHTML) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = lineHTML;
            const lineText = tempDiv.textContent || '';

            // 改成匹配 ">>>> "（4个 > 加一个空格）
            if (lineText.startsWith('>>>> ')) {
                const lineDiv = document.createElement('div');
                lineDiv.innerHTML = lineHTML;

                // 去掉 ">>>> " 5 个字符，但保留原始缩进
                let remaining = 5;

                const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT);
                let node;

                while ((node = walker.nextNode()) && remaining > 0) {
                    const textNode = node as Text;
                    const text = textNode.data;

                    if (text.length <= remaining) {
                        remaining -= text.length;
                        textNode.data = '';
                    } else {
                        // 只去掉 ">>>> " 部分，保留后面的所有内容（包括缩进空格）
                        const newText = text.substring(remaining);
                        textNode.data = newText;
                        remaining = 0;
                    }
                }

                return `<span class="highlight-line">${lineDiv.innerHTML}</span>`;
            } else {
                return lineHTML;
            }
        });

        codeElement.innerHTML = newLinesHTML.join('\n');
    }

    private processLanguage(pre: HTMLPreElement) {
        // 优先从 code 元素获取语言标识
        const codeElement = pre.querySelector('code');
        let language = '';

        if (codeElement) {
            // 从 code 元素的类名中提取语言（例如：language-代码块, language-python）
            const codeClassMatch = codeElement.className.match(/language-([^\s]+)/);
            if (codeClassMatch) {
                language = codeClassMatch[1];
            }
        }

        // 如果 code 元素没有语言标识，尝试从 pre 元素获取
        if (!language) {
            language = pre.className.match(/language-(\w+)/)?.[1] || '';
        }

        // 如果是 ANSI 块
        if (!language && pre.classList.contains('ansi-block')) {
            language = 'ansi';
        }

        if (language) {
            pre.setAttribute('data-language', language);
        }
    }

    private getCodeElement(pre: HTMLPreElement): HTMLElement {
        // 优先查找标准的 code 标签
        const code = pre.querySelector('code');
        if (code) return code;

        // 如果是 ANSI 块，查找我们包裹的内容容器
        if (pre.classList.contains('language-ansi')) {
            const wrapper = pre.querySelector('.ansi-content-wrapper');
            if (wrapper) return wrapper as HTMLElement;
            // 回退：查找第一个非行号标记的 span
            const firstSpan = Array.from(pre.children).find(c => c.tagName === 'SPAN' && !c.classList.contains('line-numbers-wrapper'));
            if (firstSpan) return firstSpan as HTMLElement;
        }

        return pre;
    }

    private prepareContainer(pre: HTMLPreElement) {
        // Move pre into a container
        const container = document.createElement('div');
        container.className = 'code-block-container';
        const language = pre.getAttribute('data-language');
        if (language) container.setAttribute('data-language', language);

        pre.parentNode?.insertBefore(container, pre);
        container.appendChild(pre);

        // Sync background
        const preStyle = window.getComputedStyle(pre);
        if (preStyle.backgroundColor && preStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && preStyle.backgroundColor !== 'transparent') {
            // Optional: hoist background color if needed, but CSS handles standard cases.
            // container.style.backgroundColor = preStyle.backgroundColor;
            pre.style.backgroundColor = 'transparent';
        }
    }

    private createHeader(pre: HTMLPreElement) {
        const container = pre.parentElement as HTMLElement;
        const header = document.createElement('div');
        header.className = 'code-block-header';

        const language = pre.getAttribute('data-language') || 'Text';
        const title = document.createElement('div');
        title.className = 'code-block-header__title';
        title.textContent = language.charAt(0).toUpperCase() + language.slice(1);

        const controls = document.createElement('div');
        controls.className = 'code-block-controls';

        // Expand/Collapse (Header)
        const options = this.getCodeBlockOptions();
        const lines = this.getLineCount(pre);
        const threshold = options.collapseThreshold || 30;

        if (lines > threshold && options.defaultCollapse) {
            // 默认折叠
            this.setupCollapse(pre, container);
            const expandBtn = this.createButton('expand', this.getTranslation('expandCollapse', '展开/收起'));
            this.updateExpandIcon(expandBtn, true);
            expandBtn.onclick = () => this.toggleCollapse(container, expandBtn);
            controls.appendChild(expandBtn);
            (container as any).expandBtn = expandBtn;
            // 创建底部展开按钮（如果启用）
            if (options.showBottomExpandButton) {
                this.createBottomExpandButton(container, pre);
            }
        }

        // Wrap
        const wrapBtn = this.createButton('wrap', this.getTranslation('wrap', '自动换行'));
        wrapBtn.innerHTML = this.getIcon('wrap');
        wrapBtn.onclick = () => this.toggleWrap(pre, wrapBtn);

        // Apply default wrap setting
        if (options.defaultWrap) {
            pre.classList.add('wrap-code');
            wrapBtn.innerHTML = this.getIcon('text');
        }

        controls.appendChild(wrapBtn);

        // Copy
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-block-button copy-button';
        const copyText = this.getTranslation('copy', '复制');
        copyBtn.title = copyText;
        copyBtn.innerHTML = `${this.getIcon('copy')}<span>${copyText}</span>`;
        copyBtn.onclick = async () => await this.copyCode(pre, copyBtn);
        controls.appendChild(copyBtn);

        header.appendChild(title);
        header.appendChild(controls);

        container.insertBefore(header, pre);
    }

    private createButton(type: string, title: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = `code-block-button ${type}-button`;
        btn.title = title;
        return btn;
    }

    private getIcon(name: string): string {
        const icons: Record<string, string> = {
            copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stroke-[2] size-4"><rect x="3" y="8" width="13" height="13" rx="4" stroke="currentColor"></rect><path fill-rule="evenodd" clip-rule="evenodd" d="M13 2.00004L12.8842 2.00002C12.0666 1.99982 11.5094 1.99968 11.0246 2.09611C9.92585 2.31466 8.95982 2.88816 8.25008 3.69274C7.90896 4.07944 7.62676 4.51983 7.41722 5.00004H9.76392C10.189 4.52493 10.7628 4.18736 11.4147 4.05768C11.6802 4.00488 12.0228 4.00004 13 4.00004H14.6C15.7366 4.00004 16.5289 4.00081 17.1458 4.05121C17.7509 4.10066 18.0986 4.19283 18.362 4.32702C18.9265 4.61464 19.3854 5.07358 19.673 5.63807C19.8072 5.90142 19.8994 6.24911 19.9488 6.85428C19.9992 7.47112 20 8.26343 20 9.40004V11C20 11.9773 19.9952 12.3199 19.9424 12.5853C19.8127 13.2373 19.4748 13.8114 19 14.2361V16.5829C20.4795 15.9374 21.5804 14.602 21.9039 12.9755C22.0004 12.4907 22.0002 11.9334 22 11.1158L22 11V9.40004V9.35725C22 8.27346 22 7.3993 21.9422 6.69141C21.8826 5.96256 21.7568 5.32238 21.455 4.73008C20.9757 3.78927 20.2108 3.02437 19.27 2.545C18.6777 2.24322 18.0375 2.1174 17.3086 2.05785C16.6007 2.00002 15.7266 2.00003 14.6428 2.00004L14.6 2.00004H13Z" fill="currentColor"></path></svg>`,
            wrap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"></line><path d="M3 12h15a3 3 0 1 1 0 6h-4"></path><polyline points="16 16 14 18 16 20"></polyline><line x1="3" x2="10" y1="18" y2="18"></line></svg>`,
            text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6.1H3"></path><path d="M21 12.1H3"></path><path d="M15.1 18H3"></path></svg>`,
            expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`,
            collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path></svg>`
        };
        return icons[name] || '';
    }

    private getLineCount(pre: HTMLPreElement): number {
        const codeElement = this.getCodeElement(pre);
        const text = codeElement.textContent || '';
        const lines = text.split('\n');
        return lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    }

    // Line Numbers Logic
    private addLineNumbers(pre: HTMLPreElement) {
        if (pre.querySelector('.line-numbers-wrapper')) return;

        // Check if line numbers should be shown
        const options = this.getCodeBlockOptions();
        if (!options.showLineNumbers) return;

        const lines = this.getLineCount(pre);
        if (lines < 1) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'line-numbers-wrapper';

        // Initial populate
        this.renderLineNumbers(wrapper, lines);

        pre.insertBefore(wrapper, pre.firstChild);
        pre.classList.add('has-line-numbers');

        // Sync typography
        this.syncTypography(pre, wrapper);

        // Observer for resize/wrap
        const debouncedUpdate = this.debounce(() => {
            requestAnimationFrame(() => this.updateLineNumbers(pre, wrapper));
        }, 100);

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    debouncedUpdate();
                    break;
                }
            }
        });
        observer.observe(pre, { attributes: true, attributeFilter: ['class'] });
        window.addEventListener('resize', debouncedUpdate);
    }

    private renderLineNumbers(wrapper: HTMLElement, count: number) {
        let html = '';
        for (let i = 1; i <= count; i++) {
            html += `<span class="line-number" data-line="${i}">${i}</span>`;
        }
        wrapper.innerHTML = html;
    }

    private syncTypography(pre: HTMLElement, wrapper: HTMLElement) {
        const codeElement = this.getCodeElement(pre as HTMLPreElement);
        const style = window.getComputedStyle(codeElement);
        pre.style.lineHeight = style.lineHeight;
        pre.style.fontSize = style.fontSize;
        pre.style.fontFamily = style.fontFamily;
        wrapper.style.lineHeight = style.lineHeight;
        wrapper.style.fontSize = style.fontSize;
        wrapper.style.fontFamily = style.fontFamily;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private updateLineNumbers(pre: HTMLPreElement, wrapper: HTMLElement) {
        const isWrapped = pre.classList.contains('wrap-code');
        const codeElement = this.getCodeElement(pre);
        if (!isWrapped) {
            this.renderLineNumbers(wrapper, this.getLineCount(pre));
            return;
        }

        // --- 步骤 1: 创建高精度测量容器 ---
        const measureDiv = document.createElement('div');
        const style = window.getComputedStyle(codeElement);

        // 强制使用 border-box 并复制所有可能影响高度/换行的属性
        Object.assign(measureDiv.style, {
            position: 'absolute',
            visibility: 'hidden',
            top: '-9999px',
            left: '-9999px',
            width: style.width,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            boxSizing: 'border-box',
            padding: style.padding,
            border: style.border,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            wordBreak: 'break-all',
            overflowWrap: 'break-word'
        });
        document.body.appendChild(measureDiv);

        // --- 步骤 2: 精确测量单行基准高度 (在子元素上测量) ---
        const probe = document.createElement('div');
        probe.style.width = '100%';
        probe.textContent = 'X';
        measureDiv.appendChild(probe);
        const singleLineHeight = probe.offsetHeight;
        measureDiv.removeChild(probe);

        if (singleLineHeight === 0) {
            document.body.removeChild(measureDiv);
            return;
        }

        // --- 步骤 3: 批量测量 ---
        const codeText = codeElement.textContent || '';
        const originalLines = codeText.split('\n');
        if (originalLines.length > 0 && originalLines[originalLines.length - 1] === '') {
            originalLines.pop();
        }

        const itemStyle = 'width: 100%; white-space: pre-wrap; word-wrap: break-word; word-break: break-all; margin: 0; padding: 0;';
        measureDiv.innerHTML = originalLines.map(line =>
            `<div style="${itemStyle}">${this.escapeHtml(line) || '&nbsp;'}</div>`
        ).join('');

        const lineDivs = measureDiv.querySelectorAll('div');
        let html = '';
        originalLines.forEach((_, i) => {
            const h = (lineDivs[i] as HTMLElement).offsetHeight;
            const rows = Math.max(1, Math.round(h / singleLineHeight));
            html += `<span class="line-number" data-line="${i + 1}">${i + 1}</span>`;
            for (let j = 1; j < rows; j++) {
                html += `<span class="line-number line-continuation"></span>`;
            }
        });

        document.body.removeChild(measureDiv);
        wrapper.innerHTML = html;
    }

    // Wrap Logic
    private toggleWrap(pre: HTMLPreElement, btn: HTMLButtonElement) {
        pre.classList.toggle('wrap-code');
        const isWrapped = pre.classList.contains('wrap-code');
        btn.innerHTML = isWrapped ? this.getIcon('text') : this.getIcon('wrap');
        // 移除 active 类，只改变图标，不显示主题色

        const wrapper = pre.querySelector('.line-numbers-wrapper') as HTMLElement;
        if (wrapper) {
            // 关键：连续两个 rAF 确保浏览器已经完成了帧渲染和布局更新
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.updateLineNumbers(pre, wrapper);
                });
            });
        }
    }

    // Collapse Logic
    private setupCollapse(pre: HTMLPreElement, container: HTMLElement) {
        container.classList.add('collapsed');
        pre.classList.add('collapsed');
        pre.setAttribute('data-collapsed', 'true');

        // 计算20行的实际高度
        this.setCollapsedHeight(pre, 20);
    }

    private createBottomExpandButton(container: HTMLElement, pre: HTMLPreElement) {
        // 检查是否已存在底部按钮
        if (container.querySelector('.bottom-expand-button')) return;

        const bottomBtn = document.createElement('button');
        bottomBtn.className = 'bottom-expand-button';
        bottomBtn.title = this.getTranslation('expandCollapse', '展开/收起');
        bottomBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><path d="M18 12L12 18L6 12" stroke="currentColor" stroke-width="2"></path><path d="M18 6L12 12L6 6" stroke="currentColor" stroke-width="2"></path></svg>`;
        bottomBtn.onclick = () => {
            const headerBtn = container.querySelector('.code-block-button.expand-button') as HTMLButtonElement;
            this.toggleCollapse(container, headerBtn || null);
        };
        container.appendChild(bottomBtn);
        // 初始状态：折叠时图标不旋转
        this.updateBottomButtonIcon(container, true);
    }

    private updateBottomButtonIcon(container: HTMLElement, isCollapsed: boolean) {
        const bottomBtn = container.querySelector('.bottom-expand-button') as HTMLElement;
        if (bottomBtn) {
            // 折叠时：不旋转（默认状态）
            // 展开时：旋转180°
            bottomBtn.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }

    private setCollapsedHeight(pre: HTMLPreElement, lines: number) {
        const computedStyle = window.getComputedStyle(pre);
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.6;
        // 20行的高度 = 20 * lineHeight
        const maxHeight = lines * lineHeight;
        pre.style.maxHeight = `${maxHeight}px`;
        pre.style.overflowY = 'hidden';
    }

    private toggleCollapse(container: HTMLElement, btn: HTMLButtonElement | null = null) {
        const pre = container.querySelector('pre') as HTMLPreElement;
        const isCollapsed = container.classList.contains('collapsed');
        if (isCollapsed) {
            // 展开
            container.classList.remove('collapsed');
            pre?.classList.remove('collapsed');
            if (pre) {
                pre.style.maxHeight = '';
                pre.style.overflowY = '';
            }
            if (btn) {
                this.updateExpandIcon(btn, false);
            }
            // 更新底部按钮图标：展开时旋转180°
            this.updateBottomButtonIcon(container, false);
        } else {
            // 折叠
            container.classList.add('collapsed');
            pre?.classList.add('collapsed');
            if (pre) {
                this.setCollapsedHeight(pre, 20);
            }
            if (btn) {
                this.updateExpandIcon(btn, true);
            }
            // 更新底部按钮图标：折叠时不旋转
            this.updateBottomButtonIcon(container, true);


            container.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    }

    private updateExpandIcon(btn: HTMLButtonElement, isCollapsed: boolean) {
        btn.innerHTML = isCollapsed ? this.getIcon('expand') : this.getIcon('collapse');
    }

    // Copy Logic
    private async copyCode(pre: HTMLPreElement, btn: HTMLButtonElement) {
        const codeElement = this.getCodeElement(pre);
        const text = codeElement.innerText || codeElement.textContent || ''; // innerText respects styling like hidden elements? No, textContent is better for raw code.

        try {
            await navigator.clipboard.writeText(text);
            this.showCopyStatus(btn, true);
        } catch (e) {
            this.fallbackCopy(text, btn);
        }
    }

    private fallbackCopy(text: string, btn: HTMLButtonElement) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.showCopyStatus(btn, true);
        } catch (e) {
            this.showCopyStatus(btn, false);
        }
        document.body.removeChild(textarea);
    }

    private showCopyStatus(btn: HTMLButtonElement, success: boolean) {
        const originalHtml = btn.innerHTML;
        const span = btn.querySelector('span');

        if (success) {
            btn.classList.add('copied');
            if (span) span.textContent = this.getTranslation('copied', '已复制');
            // 变暗效果
            btn.style.opacity = '0.6';
            btn.style.transition = 'opacity 0.3s ease';
        } else {
            btn.classList.add('error');
            if (span) span.textContent = '失败';
        }

        setTimeout(() => {
            btn.classList.remove('copied', 'error');
            btn.style.opacity = '';
            btn.style.transition = '';
            btn.innerHTML = originalHtml;
        }, 1000);
    }

    // Utils

    private setupThemeObserver() {
        const debouncedAdjust = this.debounce(() => {
            // Filter out containers that are no longer in the DOM
            this.processedContainers = this.processedContainers.filter(container => document.body.contains(container));
            this.processedContainers.forEach(container => {
                this.adjustContrast(container);
            });
        }, 100); // Debounce for 100ms

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    debouncedAdjust();
                    break; // Only need to react once per class change
                }
            }
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    private adjustContrast(container: HTMLElement) {
        const bg = getComputedStyle(container).backgroundColor;

        const isDark = document.body.classList.contains('theme-dark');

        const standardColor = isDark ? '#a0a0a0' : '#606060';
        const mutedColor = isDark ? '#888888' : '#777777';
        const adjustedColor = ensureContrast(standardColor, bg, 3.5, container);
        const adjustedMuted = ensureContrast(mutedColor, bg, 3, container);
        container.style.setProperty('--code-ui-color', adjustedColor);
        container.style.setProperty('--code-ui-color-muted', adjustedMuted);

        if (!this.processedContainers.includes(container)) {
            this.processedContainers.push(container);
        }
    }

    private debounce(func: Function, wait: number) {
        let timeout: any;
        return (...args: any[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}
