export class FootnoteHandler {
    private static instance: FootnoteHandler;
    private tooltip: HTMLElement | null = null;
    private activeTimeout: number | null = null;

    private constructor() {
        this.createTooltip();
    }

    public static getInstance(): FootnoteHandler {
        if (!FootnoteHandler.instance) {
            FootnoteHandler.instance = new FootnoteHandler();
        }
        return FootnoteHandler.instance;
    }

    public initializeFootnotes(container: HTMLElement): void {
        const refs = container.querySelectorAll('.footnote-ref');
        refs.forEach(ref => {
            const anchor = ref.querySelector('a');
            if (!anchor) return;

            // Smooth scroll on click
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent global link handler
                const targetId = anchor.getAttribute('href')?.substring(1);
                if (targetId) {
                    const target = document.getElementById(targetId);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        target.classList.add('footnote-highlight');
                        setTimeout(() => target.classList.remove('footnote-highlight'), 2000);
                    }
                }
            });

            // Tooltip on hover
            ref.addEventListener('mouseenter', () => this.showTooltip(ref as HTMLElement, anchor));
            ref.addEventListener('mouseleave', () => this.hideTooltip());
        });

        // Handle back-references (the arrows at the bottom)
        const backrefs = container.querySelectorAll('.footnote-backref');
        backrefs.forEach(backref => {
            backref.addEventListener('click', (e) => {
                const href = (backref as HTMLAnchorElement).getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    e.stopImmediatePropagation(); // Prevent global link handler
                    const targetId = href.substring(1);
                    const target = document.getElementById(targetId);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        // Optionally highlight the reference point
                        target.classList.add('footnote-highlight');
                        setTimeout(() => target.classList.remove('footnote-highlight'), 2000);
                    }
                }
            });
        });
    }

    private createTooltip(): void {
        if (this.tooltip) return;
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'footnote-tooltip';
        this.tooltip.className = 'markdown-rendered obsidian-document';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);

        this.tooltip.addEventListener('mouseenter', () => {
            if (this.activeTimeout) {
                clearTimeout(this.activeTimeout);
                this.activeTimeout = null;
            }
        });
        this.tooltip.addEventListener('mouseleave', () => this.hideTooltip());
    }

    private showTooltip(ref: HTMLElement, anchor: HTMLAnchorElement): void {
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = null;
        }

        const targetId = anchor.getAttribute('href')?.substring(1);
        if (!targetId) return;

        const target = document.getElementById(targetId);
        if (!target || !this.tooltip) return;

        const content = this.extractFootnoteContent(target);
        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';

        this.positionTooltip(ref);
    }

    private hideTooltip(): void {
        this.activeTimeout = window.setTimeout(() => {
            if (this.tooltip) {
                this.tooltip.style.display = 'none';
            }
        }, 300);
    }

    private positionTooltip(ref: HTMLElement): void {
        if (!this.tooltip) return;
        const rect = ref.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 5;

        // Boundary checks
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 20;
        }
        if (left < 10) left = 10;

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    private extractFootnoteContent(element: HTMLElement): string {
        const clone = element.cloneNode(true) as HTMLElement;
        const backref = clone.querySelector('.footnote-backref');
        if (backref) backref.remove();

        // Remove the [1] prefix if it exists in the first child
        const link = clone.querySelector('a.footnote-link');
        if (link) link.remove();

        return clone.innerHTML;
    }
}
