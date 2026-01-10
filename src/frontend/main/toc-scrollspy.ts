import { Tree, TreeItem } from "./trees";

export class TocScrollSpy {
    private rafPending = false;
    private pendingOutlineScrollFrame: number | null = null;
    private headings: { id: string, element: HTMLElement }[] = [];
    private TOP_OFFSET_PX = 50;
    private scrollContainer: HTMLElement | null = null;
    private indicatorEl: HTMLElement | null = null;

    private currentPathname: string = "";

    constructor() {
        this.refreshScrollContainer();
        this.injectStyles();
        this.createIndicator();
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

            this.createIndicator();
            this.requestSync();
        }, 500);
    }

    private createIndicator() {
        const outline = document.querySelector('#outline');
        if (!outline) return;

        // Remove existing indicator if any
        outline.querySelector('.outline-indicator')?.remove();

        this.indicatorEl = document.createElement('div');
        this.indicatorEl.className = 'outline-indicator';
        outline.appendChild(this.indicatorEl);
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
        if (!outlineTree || !outlineTree.rootEl) return;

        const outlineContainer = outlineTree.rootEl;
        let activeId: string | null = null;
        const containerTop = this.scrollContainer.getBoundingClientRect().top;
        const scrollOffset = this.scrollContainer.scrollTop;

        // 1. Find the active heading
        if (scrollOffset < 50) {
            activeId = this.headings[0].id;
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

        if (!activeId) {
            if (this.indicatorEl) this.indicatorEl.style.display = 'none';
            if (outlineTree.activeItem) {
                outlineTree.activeItem.selfEl.classList.remove("is-active");
                outlineTree.activeItem = undefined;
                this.syncExpansion(outlineTree, undefined);
            }
            return;
        }

        // 2. Find the corresponding TOC item in the tree
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

        if (!item) return;

        // 3. Update active state and expansion
        const isNew = item !== outlineTree.activeItem;
        if (isNew) {
            item.setActive();
        }

        // Always sync expansion to ensure visibility, especially during initial load or manual interactions.
        // This O(N) operation is inexpensive for typical TOC sizes and prevents state desync.
        this.syncExpansion(outlineTree, item);

        // 4. Update the highlight indicator position
        const el = item.itemEl;
        if (this.indicatorEl && el) {
            const selfEl = item.selfEl;
            const containerRect = outlineContainer.getBoundingClientRect();
            const selfRect = selfEl.getBoundingClientRect();

            this.indicatorEl.style.display = 'block';
            this.indicatorEl.style.top = `${(selfRect.top - containerRect.top) + outlineContainer.scrollTop}px`;
            this.indicatorEl.style.height = `${selfRect.height}px`;
        }

        // 5. Optimized TOC Scroll Management
        if (el) {
            const containerRect = outlineContainer.getBoundingClientRect();
            const itemRect = el.getBoundingClientRect();

            // Calculate where we WANT the TOC to be (item at 30% of container height)
            const itemTopInContainer = (itemRect.top - containerRect.top) + outlineContainer.scrollTop;
            const targetScrollTop = itemTopInContainer - containerRect.height * 0.3;
            const boundedTarget = Math.max(0, targetScrollTop);

            // "Comfortable Zone" check: Only scroll if the item is near the top or bottom edges
            // or if it's a newly selected item. This prevents jitter during small scrolls.
            const margin = containerRect.height * 0.2; // 20% margin from top and bottom
            const isOutside = itemRect.top < containerRect.top + margin || itemRect.bottom > containerRect.bottom - margin;

            if (isNew || isOutside) {
                const currentScrollTop = outlineContainer.scrollTop;
                if (Math.abs(currentScrollTop - boundedTarget) > 10) {
                    this.scheduleOutlineScroll(outlineContainer, boundedTarget, isNew);
                }
            }
        }
    }

    private scheduleOutlineScroll(outlineContainer: HTMLElement, targetTop: number, isInitial: boolean) {
        if (this.pendingOutlineScrollFrame !== null) {
            cancelAnimationFrame(this.pendingOutlineScrollFrame);
        }

        this.pendingOutlineScrollFrame = requestAnimationFrame(() => {
            const currentTop = outlineContainer.scrollTop;
            const distance = Math.abs(targetTop - currentTop);

            // Use smooth behavior for normal tracking, auto for large jumps or initial load
            const behavior: ScrollBehavior = (isInitial && distance > 500) ? 'auto' : 'smooth';

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
            #outline {
                position: relative;
            }

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
                align-items: flex-start;
                gap: 4px; 
                white-space: normal;
                word-break: break-word;
                padding-right: 4px;
                flex: 1;
                line-height: 1.4;
                padding-top: 2px;
                padding-bottom: 2px;
                font-size: 13px; /* Reduced overall size */
                transition: font-size 0.15s ease-out;
            }

            #outline .collapse-icon {
                display: flex !important;
                align-items: center;
                justify-content: center;
                z-index: 2;
                width: 20px !important;
                height: 24px;
                flex-shrink: 0;
                margin-top: -2px;
            }

            #outline .tree-item-self.is-active {
                color: var(--text-normal);
                background-color: transparent !important; /* No background highlight */
            }

            #outline .tree-item-self.is-active .tree-item-inner {
                font-size: 14.5px; /* Increase font size when active */
                font-weight: 600;
            }

            .outline-indicator {
                position: absolute;
                left: 2px; /* Position to the left of level 1 hierarchy */
                width: 3px;
                background-color: var(--interactive-accent);
                transition: top 0.2s cubic-bezier(0.4, 0, 0.2, 1), height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
                pointer-events: none;
                border-radius: 4px;
                display: none;
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
