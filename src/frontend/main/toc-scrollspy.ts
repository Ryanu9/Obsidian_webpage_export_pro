import { Tree, TreeItem } from "./trees";

export class TocScrollSpy {
    private rafPending = false;
    private headings: { id: string, element: HTMLElement }[] = [];
    private TOP_OFFSET_PX = 150;
    private scrollContainer: HTMLElement | null = null;

    private currentPathname: string = "";

    constructor() {
        this.init();
        this.injectStyles();
    }

    private init() {
        const site = (window as any).ObsidianSite;

        const interval = setInterval(() => {
            const scrollEl = document.querySelector('.obsidian-document.markdown-preview-view') as HTMLElement;

            if (scrollEl) {
                this.scrollContainer = scrollEl;
                this.scrollContainer.addEventListener('scroll', () => this.requestSync(), { passive: true });
                window.addEventListener('resize', () => this.requestSync());
                clearInterval(interval);
            } else if (site && site.centerContentEl) {
                this.scrollContainer = site.centerContentEl;
                this.scrollContainer?.addEventListener('scroll', () => this.requestSync(), { passive: true });
                window.addEventListener('resize', () => this.requestSync());
                clearInterval(interval);
            }
        }, 100);
    }

    public updateHeadings() {
        const site = (window as any).ObsidianSite;
        const doc = site.document;
        if (!doc) {
            this.headings = [];
            return;
        }

        this.currentPathname = doc.pathname || "";

        setTimeout(() => {
            const headerObjects = doc.getFlatHeaders();
            this.headings = headerObjects.map((h: any) => ({
                id: h.id,
                element: h.headerElement
            })).filter((h: any) => h.id);

            this.requestSync();
        }, 500);
    }

    private requestSync() {
        if (this.rafPending) return;
        this.rafPending = true;
        requestAnimationFrame(() => {
            this.rafPending = false;
            this.sync();
        });
    }

    private sync() {
        if (this.headings.length === 0 || !this.scrollContainer) return;

        let activeId: string | null = null;
        const containerTop = this.scrollContainer.getBoundingClientRect().top;

        for (const h of this.headings) {
            const rect = h.element.getBoundingClientRect();
            if (rect.top - containerTop <= this.TOP_OFFSET_PX) {
                activeId = h.id;
            } else {
                break;
            }
        }

        const site = (window as any).ObsidianSite;
        const outlineTree = site.outlineTree as Tree;
        if (!outlineTree) return;

        if (activeId) {
            const variants = [
                "#" + activeId,
                this.currentPathname + "#" + activeId,
                "#" + encodeURIComponent(activeId),
                this.currentPathname + "#" + encodeURIComponent(activeId),
                "#" + decodeURIComponent(activeId),
                this.currentPathname + "#" + decodeURIComponent(activeId)
            ];

            let item = null;
            for (const v of variants) {
                item = outlineTree.findByPath(v);
                if (item) break;
            }

            if (item && item !== outlineTree.activeItem) {
                item.setActive();

                // --- Auto Collapse/Expand Optimization ---
                this.syncExpansion(outlineTree, item);

                const el = item.itemEl;
                if (outlineTree.rootEl) {
                    (el as any).scrollIntoViewIfNeeded ? (el as any).scrollIntoViewIfNeeded({ behavior: 'smooth', block: 'center' }) : el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } else {
            if (outlineTree.activeItem) {
                outlineTree.activeItem.selfEl.classList.remove("is-active");
                outlineTree.activeItem = undefined;
                // Collapse back to default depth when scrolled to top
                this.syncExpansion(outlineTree, undefined);
            }
        }
    }

    private syncExpansion(tree: Tree, activeItem: TreeItem | undefined) {
        const site = (window as any).ObsidianSite;
        const autoCollapseDepth = site.metadata.featureOptions.outline.autoCollapseDepth;
        if (autoCollapseDepth >= 100) return;

        const ancestors = new Set<TreeItem>();
        let curr = activeItem;
        while (curr) {
            ancestors.add(curr);
            curr = curr.parent;
        }

        // Use overrideAnimationLength locally to make it smooth but fast
        tree.overrideAnimationLength(0);

        tree.forAllChildren((item) => {
            if (ancestors.has(item)) {
                // Should definitely be open if it's on the active path
                if (item.collapsable) item.collapsed = false;
            } else {
                // If not on active path and deeper than auto-collapse depth, collapse it
                if (item.collapsable && item.depth >= autoCollapseDepth) {
                    item.collapsed = true;
                }
            }
        });

        tree.restoreAnimationLength();
    }

    private injectStyles() {
        if (document.getElementById('toc-scrollspy-styles')) return;

        const style = document.createElement('style');
        style.id = 'toc-scrollspy-styles';
        style.textContent = `
            #outline .tree-item-self {
                position: relative;
                transition: color 0.1s ease, font-weight 0.1s ease;
                border-radius: 4px;
                display: grid !important;
                grid-template-columns: 24px 1fr;
                align-items: center;
                padding-left: 0 !important;
            }

            /* Alignment Optimization: Grid ensures text is always in the same column */
            #outline .collapse-icon {
                grid-column: 1;
                grid-row: 1;
                display: flex !important;
                align-items: center;
                justify-content: center;
                z-index: 2;
                width: 24px;
                height: 24px;
            }

            #outline .tree-item-inner {
                grid-column: 2;
                grid-row: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-right: 4px;
            }

            /* Placeholder for alignment if icon is missing */
            #outline .tree-item-self::before {
                content: "";
                grid-column: 1;
                grid-row: 1;
                width: 24px;
                height: 24px;
                display: block;
            }

            #outline .tree-item-self.is-active {
                color: var(--text-normal);
                font-weight: 600;
                background-color: var(--background-modifier-hover);
            }
        `;
        document.head.appendChild(style);
    }
}
