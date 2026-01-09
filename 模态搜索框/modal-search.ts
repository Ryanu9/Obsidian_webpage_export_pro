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

const allSearch = SearchType.Title | SearchType.Aliases | SearchType.Headers | SearchType.Tags | SearchType.Path | SearchType.Content;

interface SearchResultItem extends SearchResult {
	title: string;
	path: string;
	headers?: string[];
	tags?: string[];
	aliases?: string[];
	content?: string;
}

export class ModalSearch {
	private index: MiniSearch;
	private modal: HTMLElement | null = null;
	private overlay: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private resultsContainer: HTMLElement | null = null;
	private selectedIndex: number = 0;
	private currentResults: SearchResultItem[] = [];
	private showDetailedView: boolean = false;

	constructor() {
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleInputChange = this.handleInputChange.bind(this);
	}

	public async init(): Promise<ModalSearch | undefined> {
		// Load search index
		const indexResp = await ObsidianSite.fetch(Shared.libFolderName + '/search-index.json');
		if (!indexResp?.ok) {
			console.error("Failed to fetch search index");
			return;
		}
		const indexJSON = await indexResp.json();
		try {
			// @ts-ignore
			this.index = MiniSearch.loadJS(indexJSON, { 
				fields: ['title', 'path', 'tags', 'headers', 'aliases', 'content'] 
			});
		} catch (e) {
			console.error("Failed to load search index: ", e);
			return;
		}

		// Create modal elements
		this.createModal();
		
		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts();

		return this;
	}

	private createModal(): void {
		// Create overlay
		this.overlay = document.createElement('div');
		this.overlay.className = 'search-modal-overlay';
		this.overlay.addEventListener('click', () => this.close());

		// Create modal container
		this.modal = document.createElement('div');
		this.modal.className = 'search-modal';
		this.modal.addEventListener('click', (e) => e.stopPropagation());

		// Create search header
		const searchHeader = document.createElement('div');
		searchHeader.className = 'search-modal-header';

		// Search icon
		const searchIcon = document.createElement('div');
		searchIcon.className = 'search-modal-icon';
		searchIcon.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"></circle>
				<path d="m21 21-4.35-4.35"></path>
			</svg>
		`;

		// Search input
		this.searchInput = document.createElement('input');
		this.searchInput.type = 'text';
		this.searchInput.placeholder = 'Search... ';
		this.searchInput.className = 'search-modal-input';
		this.searchInput.addEventListener('input', this.handleInputChange);
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
				e.preventDefault();
				this.handleKeyDown(e);
			}
		});

		// Action buttons
		const actions = document.createElement('div');
		actions.className = 'search-modal-actions';

		// Toggle detailed view button
		const toggleViewButton = document.createElement('button');
		toggleViewButton.className = 'search-modal-toggle-view-btn';
		toggleViewButton.title = 'Toggle detailed view';
		toggleViewButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="8" y1="6" x2="21" y2="6"></line>
				<line x1="8" y1="12" x2="21" y2="12"></line>
				<line x1="8" y1="18" x2="21" y2="18"></line>
				<line x1="3" y1="6" x2="3.01" y2="6"></line>
				<line x1="3" y1="12" x2="3.01" y2="12"></line>
				<line x1="3" y1="18" x2="3.01" y2="18"></line>
			</svg>
		`;
		toggleViewButton.addEventListener('click', () => {
			this.showDetailedView = !this.showDetailedView;
			toggleViewButton.classList.toggle('active', this.showDetailedView);
			const currentQuery = this.searchInput?.value || '';
			this.renderResults(currentQuery);
		});

		const clearButton = document.createElement('button');
		clearButton.className = 'search-modal-clear-btn';
		clearButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		`;
		clearButton.addEventListener('click', () => {
			if (this.searchInput) {
				this.searchInput.value = '';
				this.handleInputChange(new Event('input'));
				this.searchInput.focus();
			}
		});

		const closeButton = document.createElement('button');
		closeButton.className = 'search-modal-close-btn';
		closeButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		`;
		closeButton.addEventListener('click', () => this.close());

		actions.appendChild(toggleViewButton);
		actions.appendChild(clearButton);
		actions.appendChild(closeButton);

		searchHeader.appendChild(searchIcon);
		searchHeader.appendChild(this.searchInput);
		searchHeader.appendChild(actions);

		// Create results container
		this.resultsContainer = document.createElement('div');
		this.resultsContainer.className = 'search-modal-results';

		// Create keyboard hints
		const hints = document.createElement('div');
		hints.className = 'search-modal-hints';
		hints.innerHTML = `
			<span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
			<span><kbd>↵</kbd> to select</span>
			<span><kbd>esc</kbd> to close</span>
		`;

		// Assemble modal
		this.modal.appendChild(searchHeader);
		this.modal.appendChild(this.resultsContainer);
		this.modal.appendChild(hints);

		// Add to document
		this.overlay.appendChild(this.modal);
		document.body.appendChild(this.overlay);
	}

	private setupKeyboardShortcuts(): void {
		document.addEventListener('keydown', (e) => {
			// Open search with Ctrl+K or Cmd+K
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				this.open();
			}
			// Close search with Escape
			if (e.key === 'Escape' && this.isOpen()) {
				this.close();
			}
		});
	}

	private handleInputChange(event: Event): void {
		const query = (event.target as HTMLInputElement)?.value ?? "";
		
		if (query.length === 0) {
			this.clearResults();
			return;
		}

		this.performSearch(query);
	}

	private performSearch(query: string): void {
		const results: SearchResultItem[] = this.index.search(query, {
			prefix: true,
			fuzzy: 0.2,
			boost: { 
				title: 2, 
				aliases: 1.8, 
				headers: 1.5, 
				tags: 1.3, 
				path: 1.1 
			},
			fields: ['title', 'aliases', 'headers', 'tags', 'path', 'content']
		}) as SearchResultItem[];

		// 过滤结果：只保留在文件树中的文件
		const shownInTree = ObsidianSite.metadata?.shownInTree || [];
		const filteredResults = results.filter(result => {
			// 如果文件树为空或没有metadata，显示所有结果
			if (shownInTree.length === 0) return true;
			// 检查结果路径是否在文件树中
			return shownInTree.includes(result.path);
		});

		// Deduplicate results by title, keeping the highest scored one
		const deduplicatedResults = this.deduplicateResults(filteredResults);

		// Limit to top 30 results
		this.currentResults = deduplicatedResults.slice(0, 30);
		this.selectedIndex = 0;
		this.renderResults(query);
	}

	private deduplicateResults(results: SearchResultItem[]): SearchResultItem[] {
		// Use a Map to track the best result for each title
		const titleMap = new Map<string, SearchResultItem>();
		
		for (const result of results) {
			// Filter out invalid results
			// Skip results that don't have a valid path or only have partial metadata
			if (!result.path || !result.title || result.path.trim() === '') {
				continue;
			}
			
			// Skip results where the path is just a fragment or doesn't look like a valid file path
			// Valid paths should have at least one directory separator or file extension
			if (!result.path.includes('/') && !result.path.includes('\\') && !result.path.includes('.')) {
				continue;
			}
			
			// Filter out results that would have empty breadcrumbs (no directory structure)
			// This catches cases like "【MOC】.html" which are just filename without folder
			const cleanPath = result.path.replace(/\.html$/, '');
			const pathParts = cleanPath.split('/').filter(p => p && p !== 'index');
			// If there's no directory structure (pathParts has only 1 element which is the filename),
			// skip this result as it's likely an orphaned or invalid entry
			if (pathParts.length < 2) {
				continue;
			}
			
			const title = result.title;
			const existing = titleMap.get(title);
			
			// Keep the result with the highest score
			// If scores are equal, prefer shorter paths (usually the canonical path)
			if (!existing || 
				result.score > existing.score || 
				(result.score === existing.score && result.path.length < existing.path.length)) {
				titleMap.set(title, result);
			}
		}
		
		// Convert Map back to array and sort by score (descending)
		return Array.from(titleMap.values()).sort((a, b) => b.score - a.score);
	}

	private renderResults(query: string): void {
		if (!this.resultsContainer) return;

		if (this.currentResults.length === 0) {
			this.resultsContainer.innerHTML = `
				<div class="search-modal-no-results">
					<p>No results found for "<strong>${this.escapeHtml(query)}</strong>"</p>
				</div>
			`;
			return;
		}

		this.resultsContainer.innerHTML = '';

		this.currentResults.forEach((result, index) => {
			const resultItem = this.createResultItem(result, query, index);
			this.resultsContainer!.appendChild(resultItem);
		});
		
		// 渲染完成后，更新选中状态（确保第一项被正确选中）
		this.updateSelection();
	}

	private createResultItem(result: SearchResultItem, query: string, index: number): HTMLElement {
		const item = document.createElement('div');
		item.className = 'search-modal-result-item';
		// 注意：不在这里添加selected类，而是在updateSelection中统一管理
		if (this.showDetailedView) {
			item.classList.add('detailed');
		}

		// Create breadcrumb from path
		const pathParts = this.getPathBreadcrumb(result.path);
		
		// Icon
		const icon = document.createElement('span');
		icon.className = 'search-result-icon';
		icon.textContent = '#';

		// Content container
		const content = document.createElement('div');
		content.className = 'search-result-content';

		// 合并路径和标题显示为：路径1 > 路径2 > 标题
		if (pathParts.length > 0 || result.title) {
			const fullPath = document.createElement('div');
			fullPath.className = 'search-result-full-path';
			
			// 组合路径部分和标题
			const allParts = [...pathParts];
			if (result.title) {
				allParts.push(result.title);
			}
			
			fullPath.innerHTML = allParts
				.map(part => `<span>${this.highlightMatch(part, query)}</span>`)
				.join('<span class="breadcrumb-separator">›</span>');
			content.appendChild(fullPath);
		}

		// Detailed view content
		if (this.showDetailedView) {
			// Content excerpt (show first for better hierarchy) - 显示HTML格式的摘要
			if (result.content) {
				const excerpt = document.createElement('div');
				excerpt.className = 'search-result-excerpt';
				const excerptHtml = this.getHtmlExcerpt(result.content, query, 200);
				excerpt.innerHTML = excerptHtml; // 直接使用HTML而不经过highlightMatch，因为已经包含了高亮
				content.appendChild(excerpt);
			}

			// Aliases (if available and different from title) - 优先显示，使用蓝色高亮
			if (result.aliases && result.aliases.length > 0) {
				const aliasesContainer = document.createElement('div');
				aliasesContainer.className = 'search-result-aliases';
				const aliasesList = result.aliases.slice(0, 3).map(alias => 
					this.highlightMatch(alias, query)
				).join(', ');
				// 注意：不要在innerHTML中添加 "Aliases: " 前缀，因为CSS的::before已经添加了
				aliasesContainer.innerHTML = aliasesList;
				content.appendChild(aliasesContainer);
			}

			// Headers (if available and relevant) - 显示为内部链接样式
			if (result.headers && result.headers.length > 0) {
				const matchingHeaders = result.headers.filter(header => 
					header.toLowerCase().includes(query.toLowerCase())
				);
				if (matchingHeaders.length > 0) {
					const headersContainer = document.createElement('div');
					headersContainer.className = 'search-result-headers';
					
				// 为每个标题创建链接样式
				matchingHeaders.slice(0, 3).forEach(header => {
					const headerLink = document.createElement('a');
					headerLink.className = 'tree-hint-label internal-link';
					// 构造完整的URL（路径 + 锚点）
					const fullURL = `${result.path}#${header}`;
					headerLink.href = fullURL;
					headerLink.innerHTML = this.highlightMatch(header, query);
					
					// 点击跳转到对应文章的对应标题处
					headerLink.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation(); // 阻止事件冒泡到父元素
						// 使用相对URL而非浏览器解析后的绝对URL
						ObsidianSite.loadURL(fullURL);
						this.close(); // 关闭搜索模态框
					});
					
					headersContainer.appendChild(headerLink);
				});
					
					content.appendChild(headersContainer);
				}
			}

			// Tags (if available)
			if (result.tags && result.tags.length > 0) {
				const tagsContainer = document.createElement('div');
				tagsContainer.className = 'search-result-tags';
				result.tags.slice(0, 5).forEach(tag => {
					const tagSpan = document.createElement('span');
					tagSpan.className = 'search-result-tag';
					tagSpan.innerHTML = this.highlightMatch(tag, query);
					tagsContainer.appendChild(tagSpan);
				});
				content.appendChild(tagsContainer);
			}
		}

		item.appendChild(icon);
		item.appendChild(content);

		// 添加点击事件处理器
		item.addEventListener('click', () => {
			this.selectedIndex = index; // 更新选中索引
			this.selectResult(result);
		});
		
		// 添加鼠标进入事件：hover时更新选中状态
		item.addEventListener('mouseenter', () => {
			this.selectedIndex = index;
			this.updateSelection();
		});

		return item;
	}

	private cleanTextContent(text: string): string {
		if (!text) return '';
		
		let cleaned = text;
		
		// Remove HTML tags
		cleaned = cleaned.replace(/<[^>]*>/g, ' ');
		
		// Decode common HTML entities
		const htmlEntities: { [key: string]: string } = {
			'&nbsp;': ' ',
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#39;': "'",
			'&apos;': "'",
			'&mdash;': '—',
			'&ndash;': '–',
			'&hellip;': '...',
		};
		
		for (const [entity, char] of Object.entries(htmlEntities)) {
			cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
		}
		
		// Clean Markdown syntax
		cleaned = cleaned.replace(/```([\s\S]*?)```/g, (_match, codeBlock: string) => {
			const normalizedCode = `${codeBlock}`
				.replace(/^\s*[\r\n]+/, '')
				.replace(/[\r\n]+\s*$/, '');
			return ` ${normalizedCode.replace(/\s+/g, ' ').trim()} `;
		}); // Code blocks
		cleaned = cleaned.replace(/`([^`]+)`/g, '$1'); // Inline code
		cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1'); // Images
		cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Links
		cleaned = cleaned.replace(/^#{1,6}\s+/gm, ''); // Headers
		cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, ''); // Lists
		cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, ''); // Numbered lists
		cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
		cleaned = cleaned.replace(/__([^_]+)__/g, '$1'); // Bold underscore
		cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // Italic
		cleaned = cleaned.replace(/_([^_]+)_/g, '$1'); // Italic underscore
		cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1'); // Strikethrough
		cleaned = cleaned.replace(/==([^=]+)==/g, '$1'); // Highlight
		
		// Normalize whitespace
		cleaned = cleaned.replace(/\s+/g, ' ').trim();
		
		return cleaned;
	}

	private getHtmlExcerpt(text: string, query: string, maxLength: number = 200): string {
		if (!text) return '';
		
		// 获取纯文本版本用于定位
		const cleanText = this.cleanTextContent(text);
		const excerptInfo = this.findBestExcerptPosition(cleanText, query, maxLength);
		
		// 转换Markdown格式为HTML
		let html = text;
		const codeBlocks: string[] = [];
		
		// 先保护已有的HTML标签（如果有）
		const htmlTagPattern = /<[^>]+>/g;
		const htmlTags: string[] = [];
		html = html.replace(htmlTagPattern, (match) => {
			htmlTags.push(match);
			return `__HTML_TAG_${htmlTags.length - 1}__`;
		});
		
		// 提取并占位代码块，防止后续格式化破坏结构
		html = html.replace(/```(?:([\w+-]+)\s*)?([\s\S]*?)```/g, (_match: string, language: string | undefined, codeContent: string) => {
			const languageClass = language ? ` search-excerpt-code--${language.trim().toLowerCase()}` : '';
			const normalizedCode = `${codeContent}`
				.replace(/^\s*[\r\n]+/, '')
				.replace(/[\r\n]+\s*$/, '')
				.replace(/\r\n/g, '\n')
				.replace(/\r/g, '\n');
			const escapedCode = this.escapeHtml(normalizedCode);
			const codeHtml = `<pre class="search-excerpt-code${languageClass}"><code>${escapedCode}</code></pre>`;
			codeBlocks.push(codeHtml);
			return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
		});

		// 转换基本的Markdown语法为HTML
		// 加粗 **text** 或 __text__
		html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
		
		// 斜体 *text* 或 _text_ （避免与加粗冲突）
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
		html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
		
		// 行内代码 `code`
		html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
		
		// 链接 [text](url) - 保留为链接样式
		html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" class="search-excerpt-link">$1</a>');
		
		// 图片 ![alt](url) - 显示为图片标记
		html = html.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '<span class="search-excerpt-image">🖼️ $1</span>');
		
		// 标题 # Header
		html = html.replace(/^#{1,6}\s+(.+)$/gm, '<strong class="search-excerpt-heading">$1</strong>');
		
		// 删除线 ~~text~~
		html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
		
		// 高亮 ==text==
		html = html.replace(/==([^=]+)==/g, '<mark class="search-excerpt-highlight">$1</mark>');
		
		// 列表项 - * item 或 - item
		html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<span class="search-excerpt-list-item">• $1</span>');

		// 有序列表 1. 项目 或 1.1. 项目
		html = html.replace(/^\s*(\d+(?:\.\d+)*)(?:[\.)])\s+(.+)$/gm, (_match, indexToken: string, listContent: string) => {
			const normalizedIndex = `${indexToken}`.replace(/\.$/, '');
			const normalizedContent = listContent.trim();
			return `<span class="search-excerpt-list-item search-excerpt-list-item--ordered"><span class="search-excerpt-list-index">${normalizedIndex}.</span><span class="search-excerpt-list-content">${normalizedContent}</span></span>`;
		});
		
		// 恢复HTML标签
		htmlTags.forEach((tag, index) => {
			html = html.replace(`__HTML_TAG_${index}__`, tag);
		});

		// 将换行转换为<br />以保留原始段落结构
		html = html.replace(/\r\n/g, '\n');
		html = html.replace(/\n/g, '<br />');
		html = html.replace(/<\/span><br \/><span class="search-excerpt-list-item/g, '</span><span class="search-excerpt-list-item');
		
		// 清理多余的空白但保留换行
		html = html.replace(/[ \t]+/g, ' ').trim();

		// 还原代码块并保持其原始换行
		codeBlocks.forEach((codeHtml, index) => {
			html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml);
		});
		
		if (excerptInfo.start === -1 || excerptInfo.start === 0) {
			// 没有找到匹配或从开头开始，使用HTML版本截取
			const excerptHtml = this.truncateHtml(html, maxLength);
			return this.highlightQueryInHtml(excerptHtml, query);
		}
		
		// 尝试在HTML中找到对应位置
		const prefix = excerptInfo.start > 0 ? '<span class="search-excerpt-ellipsis">...</span>' : '';
		const suffix = excerptInfo.end < cleanText.length ? '<span class="search-excerpt-ellipsis">...</span>' : '';
		
		// 简化处理：基于字符位置估算HTML位置
		const ratio = html.length / cleanText.length;
		const htmlStart = Math.floor(excerptInfo.start * ratio);
		const htmlEnd = Math.floor(excerptInfo.end * ratio);
		
		let excerptHtml = html.substring(htmlStart, htmlEnd);
		
		// 清理可能被截断的HTML标签
		excerptHtml = this.cleanBrokenHtmlTags(excerptHtml);
		
		// 在HTML中高亮查询词
		return prefix + this.highlightQueryInHtml(excerptHtml, query) + suffix;
	}
	
	// 截断HTML但保留标签完整性
	private truncateHtml(html: string, maxLength: number): string {
		if (html.length <= maxLength) return html;
		
		let truncated = html.substring(0, maxLength);
		const lastTagStart = truncated.lastIndexOf('<');
		const lastTagEnd = truncated.lastIndexOf('>');
		
		// 如果有未闭合的标签，截取到最后一个完整标签
		if (lastTagStart > lastTagEnd) {
			truncated = truncated.substring(0, lastTagStart);
		}
		
		return truncated + '<span class="search-excerpt-ellipsis">...</span>';
	}
	
	// 清理被截断的HTML标签
	private cleanBrokenHtmlTags(html: string): string {
		// 移除开头的不完整标签
		html = html.replace(/^[^<]*>/, '');
		// 移除结尾的不完整标签
		html = html.replace(/<[^>]*$/, '');
		
		// 检查并闭合未闭合的标签
		const openTags: string[] = [];
		const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
		let match;
		
		while ((match = tagRegex.exec(html)) !== null) {
			const tag = match[1].toLowerCase();
			if (match[0].startsWith('</')) {
				// 闭合标签
				const lastOpen = openTags.lastIndexOf(tag);
				if (lastOpen !== -1) {
					openTags.splice(lastOpen, 1);
				}
			} else if (!match[0].endsWith('/>') && !['br', 'img', 'hr'].includes(tag)) {
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

	private findBestExcerptPosition(text: string, query: string, maxLength: number): { start: number, end: number } {
		if (!query || text.length <= maxLength) {
			return { start: 0, end: Math.min(text.length, maxLength) };
		}

		const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
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
				const regionEnd = Math.min(lowerText.length, matchIndex + Math.floor(maxLength / 2));
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
			const spaceIndex = text.indexOf(' ', start);
			if (spaceIndex !== -1 && spaceIndex < start + 30) {
				start = spaceIndex + 1;
			}
		}
		
		if (end < text.length) {
			const spaceIndex = text.lastIndexOf(' ', end);
			if (spaceIndex !== -1 && spaceIndex > end - 30) {
				end = spaceIndex;
			}
		}
		
		return { start, end };
	}

	private highlightQueryInHtml(html: string, query: string): string {
		if (!query) return html;
		
		const escapedQuery = this.escapeRegex(query);
		const regex = new RegExp(`(${escapedQuery})`, 'gi');
		
		return html.replace(regex, '<mark>$1</mark>');
	}

	private getExcerpt(text: string, query: string, maxLength: number = 200): string {
		if (!text) return '';
		
		const cleanText = this.cleanTextContent(text);
		
		if (!query || cleanText.length <= maxLength) {
			return cleanText.substring(0, maxLength) + (cleanText.length > maxLength ? '...' : '');
		}

		// Split query into individual words
		// Support both short and long words (for English and CJK languages)
		const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
		const lowerText = cleanText.toLowerCase();
		
		if (queryWords.length === 0) {
			return cleanText.substring(0, maxLength) + (cleanText.length > maxLength ? '...' : '');
		}
		
		// Find the best position that contains the most query words
		let bestMatchStart = -1;
		let bestMatchScore = -1;
		let bestMatchLength = 0;
		
		// Search for each query word and score regions around them
		for (const word of queryWords) {
			let searchStart = 0;
			let matchIndex = lowerText.indexOf(word, searchStart);
			
			while (matchIndex !== -1) {
				// Score this region by counting how many other query words are nearby
				const regionStart = Math.max(0, matchIndex - Math.floor(maxLength / 2));
				const regionEnd = Math.min(lowerText.length, matchIndex + Math.floor(maxLength / 2));
				const regionText = lowerText.substring(regionStart, regionEnd);
				
				let score = 0;
				let matchLength = word.length;
				
				for (const qw of queryWords) {
					const qwIndex = regionText.indexOf(qw);
					if (qwIndex !== -1) {
						score += 1;
						// Bonus for matches close to the center
						const distance = Math.abs(qwIndex - (regionText.length / 2));
						score += Math.max(0, 1 - distance / regionText.length);
					}
				}
				
				if (score > bestMatchScore) {
					bestMatchScore = score;
					bestMatchStart = matchIndex;
					bestMatchLength = matchLength;
				}
				
				searchStart = matchIndex + 1;
				matchIndex = lowerText.indexOf(word, searchStart);
			}
		}
		
		if (bestMatchStart === -1) {
			// No match found, return start of text
			return cleanText.substring(0, maxLength) + (cleanText.length > maxLength ? '...' : '');
		}
		
		// Calculate excerpt bounds to center around the best match
		const halfLength = Math.floor(maxLength / 2);
		let start = Math.max(0, bestMatchStart - halfLength + Math.floor(bestMatchLength / 2));
		let end = Math.min(cleanText.length, start + maxLength);
		
		// Adjust start if we're near the end
		if (end === cleanText.length) {
			start = Math.max(0, end - maxLength);
		}
		
		// Try to start/end at sentence boundaries first (. ! ? followed by space)
		if (start > 0) {
			const sentenceEnd = cleanText.substring(Math.max(0, start - 50), start).search(/[.!?]\s+(?=\S)/g);
			if (sentenceEnd !== -1) {
				const actualStart = Math.max(0, start - 50) + sentenceEnd + 2;
				if (actualStart < start + 20) {
					start = actualStart;
				}
			}
		}
		
		if (end < cleanText.length) {
			const sentenceEnd = cleanText.substring(end, Math.min(cleanText.length, end + 50)).search(/[.!?]\s/);
			if (sentenceEnd !== -1) {
				end = end + sentenceEnd + 1;
			}
		}
		
		// Fall back to word boundaries if sentence boundaries didn't work
		if (start > 0) {
			const spaceIndex = cleanText.indexOf(' ', start);
			if (spaceIndex !== -1 && spaceIndex < start + 30) {
				start = spaceIndex + 1;
			}
		}
		
		if (end < cleanText.length) {
			const spaceIndex = cleanText.lastIndexOf(' ', end);
			if (spaceIndex !== -1 && spaceIndex > end - 30) {
				end = spaceIndex;
			}
		}
		
		const prefix = start > 0 ? '...' : '';
		const suffix = end < cleanText.length ? '...' : '';
		
		return prefix + cleanText.substring(start, end).trim() + suffix;
	}

	private getPathBreadcrumb(path: string): string[] {
		if (!path) return [];
		
		// Remove .html extension and split by /
		const cleanPath = path.replace(/\.html$/, '');
		const parts = cleanPath.split('/').filter(p => p && p !== 'index');
		
		// Return all parts except the last one (which is the title)
		return parts.slice(0, -1);
	}

	private highlightMatch(text: string, query: string): string {
		if (!query) return this.escapeHtml(text);
		
		const escapedText = this.escapeHtml(text);
		const escapedQuery = this.escapeRegex(query);
		const regex = new RegExp(`(${escapedQuery})`, 'gi');
		
		return escapedText.replace(regex, '<mark>$1</mark>');
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	private escapeRegex(text: string): string {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (!this.currentResults.length) return;

		switch (event.key) {
			case 'ArrowDown':
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
				this.updateSelection();
				break;
			case 'ArrowUp':
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.updateSelection();
				break;
			case 'Enter':
				if (this.currentResults[this.selectedIndex]) {
					this.selectResult(this.currentResults[this.selectedIndex]);
				}
				break;
		}
	}

	private updateSelection(): void {
		if (!this.resultsContainer) return;

		const items = this.resultsContainer.querySelectorAll('.search-modal-result-item');
		items.forEach((item, index) => {
			if (index === this.selectedIndex) {
				item.classList.add('selected');
				item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			} else {
				item.classList.remove('selected');
			}
		});
	}

	private selectResult(result: SearchResultItem): void {
		if (!result.path) return;

		// Navigate to the selected page
		ObsidianSite.loadURL(result.path);
		this.close();
	}

	private clearResults(): void {
		if (this.resultsContainer) {
			this.resultsContainer.innerHTML = '';
		}
		this.currentResults = [];
		this.selectedIndex = 0;
	}

	public open(): void {
		if (!this.overlay || !this.modal || !this.searchInput) return;

		this.overlay.classList.add('active');
		this.modal.classList.add('active');
		
		// Focus input after a short delay to ensure the modal is visible
		setTimeout(() => {
			this.searchInput?.focus();
		}, 50);
	}

	public close(): void {
		if (!this.overlay || !this.modal || !this.searchInput) return;

		this.overlay.classList.remove('active');
		this.modal.classList.remove('active');
		
		// Clear search
		this.searchInput.value = '';
		this.clearResults();
	}

	public isOpen(): boolean {
		return this.overlay?.classList.contains('active') || false;
	}
}

