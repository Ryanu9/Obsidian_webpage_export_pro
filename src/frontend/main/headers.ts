export class Header {
    private static headerMap: WeakMap<HTMLElement, Header> = new WeakMap();

    private _id: string;
    private _level: number;
    private _divParent: HTMLElement;
    private _headerElement: HTMLElement;
    private _collapseIndicatorElement: HTMLElement | null;
    private _children: Header[] = [];
    private _isCollapsed: boolean = false;
    private _content: HTMLElement[] = [];

    constructor(element: HTMLElement) {
        this._divParent = element.parentElement as HTMLElement;
        this._headerElement = element;
        this._collapseIndicatorElement = this._headerElement.querySelector(".heading-collapse-indicator");
        this._id = element.id;
        this._level = parseInt(element.tagName.replace("H", ""));

        Header.headerMap.set(element, this);

        if (this._collapseIndicatorElement) {
            this._collapseIndicatorElement.addEventListener("click", () => {
                this.toggleCollapse();
            });
        }

        this.addAnchorCopyButton();
        Header.injectStyles();
    }

    private addAnchorCopyButton() {
        if (!this._id) return;

        const anchorButton = document.createElement('button');
        anchorButton.className = 'heading-anchor-copy-button';
        anchorButton.textContent = '#';
        anchorButton.setAttribute('aria-label', '复制标题链接');
        anchorButton.title = '复制标题链接';

        anchorButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const url = `${window.location.origin}${window.location.pathname}#${this._id}`;
            navigator.clipboard.writeText(url);

            anchorButton.classList.add('is-active');
            setTimeout(() => {
                anchorButton.classList.remove('is-active');
            }, 1000);
        };

        this._headerElement.appendChild(anchorButton);
    }

    private static injectStyles() {
        if (document.getElementById('heading-anchor-styles')) return;

        const style = document.createElement('style');
        style.id = 'heading-anchor-styles';
        style.textContent = `
            .heading-anchor-copy-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                
                /* 1. 核心清除：移除所有按钮痕迹 */
                background: none !important;
                border: none !important;
                outline: none !important;           /* 防止点击时出现蓝色外框 */
                box-shadow: none !important;         /* 移除阴影 */
                -webkit-appearance: none;            /* 移除系统级按钮外观 */
                appearance: none;
                padding: 0;
                
                /* 2. 视觉表现：看起来像文本 */
                opacity: 0;                          /* 默认隐藏，悬庭才显示 */
                color: var(--text-faint);            /* 使用淡淡的文字颜色 */
                font-size: 0.9em;
                margin-left: 0.2em;
                cursor: pointer;
                font-family: var(--font-monospace);  /* 使用等宽字体让 # 更美观 */
                vertical-align: middle;
                
                transition: opacity 0.2s ease-in-out, color 0.15s ease-in-out;
            }

            /* 3. 状态控制：强力确保任何时刻都没有背景和边框 */
            .heading-anchor-copy-button:hover,
            .heading-anchor-copy-button:focus,
            .heading-anchor-copy-button:active,
            .heading-anchor-copy-button:focus-visible {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
                background: none !important;
            }

            /* 4. 悬停效果：仅在鼠标移入标题时显示 */
            h1:hover .heading-anchor-copy-button,
            h2:hover .heading-anchor-copy-button,
            h3:hover .heading-anchor-copy-button,
            h4:hover .heading-anchor-copy-button,
            h5:hover .heading-anchor-copy-button,
            h6:hover .heading-anchor-copy-button {
                opacity: 0.4;  /* 设置为半透明，不喧宾夺主 */
            }

            /* 5. 点击激活时反馈：通过改变不透明度和颜色来示意 */
            .heading-anchor-copy-button.is-active {
                opacity: 1 !important;
                color: var(--text-normal) !important;
            }
        `;
        document.head.appendChild(style);
    }

    public get id(): string {
        return this._id;
    }

    public get text(): string {
        return this._headerElement.textContent ?? "";
    }

    public set text(value: string) {
        this._headerElement.textContent = value;
    }

    public get level(): number {
        return this._level;
    }

    public get headerElement(): HTMLElement {
        return this._headerElement;
    }

    public get collapseIndicatorElement(): HTMLElement | null {
        return this._collapseIndicatorElement;
    }

    public get children(): Header[] {
        return this._children;
    }

    public get isCollapsed(): boolean {
        return this._isCollapsed;
    }

    public scrollTo(options: ScrollIntoViewOptions = { behavior: "smooth", block: "start" }): void {
        // Find the nearest scrollable ancestor to avoid scrolling the entire page
        const scrollContainer = this.findScrollContainer(this._headerElement);
        if (scrollContainer) {
            const headerRect = this._headerElement.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetTop = headerRect.top - containerRect.top + scrollContainer.scrollTop;
            scrollContainer.scrollTo({ top: targetTop, behavior: options.behavior ?? "smooth" });
        } else {
            this._headerElement.scrollIntoView(options);
        }
    }

    private findScrollContainer(el: HTMLElement): HTMLElement | null {
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
            const style = getComputedStyle(parent);
            const overflowY = style.overflowY;
            if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return null;
    }

    public find(predicate: (header: Header) => boolean): Header | undefined {
        if (predicate(this)) {
            return this;
        }

        for (const child of this.children) {
            const result = child.find(predicate);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public findByID(id: string): Header | undefined {
        if (id.startsWith("#")) {
            id = id.substring(1);
        }

        return this.find(header => header.id === id);
    }

    public getFlatChildren(): Header[] {
        let headers: Header[] = [this];
        for (const child of this._children) {
            headers = headers.concat(child.getFlatChildren());
        }
        return headers;
    }

    public toggleCollapse() {
        this._isCollapsed = !this._isCollapsed;
        this._collapseIndicatorElement?.classList.toggle("is-collapsed", this._isCollapsed);
        this._headerElement.classList.toggle("is-collapsed", this._isCollapsed);
        this.updateVisibility(this._isCollapsed);
    }

    private updateVisibility(collapse: boolean) {
        this._collapseIndicatorElement?.classList.toggle("is-collapsed", collapse);
        this._headerElement.classList.toggle("is-collapsed", collapse);

        for (const element of this._content) {
            element.style.display = collapse ? "none" : "";
        }

        for (const child of this._children) {
            child.headerElement.style.display = collapse ? "none" : "";
            if (collapse) {
                child.updateVisibility(true);
            } else {
                child.updateVisibility(child._isCollapsed);
            }
        }
    }

    // return content and child content
    public getHeaderWithContentRecursive(): HTMLElement[] {
        let content: HTMLElement[] = [];
        content.push(this._divParent);
        for (const element of this._content) {
            content.push(element);
        }
        for (const child of this._children) {
            content = content.concat(child.getHeaderWithContentRecursive());
        }
        return content;
    }

    public static createHeaderTree(html: HTMLElement): Header[] {
        const headers = Array.from(html.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headerObjects = headers.map(el => new Header(el as HTMLElement));
        const rootHeaders: Header[] = [];
        const stack: Header[] = [];

        for (let i = 0; i < headerObjects.length; i++) {
            const currentHeader = headerObjects[i];

            while (stack.length > 0 && stack[stack.length - 1].level >= currentHeader.level) {
                stack.pop();
            }

            if (stack.length > 0) {
                stack[stack.length - 1].children.push(currentHeader);
            } else {
                rootHeaders.push(currentHeader);
            }

            stack.push(currentHeader);

            // Collect inline block content
            let nextElement = currentHeader.headerElement.nextElementSibling;
            while (nextElement && !(nextElement instanceof HTMLHeadingElement)) {
                if (nextElement instanceof HTMLElement) {
                    currentHeader._content.push(nextElement);
                }
                nextElement = nextElement.nextElementSibling;
            }

            // collect outer block content
            nextElement = currentHeader.headerElement.parentElement?.nextElementSibling ?? null;
            while (nextElement && !nextElement.querySelector('h1, h2, h3, h4, h5, h6')) {
                if (nextElement instanceof HTMLElement && !nextElement.classList.contains('footer')) {
                    currentHeader._content.push(nextElement);
                }
                nextElement = nextElement.nextElementSibling;
            }

        }

        return rootHeaders;
    }

}
