import { Shared } from "src/shared/shared";
import MiniSearch, { SearchResult } from "minisearch";

export enum SearchType {
	Title = 1,
	Aliases = 2,
	Headers = 4,
	Tags = 8,
	Path = 16,
	Content = 32,
}

interface SearchResultItem extends SearchResult {
	title: string;
	path: string;
	headers?: string[];
	tags?: string[];
	aliases?: string[];
	content?: string;
}

export class ModalSearch {
    private index: MiniSearch | null = null;
    private modal: HTMLElement | null = null;
    private overlay: HTMLElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private resultsContainer: HTMLElement | null = null;
    private toggleBtn: HTMLButtonElement | null = null;
    private selectedIndex: number = 0;
    private currentResults: SearchResultItem[] = [];
	private showDetailedView: boolean = false;
    private searchTimeout: any = null;

	constructor() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
	}

	public async init(): Promise<ModalSearch | undefined> {
        ModalSearch.injectStyles();

        const indexResp = await ObsidianSite.fetch(Shared.libFolderName + '/' + Shared.searchIndexFileName);
        if (!indexResp?.ok) return;

        const indexJSON = await indexResp.json();
        try {
            // @ts-ignore
            this.index = MiniSearch.loadJS(indexJSON, {
                fields: ['title', 'path', 'tags', 'headers', 'aliases', 'content']
			});
		} catch (e) {
            console.error("ModalSearch: Failed to load index", e);
			return;
		}

        this.createModal();
        this.setupKeyboardShortcuts();
        this.bindSearchButtons();
		return this;
	}

    private bindSearchButtons(): void {
        const searchButtons = document.querySelectorAll('.search-icon, #search-icon, #search-input-container .search-icon, .sidebar-toolbar-search');
        searchButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
				this.open();
			});
        });
    }

    private static injectStyles() {
        if (document.getElementById('modal-search-styles')) return;
        const style = document.createElement('style');
        style.id = 'modal-search-styles';
        style.textContent = `
			.search-modal-overlay {
				position: fixed; top: 0; left: 0; right: 0; bottom: 0;
				background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
				z-index: 10000; display: none; align-items: flex-start;
				justify-content: center; padding-top: 10vh; animation: modalSearchFadeIn 0.15s ease-out;
			}
			.search-modal-overlay.active { display: flex; }
			@keyframes modalSearchFadeIn { from { opacity: 0; } to { opacity: 1; } }
			.search-modal {
				width: 90%; max-width: 800px; background: var(--background-primary);
				border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
				display: flex; flex-direction: column; max-height: 75vh;
				opacity: 0; transform: scale(0.95) translateY(-20px); transition: all 0.15s ease-out;
				overflow: hidden; border: 1px solid var(--background-modifier-border);
			}
			.search-modal.active { opacity: 1; transform: scale(1) translateY(0); }
			.search-modal-header {
				display: flex; align-items: center; gap: 12px; padding: 14px 20px;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.search-modal-input {
				flex: 1; border: none; outline: none; background: transparent;
				font-size: 18px; color: var(--text-normal); font-family: inherit;
			}
			.search-modal-icon { color: var(--text-muted); display: flex; align-items: center; }
			.search-modal-actions { display: flex; gap: 4px; }
			.search-modal-btn {
				padding: 6px; border: none; background: transparent; border-radius: 6px;
				cursor: pointer; color: var(--text-muted); transition: all 0.15s ease;
				display: flex; align-items: center; justify-content: center;
			}
			.search-modal-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
			.search-modal-btn.active { background: var(--interactive-accent); color: white; }
			.search-modal-results { flex: 1; overflow-y: auto; padding: 8px 0; }
			.search-modal-results:empty { display: none; }
			.search-modal-result-item {
				display: flex; gap: 12px; padding: 10px 20px; cursor: pointer;
				margin: 2px 8px; border-radius: 8px; transition: background 0.1s;
				border: 2px solid transparent; opacity: 0.7;
			}
			.search-modal-result-item:hover { background: var(--background-modifier-hover); opacity: 0.9; }
			.search-modal-result-item.selected {
				background: var(--background-primary-alt); border-color: var(--interactive-accent);
				opacity: 1;
			}
			.search-result-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
			.search-result-path {
				font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;
				white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
			}
			.search-result-title { font-weight: 600; font-size: 15px; color: var(--text-normal); }
			.search-modal-result-item.selected .search-result-title { color: var(--interactive-accent); }
			.search-result-excerpt {
				font-size: 13px; color: var(--text-muted); line-height: 1.65;
				margin-top: 4px; word-break: break-word;
				padding: 6px 0;
				max-height: 12em;
				overflow: hidden;
			}
			.search-result-excerpt .search-excerpt-line {
				margin: 1px 0;
			}
			.search-result-excerpt strong {
				font-weight: 700; color: var(--text-normal);
			}
			.search-result-excerpt em {
				font-style: italic; color: var(--text-normal);
			}
			.search-result-excerpt del {
				opacity: 0.5;
			}
			.search-result-excerpt code.inline-code {
				background: var(--code-background, rgba(135,131,120,0.15));
				color: var(--code-normal, #e06c75);
				padding: 1px 5px; border-radius: 3px;
				font-size: 0.88em;
				font-family: var(--font-monospace, 'Consolas', 'Monaco', monospace);
			}
			.search-result-excerpt pre.search-excerpt-code {
				margin: 6px 0; padding: 10px 12px;
				background: var(--code-background, rgba(0,0,0,0.15));
				border-radius: 6px; font-size: 12px;
				line-height: 1.5; white-space: pre-wrap;
				color: var(--text-muted);
				font-family: var(--font-monospace, 'Consolas', 'Monaco', monospace);
				position: relative;
				overflow: hidden;
				max-height: 6em;
			}
			.search-result-excerpt pre.search-excerpt-code code {
				font-family: inherit; font-size: inherit;
			}
			.search-result-excerpt .code-lang-label {
				position: absolute; top: 4px; right: 8px;
				font-size: 10px; color: var(--text-faint);
				text-transform: lowercase; opacity: 0.7;
			}
			mark.search-excerpt-highlight {
				background: var(--text-highlight-bg, #ffd60a);
				color: var(--text-normal);
				padding: 1px 3px; border-radius: 2px;
			}
			.search-result-excerpt mark:not(.search-excerpt-highlight) {
				background: rgba(255,214,10,0.3); color: var(--text-normal); font-weight: 500;
			}
			.search-result-excerpt .search-excerpt-ellipsis {
				color: var(--text-faint); font-size: 12px; margin: 2px 0;
			}
			.search-result-excerpt .search-excerpt-link {
				color: var(--text-accent); text-decoration: underline;
			}
			.search-result-excerpt .search-excerpt-heading {
				font-weight: 700; color: var(--text-normal);
				margin: 4px 0 2px 0; font-size: 13.5px;
			}
			.search-result-excerpt .search-excerpt-heading .heading-marker {
				color: var(--text-faint); margin-right: 4px; font-weight: 400;
			}
			.search-result-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
			.search-tag {
				font-size: 11px; padding: 2px 8px; background: var(--background-secondary);
				border-radius: 10px; color: var(--text-accent);
			}
			.search-alias { font-size: 12px; color: var(--text-accent); display: flex; align-items: center; gap: 4px; }
			.search-alias::before { content: "alias"; font-size: 10px; opacity: 0.7; }
			.search-modal-hints {
				display: flex; justify-content: center; gap: 15px; padding: 10px;
				border-top: 1px solid var(--background-modifier-border); font-size: 11px; color: var(--text-faint);
			}
			.search-modal-hints kbd {
				background: var(--background-secondary); padding: 2px 5px; border-radius: 4px;
				border: 1px solid var(--background-modifier-border);
			}
			.breadcrumb-sep { opacity: 0.5; font-size: 10px; }
			
			/* Dark theme specific overrides if needed */
			.theme-dark .search-result-excerpt mark { color: #f7b756; }
			.theme-light .search-result-excerpt mark { color: #db74db; }
			.search-result-icon { color: var(--interactive-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding-top: 2px; }
			.search-tag.header-match { background: rgba(var(--interactive-accent-rgb), 0.1); border: 1px solid var(--interactive-accent); cursor: pointer; }
			.search-tag.header-match:hover { background: var(--interactive-accent); color: white; }
		`;
        document.head.appendChild(style);
    }

    private createModal(): void {
        this.overlay = document.createElement('div');
        this.overlay.className = 'search-modal-overlay';
        this.overlay.onclick = () => this.close();

        this.modal = document.createElement('div');
        this.modal.className = 'search-modal';
        this.modal.onclick = (e) => e.stopPropagation();

        const header = document.createElement('div');
        header.className = 'search-modal-header';
        header.innerHTML = `
			<div class="search-modal-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
			</div>
		`;

        this.searchInput = document.createElement('input');
        this.searchInput.className = 'search-modal-input';
        this.searchInput.placeholder = 'Search...';
        this.searchInput.oninput = this.handleInputChange;
        this.searchInput.onkeydown = this.handleKeyDown;

        const actions = document.createElement('div');
        actions.className = 'search-modal-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'search-modal-btn';
        toggleBtn.title = 'Toggle Detailed View';
        toggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
        this.toggleBtn = toggleBtn;
        toggleBtn.onclick = () => {
            this.toggleDetailedView();
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'search-modal-btn';
        closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        closeBtn.onclick = () => this.close();

        actions.append(toggleBtn, closeBtn);
        header.append(this.searchInput, actions);

        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'search-modal-results';

        const hints = document.createElement('div');
        hints.className = 'search-modal-hints';
        hints.innerHTML = `<span><kbd>↑↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span>`;

        this.modal.append(header, this.resultsContainer, hints);
        this.overlay.append(this.modal);
        document.body.append(this.overlay);
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });
    }

    private handleInputChange(): void {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            const query = this.searchInput?.value || "";
            this.performSearch(query);
        }, 100);
    }

    private performSearch(query: string): void {
        if (!this.index || query.length === 0) {
			this.currentResults = [];
            this.renderResults("");
			return;
		}

		const results = this.index.search(query, {
            prefix: true, fuzzy: 0.2,
            boost: { title: 2, aliases: 1.8, headers: 1.5, tags: 1.3, path: 1.1 }
        }) as SearchResultItem[];

        const shownInTree = ObsidianSite.metadata?.shownInTree || [];
        this.currentResults = results
            .filter(r => r.path && r.title && (shownInTree.length === 0 || shownInTree.includes(r.path)))
            .slice(0, 30);

		this.selectedIndex = 0;
		this.renderResults(query);
	}

    private renderResults(query: string): void {
        if (!this.resultsContainer) return;
        this.resultsContainer.innerHTML = '';

        if (this.currentResults.length === 0 && query.length > 0) {
            this.resultsContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-faint)">No results found.</div>`;
			return;
		}

        this.currentResults.forEach((result, i) => {
            const item = this.createResultItem(result, query, i);
            this.resultsContainer?.append(item);
        });
        this.updateSelection();
    }

    private createResultItem(result: SearchResultItem, query: string, index: number): HTMLElement {
        const div = document.createElement('div');
        div.className = 'search-modal-result-item';
        div.onclick = () => this.selectResult(result);
        div.onmouseenter = () => { this.selectedIndex = index; this.updateSelection(); };

        const icon = document.createElement('div');
        icon.className = 'search-result-icon';
        icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;

        const content = document.createElement('div');
        content.className = 'search-result-content';

        const path = result.path.replace(/\.html$/, '').split('/').filter(p => p && p !== 'index');
        const pathEl = document.createElement('div');
        pathEl.className = 'search-result-path';
        pathEl.innerHTML = path.map(p => `<span>${this.escape(p)}</span>`).join('<span class="breadcrumb-sep">›</span>');

        const title = document.createElement('div');
        title.className = 'search-result-title';
        title.innerHTML = this.highlight(result.title, query);

        if (this.showDetailedView) {
            // In detail mode, only show compact path, no separate title
            content.append(pathEl);
            if (result.content) {
                const excerpt = document.createElement('div');
                excerpt.className = 'search-result-excerpt';
                excerpt.innerHTML = this.getExcerpt(result.content, query);
                content.append(excerpt);
            }
        } else {
            content.append(pathEl, title);
        }

		if (this.showDetailedView) {

            const meta = document.createElement('div');
            meta.className = 'search-result-meta';

            if (result.aliases?.length) {
                result.aliases.slice(0, 2).forEach(a => {
                    const s = document.createElement('span');
                    s.className = 'search-alias';
                    s.innerHTML = this.highlight(a, query);
                    meta.append(s);
                });
            }

            if (result.headers?.length) {
                const matching = result.headers.filter(h => h.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
                matching.forEach(h => {
                    const s = document.createElement('a');
                    s.className = 'search-tag header-match';
                    s.innerHTML = '§ ' + this.highlight(h, query);
                    s.onclick = (e) => {
                        e.stopPropagation();
                        ObsidianSite.loadURL(result.path + '#' + encodeURIComponent(h));
                        this.close();
                    };
                    meta.append(s);
                });
            }

            if (result.tags?.length) {
                result.tags.slice(0, 3).forEach(t => {
                    const s = document.createElement('span');
                    s.className = 'search-tag';
                    s.innerHTML = '#' + this.highlight(t, query);
                    meta.append(s);
                });
            }
            if (meta.children.length) content.append(meta);
        }

        div.append(icon, content);
        return div;
    }

    private updateSelection(): void {
        const items = this.resultsContainer?.querySelectorAll('.search-modal-result-item');
        items?.forEach((el, i) => {
            if (i === this.selectedIndex) {
                el.classList.add('selected');
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                el.classList.remove('selected');
            }
        });
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.currentResults.length);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % Math.max(1, this.currentResults.length);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            const res = this.currentResults[this.selectedIndex];
            if (res) this.selectResult(res);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.toggleDetailedView();
        }
    }

    private toggleDetailedView(): void {
        this.showDetailedView = !this.showDetailedView;
        if (this.toggleBtn) {
            this.toggleBtn.classList.toggle('active', this.showDetailedView);
        }
        this.performSearch(this.searchInput?.value || "");
    }

    private selectResult(result: SearchResultItem): void {
        ObsidianSite.loadURL(result.path);
        this.close();
    }

    public open(): void {
        this.overlay?.classList.add('active');
        this.modal?.classList.add('active');
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.currentResults = [];
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = '';
        }
        this.searchInput?.focus();
    }

    public close(): void {
        this.overlay?.classList.remove('active');
        this.modal?.classList.remove('active');
    }

    public isOpen(): boolean { return this.overlay?.classList.contains('active') ?? false; }

    private highlight(text: string, query: string): string {
        if (!query) return this.escape(text);
        const words = query.trim().split(/\s+/).map(w => this.escapeRegex(w)).filter(w => w);
        if (!words.length) return this.escape(text);
        const regex = new RegExp(`(${words.join('|')})`, 'gi');
        return this.escape(text).replace(regex, '<mark class="search-excerpt-highlight">$1</mark>');
    }

    private getExcerpt(content: string, query: string): string {
        if (!content) return "";
        return this.getFormattedExcerpt(content, query);
    }

    /**
     * Generate a readable excerpt that preserves line structure from the search content.
     * Content now has \n from block-level elements (headings, paragraphs, list items).
     */
    private getFormattedExcerpt(text: string, query: string): string {
        if (!text) return "";

        // Clean up placeholder strings
        let cleaned = text.replace(/__[A-Z_]+_\d+__/g, "").trim();
        if (!cleaned) return "";

        // Split by newlines (preserved from block-level DOM elements)
        let lines = cleaned.split("\n").map(s => s.trim()).filter(s => s.length > 0);

        // Fallback: if no newlines, chunk by ~100 chars
        if (lines.length <= 1 && cleaned.length > 100) {
            lines = [];
            let remaining = cleaned;
            while (remaining.length > 0) {
                if (remaining.length <= 100) {
                    lines.push(remaining);
                    break;
                }
                let breakAt = remaining.lastIndexOf(" ", 100);
                if (breakAt < 50) breakAt = 100;
                lines.push(remaining.substring(0, breakAt));
                remaining = remaining.substring(breakAt).trimStart();
            }
        }

        if (lines.length === 0) return "";

        // Find the best line containing query words
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        let bestIdx = 0;
        if (queryWords.length > 0) {
            let bestScore = -1;
            for (let i = 0; i < lines.length; i++) {
                const lower = lines[i].toLowerCase();
                let score = 0;
                for (const w of queryWords) {
                    if (lower.includes(w)) score++;
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                }
            }
        }

        // Take up to 6 lines around the best match
        const startLine = Math.max(0, bestIdx - 1);
        const endLine = Math.min(lines.length, startLine + 6);
        const excerptLines = lines.slice(startLine, endLine);

        // Build HTML with each line as a div
        const parts = excerptLines.map(line => {
            const escaped = this.escape(line.length > 150 ? line.substring(0, 150) + "…" : line);
            return `<div class="search-excerpt-line">${escaped}</div>`;
        });

        let html = "";
        if (startLine > 0) html += '<div class="search-excerpt-ellipsis">…</div>';
        html += parts.join("");
        if (endLine < lines.length) html += '<div class="search-excerpt-ellipsis">…</div>';

        return this.highlightQueryInHtml(html, query);
    }

    /**
     * 在 HTML 中高亮查询词
     */
    private highlightQueryInHtml(html: string, query: string): string {
        if (!query) return html;

        // 分割查询词，支持多词搜索
        const queryWords = query.trim().split(/\s+/).filter((w) => w.length > 0);
        if (queryWords.length === 0) return html;

        // 创建一个临时标记来保护已有的 HTML 标签和特殊内容
        const placeholders: { [key: string]: string } = {};
        let placeholderIndex = 0;

        // 保护代码块（pre 和 code 标签内的内容不应该被高亮）
        html = html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
            const key = `__CODE_BLOCK_PLACEHOLDER_${placeholderIndex}__`;
            placeholders[key] = match;
            placeholderIndex++;
            return key;
        });

        // 保护行内代码
        html = html.replace(/<code[^>]*>([^<]*)<\/code>/gi, (match) => {
            const key = `__INLINE_CODE_PLACEHOLDER_${placeholderIndex}__`;
            placeholders[key] = match;
            placeholderIndex++;
            return key;
        });

        // 保护已有的 mark 标签（避免重复高亮）
        html = html.replace(/<mark[^>]*>([^<]*)<\/mark>/gi, (match) => {
            const key = `__MARK_PLACEHOLDER_${placeholderIndex}__`;
            placeholders[key] = match;
            placeholderIndex++;
            return key;
        });

        // 保护所有其他 HTML 标签
        html = html.replace(/<[^>]+>/g, (match) => {
            const key = `__HTML_PLACEHOLDER_${placeholderIndex}__`;
            placeholders[key] = match;
            placeholderIndex++;
            return key;
        });

        // 对每个查询词进行高亮
        for (const word of queryWords) {
            const escapedWord = this.escapeRegex(word);
            // 使用正则匹配，支持 CJK 字符
            const regex = new RegExp(`(${escapedWord})`, "gi");
            html = html.replace(regex, '<mark class="search-excerpt-highlight">$1</mark>');
        }

        // 恢复所有占位符（按相反顺序，先恢复后添加的）
        const sortedKeys = Object.keys(placeholders).sort((a, b) => {
            const aIndex = parseInt(a.match(/\d+/)?.[0] || "0");
            const bIndex = parseInt(b.match(/\d+/)?.[0] || "0");
            return bIndex - aIndex; // 反向排序，先恢复后添加的
        });

        sortedKeys.forEach((key) => {
            html = html.replace(key, placeholders[key]);
        });

        // 清理可能嵌套的 mark 标签（避免重复高亮）
        html = html.replace(/<mark[^>]*>(<mark[^>]*>([^<]*)<\/mark>)<\/mark>/gi, "$1");

        return html;
    }

    private escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    private escape(s: string): string {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
}
