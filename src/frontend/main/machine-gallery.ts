import { LinkHandler } from "./links";

type SortField = "score" | "title" | "datePublished" | "ctime";
type SortDirection = "asc" | "desc";

interface MachineCardData {
	index: number;
	element: HTMLElement;
	title: string;
	titleLower: string;
	systems: string[];
	systemsLower: string[];
	tags: string[];
	tagsLower: string[];
	difficulties: string[];
	difficultiesLower: string[];
	authors: string[];
	authorsLower: string[];
	releaseDate: Date | null;
	releaseYear: number | null;
	releaseText: string;
	createTime: Date | null;
	favorite: boolean;
	score: number | null;
	searchContent: string;
}

interface DynamicGroupConfig {
	values: Array<{ value: string; label: string; count: number }>;
	container: HTMLElement;
	toggleButton: HTMLButtonElement;
	limit: number;
	expanded: boolean;
}

interface FilterState {
	searchQuery: string;
	system: string;
	favorite: string;
	tag: string[];
	difficulty: string[];
	author: string[];
	releaseTime: string;
	createTime: string;
	customDateStart: string | null;
	customDateEnd: string | null;
	sortField: SortField;
	sortDirection: SortDirection;
	status: string;
	fcontinue: string;
}

/**
 * 负责在导出的网页中恢复靶机画廊的搜索与筛选能力
 */
export class MachineGalleryFilters {
	private static initializedRoots = new WeakSet<HTMLElement>();

	public static initialize(context?: HTMLElement): void {
		const scope = context ?? document.body;
		const galleries = Array.from(scope.querySelectorAll<HTMLElement>(".machine-gallery-grid"));
		if (galleries.length === 0) {
			return;
		}

		for (const gallery of galleries) {
			const root = gallery.parentElement as HTMLElement | null;
			if (!root || MachineGalleryFilters.initializedRoots.has(root)) {
				continue;
			}

			new MachineGalleryFilters(root, gallery);
			MachineGalleryFilters.initializedRoots.add(root);
		}
	}

	private readonly root: HTMLElement;
	private readonly gallery: HTMLElement;
	private readonly filtersContainer: HTMLElement;
	private readonly searchInput: HTMLInputElement | null;
	private readonly searchButton: HTMLButtonElement | null;
	private resultsCountEl: HTMLElement | null;
	private noResultsEl: HTMLElement | null = null;

	private readonly cardsData: MachineCardData[] = [];
	private readonly buttonGroups: Map<string, HTMLButtonElement[]> = new Map();
	private readonly dynamicGroups: Map<string, DynamicGroupConfig> = new Map();
	private readonly dynamicAllButtons: Map<string, HTMLButtonElement> = new Map();

	private readonly systemsSet: Set<string> = new Set();
	private readonly tagsCount: Map<string, number> = new Map();
	private readonly difficultiesSet: Set<string> = new Set();
	private readonly authorsCount: Map<string, number> = new Map();

	private state: FilterState = {
		searchQuery: "",
		system: "all",
		favorite: "all",
		tag: [],
		difficulty: [],
		author: [],
		releaseTime: "all",
		createTime: "all",
		customDateStart: null,
		customDateEnd: null,
		sortField: "score",
		sortDirection: "desc",
		status: "all",
		fcontinue: "all",
	};

	private selectedTagFiltersLower: string[] = [];
	private selectedDifficultyFiltersLower: string[] = [];
	private selectedAuthorFiltersLower: string[] = [];

	private constructor(root: HTMLElement, gallery: HTMLElement) {
		this.root = root;
		this.gallery = gallery;
		this.filtersContainer = this.ensureFiltersContainer();
		this.searchInput = this.root.querySelector<HTMLInputElement>("#machine-search-input");
		this.searchButton = this.root.querySelector<HTMLButtonElement>(".search-button");
		this.resultsCountEl = this.root.querySelector<HTMLElement>(".results-count");

		this.collectCards();
		this.buildFilters();
		this.setupSearch();
		this.applyFilters();
	}

	// ----------- 初始化与数据收集 -----------

	private ensureFiltersContainer(): HTMLElement {
		let container = this.root.querySelector<HTMLElement>(".filters-container");
		if (!container) {
			container = document.createElement("div");
			container.className = "filters-container";
			const toolbar = this.root.querySelector<HTMLElement>(".top-toolbar");
			if (toolbar?.nextSibling) {
				toolbar.parentElement?.insertBefore(container, toolbar.nextSibling);
			} else {
				this.root.insertBefore(container, this.gallery);
			}
		}
		container.innerHTML = "";
		return container;
	}

	private collectCards(): void {
		const cards = Array.from(this.gallery.querySelectorAll<HTMLElement>(".machine-card"));
		cards.forEach((card, index) => {
			const titleEl = card.querySelector<HTMLAnchorElement>(".machine-title");
			const osEl = card.querySelector<HTMLElement>(".machine-os-info");
			const tagEl = card.querySelector<HTMLElement>(".machine-extra-info");
			const difficultyEl = card.querySelector<HTMLElement>(".machine-difficulty-info");
			const authorEl = card.querySelector<HTMLElement>(".machine-creator");
			const dateEl = card.querySelector<HTMLElement>(".machine-date");
			const ratingEl = card.querySelector<HTMLElement>(".machine-rating");
			const favoriteEl = card.querySelector<HTMLElement>(".machine-status-tag");

			const title = titleEl?.textContent?.trim() ?? "";
			const systems = this.splitValues(osEl?.textContent, "系统");
			systems.forEach((value) => this.systemsSet.add(value));

			const tags = this.splitValues(tagEl?.textContent);
			tags.forEach((value) => this.incrementCount(this.tagsCount, value));

			const difficulties = this.splitValues(difficultyEl?.textContent, "难度");
			difficulties.forEach((value) => this.difficultiesSet.add(value));

			const authors = this.splitValues(authorEl?.textContent, "作者");
			authors.forEach((value) => this.incrementCount(this.authorsCount, value));

			const releaseText = dateEl?.textContent?.trim() ?? "";
			const releaseDate = this.parseDateFromText(releaseText);
			const releaseYear = releaseDate?.getFullYear() ?? null;

			const linkTarget = titleEl?.getAttribute("href") ?? titleEl?.dataset.href ?? "";
			const createTime = this.resolveCreateTimeFromCard(card) ?? this.resolveCreateTime(linkTarget);

			const favorite = Boolean(favoriteEl && favoriteEl.textContent && favoriteEl.textContent.includes("💖"));

			const scoreMatch = ratingEl?.textContent?.match(/([0-9]+(?:\.[0-9]+)?)/);
			const score = scoreMatch ? Number.parseFloat(scoreMatch[1]) : null;

			const searchPieces = [
				title,
				systems.join(" "),
				tags.join(" "),
				difficulties.join(" "),
				authors.join(" "),
				releaseText,
				card.textContent ?? "",
			];

			const data: MachineCardData = {
				index,
				element: card,
				title,
				titleLower: title.toLowerCase(),
				systems,
				systemsLower: systems.map((v) => v.toLowerCase()),
				tags,
				tagsLower: tags.map((v) => v.toLowerCase()),
				difficulties,
				difficultiesLower: difficulties.map((v) => v.toLowerCase()),
				authors,
				authorsLower: authors.map((v) => v.toLowerCase()),
				releaseDate,
				releaseYear,
				releaseText,
				createTime,
				favorite,
				score,
				searchContent: searchPieces.join(" \n ").toLowerCase(),
			};

			this.cardsData.push(data);
		});
	}

	private splitValues(source?: string | null, prefix?: string): string[] {
		if (!source) return [];
		let text = source.trim();
		if (prefix && text.startsWith(prefix)) {
			const separatorIndex = text.indexOf(":");
			if (separatorIndex > -1) {
				text = text.substring(separatorIndex + 1).trim();
			} else {
				text = text.replace(prefix, "");
			}
		}

		return text
			.split(/[\s,，|\/]+/)
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
	}

	private incrementCount(map: Map<string, number>, value: string): void {
		if (!value) return;
		const prev = map.get(value) ?? 0;
		map.set(value, prev + 1);
	}

	private parseDateFromText(text: string): Date | null {
		if (!text) return null;

		const patterns: RegExp[] = [
			/\d{4}[年\/.\-]\d{1,2}[月\/.\-]\d{1,2}(?:[日号])?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/,
			/\d{4}[年\/.\-]\d{1,2}(?:[月])?/, // 年-月
			/\d{8}/, // 紧凑格式 YYYYMMDD
			/\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}/, // 常规分隔符
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (!match) continue;
			const [value] = match;
			const parsed = this.parseDateString(value);
			if (parsed) {
				return parsed;
			}
		}

		return null;
	}

	private parseDateString(raw: string): Date | null {
		if (!raw) return null;
		const value = raw.trim();
		if (!value) return null;

		if (/^\d+$/.test(value)) {
			const numeric = Number(value);
			if (!Number.isNaN(numeric)) {
				const timestamp = value.length >= 13 ? numeric : numeric * 1000;
				const date = new Date(timestamp);
				return Number.isNaN(date.getTime()) ? null : date;
			}
		}

		if (/^\d{8}$/.test(value)) {
			const normalized = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
			const date = new Date(normalized);
			if (!Number.isNaN(date.getTime())) return date;
		}

		let normalized = value
			.replace(/[年\/.]/g, "-")
			.replace(/月/g, "-")
			.replace(/[日号]/g, "")
			.replace(/\s+/g, " ")
			.trim();

		if (/^\d{4}-\d{1,2}$/.test(normalized)) {
			normalized = `${normalized}-01`;
		}

		if (/^\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)) {
			normalized = normalized.replace(" ", "T");
		}

		normalized = normalized.replace(/\//g, "-");

		const direct = new Date(normalized);
		if (!Number.isNaN(direct.getTime())) {
			return direct;
		}

		const fallback = new Date(Date.parse(normalized));
		return Number.isNaN(fallback.getTime()) ? null : fallback;
	}

	private resolveCreateTimeFromCard(card: HTMLElement): Date | null {
		const attributeDate = this.extractDateFromElementAttributes(card);
		if (attributeDate) return attributeDate;

		const attributeSelectors = "[data-created],[data-create-time],[data-created-time],[data-created_at],[data-created-date],[data-createtime],[data-createdat]";
		const dataElements = Array.from(card.querySelectorAll<HTMLElement>(attributeSelectors));
		for (const element of dataElements) {
			const date = this.extractDateFromElementAttributes(element) ?? this.extractDateFromElementText(element);
			if (date) return date;
		}

		const keywordSelectors = [
			".machine-created",
			".machine-meta",
			".machine-info",
			".machine-date",
			".machine-extra-info",
			".machine-header",
			".machine-details",
		];

		for (const selector of keywordSelectors) {
			const element = card.querySelector<HTMLElement>(selector);
			if (!element) continue;
			const date = this.extractDateFromElementText(element);
			if (date) return date;
		}

		return this.extractDateFromElementText(card);
	}

	private extractDateFromElementAttributes(element: HTMLElement): Date | null {
		const datasetEntries = Object.entries(element.dataset ?? {});
		for (const [key, value] of datasetEntries) {
			if (!value) continue;
			const lowerKey = key.toLowerCase();
			if (!lowerKey.includes("created") && !lowerKey.includes("ctime")) continue;
			const parsed = this.parseDateString(value);
			if (parsed) return parsed;
		}

		const attributes = Array.from(element.attributes);
		for (const attr of attributes) {
			const name = attr.name.toLowerCase();
			if (!name.includes("created") && !name.includes("ctime")) continue;
			const parsed = this.parseDateString(attr.value);
			if (parsed) return parsed;
		}

		return null;
	}

	private extractDateFromElementText(element: HTMLElement | null): Date | null {
		if (!element) return null;
		const text = element.textContent ?? "";
		if (!text) return null;
		if (!/(创建|添加|created|create)/i.test(text)) return null;
		return this.parseDateFromText(text);
	}

	private resolveCreateTime(target: string): Date | null {
		if (!target) return null;
		let normalized = LinkHandler.getPathnameFromURL(target);
		const metadata = ObsidianSite.metadata;
		if (!metadata) return null;

		if (!normalized.endsWith(".html")) {
			const mapped = metadata.sourceToTarget?.[normalized];
			if (mapped) {
				normalized = mapped;
			}
		}

		const fileInfo = metadata.fileInfo?.[normalized];
		if (!fileInfo?.createdTime) return null;
		const created = new Date(fileInfo.createdTime);
		return Number.isNaN(created.getTime()) ? null : created;
	}

	// ----------- 构建筛选 UI -----------

	private buildFilters(): void {
		this.buildSystemRow();
		this.buildFavoriteRow();
		this.buildTagRow();
		this.buildDifficultyRow();
		this.buildAuthorRow();
		this.buildReleaseTimeRow();
		this.buildCreateTimeRow();
		this.buildSortRow();
		this.ensureDatePicker();
	}

	private buildSystemRow(): void {
		const row = this.createRowContainer();
		row.appendChild(this.createFilterButton("system", "all", "全部系统", true));

		Array.from(this.systemsSet)
			.sort((a, b) => a.localeCompare(b))
			.forEach((value) => {
				row.appendChild(this.createFilterButton("system", value, value));
			});

		this.filtersContainer.appendChild(row);
	}

	private buildFavoriteRow(): void {
		const row = this.createRowContainer();
		row.appendChild(this.createFilterButton("favorite", "all", "全部收藏", true));
		row.appendChild(this.createFilterButton("favorite", "true", "已收藏 💖"));
		row.appendChild(this.createFilterButton("favorite", "false", "未收藏"));
		this.filtersContainer.appendChild(row);
	}

	private buildTagRow(): void {
		const tags = Array.from(this.tagsCount.entries()).filter(([value]) => value.length > 0);
		if (tags.length === 0) return;

		const wrapper = document.createElement("div");
		wrapper.className = "filter-item-column";

		const header = this.createRowContainer();
		const allBtn = this.createFilterButton("tag", "all", "所有知识点", true);
		header.appendChild(allBtn);
		this.dynamicAllButtons.set("tag", allBtn);

		const toggleBtn = this.createToggleButton("tag");
		header.appendChild(toggleBtn);

		const buttonsContainer = document.createElement("div");
		buttonsContainer.className = "filter-item filter-buttons-dynamic-container";

		wrapper.appendChild(header);
		wrapper.appendChild(buttonsContainer);
		this.filtersContainer.appendChild(wrapper);

		const values = tags
			.map(([value, count]) => ({ value, count, label: value }))
			.sort((a, b) => {
				if (b.count !== a.count) return b.count - a.count;
				return a.value.localeCompare(b.value);
			});

		this.dynamicGroups.set("tag", {
			values,
			container: buttonsContainer,
			toggleButton: toggleBtn,
			limit: 10,
			expanded: false,
		});

		this.renderDynamicGroup("tag");
	}

	private buildDifficultyRow(): void {
		const row = this.createRowContainer();
		row.appendChild(this.createFilterButton("difficulty", "all", "全部难度", true));

		Array.from(this.difficultiesSet)
			.sort((a, b) => a.localeCompare(b))
			.forEach((value) => {
				row.appendChild(this.createFilterButton("difficulty", value, value));
			});

		this.filtersContainer.appendChild(row);
	}

	private buildAuthorRow(): void {
		const authors = Array.from(this.authorsCount.entries()).filter(([value]) => value.length > 0);
		if (authors.length === 0) return;

		const wrapper = document.createElement("div");
		wrapper.className = "filter-item-column";

		const header = this.createRowContainer();
		const allBtn = this.createFilterButton("author", "all", "全部作者", true);
		header.appendChild(allBtn);
		this.dynamicAllButtons.set("author", allBtn);

		const toggleBtn = this.createToggleButton("author");
		header.appendChild(toggleBtn);

		const buttonsContainer = document.createElement("div");
		buttonsContainer.className = "filter-item filter-buttons-dynamic-container";

		wrapper.appendChild(header);
		wrapper.appendChild(buttonsContainer);
		this.filtersContainer.appendChild(wrapper);

		const values = authors
			.map(([value, count]) => ({ value, count, label: value }))
			.sort((a, b) => {
				if (b.count !== a.count) return b.count - a.count;
				return a.value.localeCompare(b.value);
			});

		this.dynamicGroups.set("author", {
			values,
			container: buttonsContainer,
			toggleButton: toggleBtn,
			limit: 5,
			expanded: false,
		});

		this.renderDynamicGroup("author");
	}

	private buildReleaseTimeRow(): void {
		const options: Array<{ value: string; label: string }> = [
			{ value: "all", label: "发布时间" },
			{ value: "after2024", label: "2024之后" },
			{ value: "2024-2021", label: "2024-2021" },
			{ value: "2021-2018", label: "2021-2018" },
			{ value: "2018-2015", label: "2018-2015" },
			{ value: "before2015", label: "2015之前" },
		];

		const row = this.createRowContainer();
		options.forEach((option, index) => {
			const btn = this.createFilterButton("releaseTime", option.value, option.label, index === 0);
			row.appendChild(btn);
		});

		this.filtersContainer.appendChild(row);
	}

	private buildCreateTimeRow(): void {
		const options: Array<{ value: string; label: string }> = [
			{ value: "all", label: "添加时间" },
			{ value: "week", label: "最近一周" },
			{ value: "month", label: "最近一月" },
			{ value: "quarter", label: "最近三月" },
			{ value: "year", label: "最近一年" },
			{ value: "custom", label: "自定义" },
		];

		const row = this.createRowContainer();
		options.forEach((option, index) => {
			const btn = this.createFilterButton("createTime", option.value, option.label, index === 0);
			row.appendChild(btn);
		});

		this.filtersContainer.appendChild(row);
	}

	private buildSortRow(): void {
		const options: Array<{ label: string; field: SortField; direction: SortDirection }> = [
			{ label: "评分 ↓", field: "score", direction: "desc" },
			{ label: "评分 ↑", field: "score", direction: "asc" },
			{ label: "标题 A-Z", field: "title", direction: "asc" },
			{ label: "标题 Z-A", field: "title", direction: "desc" },
			{ label: "发布日期 新→旧", field: "datePublished", direction: "desc" },
			{ label: "发布日期 旧→新", field: "datePublished", direction: "asc" },
			{ label: "创建时间 新→旧", field: "ctime", direction: "desc" },
			{ label: "创建时间 旧→新", field: "ctime", direction: "asc" },
		];

		const row = this.createRowContainer();
		options.forEach((option) => {
			const btn = this.createFilterButton("sort", `${option.field}:${option.direction}`, option.label);
			btn.dataset.sortField = option.field;
			btn.dataset.sortDirection = option.direction;
			const isActive = option.field === this.state.sortField && option.direction === this.state.sortDirection;
			this.setButtonActiveState(btn, isActive);
			row.appendChild(btn);
		});

		this.filtersContainer.appendChild(row);
	}

	private ensureDatePicker(): void {
		let container = this.root.querySelector<HTMLElement>("#custom-date-picker");
		if (!container) {
			container = document.createElement("div");
			container.id = "custom-date-picker";
			container.style.display = "none";
			container.className = "filter-item";
			this.filtersContainer.appendChild(container);
		} else {
			container.innerHTML = "";
		}

		const startLabel = document.createElement("span");
		startLabel.textContent = "开始日期:";

		const startInput = document.createElement("input");
		startInput.type = "date";
		startInput.id = "start-date";

		const endLabel = document.createElement("span");
		endLabel.textContent = "结束日期:";
		endLabel.style.marginLeft = "10px";

		const endInput = document.createElement("input");
		endInput.type = "date";
		endInput.id = "end-date";

		const applyBtn = document.createElement("button");
		applyBtn.textContent = "应用";
		applyBtn.className = "filter-btn";
		applyBtn.style.marginLeft = "10px";
		applyBtn.addEventListener("click", () => {
			this.state.customDateStart = startInput.value || null;
			this.state.customDateEnd = endInput.value || null;
			this.applyFilters();
		});

		container.append(startLabel, startInput, endLabel, endInput, applyBtn);
	}

	private createRowContainer(): HTMLElement {
		const row = document.createElement("div");
		row.className = "filter-item";
		return row;
	}

	private createFilterButton(type: string, value: string, label: string, active = false): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.className = "filter-btn";
		btn.type = "button";
		btn.textContent = label;
		btn.dataset.filterType = type;
		btn.dataset.filterValue = value;
		this.setButtonActiveState(btn, active);
		btn.addEventListener("click", () => this.onFilterButtonClick(btn));

		this.registerButton(type, btn);
		return btn;
	}

	// 统一处理筛选按钮的激活状态，确保样式与ARIA语义同步
	private setButtonActiveState(button: HTMLButtonElement, isActive: boolean): void {
		button.classList.toggle("active", isActive);
		button.setAttribute("aria-pressed", isActive ? "true" : "false");
	}

	// 判断筛选类型是否为多选类型
	private isMultiSelectType(type: string): type is "tag" | "difficulty" | "author" {
		return type === "tag" || type === "difficulty" || type === "author";
	}

	// 获取多选类型当前的选中值列表
	private getMultiSelectState(type: "tag" | "difficulty" | "author"): string[] {
		switch (type) {
			case "tag":
				return this.state.tag;
			case "difficulty":
				return this.state.difficulty;
			case "author":
				return this.state.author;
		}
		return [];
	}

	// 更新多选类型的选中值列表
	private setMultiSelectState(type: "tag" | "difficulty" | "author", values: string[]): void {
		switch (type) {
			case "tag":
				this.state.tag = values;
				break;
			case "difficulty":
				this.state.difficulty = values;
				break;
			case "author":
				this.state.author = values;
				break;
		}
	}

	// 根据筛选类型返回当前状态值，便于统一处理
	private getStringStateForType(type: string): string | null {
		switch (type) {
			case "system":
				return this.state.system;
			case "favorite":
				return this.state.favorite;
			case "releaseTime":
				return this.state.releaseTime;
			case "createTime":
				return this.state.createTime;
			case "status":
				return this.state.status;
			case "fcontinue":
				return this.state.fcontinue;
			default:
				return null;
		}
	}

	// 判断某个按钮是否应处于激活状态
	private isValueActive(type: string, value: string): boolean {
		if (this.isMultiSelectType(type)) {
			const selected = this.getMultiSelectState(type);
			if (value === "all") {
				return selected.length === 0;
			}
			return selected.some((item) => item.toLowerCase() === value.toLowerCase());
		}

		const stateValue = this.getStringStateForType(type);
		return stateValue !== null && stateValue === value;
	}

	// 统一处理多选筛选的选中状态，包括标签、难度、作者
	private handleMultiSelectClick(type: "tag" | "difficulty" | "author", value: string): void {
		if (value === "all") {
			this.setMultiSelectState(type, []);
			return;
		}

		const normalized = value.toLowerCase();
		const current = this.getMultiSelectState(type);
		const exists = current.some((item) => item.toLowerCase() === normalized);
		if (exists) {
			const next = current.filter((item) => item.toLowerCase() !== normalized);
			this.setMultiSelectState(type, next);
		} else {
			this.setMultiSelectState(type, [...current, value]);
		}
	}

	private createToggleButton(type: string): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.className = "filter-btn toggle-btn";
		btn.type = "button";
		btn.textContent = "展开更多";
		btn.addEventListener("click", () => {
			const group = this.dynamicGroups.get(type);
			if (!group) return;
			group.expanded = !group.expanded;
			this.renderDynamicGroup(type);
		});
		return btn;
	}

	private renderDynamicGroup(type: string): void {
		const group = this.dynamicGroups.get(type);
		if (!group) return;

		group.container.innerHTML = "";
		this.resetButtonGroup(type);

		const visibleValues = group.expanded ? group.values : group.values.slice(0, group.limit);
		visibleValues.forEach((entry) => {
			const btn = this.createFilterButton(type, entry.value, entry.label, this.isValueActive(type, entry.value));
			btn.title = `共 ${entry.count} 条记录`;
			group.container.appendChild(btn);
		});

		if (group.values.length > group.limit) {
			const remain = group.values.length - group.limit;
			group.toggleButton.style.display = "inline-block";
			group.toggleButton.textContent = group.expanded ? "收起" : `展开更多 (${remain}+)`;
		} else {
			group.toggleButton.style.display = "none";
		}

		this.updateActiveButtons(type);
	}

	private resetButtonGroup(type: string): void {
		const allBtn = this.dynamicAllButtons.get(type);
		if (allBtn) {
			this.buttonGroups.set(type, [allBtn]);
		} else if (this.buttonGroups.has(type)) {
			this.buttonGroups.set(type, []);
		}
	}

	private registerButton(type: string, button: HTMLButtonElement): void {
		const group = this.buttonGroups.get(type) ?? [];
		group.push(button);
		this.buttonGroups.set(type, group);
	}

	// ----------- 搜索框绑定 -----------

	private setupSearch(): void {
		if (this.searchInput) {
			this.searchInput.addEventListener("input", () => {
				this.state.searchQuery = this.searchInput?.value.trim().toLowerCase() ?? "";
				this.applyFilters();
			});
			this.searchInput.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					this.state.searchQuery = this.searchInput?.value.trim().toLowerCase() ?? "";
					this.applyFilters();
				}
			});
		}

		if (this.searchButton) {
			this.searchButton.addEventListener("click", () => {
				this.state.searchQuery = this.searchInput?.value.trim().toLowerCase() ?? "";
				this.applyFilters();
			});
		}
	}

	// ----------- 交互核心逻辑 -----------

	private onFilterButtonClick(button: HTMLButtonElement): void {
		const type = button.dataset.filterType ?? "";
		const value = button.dataset.filterValue ?? "";

		if (!type) return;

		if (this.isMultiSelectType(type)) {
			this.handleMultiSelectClick(type, value);
			this.updateActiveButtons(type);
			this.applyFilters();
			return;
		}

		if (type === "sort") {
			this.state.sortField = (button.dataset.sortField as SortField) ?? "score";
			this.state.sortDirection = (button.dataset.sortDirection as SortDirection) ?? "desc";
			this.updateActiveButtons(type, button);
			this.applyFilters();
			return;
		}

		if (type === "createTime") {
			this.state.createTime = value;
			const datePicker = this.root.querySelector<HTMLElement>("#custom-date-picker");
			if (datePicker) {
				datePicker.style.display = value === "custom" ? "flex" : "none";
			}
			if (value !== "custom") {
				this.state.customDateStart = null;
				this.state.customDateEnd = null;
			}
			this.updateActiveButtons(type, button);
			this.applyFilters();
			return;
		}

		if (type === "releaseTime") {
			this.state.releaseTime = value;
			this.updateActiveButtons(type, button);
			this.applyFilters();
			return;
		}

		const key = type as keyof FilterState;
		if (key in this.state) {
			const current = this.state[key];
			if (typeof current === "string") {
				(this.state[key] as unknown as string) = value;
			}
			this.updateActiveButtons(type, button);
			this.applyFilters();
		}
	}

	private updateActiveButtons(type: string, activeButton?: HTMLButtonElement): void {
		const buttons = this.buttonGroups.get(type) ?? [];
		if (buttons.length === 0) return;

		if (this.isMultiSelectType(type)) {
			const selected = new Set(this.getMultiSelectState(type).map((item) => item.toLowerCase()));
			const isAllActive = selected.size === 0;
			buttons.forEach((btn) => {
				if (btn.classList.contains("toggle-btn")) return;
				const value = (btn.dataset.filterValue ?? "").toLowerCase();
				const isActive = value === "all" ? isAllActive : selected.has(value);
				this.setButtonActiveState(btn, isActive);
			});
			return;
		}

		if (type === "sort") {
			buttons.forEach((btn) => {
				if (btn.classList.contains("toggle-btn")) return;
				const field = btn.dataset.sortField as SortField | undefined;
				const direction = btn.dataset.sortDirection as SortDirection | undefined;
				const isActive = field === this.state.sortField && direction === this.state.sortDirection;
				this.setButtonActiveState(btn, isActive);
			});
			return;
		}

		const activeValue = this.getStringStateForType(type);
		buttons.forEach((btn) => {
			if (btn.classList.contains("toggle-btn")) return;
			if (activeButton) {
				this.setButtonActiveState(btn, btn === activeButton);
				return;
			}
			if (activeValue === null) return;
			const value = btn.dataset.filterValue ?? "";
			this.setButtonActiveState(btn, value === activeValue);
		});
	}

	private applyFilters(): void {
		const query = this.state.searchQuery;
		this.selectedTagFiltersLower = this.state.tag.map((tag) => tag.toLowerCase());
		this.selectedDifficultyFiltersLower = this.state.difficulty.map((item) => item.toLowerCase());
		this.selectedAuthorFiltersLower = this.state.author.map((item) => item.toLowerCase());

		const filtered = this.cardsData.filter((card) => this.matchesCard(card, query));
		const sorted = filtered.sort((a, b) => this.compareCards(a, b));

		const visibleSet = new Set(sorted.map((item) => item.element));

		this.cardsData.forEach((card) => {
			if (visibleSet.has(card.element)) {
				card.element.style.display = "";
			} else {
				card.element.style.display = "none";
			}
		});

		sorted.forEach((card) => {
			this.gallery.appendChild(card.element);
		});

		this.updateResultsCount(sorted.length);
	}

	private matchesCard(card: MachineCardData, query: string): boolean {
		if (this.state.system !== "all" && !card.systemsLower.includes(this.state.system.toLowerCase())) {
			return false;
		}

		if (this.state.favorite === "true" && !card.favorite) {
			return false;
		}
		if (this.state.favorite === "false" && card.favorite) {
			return false;
		}

		if (this.selectedTagFiltersLower.length > 0) {
			const missingTag = this.selectedTagFiltersLower.some((tag) => !card.tagsLower.includes(tag));
			if (missingTag) {
				return false;
			}
		}

		if (this.selectedDifficultyFiltersLower.length > 0) {
			const hasDifficulty = this.selectedDifficultyFiltersLower.some((item) => card.difficultiesLower.includes(item));
			if (!hasDifficulty) {
				return false;
			}
		}

		if (this.selectedAuthorFiltersLower.length > 0) {
			const hasAuthor = this.selectedAuthorFiltersLower.some((item) => card.authorsLower.includes(item));
			if (!hasAuthor) {
				return false;
			}
		}

		if (!this.matchesReleaseTime(card)) {
			return false;
		}

		if (!this.matchesCreateTime(card)) {
			return false;
		}

		if (query && query.length > 0) {
			return card.searchContent.includes(query);
		}

		return true;
	}

	private matchesReleaseTime(card: MachineCardData): boolean {
		const filter = this.state.releaseTime;
		if (filter === "all") return true;
		const year = card.releaseYear;
		if (!year) return false;

		switch (filter) {
			case "after2024":
				return year > 2024;
			case "2024-2021":
				return year >= 2021 && year <= 2024;
			case "2021-2018":
				return year >= 2018 && year < 2021;
			case "2018-2015":
				return year >= 2015 && year < 2018;
			case "before2015":
				return year < 2015;
			default:
				return true;
		}
	}

	private matchesCreateTime(card: MachineCardData): boolean {
		const filter = this.state.createTime;
		if (filter === "all") return true;

		const ctime = card.createTime;
		if (!ctime) return false;

		const now = new Date();
		let cutoff: Date | null = null;

		switch (filter) {
			case "week":
				cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case "month":
				cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
				break;
			case "quarter":
				cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
				break;
			case "year":
				cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
				break;
			case "custom":
				return this.matchesCustomRange(ctime);
			default:
				return true;
		}

		if (!cutoff) return true;
		return ctime >= cutoff;
	}

	private matchesCustomRange(ctime: Date): boolean {
		const start = this.state.customDateStart ? new Date(this.state.customDateStart) : null;
		const end = this.state.customDateEnd ? new Date(this.state.customDateEnd) : null;

		if (start && Number.isNaN(start.getTime())) return false;
		if (end && Number.isNaN(end.getTime())) return false;

		if (start) {
			start.setHours(0, 0, 0, 0);
			if (ctime < start) return false;
		}
		if (end) {
			end.setHours(23, 59, 59, 999);
			if (ctime > end) return false;
		}

		return true;
	}

	private compareCards(a: MachineCardData, b: MachineCardData): number {
		const field = this.state.sortField;
		const direction = this.state.sortDirection;

		if (field === "title") {
			const result = a.titleLower.localeCompare(b.titleLower);
			return direction === "asc" ? result : -result;
		}

		let valueA: number;
		let valueB: number;

		switch (field) {
			case "score":
				valueA = a.score ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				valueB = b.score ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				break;
			case "datePublished":
				valueA = a.releaseDate?.getTime() ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				valueB = b.releaseDate?.getTime() ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				break;
			case "ctime":
				valueA = a.createTime?.getTime() ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				valueB = b.createTime?.getTime() ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				break;
			default:
				valueA = 0;
				valueB = 0;
		}

		if (valueA === valueB) {
			return a.index - b.index;
		}

		if (direction === "asc") {
			return valueA - valueB;
		}
		return valueB - valueA;
	}

	private updateResultsCount(count: number): void {
		if (!this.resultsCountEl) {
			this.resultsCountEl = document.createElement("div");
			this.resultsCountEl.className = "results-count";
			this.filtersContainer.after(this.resultsCountEl);
		}
		this.resultsCountEl.textContent = `找到 ${count} 个结果`;

		if (!this.noResultsEl) {
			this.noResultsEl = document.createElement("div");
			this.noResultsEl.className = "no-results";
			this.noResultsEl.textContent = "没有找到符合条件的媒体";
			this.resultsCountEl.after(this.noResultsEl);
		}

		this.noResultsEl.style.display = count === 0 ? "block" : "none";
	}
}


