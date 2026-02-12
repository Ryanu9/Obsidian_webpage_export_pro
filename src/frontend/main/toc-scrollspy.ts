import { Tree, TreeItem } from "./trees";

export class TocScrollSpy {
    private observer: IntersectionObserver | null = null;
    private headings: { id: string; element: HTMLElement }[] = [];
    private visibleHeadings = new Set<string>();
    private indicatorEl: HTMLElement | null = null;
    private currentPathname = "";
    private pendingScrollFrame: number | null = null;
    private static stylesInjected = false;

    constructor() {
        this.injectStyles();
    }

    public updateHeadings(): void {
        const site = (window as any).ObsidianSite;
        const doc = site?.document;

        // 断开旧观察器
        this.observer?.disconnect();
        this.visibleHeadings.clear();

        if (!doc) {
            this.headings = [];
            return;
        }

        this.currentPathname = doc.pathname || "";

        // Pre-collapse tree items immediately to avoid expand-then-collapse flash
        this.preCollapseItems();

        // 延迟初始化，确保 DOM 渲染完成
        setTimeout(() => {
            this.initHeadings(doc);
            this.setupObserver();
            this.createIndicator();
            this.updateOverflowGradients();
        }, 300);
    }

    private initHeadings(doc: any): void {
        // 移动折叠图标到 inner 容器内
        document.querySelectorAll("#outline .tree-item-self").forEach((self) => {
            const icon = self.querySelector(":scope > .collapse-icon");
            const inner = self.querySelector(".tree-item-inner");
            if (icon && inner) inner.prepend(icon);
        });

        this.headings = doc
            .getFlatHeaders()
            .map((h: any) => ({ id: h.id, element: h.headerElement }))
            .filter((h: any) => h.id && h.element);
    }

    private setupObserver(): void {
        if (this.headings.length === 0) return;

        // 使用 rootMargin 定义"顶部激活区域"
        this.observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.id;
                    if (entry.isIntersecting) {
                        this.visibleHeadings.add(id);
                    } else {
                        this.visibleHeadings.delete(id);
                    }
                }
                this.syncActiveHeading();
            },
            {
                // 顶部 0px，底部 -80% 表示只有进入视口上部 20% 区域才算"可见"
                rootMargin: "0px 0px -80% 0px",
                threshold: 0,
            }
        );

        this.headings.forEach((h) => this.observer!.observe(h.element));
    }

    private syncActiveHeading(): void {
        // 优先从 IntersectionObserver 检测到的可见标题中选择
        let activeId: string | null = null;
        for (const h of this.headings) {
            if (this.visibleHeadings.has(h.id)) {
                activeId = h.id;
                break;
            }
        }

        // 如果没有可见标题，使用位置计算找到最后一个已滚过顶部的标题
        if (!activeId && this.headings.length > 0) {
            activeId = this.findActiveByPosition();
        }

        if (!activeId) {
            this.hideIndicator();
            return;
        }

        this.activateTocItem(activeId);
    }

    private findActiveByPosition(): string | null {
        const TOP_OFFSET = 80; // 顶部偏移量
        let lastPassedId: string | null = null;

        for (const h of this.headings) {
            const rect = h.element.getBoundingClientRect();
            if (rect.top <= TOP_OFFSET) {
                lastPassedId = h.id;
            } else {
                break; // 标题按文档顺序排列，一旦遇到还没滚过的就停止
            }
        }

        return lastPassedId;
    }

    private activateTocItem(activeId: string): void {
        const site = (window as any).ObsidianSite;
        const outlineTree = site?.outlineTree as Tree;
        if (!outlineTree?.rootEl) return;

        // 查找对应的 TOC 项
        const item = this.findTocItem(outlineTree, activeId);
        if (!item) return;

        const isNew = item !== outlineTree.activeItem;
        if (isNew) item.setActive();

        this.syncExpansion(outlineTree, item);
        this.updateIndicator(outlineTree.rootEl, item);

        if (isNew) this.scrollTocIntoView(outlineTree.rootEl, item);
    }

    private findTocItem(tree: Tree, id: string): TreeItem | null {
        const variants = [
            `#${id}`,
            `${this.currentPathname}#${id}`,
            `#${encodeURIComponent(id)}`,
            `#${decodeURIComponent(id)}`,
        ];
        for (const v of variants) {
            const item = tree.findByPath(v);
            if (item) return item;
        }
        return null;
    }

    private preCollapseItems(): void {
        const site = (window as any).ObsidianSite;
        const outlineTree = site?.outlineTree as Tree;
        if (!outlineTree) return;

        const autoCollapseDepth = site?.metadata?.featureOptions?.outline?.autoCollapseDepth ?? 1;
        if (autoCollapseDepth >= 100) return;

        outlineTree.overrideAnimationLength(0);
        outlineTree.forAllChildren((item) => {
            if (item.collapsable && item.depth >= autoCollapseDepth) {
                item.collapsed = true;
            }
        });
        outlineTree.restoreAnimationLength();
    }

    private syncExpansion(tree: Tree, activeItem: TreeItem): void {
        const site = (window as any).ObsidianSite;
        const autoCollapseDepth = site?.metadata?.featureOptions?.outline?.autoCollapseDepth ?? 1;
        if (autoCollapseDepth >= 100) return;

        // 收集激活路径上的所有祖先
        const ancestors = new Set<TreeItem>();
        let curr: TreeItem | undefined = activeItem;
        while (curr) {
            ancestors.add(curr);
            curr = curr.parent;
        }

        tree.overrideAnimationLength(0);
        tree.forAllChildren((item) => {
            if (ancestors.has(item)) {
                if (item.collapsable) item.collapsed = false;
            } else if (item.collapsable && item.depth >= autoCollapseDepth) {
                item.collapsed = true;
            }
        });
        tree.restoreAnimationLength();
    }

    private createIndicator(): void {
        const outline = document.querySelector("#outline");
        if (!outline) return;

        outline.querySelector(".outline-indicator")?.remove();
        this.indicatorEl = document.createElement("div");
        this.indicatorEl.className = "outline-indicator";
        outline.appendChild(this.indicatorEl);
    }

    private updateIndicator(container: HTMLElement, item: TreeItem): void {
        if (!this.indicatorEl) return;

        const containerRect = container.getBoundingClientRect();
        const selfRect = item.selfEl.getBoundingClientRect();

        this.indicatorEl.style.display = "block";
        this.indicatorEl.style.top = `${selfRect.top - containerRect.top + container.scrollTop}px`;
        this.indicatorEl.style.height = `${selfRect.height}px`;
    }

    private hideIndicator(): void {
        if (this.indicatorEl) this.indicatorEl.style.display = "none";
    }

    private scrollTocIntoView(container: HTMLElement, item: TreeItem): void {
        if (this.pendingScrollFrame) cancelAnimationFrame(this.pendingScrollFrame);

        this.pendingScrollFrame = requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const itemRect = item.itemEl.getBoundingClientRect();

            // 只有当项目在舒适区外时才滚动
            const margin = containerRect.height * 0.2;
            const isOutside =
                itemRect.top < containerRect.top + margin ||
                itemRect.bottom > containerRect.bottom - margin;

            if (isOutside) {
                const targetTop =
                    itemRect.top - containerRect.top + container.scrollTop - containerRect.height * 0.3;
                container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
            }
            this.pendingScrollFrame = null;
        });
    }

    private updateOverflowGradients(): void {
        const outline = document.querySelector("#outline") as HTMLElement;
        if (outline) {
            const isOverflowing = outline.scrollHeight > outline.clientHeight + 10;
            outline.classList.toggle("gradient-active", isOverflowing);
        }

        const backlinkContent = document.querySelector("#backlinks .backlinks-content") as HTMLElement;
        if (backlinkContent) {
            const isOverflowing = backlinkContent.scrollHeight > backlinkContent.clientHeight + 10;
            backlinkContent.classList.toggle("gradient-active", isOverflowing);
        }
    }

    private injectStyles(): void {
        if (TocScrollSpy.stylesInjected) return;
        TocScrollSpy.stylesInjected = true;

        const style = document.createElement("style");
        style.id = "toc-scrollspy-styles";
        style.textContent = `
            /* ====== Outline (TOC) — Quartz exact match ====== */
            #outline {
                position: relative;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                min-height: 1.4rem;
            }
            #outline.is-collapsed {
                flex: 0 0 auto;
                overflow-y: visible;
            }

            /* Flatten nested tree — remove all child indentation from DOM nesting */
            #outline .tree-item-children {
                border-left: none !important;
                margin-left: 0 !important;
                padding-left: 0 !important;
            }
            #outline .tree-item-children::before,
            #outline .tree-item-children::after,
            #outline .tree-item::before,
            #outline .tree-item::after {
                display: none !important;
                border: none !important;
            }

            /* Hide collapse icons and tree icons — Quartz TOC is flat text only */
            #outline .collapse-icon { display: none !important; }
            #outline .tree-collapse-all { display: none !important; }
            #outline .tree-icon { display: none !important; }

            /* Active indicator bar — animated accent highlight on left line */
            .outline-indicator {
                position: absolute;
                left: 0;
                width: 2px;
                background-color: var(--interactive-accent);
                border-radius: 2px;
                transition: top 0.15s ease-out, height 0.15s ease-out, opacity 0.15s ease-out;
                z-index: 1;
                pointer-events: none;
            }

            /* TOC items — left border line + opacity style */
            #outline .tree-item-self {
                position: relative;
                display: flex !important;
                align-items: center;
                background-color: transparent !important;
                color: var(--dark, var(--text-normal));
                opacity: 0.35;
                transition: 0.5s ease opacity, 0.3s ease color, 0.2s ease border-left-color;
                padding: 0 !important;
                border-left: 1px solid var(--background-modifier-border);
            }

            #outline .tree-item-inner {
                display: block !important;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
                line-height: 1.8;
                padding: 0;
                font-size: 1rem;
                font-weight: 500;
            }

            /* Depth-based indentation (includes 0.75rem gap from left border) */
            #outline .tree-item[data-depth="1"] > .tree-item-self { padding-left: 0.75rem !important; }
            #outline .tree-item[data-depth="2"] > .tree-item-self { padding-left: 1.75rem !important; }
            #outline .tree-item[data-depth="3"] > .tree-item-self { padding-left: 2.75rem !important; }
            #outline .tree-item[data-depth="4"] > .tree-item-self { padding-left: 3.75rem !important; }
            #outline .tree-item[data-depth="5"] > .tree-item-self { padding-left: 4.75rem !important; }
            #outline .tree-item[data-depth="6"] > .tree-item-self { padding-left: 5.75rem !important; }

            /* Hovered item */
            #outline .tree-item-self:hover {
                opacity: 0.75;
            }

            /* Active (in-view) item */
            #outline .tree-item-self.is-active {
                opacity: 1;
                background: none !important;
                border-left-color: var(--interactive-accent);
            }

            /* ---- Feature header — Quartz button.toc-header ---- */
            #outline .feature-header {
                background-color: transparent;
                border: none;
                text-align: left;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                margin-bottom: 0.25rem;
            }

            #outline .feature-header .feature-title {
                font-size: 1rem !important;
                font-weight: 700 !important;
                margin: 0 !important;
                margin-right: 0 !important;
                display: inline-block;
                color: var(--dark, var(--text-normal)) !important;
                flex-grow: 0 !important;
                flex-shrink: 0;
            }

            /* Fold chevron icon — Quartz style */
            #outline .feature-header .fold {
                margin-left: 0.3rem;
                transition: transform 0.3s ease;
                opacity: 0.8;
                width: 18px;
                height: 18px;
                flex-shrink: 0;
            }

            #outline.is-collapsed .feature-header .fold {
                transform: rotateZ(-90deg);
            }

            /* Collapse content */
            #outline.is-collapsed > :not(.feature-header) {
                display: none !important;
            }

            /* ====== Overflow gradient ====== */
            #outline.tree-container.gradient-active,
            #backlinks .backlinks-content.gradient-active {
                mask-image: linear-gradient(to bottom, black calc(100% - 50px), transparent 100%);
                -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 50px), transparent 100%);
            }

            /* ====== Backlinks — Quartz exact match ====== */
            #backlinks {
                margin-top: 1rem;
            }

            #backlinks .feature-header {
                padding: 0;
                margin: 0;
                border-bottom: none !important;
            }

            #backlinks .feature-header .feature-title {
                font-size: 1rem !important;
                font-weight: 700 !important;
                margin: 0 !important;
                color: var(--dark, var(--text-normal)) !important;
            }

            #backlinks .backlinks-content {
                list-style: none;
                padding: 0;
                margin: 0.5rem 0;
            }

            /* Hide backlink icons — Quartz uses plain text links */
            #backlinks .backlink-icon {
                display: none !important;
            }

            /* Backlink links — Quartz internal link style */
            #backlinks a.backlink {
                display: block !important;
                padding: 0 !important;
                gap: 0 !important;
                background-color: transparent !important;
                color: var(--text-accent) !important;
                text-decoration: none !important;
                line-height: 1.8;
                border-radius: 0 !important;
                font-size: 0.95rem;
                font-weight: 500;
            }

            #backlinks a.backlink:hover {
                background-color: transparent !important;
                text-decoration: none !important;
                opacity: 0.7;
            }

            #backlinks .backlink-title {
                display: inline;
                font-weight: 600;
                margin-left: 1em;
            }

            #backlinks .backlinks-empty-message {
                color: var(--text-muted);
                font-size: 0.9rem;
                font-style: normal;
                text-align: left;
                padding: 0;
                opacity: 0.5;
            }
        `;
        document.head.appendChild(style);
    }
}
