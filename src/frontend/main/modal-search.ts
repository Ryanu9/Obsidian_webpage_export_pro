import { Shared } from "src/shared/shared";
import MiniSearch, { SearchResult } from "minisearch";

export enum ModalSearchType {
	Title = 1,
	Aliases = 2,
	Headers = 4,
	Tags = 8,
	Path = 16,
	Content = 32,
}

const defaultSearchMask =
	ModalSearchType.Title |
	ModalSearchType.Aliases |
	ModalSearchType.Headers |
	ModalSearchType.Tags |
	ModalSearchType.Path |
	ModalSearchType.Content;

interface ModalSearchResultItem extends SearchResult {
	title: string;
	path: string;
	headers?: string[];
	tags?: string[];
	aliases?: string[];
	content?: string;
}

const INPUT_DEBOUNCE_MS = 80;
const MAX_RESULTS = 30;

export class ModalSearch {
	private index: MiniSearch | undefined;

	private overlayEl: HTMLElement | null = null;
	private modalEl: HTMLElement | null = null;
	private inputEl: HTMLInputElement | null = null;
	private resultsEl: HTMLElement | null = null;
	private toggleViewButtonEl: HTMLElement | null = null;

	private currentResults: ModalSearchResultItem[] = [];
	private selectedIndex = 0;
	private isOpening = false;
	private lastQuery = "";

	private inputDebounceHandle: number | undefined;
	private showDetailedView: boolean = false;

	constructor() {
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onGlobalKeyDown = this.onGlobalKeyDown.bind(this);
	}

	public async init(): Promise<ModalSearch | undefined> {
		// Only load index once; if it fails we simply do not enable the modal search.
		const resp = await ObsidianSite.fetch(
			Shared.libFolderName + "/search-index.json",
		);
		if (!resp?.ok) return;

		const raw = await resp.json();

		try {
			// @ts-ignore - MiniSearch.loadJS exists at runtime
			this.index = MiniSearch.loadJS(raw, {
				fields: ["title", "path", "tags", "headers", "aliases", "content"],
			});
		} catch (e) {
			console.error("Failed to initialise modal search index", e);
			return;
		}

		this.buildDOM();
		this.registerGlobalShortcuts();
		this.bindTriggerElement();
		return this;
	}

	private bindTriggerElement() {
		// 优先绑定到显式的放大镜图标
		const icon = document.getElementById("search-icon");
		if (icon) {
			icon.addEventListener("click", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.open();
			});
			return;
		}


		const container = document.getElementById("search-container");
		if (container) {
			container.addEventListener("click", (evt) => {
				if (evt.target !== container) return;
				evt.preventDefault();
				evt.stopPropagation();
				this.open();
			});
		}
	}

	private buildDOM() {
		if (this.overlayEl) return;

		const overlay = document.createElement("div");
		overlay.className = "search-modal-overlay";
		overlay.addEventListener("click", () => this.close());

		const modal = document.createElement("div");
		modal.className = "search-modal";
		modal.addEventListener("click", (evt) => evt.stopPropagation());

		const header = document.createElement("div");
		header.className = "search-modal-header";

		const input = document.createElement("input");
		input.type = "search";
		input.className = "search-modal-input";
		input.placeholder = "Search notes…";
		input.setAttribute("enterkeyhint", "search");
		input.setAttribute("spellcheck", "false");

		input.addEventListener("input", () => this.onInputChanged());
		input.addEventListener("keydown", (evt) => {
			if (
				evt.key === "ArrowDown" ||
				evt.key === "ArrowUp" ||
				evt.key === "Enter"
			) {
				evt.preventDefault();
				this.onKeyDown(evt);
			}
		});

		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "search-modal-toggle";
		toggle.setAttribute("aria-label", "Toggle detailed view");
		toggle.innerHTML =
			`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/></svg>`;
		toggle.addEventListener("click", () => {
			this.showDetailedView = !this.showDetailedView;
			toggle.classList.toggle("active", this.showDetailedView);
			this.renderResults(this.inputEl?.value ?? this.lastQuery);
		});

		header.appendChild(input);
		header.appendChild(toggle);

		const results = document.createElement("div");
		results.className = "search-modal-results";

		const hints = document.createElement("div");
		hints.className = "search-modal-hints";
		hints.innerHTML =
			`<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>` +
			`<span><kbd>↵</kbd> Open</span>` +
			`<span><kbd>Esc</kbd> Close</span>`;

		modal.appendChild(header);
		modal.appendChild(results);
		modal.appendChild(hints);

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		this.overlayEl = overlay;
		this.modalEl = modal;
		this.inputEl = input;
		this.resultsEl = results;
		this.toggleViewButtonEl = toggle;
	}

	private registerGlobalShortcuts() {
		document.addEventListener("keydown", this.onGlobalKeyDown);
	}

	private onGlobalKeyDown(evt: KeyboardEvent) {
		if ((evt.ctrlKey || evt.metaKey) && evt.key === "k") {
			evt.preventDefault();
			this.open();
		} else if (evt.key === "Escape" && this.isOpen()) {
			evt.preventDefault();
			this.close();
		}
	}

	public open(initialQuery: string = "") {
		if (!this.overlayEl || !this.modalEl || this.isOpening) return;
		this.isOpening = true;

		this.overlayEl.classList.add("active");
		this.modalEl.classList.add("active");
		this.overlayEl.style.display = "flex";

		requestAnimationFrame(() => {
			this.inputEl?.focus();
			if (initialQuery) {
				this.inputEl!.value = initialQuery;
				this.triggerSearch(initialQuery);
			}
			this.isOpening = false;
		});
	}

	public close() {
		if (!this.overlayEl || !this.modalEl) return;

		this.overlayEl.classList.remove("active");
		this.modalEl.classList.remove("active");
		this.overlayEl.style.display = "none";

		this.currentResults = [];
		this.selectedIndex = 0;
		this.lastQuery = "";
		if (this.resultsEl) {
			this.resultsEl.innerHTML = "";
		}
	}

	public isOpen(): boolean {
		return !!this.overlayEl && this.overlayEl.classList.contains("active");
	}

	private onInputChanged() {
		if (!this.inputEl) return;
		const value = this.inputEl.value.trim();

		if (this.inputDebounceHandle != null) {
			window.clearTimeout(this.inputDebounceHandle);
		}

		if (!value) {
			this.currentResults = [];
			this.selectedIndex = 0;
			if (this.resultsEl) this.resultsEl.textContent = "";
			return;
		}

		this.inputDebounceHandle = window.setTimeout(() => {
			this.triggerSearch(value);
		}, INPUT_DEBOUNCE_MS);
	}

	private triggerSearch(query: string) {
		if (!this.index || !query || query === this.lastQuery) return;

		this.lastQuery = query;
		const fields: string[] = [];
		const mask = defaultSearchMask;
		if (mask & ModalSearchType.Title) fields.push("title");
		if (mask & ModalSearchType.Aliases) fields.push("aliases");
		if (mask & ModalSearchType.Headers) fields.push("headers");
		if (mask & ModalSearchType.Tags) fields.push("tags");
		if (mask & ModalSearchType.Path) fields.push("path");
		if (mask & ModalSearchType.Content) fields.push("content");

		const results = this.index.search(query, {
			prefix: true,
			fuzzy: 0.2,
			boost: {
				title: 2,
				aliases: 1.8,
				headers: 1.5,
				tags: 1.3,
				path: 1.1,
			},
			fields,
		}) as ModalSearchResultItem[];

		this.currentResults = results.slice(0, MAX_RESULTS);
		this.selectedIndex = 0;
		this.renderResults(query);
	}

	private onKeyDown(evt: KeyboardEvent) {
		if (!this.currentResults.length) return;

		if (evt.key === "ArrowDown") {
			evt.preventDefault();
			this.selectedIndex = Math.min(
				this.selectedIndex + 1,
				this.currentResults.length - 1,
			);
			this.renderSelection();
		} else if (evt.key === "ArrowUp") {
			evt.preventDefault();
			this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
			this.renderSelection();
		} else if (evt.key === "Enter") {
			evt.preventDefault();
			this.openSelected();
		}
	}

	private openSelected() {
		const item = this.currentResults[this.selectedIndex];
		if (!item) return;

		const target = item.path.endsWith(".html") ? item.path : item.path + ".html";
		const url = target + "?mark=" + encodeURIComponent(this.lastQuery);

		this.close();
		// Reuse the same navigation flow as internal links so history,
		// sidebars and other features stay consistent.
		ObsidianSite.loadURL(url);
	}

	private renderResults(query: string) {
		if (!this.resultsEl) return;
		this.resultsEl.textContent = "";

		if (!this.currentResults.length) {
			const empty = document.createElement("div");
			empty.className = "search-modal-empty";
			empty.textContent = "No results";
			this.resultsEl.appendChild(empty);
			return;
		}

		const fragment = document.createDocumentFragment();
		const lowerQuery = query.toLowerCase();

		for (let i = 0; i < this.currentResults.length; i++) {
			const result = this.currentResults[i];
			const container = document.createElement("div");
			container.className = "search-modal-result-item";
			if (i === this.selectedIndex) {
				container.classList.add("selected");
			}
			if (this.showDetailedView) {
				container.classList.add("detailed");
			}

			container.addEventListener("mouseenter", () => {
				this.selectedIndex = i;
				this.renderSelection();
			});
			container.addEventListener("click", () => {
				this.selectedIndex = i;
				this.openSelected();
			});

			const main = document.createElement("div");
			main.className = "search-result-main";

			const titleEl = document.createElement("div");
			titleEl.className = "search-result-title";
			titleEl.innerHTML = this.highlightText(
				result.title ?? result.path,
				lowerQuery,
			);

			const pathEl = document.createElement("div");
			pathEl.className = "search-result-path";
			pathEl.textContent = result.path;

			const excerptEl = document.createElement("div");
			excerptEl.className = "search-result-excerpt";
			excerptEl.innerHTML = this.buildExcerptHTML(result, lowerQuery);

			main.appendChild(titleEl);
			main.appendChild(pathEl);
			main.appendChild(excerptEl);

			if (this.showDetailedView) {
				const meta = this.buildMetaSection(result, lowerQuery);
				if (meta) {
					main.appendChild(meta);
				}
			}

			container.appendChild(main);
			fragment.appendChild(container);
		}

		this.resultsEl.appendChild(fragment);
	}

	private renderSelection() {
		if (!this.resultsEl) return;
		const children = this.resultsEl.querySelectorAll(".search-modal-result-item");
		children.forEach((el, idx) => {
			if (idx === this.selectedIndex) el.classList.add("selected");
			else el.classList.remove("selected");
		});

		const selected = children[this.selectedIndex] as HTMLElement | undefined;
		if (selected) {
			selected.scrollIntoView({ block: "nearest" });
		}
	}

	private highlightText(text: string, queryLower: string): string {
		if (!text) return "";
		const idx = text.toLowerCase().indexOf(queryLower);
		if (idx === -1) {
			return text;
		}
		const before = text.slice(0, idx);
		const match = text.slice(idx, idx + queryLower.length);
		const after = text.slice(idx + queryLower.length);
		return `${this.escapeHtml(before)}<mark>${this.escapeHtml(
			match,
		)}</mark>${this.escapeHtml(after)}`;
	}

	private buildExcerptHTML(
		item: ModalSearchResultItem,
		queryLower: string,
	): string {
		const rawContent = item.content ?? "";
		if (!rawContent) return "";

		const maxChars = 260;
		const textOnly = this.stripHtml(rawContent);
		const lower = textOnly.toLowerCase();

		const terms = this.getQueryTerms(queryLower);
		if (!terms.length) {
			return this.escapeHtml(
				textOnly.length > maxChars ? textOnly.slice(0, maxChars) + "…" : textOnly,
			);
		}

		const halfWindow = Math.floor(maxChars / 2);
		let bestStart = 0;
		let bestScore = -1;

		for (const term of terms) {
			let fromIndex = 0;
			while (true) {
				const hit = lower.indexOf(term, fromIndex);
				if (hit === -1) break;
				fromIndex = hit + term.length;

				const windowStart = Math.max(0, hit - halfWindow);
				const windowEnd = Math.min(textOnly.length, windowStart + maxChars);

				let score = 0;
				for (const t of terms) {
					const pos = lower.indexOf(t, windowStart);
					if (pos !== -1 && pos <= windowEnd) {
						score += 1;
					}
				}

				if (score > bestScore) {
					bestScore = score;
					bestStart = windowStart;
				}
			}
		}

		let start = bestStart;
		let end = Math.min(textOnly.length, start + maxChars);

		// 尝试在单词或句子边界截断，避免在中间断开
		if (end < textOnly.length) {
			const punctuationIndex = textOnly.slice(start, end).search(/[.!?](\s|$)/);
			if (punctuationIndex !== -1 && punctuationIndex > maxChars * 0.3) {
				end = start + punctuationIndex + 1;
			} else {
				const space = textOnly.indexOf(" ", end);
				if (space > -1 && space - end < 40) {
					end = space;
				}
			}
		}

		const slice = textOnly.slice(start, end);
		let safe = this.escapeHtml(slice);

		if (start > 0) safe = "…" + safe;
		if (end < textOnly.length) safe = safe + "…";

		const parts = this.getQueryTerms(queryLower).map((t) => this.escapeRegExp(t));
		const re =
			parts.length === 1
				? new RegExp(parts[0], "gi")
				: new RegExp("(" + parts.join("|") + ")", "gi");
		safe = safe.replace(re, (m) => `<mark>${m}</mark>`);

		return safe;
	}

	private stripHtml(html: string): string {
		const tmp = document.createElement("div");
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || "";
	}

	private escapeHtml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	private escapeRegExp(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	private getQueryTerms(queryLower: string): string[] {
		return queryLower
			.split(/[\s,;]+/)
			.map((t) => t.trim())
			.filter((t) => t.length > 1);
	}

	private buildMetaSection(
		item: ModalSearchResultItem,
		queryLower: string,
	): HTMLElement | null {
		const aliases = item.aliases ?? [];
		const tags = item.tags ?? [];
		const headers = item.headers ?? [];

		if (!aliases.length && !tags.length && !headers.length) return null;

		const root = document.createElement("div");
		root.className = "search-result-meta";

		const terms = this.getQueryTerms(queryLower);

		if (aliases.length) {
			const aliasEl = document.createElement("div");
			aliasEl.className = "search-result-aliases";
			for (const a of aliases.slice(0, 6)) {
				const chip = document.createElement("span");
				chip.className = "meta-chip alias-chip";
				chip.textContent = a;
				if (this.textMatchesTerms(a, terms)) {
					chip.classList.add("match");
				}
				aliasEl.appendChild(chip);
			}
			root.appendChild(aliasEl);
		}

		const matchingHeaders = this.pickMatchingHeaders(headers, terms);
		if (matchingHeaders.length) {
			const headersEl = document.createElement("div");
			headersEl.className = "search-result-headers";
			for (const h of matchingHeaders.slice(0, 5)) {
				const link = document.createElement("button");
				link.type = "button";
				link.className = "meta-chip header-chip";
				link.textContent = h;
				link.addEventListener("click", (evt) => {
					evt.preventDefault();
					evt.stopPropagation();
					const target = item.path.endsWith(".html")
						? item.path
						: item.path + ".html";
					const url = `${target}#${encodeURIComponent(h)}`;
					this.close();
					ObsidianSite.loadURL(url);
				});
				headersEl.appendChild(link);
			}
			root.appendChild(headersEl);
		}

		if (tags.length) {
			const tagsEl = document.createElement("div");
			tagsEl.className = "search-result-tags";
			for (const t of tags.slice(0, 8)) {
				const chip = document.createElement("span");
				chip.className = "meta-chip tag-chip";
				chip.textContent = t.startsWith("#") ? t : `#${t}`;
				if (this.textMatchesTerms(t, terms)) {
					chip.classList.add("match");
				}
				tagsEl.appendChild(chip);
			}
			root.appendChild(tagsEl);
		}

		return root;
	}

	private textMatchesTerms(text: string, terms: string[]): boolean {
		const lower = text.toLowerCase();
		return terms.some((t) => lower.includes(t));
	}

	private pickMatchingHeaders(headers: string[], terms: string[]): string[] {
		if (!headers.length || !terms.length) return [];
		const matches: string[] = [];
		for (const h of headers) {
			const lower = h.toLowerCase();
			if (terms.some((t) => lower.includes(t))) {
				matches.push(h);
			}
		}
		return matches;
	}
}

