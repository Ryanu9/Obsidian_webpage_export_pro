import { Shared } from "src/shared/shared";
import MiniSearch, { SearchResult } from "minisearch";

interface SearchResultItem extends SearchResult {
	title: string;
	path: string;
	headers?: string[];
	tags?: string[];
	aliases?: string[];
	content?: string;
}

const contextWindowWords = 30;
const numSearchResults = 12;
const numTagResults = 5;

export class ModalSearch {
	private index: MiniSearch | null = null;
	private container: HTMLElement | null = null;
	private searchBar: HTMLInputElement | null = null;
	private searchLayout: HTMLElement | null = null;
	private resultsContainer: HTMLElement | null = null;
	private previewContainer: HTMLElement | null = null;
	private currentSearchTerm: string = "";
	private currentHover: HTMLElement | null = null;
	private fetchContentCache: Map<string, Element[]> = new Map();

	constructor() {}

	public async init(preloadedIndexJSON?: any): Promise<ModalSearch | undefined> {
		let indexJSON = preloadedIndexJSON;
		if (!indexJSON) {
			const indexResp = await ObsidianSite.fetch(Shared.libFolderName + '/' + Shared.searchIndexFileName);
			if (!indexResp?.ok) return;
			indexJSON = await indexResp.json();
		}
		try {
			// @ts-ignore
			this.index = MiniSearch.loadJS(indexJSON, {
				fields: ['title', 'path', 'tags', 'headers', 'aliases', 'content']
			});
		} catch (e) {
			console.error("ModalSearch: Failed to load index", e);
			return;
		}

		this.createSearchUI();
		this.setupEvents();
		this.bindSearchButtons();
		return this;
	}

	private createSearchUI(): void {
		this.container = document.createElement('div');
		this.container.className = 'search-container';

		const searchSpace = document.createElement('div');
		searchSpace.className = 'search-space';

		this.searchBar = document.createElement('input');
		this.searchBar.className = 'search-bar';
		this.searchBar.type = 'text';
		this.searchBar.autocomplete = 'off';
		this.searchBar.name = 'search';
		this.searchBar.placeholder = 'Search...';
		this.searchBar.setAttribute('aria-label', 'Search...');

		this.searchLayout = document.createElement('div');
		this.searchLayout.className = 'search-layout';
		this.searchLayout.dataset.preview = 'true';

		this.resultsContainer = document.createElement('div');
		this.resultsContainer.className = 'results-container';

		this.previewContainer = document.createElement('div');
		this.previewContainer.className = 'preview-container';

		this.searchLayout.append(this.resultsContainer, this.previewContainer);
		searchSpace.append(this.searchBar, this.searchLayout);
		this.container.append(searchSpace);
		document.body.append(this.container);
	}

	private setupEvents(): void {
		const shortcutHandler = (e: KeyboardEvent) => this.shortcutHandler(e);
		document.addEventListener('keydown', shortcutHandler);

		this.searchBar?.addEventListener('input', (e) => this.onType(e));

		this.container?.addEventListener('click', (e) => {
			if (e.target === this.container) {
				this.hideSearch();
			}
		});
	}

	private bindSearchButtons(): void {
		const searchButtons = document.querySelectorAll('.search-icon, #search-icon, #search-input-container .search-icon, .sidebar-toolbar-search');
		searchButtons.forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.showSearch();
			});
		});
	}

	private hideSearch(): void {
		this.container?.classList.remove('active');
		if (this.searchBar) this.searchBar.value = '';
		this.removeAllChildren(this.resultsContainer);
		this.removeAllChildren(this.previewContainer);
		this.searchLayout?.classList.remove('display-results');
		this.currentSearchTerm = '';
		this.currentHover = null;
	}

	private showSearch(): void {
		this.container?.classList.add('active');
		this.searchBar?.focus();
	}

	public open(): void { this.showSearch(); }
	public close(): void { this.hideSearch(); }
	public isOpen(): boolean { return this.container?.classList.contains('active') ?? false; }

	private shortcutHandler(e: KeyboardEvent): void {
		if (e.key === 'k' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
			e.preventDefault();
			const isOpen = this.container?.classList.contains('active');
			isOpen ? this.hideSearch() : this.showSearch();
			return;
		}

		if (e.key === 'Escape' && this.isOpen()) {
			e.preventDefault();
			this.hideSearch();
			return;
		}

		if (this.currentHover) {
			this.currentHover.classList.remove('focus');
		}

		if (!this.container?.classList.contains('active')) return;

		if (e.key === 'Enter' && !e.isComposing) {
			if (this.resultsContainer?.contains(document.activeElement)) {
				const active = document.activeElement as HTMLElement;
				if (active.classList.contains('no-match')) return;
				this.displayPreview(active);
				(active as HTMLAnchorElement).click();
			} else {
				const anchor = this.resultsContainer?.querySelector('.result-card') as HTMLElement | null;
				if (!anchor || anchor.classList.contains('no-match')) return;
				this.displayPreview(anchor);
				(anchor as HTMLAnchorElement).click();
			}
		} else if (e.key === 'ArrowUp' || (e.shiftKey && e.key === 'Tab')) {
			e.preventDefault();
			if (this.resultsContainer?.contains(document.activeElement)) {
				const currentResult = this.currentHover ?? document.activeElement as HTMLElement | null;
				const prevResult = currentResult?.previousElementSibling as HTMLElement | null;
				currentResult?.classList.remove('focus');
				prevResult?.focus();
				if (prevResult) this.currentHover = prevResult;
				this.displayPreview(prevResult);
			}
		} else if (e.key === 'ArrowDown' || e.key === 'Tab') {
			e.preventDefault();
			if (document.activeElement === this.searchBar || this.currentHover !== null) {
				const firstResult = this.currentHover ?? this.resultsContainer?.querySelector('.result-card') as HTMLElement | null;
				const secondResult = firstResult?.nextElementSibling as HTMLElement | null;
				firstResult?.classList.remove('focus');
				secondResult?.focus();
				if (secondResult) this.currentHover = secondResult;
				this.displayPreview(secondResult);
			}
		}
	}

	private async onType(e: Event): Promise<void> {
		if (!this.searchLayout || !this.index) return;
		this.currentSearchTerm = (e.target as HTMLInputElement).value;
		this.searchLayout.classList.toggle('display-results', this.currentSearchTerm !== '');

		if (this.currentSearchTerm.length === 0) {
			this.removeAllChildren(this.resultsContainer);
			this.removeAllChildren(this.previewContainer);
			return;
		}

		const results = this.index.search(this.currentSearchTerm, {
			prefix: true,
			fuzzy: 0.2,
			boost: { title: 2, aliases: 1.8, headers: 1.5, tags: 1.3, path: 1.1 }
		}) as SearchResultItem[];

		const shownInTree = ObsidianSite.metadata?.shownInTree || [];
		const filteredResults = results
			.filter(r => r.path && r.title && (shownInTree.length === 0 || shownInTree.includes(r.path)))
			.slice(0, numSearchResults);

		const finalResults = filteredResults.map(r => this.formatForDisplay(this.currentSearchTerm, r));
		await this.displayResults(finalResults);
	}

	private formatForDisplay(term: string, result: SearchResultItem): SearchResultItem {
		return {
			...result,
			title: this.highlightText(term, result.title ?? ''),
			content: this.highlightText(term, result.content ?? '', true),
			tags: this.highlightTags(term, result.tags ?? []) as any,
		};
	}

	private tokenizeTerm(term: string): string[] {
		const tokens = term.split(/\s+/).filter(t => t.trim() !== '');
		const tokenLen = tokens.length;
		if (tokenLen > 1) {
			for (let i = 1; i < tokenLen; i++) {
				tokens.push(tokens.slice(0, i + 1).join(' '));
			}
		}
		return tokens.sort((a, b) => b.length - a.length);
	}

	private highlightText(searchTerm: string, text: string, trim?: boolean): string {
		const tokenizedTerms = this.tokenizeTerm(searchTerm);
		let tokenizedText = text.split(/\s+/).filter(t => t !== '');

		let startIndex = 0;
		let endIndex = tokenizedText.length - 1;

		if (trim) {
			const includesCheck = (tok: string) =>
				tokenizedTerms.some(term => tok.toLowerCase().startsWith(term.toLowerCase()));
			const occurrencesIndices = tokenizedText.map(includesCheck);

			let bestSum = 0;
			let bestIndex = 0;
			for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
				const window = occurrencesIndices.slice(i, i + contextWindowWords);
				const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0);
				if (windowSum >= bestSum) {
					bestSum = windowSum;
					bestIndex = i;
				}
			}

			startIndex = Math.max(bestIndex - contextWindowWords, 0);
			endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1);
			tokenizedText = tokenizedText.slice(startIndex, endIndex);
		}

		const slice = tokenizedText
			.map(tok => {
				for (const searchTok of tokenizedTerms) {
					if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
						const regex = new RegExp(this.escapeRegex(searchTok), 'gi');
						return tok.replace(regex, `<span class="highlight">$&</span>`);
					}
				}
				return tok;
			})
			.join(' ');

		return `${startIndex === 0 ? '' : '...'}${slice}${endIndex === tokenizedText.length - 1 ? '' : '...'}`;
	}

	private highlightTags(term: string, tags: string[]): string[] {
		if (!tags?.length) return [];
		return tags
			.map(tag => {
				if (tag.toLowerCase().includes(term.toLowerCase())) {
					return `<li><p class="match-tag">${tag}</p></li>`;
				} else {
					return `<li><p>${tag}</p></li>`;
				}
			})
			.slice(0, numTagResults);
	}

	private resultToHTML(result: SearchResultItem): HTMLElement {
		const htmlTags = result.tags && (result.tags as any[]).length > 0
			? `<ul class="tags">${(result.tags as any[]).join('')}</ul>` : '';

		const itemTile = document.createElement('a');
		itemTile.classList.add('result-card');
		itemTile.id = result.path;
		itemTile.href = result.path;
		itemTile.innerHTML = `
			<h3 class="card-title">${result.title}</h3>
			${htmlTags}
			<p class="card-description">${result.content}</p>
		`;

		itemTile.addEventListener('click', (e) => {
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
			e.preventDefault();
			ObsidianSite.loadURL(result.path);
			this.hideSearch();
		});

		itemTile.addEventListener('mouseenter', () => {
			this.displayPreview(itemTile);
		});

		return itemTile;
	}

	private async displayResults(finalResults: SearchResultItem[]): Promise<void> {
		this.removeAllChildren(this.resultsContainer);

		if (finalResults.length === 0) {
			if (this.resultsContainer) {
				this.resultsContainer.innerHTML = `<a class="result-card no-match">
					<h3>No results.</h3>
					<p>Try another search term?</p>
				</a>`;
			}
		} else {
			finalResults.forEach(r => {
				this.resultsContainer?.appendChild(this.resultToHTML(r));
			});
		}

		if (finalResults.length === 0 && this.previewContainer) {
			this.removeAllChildren(this.previewContainer);
		} else {
			const firstChild = this.resultsContainer?.firstElementChild as HTMLElement;
			if (firstChild) {
				firstChild.classList.add('focus');
				this.currentHover = firstChild;
				await this.displayPreview(firstChild);
			}
		}
	}

	private async fetchContent(path: string): Promise<Element[]> {
		if (this.fetchContentCache.has(path)) {
			return this.fetchContentCache.get(path)!;
		}

		try {
			const resp = await ObsidianSite.fetch(path);
			if (!resp?.ok) return [];
			const text = await resp.text();
			const parser = new DOMParser();
			const html = parser.parseFromString(text, 'text/html');
			const docContent = html.querySelector('.markdown-preview-sizer')
				?? html.querySelector('.obsidian-document')
				?? html.querySelector('.password-lock')
				?? html.querySelector('body');

			const contents = docContent ? [docContent] : [];
			this.fetchContentCache.set(path, contents);
			return contents;
		} catch {
			return [];
		}
	}

	private highlightHTML(searchTerm: string, el: HTMLElement): HTMLElement {
		const tokenizedTerms = this.tokenizeTerm(searchTerm);
		const clone = el.cloneNode(true) as HTMLElement;

		const createHighlightSpan = (text: string): HTMLSpanElement => {
			const span = document.createElement('span');
			span.className = 'highlight';
			span.textContent = text;
			return span;
		};

		const highlightTextNodes = (node: Node, term: string): void => {
			if (node.nodeType === Node.TEXT_NODE) {
				const nodeText = node.nodeValue ?? '';
				const regex = new RegExp(this.escapeRegex(term), 'gi');
				const matches = nodeText.match(regex);
				if (!matches || matches.length === 0) return;
				const spanContainer = document.createElement('span');
				let lastIndex = 0;
				for (const match of matches) {
					const matchIndex = nodeText.indexOf(match, lastIndex);
					spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, matchIndex)));
					spanContainer.appendChild(createHighlightSpan(match));
					lastIndex = matchIndex + match.length;
				}
				spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)));
				node.parentNode?.replaceChild(spanContainer, node);
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if ((node as HTMLElement).classList?.contains('highlight')) return;
				Array.from(node.childNodes).forEach(child => highlightTextNodes(child, term));
			}
		};

		for (const term of tokenizedTerms) {
			highlightTextNodes(clone, term);
		}

		return clone;
	}

	private async displayPreview(el: HTMLElement | null): Promise<void> {
		if (!this.searchLayout || !el || !this.previewContainer) return;
		const path = el.id;
		if (!path) return;

		const contents = await this.fetchContent(path);
		if (contents.length === 0) return;

		const innerDiv = contents.flatMap(c => {
			const highlighted = this.highlightHTML(this.currentSearchTerm, c as HTMLElement);
			return Array.from(highlighted.children);
		});

		const previewInner = document.createElement('div');
		previewInner.classList.add('preview-inner', 'markdown-preview-view', 'markdown-rendered');
		innerDiv.forEach(child => previewInner.appendChild(child.cloneNode(true)));
		this.previewContainer.replaceChildren(previewInner);

		this.rebindCopyButtons(previewInner);

		const highlights = Array.from(this.previewContainer.getElementsByClassName('highlight')).sort(
			(a, b) => b.innerHTML.length - a.innerHTML.length
		);
		if (highlights[0] && this.previewContainer) {
			const containerRect = this.previewContainer.getBoundingClientRect();
			const highlightRect = highlights[0].getBoundingClientRect();
			this.previewContainer.scrollTop += highlightRect.top - containerRect.top;
		}
	}

	private removeAllChildren(el: HTMLElement | null): void {
		if (!el) return;
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}
	}

	private rebindCopyButtons(container: HTMLElement): void {
		container.querySelectorAll<HTMLButtonElement>('.copy-button, .copy-code-button').forEach(btn => {
			const pre = btn.closest('pre') ?? btn.closest('.code-block-container')?.querySelector('pre');
			if (!pre) return;
			btn.onclick = async () => {
				const codeEl = pre.querySelector('code') ?? pre;
				const text = codeEl.textContent ?? '';
				let success = false;
				try {
					await navigator.clipboard.writeText(text);
					success = true;
				} catch {
					try {
						const textarea = document.createElement('textarea');
						textarea.value = text;
						textarea.style.position = 'fixed';
						textarea.style.left = '-9999px';
						document.body.appendChild(textarea);
						textarea.select();
						document.execCommand('copy');
						document.body.removeChild(textarea);
						success = true;
					} catch { success = false; }
				}
				this.showCopyToast(btn, success);
			};
		});
	}

	private showCopyToast(anchor: HTMLElement, success: boolean): void {
		document.querySelectorAll('.copy-toast').forEach(el => el.remove());

		const rect = anchor.getBoundingClientRect();
		const toast = document.createElement('span');
		toast.className = 'copy-toast';
		toast.textContent = success ? 'Copied!' : 'Failed';
		toast.style.cssText = `
			position: fixed;
			top: ${rect.top - 28}px;
			left: ${rect.left + rect.width / 2}px;
			transform: translateX(-50%);
			background: ${success ? 'var(--interactive-accent, #7f6df2)' : '#e03e3e'};
			color: #fff;
			font-size: 12px;
			padding: 2px 8px;
			border-radius: 4px;
			white-space: nowrap;
			pointer-events: none;
			opacity: 1;
			transition: opacity 0.3s ease;
			z-index: 10001;
		`;
		document.body.appendChild(toast);
		setTimeout(() => { toast.style.opacity = '0'; }, 700);
		setTimeout(() => { toast.remove(); }, 1000);
	}

	private escapeRegex(s: string): string {
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}
