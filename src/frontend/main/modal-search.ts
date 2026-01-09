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
        const searchButtons = document.querySelectorAll('.search-icon, #search-icon, #search-input-container .search-icon');
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
			.search-modal-results { flex: 1; overflow-y: auto; padding: 8px 0; min-height: 150px; }
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
				font-size: 13px; color: var(--text-muted, #666); line-height: 1.6;
				margin-top: 4px; word-break: break-word;
			}
			/* 摘要内的富文本样式还原 (加粗与斜体) */
			.search-result-excerpt strong {
				font-weight: 600; color: var(--text-normal, #333);
			}
			.search-result-excerpt em {
				font-style: italic; color: var(--text-normal, #555);
			}
			/* 摘要内的代码展示 (行内与块级) */
			.search-result-excerpt code.inline-code {
				background: var(--code-background, #f5f5f5);
				color: var(--code-normal, #e83e8c);
				padding: 2px 6px; border-radius: 3px;
				font-size: 0.9em;
				font-family: var(--font-monospace, 'Consolas', 'Monaco', monospace);
			}
			/* 摘要中的代码块预览 */
			.search-result-excerpt pre.search-excerpt-code {
				margin: 0.5rem 0; padding: 0.75rem;
				background: var(--code-block-background, #f3f4f6);
				border-radius: 6px; font-size: 0.9em;
				line-height: 1.5; white-space: pre-wrap;
				color: var(--code-block-text, #1f2933);
			}
			/* 搜索命中词的高亮 (通用样式，适用于所有位置) */
			mark.search-excerpt-highlight {
				background: var(--text-highlight-bg, #ffd60a);
				color: var(--text-normal, #333);
				padding: 2px 4px; border-radius: 2px;
			}
			/* 摘要内的 mark 标签（如果没有 search-excerpt-highlight 类） */
			.search-result-excerpt mark:not(.search-excerpt-highlight) {
				background: transparent; color: var(--text-accent); font-weight: bold;
			}
			/* 摘要中的省略符号 (三个点) 样式 */
			.search-result-excerpt .search-excerpt-ellipsis {
				color: var(--text-faint, #999); font-style: italic; margin: 0 2px;
			}
			/* 摘要中的链接样式 */
			.search-result-excerpt a.search-excerpt-link {
				color: var(--text-accent, #4a9eff);
				text-decoration: underline;
			}
			/* 摘要中的标题样式 */
			.search-result-excerpt .search-excerpt-heading {
				display: block; font-weight: 600;
				margin: 0.25rem 0; color: var(--text-normal, #333);
			}
			/* 摘要中的列表项样式 */
			.search-result-excerpt .search-excerpt-list-item {
				display: block; margin: 0.2rem 0;
			}
			.search-result-excerpt .search-excerpt-list-item--ordered {
				display: flex; gap: 0.5rem;
			}
			/* 摘要中的图片标记样式 */
			.search-result-excerpt .search-excerpt-image {
				color: var(--text-muted, #666);
				font-style: italic;
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

        content.append(pathEl, title);

			if (this.showDetailedView) {
            if (result.content) {
                const excerpt = document.createElement('div');
                excerpt.className = 'search-result-excerpt';
                excerpt.innerHTML = this.getExcerpt(result.content, query);
                content.append(excerpt);
            }

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
        this.searchInput?.focus();
        this.searchInput?.select();
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
        // 使用 HTML 格式的摘要，支持 Markdown 语法转换和富文本展示
        return this.getHtmlExcerpt(content, query, 200);
    }

    /**
     * 生成 HTML 格式的摘要，支持 Markdown 语法转换和富文本展示
     */
    private getHtmlExcerpt(text: string, query: string, maxLength: number = 200): string {
        if (!text) return "";

        // 获取纯文本版本用于定位
        const cleanText = this.cleanTextContent(text);
        const excerptInfo = this.findBestExcerptPosition(cleanText, query, maxLength);

        // 转换 Markdown 格式为 HTML
        let html = text;
        const codeBlocks: string[] = [];

        // 先保护已有的 HTML 标签（如果有）
        const htmlTagPattern = /<[^>]+>/g;
        const htmlTags: string[] = [];
        html = html.replace(htmlTagPattern, (match) => {
            htmlTags.push(match);
            return `__HTML_TAG_${htmlTags.length - 1}__`;
        });

        // 提取并占位代码块，防止后续格式化破坏结构
        html = html.replace(
            /```(?:([\w+-]+)\s*)?([\s\S]*?)```/g,
            (_match: string, language: string | undefined, codeContent: string) => {
                const languageClass = language
                    ? ` search-excerpt-code--${language.trim().toLowerCase()}`
                    : "";
                const normalizedCode = `${codeContent}`
                    .replace(/^\s*[\r\n]+/, "")
                    .replace(/[\r\n]+\s*$/, "")
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n");
                const escapedCode = this.escape(normalizedCode);
                const codeHtml = `<pre class="search-excerpt-code${languageClass}"><code>${escapedCode}</code></pre>`;
                codeBlocks.push(codeHtml);
                return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
            },
        );

        // 转换基本的 Markdown 语法为 HTML
        // 加粗 **text** 或 __text__
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

        // 斜体 *text* 或 _text_ （避免与加粗冲突）
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
        html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

        // 行内代码 `code`
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // 链接 [text](url) - 保留为链接样式
        html = html.replace(
            /\[([^\]]+)\]\(([^\)]+)\)/g,
            '<a href="$2" class="search-excerpt-link">$1</a>',
        );

        // 图片 ![alt](url) - 显示为图片标记
        html = html.replace(
            /!\[([^\]]*)\]\([^\)]+\)/g,
            '<span class="search-excerpt-image">🖼️ $1</span>',
        );

        // 标题 # Header
        html = html.replace(
            /^#{1,6}\s+(.+)$/gm,
            '<strong class="search-excerpt-heading">$1</strong>',
        );

        // 删除线 ~~text~~
        html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

        // 高亮 ==text==
        html = html.replace(
            /==([^=]+)==/g,
            '<mark class="search-excerpt-highlight">$1</mark>',
        );

        // 列表项 - * item 或 - item
        html = html.replace(
            /^\s*[-*+]\s+(.+)$/gm,
            '<span class="search-excerpt-list-item">• $1</span>',
        );

        // 有序列表 1. 项目 或 1.1. 项目
        html = html.replace(
            /^\s*(\d+(?:\.\d+)*)(?:[\.)])\s+(.+)$/gm,
            (_match, indexToken: string, listContent: string) => {
                const normalizedIndex = `${indexToken}`.replace(/\.$/, "");
                const normalizedContent = listContent.trim();
                return `<span class="search-excerpt-list-item search-excerpt-list-item--ordered"><span class="search-excerpt-list-index">${normalizedIndex}.</span><span class="search-excerpt-list-content">${normalizedContent}</span></span>`;
            },
        );

        // 恢复 HTML 标签
        htmlTags.forEach((tag, index) => {
            html = html.replace(`__HTML_TAG_${index}__`, tag);
        });

        // 将换行转换为<br />以保留原始段落结构
        html = html.replace(/\r\n/g, "\n");
        html = html.replace(/\n/g, "<br />");
        html = html.replace(
            /<\/span><br \/><span class="search-excerpt-list-item/g,
            '</span><span class="search-excerpt-list-item',
        );

        // 清理多余的空白但保留换行
        html = html.replace(/[ \t]+/g, " ").trim();

        // 还原代码块并保持其原始换行
        codeBlocks.forEach((codeHtml, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml);
        });

        if (excerptInfo.start === -1 || excerptInfo.start === 0) {
            // 没有找到匹配或从开头开始，使用 HTML 版本截取
            const excerptHtml = this.truncateHtml(html, maxLength);
            return this.highlightQueryInHtml(excerptHtml, query);
        }

        // 尝试在 HTML 中找到对应位置
        const prefix =
            excerptInfo.start > 0
                ? '<span class="search-excerpt-ellipsis">...</span>'
                : "";
        const suffix =
            excerptInfo.end < cleanText.length
                ? '<span class="search-excerpt-ellipsis">...</span>'
                : "";

        // 简化处理：基于字符位置估算 HTML 位置
        const ratio = html.length / cleanText.length;
        const htmlStart = Math.floor(excerptInfo.start * ratio);
        const htmlEnd = Math.floor(excerptInfo.end * ratio);

        let excerptHtml = html.substring(htmlStart, htmlEnd);

        // 清理可能被截断的 HTML 标签
        excerptHtml = this.cleanBrokenHtmlTags(excerptHtml);

        // 在 HTML 中高亮查询词
        return prefix + this.highlightQueryInHtml(excerptHtml, query) + suffix;
    }

    /**
     * 清理文本内容，移除 HTML 标签和 Markdown 语法
     */
    private cleanTextContent(text: string): string {
        if (!text) return "";

        let cleaned = text;

        // Remove HTML tags
        cleaned = cleaned.replace(/<[^>]*>/g, " ");

        // Decode common HTML entities
        const htmlEntities: { [key: string]: string } = {
            "&nbsp;": " ",
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": '"',
            "&#39;": "'",
            "&apos;": "'",
            "&mdash;": "—",
            "&ndash;": "–",
            "&hellip;": "...",
        };

        for (const [entity, char] of Object.entries(htmlEntities)) {
            cleaned = cleaned.replace(new RegExp(entity, "g"), char);
        }

        // Clean Markdown syntax
        cleaned = cleaned.replace(/```([\s\S]*?)```/g, (_match, codeBlock: string) => {
            const normalizedCode = `${codeBlock}`
                .replace(/^\s*[\r\n]+/, "")
                .replace(/[\r\n]+\s*$/, "");
            return ` ${normalizedCode.replace(/\s+/g, " ").trim()} `;
        }); // Code blocks
        cleaned = cleaned.replace(/`([^`]+)`/g, "$1"); // Inline code
        cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1"); // Images
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"); // Links
        cleaned = cleaned.replace(/^#{1,6}\s+/gm, ""); // Headers
        cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, ""); // Lists
        cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, ""); // Numbered lists
        cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1"); // Bold
        cleaned = cleaned.replace(/__([^_]+)__/g, "$1"); // Bold underscore
        cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1"); // Italic
        cleaned = cleaned.replace(/_([^_]+)_/g, "$1"); // Italic underscore
        cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1"); // Strikethrough
        cleaned = cleaned.replace(/==([^=]+)==/g, "$1"); // Highlight

        // Normalize whitespace
        cleaned = cleaned.replace(/\s+/g, " ").trim();

        return cleaned;
    }

    /**
     * 查找最佳摘要位置，尽量包含查询词
     */
    private findBestExcerptPosition(
        text: string,
        query: string,
        maxLength: number,
    ): { start: number; end: number } {
        if (!query || text.length <= maxLength) {
            return { start: 0, end: Math.min(text.length, maxLength) };
        }

        const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
        const lowerText = text.toLowerCase();

        if (queryWords.length === 0) {
            return { start: 0, end: Math.min(text.length, maxLength) };
        }

        let bestMatchStart = -1;
        let bestMatchScore = -1;

        // 查找最佳匹配位置
        for (const word of queryWords) {
            const matchIndex = lowerText.indexOf(word);
            if (matchIndex !== -1) {
                const regionStart = Math.max(0, matchIndex - Math.floor(maxLength / 2));
                const regionEnd = Math.min(
                    lowerText.length,
                    matchIndex + Math.floor(maxLength / 2),
                );
                const regionText = lowerText.substring(regionStart, regionEnd);

                let score = 0;
                for (const qw of queryWords) {
                    if (regionText.indexOf(qw) !== -1) {
                        score += 1;
                    }
                }

                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatchStart = matchIndex;
                }
            }
        }

        if (bestMatchStart === -1) {
            return { start: 0, end: Math.min(text.length, maxLength) };
        }

        // 计算摘要范围
        const halfLength = Math.floor(maxLength / 2);
        let start = Math.max(0, bestMatchStart - halfLength);
        let end = Math.min(text.length, start + maxLength);

        if (end === text.length) {
            start = Math.max(0, end - maxLength);
        }

        // 尝试在单词边界处开始和结束
        if (start > 0) {
            const spaceIndex = text.indexOf(" ", start);
            if (spaceIndex !== -1 && spaceIndex < start + 30) {
                start = spaceIndex + 1;
            }
        }

        if (end < text.length) {
            const spaceIndex = text.lastIndexOf(" ", end);
            if (spaceIndex !== -1 && spaceIndex > end - 30) {
                end = spaceIndex;
            }
        }

        return { start, end };
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

    /**
     * 截断 HTML 但保留标签完整性
     */
    private truncateHtml(html: string, maxLength: number): string {
        if (html.length <= maxLength) return html;

        let truncated = html.substring(0, maxLength);
        const lastTagStart = truncated.lastIndexOf("<");
        const lastTagEnd = truncated.lastIndexOf(">");

        // 如果有未闭合的标签，截取到最后一个完整标签
        if (lastTagStart > lastTagEnd) {
            truncated = truncated.substring(0, lastTagStart);
        }

        return truncated + '<span class="search-excerpt-ellipsis">...</span>';
    }

    /**
     * 清理被截断的 HTML 标签
     */
    private cleanBrokenHtmlTags(html: string): string {
        // 移除开头的不完整标签
        html = html.replace(/^[^<]*>/, "");
        // 移除结尾的不完整标签
        html = html.replace(/<[^>]*$/, "");

        // 检查并闭合未闭合的标签
        const openTags: string[] = [];
        const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
        let match;

        while ((match = tagRegex.exec(html)) !== null) {
            const tag = match[1].toLowerCase();
            if (match[0].startsWith("</")) {
                // 闭合标签
                const lastOpen = openTags.lastIndexOf(tag);
                if (lastOpen !== -1) {
                    openTags.splice(lastOpen, 1);
                }
            } else if (
                !match[0].endsWith("/>") &&
                !["br", "img", "hr"].includes(tag)
            ) {
                // 开放标签（非自闭合）
                openTags.push(tag);
            }
        }

        // 为未闭合的标签添加闭合标签
        for (let i = openTags.length - 1; i >= 0; i--) {
            html += `</${openTags[i]}>`;
        }

        return html;
    }

    private escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    private escape(s: string): string {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
}
