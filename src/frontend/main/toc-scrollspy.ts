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

        // 延迟初始化，确保 DOM 渲染完成
        setTimeout(() => {
            this.initHeadings(doc);
            this.setupObserver();
            this.createIndicator();
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
        // 从可见标题中选择文档顺序最靠前的一个
        let activeId: string | null = null;
        for (const h of this.headings) {
            if (this.visibleHeadings.has(h.id)) {
                activeId = h.id;
                break;
            }
        }

        // 如果没有可见标题，回退到第一个
        if (!activeId && this.headings.length > 0) {
            activeId = this.headings[0].id;
        }

        if (!activeId) {
            this.hideIndicator();
            return;
        }

        this.activateTocItem(activeId);
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

    private injectStyles(): void {
        if (TocScrollSpy.stylesInjected) return;
        TocScrollSpy.stylesInjected = true;

        const style = document.createElement("style");
        style.id = "toc-scrollspy-styles";
        style.textContent = `
            #outline { position: relative; }
            #outline .tree-item-self {
                position: relative;
                transition: color 0.1s ease;
                border-radius: 4px;
                display: flex !important;
                align-items: center;
                padding-left: 8px !important;
            }
            #outline .tree-item-inner {
                display: flex !important;
                align-items: flex-start;
                gap: 4px;
                white-space: normal;
                word-break: break-word;
                flex: 1;
                line-height: 1.4;
                padding: 2px 4px 2px 0;
                font-size: 13px;
                transition: font-size 0.15s ease-out;
            }
            #outline .collapse-icon {
                display: flex !important;
                align-items: center;
                justify-content: center;
                width: 20px !important;
                height: 24px;
                flex-shrink: 0;
                margin-top: -2px;
            }
            #outline .tree-item-self.is-active { color: var(--text-normal); }
            #outline .tree-item-self.is-active .tree-item-inner {
                font-size: 14.5px;
                font-weight: 600;
            }
            .outline-indicator {
                position: absolute;
                left: 2px;
                width: 3px;
                background-color: var(--interactive-accent);
                transition: top 0.2s cubic-bezier(0.4,0,0.2,1), height 0.2s cubic-bezier(0.4,0,0.2,1);
                z-index: 10;
                pointer-events: none;
                border-radius: 4px;
                display: none;
            }
            #outline .tree-item[data-depth="0"] > .tree-item-self .collapse-icon,
            #outline .tree-item[data-depth="1"] > .tree-item-self .collapse-icon {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
}
