import { Tree, TreeItem } from "./trees";

export class TocScrollSpy {
    private rafPending = false;
    private pendingOutlineScrollFrame: number | null = null;
    private headings: { id: string, element: HTMLElement }[] = [];
    private TOP_OFFSET_PX = 50;
    private scrollContainer: HTMLElement | null = null;

    private currentPathname: string = "";

    constructor() {
        this.refreshScrollContainer();
        this.injectStyles();
    }

    private onScroll = () => this.requestSync();
    private onResize = () => this.requestSync();

    private refreshScrollContainer() {
        const site = (window as any).ObsidianSite;

        // Attempt to find the scrollable container. 
        // In Obsidian, it's often .markdown-preview-view. 
        // If not found, fall back to centerContentEl.
        const scrollEl = document.querySelector('.obsidian-document.markdown-preview-view') as HTMLElement;
        const newContainer = scrollEl || site?.centerContentEl;

        if (newContainer && newContainer !== this.scrollContainer) {
            if (this.scrollContainer) {
                this.scrollContainer.removeEventListener('scroll', this.onScroll);
            }
            this.scrollContainer = newContainer;
            this.scrollContainer.addEventListener('scroll', this.onScroll, { passive: true });

            window.removeEventListener('resize', this.onResize);
            window.addEventListener('resize', this.onResize);

            console.log("TOC ScrollSpy: Scroll container updated", this.scrollContainer);
        }
    }

    public updateHeadings() {
        const site = (window as any).ObsidianSite;
        const doc = site.document;

        // Always try to refresh the container when headings are updated (page switch)
        this.refreshScrollContainer();

        if (!doc) {
            this.headings = [];
            return;
        }

        this.currentPathname = doc.pathname || "";

        // Wait a bit for the DOM to be fully rendered
        setTimeout(() => {
            // Move collapse icon inside the inner container for better "tight" integration
            document.querySelectorAll('#outline .tree-item-self').forEach(self => {
                const icon = self.querySelector(':scope > .collapse-icon');
                const inner = self.querySelector('.tree-item-inner');
                if (icon && inner) {
                    inner.prepend(icon);
                }
            });

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

        const site = (window as any).ObsidianSite;
        const outlineTree = site.outlineTree as Tree;
        if (!outlineTree) return;

        let activeId: string | null = null;
        const containerTop = this.scrollContainer.getBoundingClientRect().top;
        const scrollOffset = this.scrollContainer.scrollTop;

        // If at the very top, select the first heading and scroll the TOC to top
        if (scrollOffset < 50) {
            activeId = this.headings[0].id;
            if (outlineTree.rootEl) {
                this.scheduleOutlineScroll(outlineTree.rootEl, 0);
            }
        } else {
            for (const h of this.headings) {
                const rect = h.element.getBoundingClientRect();
                if (rect.top - containerTop <= this.TOP_OFFSET_PX) {
                    activeId = h.id;
                } else {
                    break;
                }
            }
        }

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

            if (item) {
                const isNew = item !== outlineTree.activeItem;
                if (isNew) {
                    item.setActive();
                    this.syncExpansion(outlineTree, item);
                }

                const el = item.itemEl;
                const outlineContainer = outlineTree.rootEl;
                if (outlineContainer && el) {
                    const containerRect = outlineContainer.getBoundingClientRect();
                    const itemRect = el.getBoundingClientRect();
                    const itemTop = (itemRect.top - containerRect.top) + outlineContainer.scrollTop;
                    const containerHeight = containerRect.height;
                    const targetTop = itemTop - containerHeight * 0.3;
                    this.scheduleOutlineScroll(outlineContainer, Math.max(0, targetTop));
                }
            }
        } else {
            if (outlineTree.activeItem) {
                outlineTree.activeItem.selfEl.classList.remove("is-active");
                outlineTree.activeItem = undefined;
                this.syncExpansion(outlineTree, undefined);
            }
        }
    }

    private scheduleOutlineScroll(outlineContainer: HTMLElement, targetTop: number) {
        if (this.pendingOutlineScrollFrame !== null) {
            cancelAnimationFrame(this.pendingOutlineScrollFrame);
        }

        const distance = Math.abs(targetTop - outlineContainer.scrollTop);
        const behavior: ScrollBehavior = distance > 50 ? 'smooth' : 'auto';

        this.pendingOutlineScrollFrame = requestAnimationFrame(() => {
            outlineContainer.scrollTo({
                top: targetTop,
                behavior
            });
            this.pendingOutlineScrollFrame = null;
        });
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
                display: flex !important;
                align-items: center;
                padding-left: 8px !important;
            }

            #outline .tree-item-inner {
                display: flex !important;
                align-items: flex-start; /* Align icon to the top of the first line */
                gap: 4px; 
                white-space: normal; /* Allow wrapping */
                word-break: break-word;
                padding-right: 4px;
                flex: 1;
                line-height: 1.4;
                padding-top: 2px;
                padding-bottom: 2px;
            }

            #outline .collapse-icon {
                display: flex !important;
                align-items: center;
                justify-content: center;
                z-index: 2;
                width: 20px !important;
                height: 24px;
                flex-shrink: 0;
                margin-top: -2px; /* Pull icon up slightly to align with the first line better */
            }

            #outline .tree-item-self.is-active {
                color: var(--text-normal);
                font-weight: 600;
                background-color: var(--background-modifier-hover);
            }

            /* Hide collapse icon for top-level TOC items (depth 0) */
            #outline .tree-item[data-depth="0"] > .tree-item-self .collapse-icon,
            #outline .tree-item[data-depth="1"] > .tree-item-self .collapse-icon {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
}
