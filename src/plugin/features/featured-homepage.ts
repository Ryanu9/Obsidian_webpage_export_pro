import { CachedMetadata, FrontMatterCache, TFile } from "obsidian";
import { AssetLoader } from "src/plugin/asset-loaders/base-asset";
import { ExportLog, _MarkdownRendererInternal, MarkdownRendererAPI } from "src/plugin/render-api/render-api";
import { Settings } from "src/plugin/settings/settings";
import { Attachment } from "src/plugin/utils/downloadable";
import { Path } from "src/plugin/utils/path";
import { Webpage } from "src/plugin/website/webpage";
import { Website } from "src/plugin/website/website";
import {
	FeaturedHomepageLayout,
	FeaturedHomepageOptions,
	FeaturedHomepageSortBy,
} from "src/shared/features/featured-homepage";

export interface FeaturedHomepageItem {
	sourcePath: string;
	targetPath: string;
	title: string;
	date: number;
	tags: string[];
	category: string;
	excerpt: string;
	imageURL: string;
	imageAlt: string;
	order: number;
}

export class FeaturedHomepage {
	private static readonly imageExtensions = new Set([
		"png",
		"jpg",
		"jpeg",
		"gif",
		"webp",
		"svg",
		"avif",
		"bmp",
		"tiff",
		"ico",
	]);

	public static async collect(website: Website): Promise<FeaturedHomepageItem[]> {
		const options = website.exportOptions.featuredHomepageOptions;
		if (!options.enabled) return [];
		const homepageSourceFile = this.findHomepageSourceFile(website.filesToExport, options, website);

		const items: FeaturedHomepageItem[] = [];
		for (const file of website.filesToExport) {
			if (!MarkdownRendererAPI.isConvertable(file.extension)) continue;
			if (homepageSourceFile && this.isSameVaultPath(file.path, homepageSourceFile.path)) continue;

			const cache = app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter ?? {};
			if (!this.isTruthy(frontmatter[options.featuredProperty])) continue;

			const targetPath = this.getTargetPath(website, file).path;
			if (targetPath == this.normalizeTargetPath(options.homepageTargetPath, website)) continue;

			items.push({
				sourcePath: file.path,
				targetPath,
				title: await this.getTitle(file, frontmatter),
				date: this.getDate(file, frontmatter, options),
				tags: this.getTags(cache, frontmatter),
				category: this.getCategory(frontmatter, options),
				excerpt: await this.getExcerpt(file, frontmatter, options),
				imageURL: await this.resolveFeaturedImage(file, frontmatter, website, options),
				imageAlt: this.toString(frontmatter["imageAlt"]) || await this.getTitle(file, frontmatter),
				order: this.getOrder(frontmatter, options),
			});
		}

		return this.sortItems(items, options).slice(0, Math.max(0, options.maxItems));
	}

	public static isHomepage(webpage: Webpage, options: FeaturedHomepageOptions, website: Website): boolean {
		return webpage.targetPath.path == this.normalizeTargetPath(options.homepageTargetPath, website);
	}

	public static findHomepage(webpages: Webpage[], options: FeaturedHomepageOptions, website: Website): Webpage | undefined {
		const sourcePath = this.normalizeHomepageSourcePath(options.homepageSourcePath);
		if (sourcePath) {
			const sourceHomepage = webpages.find((webpage) => this.isSameVaultPath(webpage.source.path, sourcePath));
			if (sourceHomepage) return sourceHomepage;
		}

		const target = this.normalizeTargetPath(options.homepageTargetPath, website);
		const configuredHomepage = webpages.find((webpage) => webpage.targetPath.path == target);
		if (configuredHomepage) return configuredHomepage;

		const rootIndexPage = webpages.find((webpage) => webpage.targetPath.depth <= 0 && webpage.targetPath.basename.toLowerCase().startsWith("index"));
		if (rootIndexPage) return rootIndexPage;

		const anyIndexPage = webpages.find((webpage) => webpage.targetPath.basename.toLowerCase().startsWith("index"));
		if (anyIndexPage) return anyIndexPage;

		return webpages.find((webpage) => webpage.targetPath.depth <= 0);
	}

	public static findHomepageSourceFile(files: TFile[], options: FeaturedHomepageOptions, website: Website): TFile | undefined {
		files = files.filter((file) => MarkdownRendererAPI.isConvertable(file.extension));
		const sourcePath = this.normalizeHomepageSourcePath(options.homepageSourcePath);
		if (sourcePath) return files.find((file) => this.isSameVaultPath(file.path, sourcePath));

		const target = this.normalizeTargetPath(options.homepageTargetPath, website);
		const configuredHomepage = files.find((file) => this.getTargetPath(website, file).path == target);
		if (configuredHomepage) return configuredHomepage;

		const rootIndexFile = files.find((file) => {
			const targetPath = this.getTargetPath(website, file);
			return targetPath.depth <= 0 && targetPath.basename.toLowerCase().startsWith("index");
		});
		if (rootIndexFile) return rootIndexFile;

		return files.find((file) => this.getTargetPath(website, file).depth <= 0);
	}

	public static applyHomepageTargetPath(webpage: Webpage, options: FeaturedHomepageOptions, website: Website): void {
		webpage.targetPath = this.getHomepageTargetPath(options, website);
	}

	public static getHomepageTargetPath(options: FeaturedHomepageOptions, website: Website): Path {
		const targetPath = new Path(options.homepageTargetPath || "index.html", website.destination.path);
		targetPath.setExtension("html");
		return targetPath.slugify(website.exportOptions.slugifyPaths);
	}

	public static inject(webpage: Webpage, items: FeaturedHomepageItem[], options: FeaturedHomepageOptions, clearTemplateContent: boolean = false): void {
		const doc = webpage.pageDocument;
		if (!doc) return;

		doc.getElementById(options.featureId)?.remove();
		if (clearTemplateContent) this.clearTemplateContent(doc);
		if (items.length == 0 && options.hideWhenEmpty) return;

		const section = this.createSection(doc, items, options);
		const marker = doc.querySelector("[data-featured-homepage]");
		if (marker) {
			marker.replaceWith(section);
			return;
		}

		const inserted = options.insertFeature(doc.documentElement, section);
		if (inserted) return;

		const fallbackContainer = doc.querySelector(".markdown-preview-sizer") ?? doc.querySelector("#center-content") ?? doc.body;
		fallbackContainer.prepend(section);
	}

	public static isExplicitHomepageSource(webpage: Webpage, options: FeaturedHomepageOptions): boolean {
		const sourcePath = this.normalizeHomepageSourcePath(options.homepageSourcePath);
		return sourcePath != "" && this.isSameVaultPath(webpage.source.path, sourcePath);
	}

	private static clearTemplateContent(doc: Document): void {
		const contentRoot = doc.querySelector(".markdown-preview-sizer") as HTMLElement
			?? doc.querySelector(".obsidian-document") as HTMLElement
			?? doc.querySelector("#center-content") as HTMLElement;
		if (!contentRoot) return;

		const footer = this.ensureFooter(doc, contentRoot);
		Array.from(contentRoot.children).forEach((child) => {
			if (child == footer) return;
			child.remove();
		});
		contentRoot.appendChild(footer);
	}

	private static ensureFooter(doc: Document, container: HTMLElement): HTMLElement {
		let footer = container.querySelector(":scope > .footer") as HTMLElement | null;
		footer ??= doc.createElement("div");
		footer.classList.add("footer");
		if (!footer.querySelector(":scope > .data-bar")) footer.createDiv({ cls: "data-bar" });
		return footer;
	}

	private static createSection(doc: Document, items: FeaturedHomepageItem[], options: FeaturedHomepageOptions): HTMLElement {
		const section = doc.createElement("section");
		section.id = options.featureId;
		section.className = `feature featured-homepage featured-homepage--${options.layout}`;

		const header = section.createDiv({ cls: "feature-header featured-homepage__header" });
		const title = header.createDiv({ cls: "feature-title featured-homepage__title" });
		title.textContent = options.displayTitle || "Featured";
		if (options.subtitle.trim().length > 0) {
			const subtitle = header.createEl("p", { cls: "featured-homepage__subtitle" });
			subtitle.textContent = options.subtitle;
		}

		const grid = section.createDiv({ cls: "featured-homepage__grid" });
		items.forEach((item, index) => {
			grid.appendChild(this.createCard(doc, item, options, index));
		});

		return section;
	}

	private static createCard(doc: Document, item: FeaturedHomepageItem, options: FeaturedHomepageOptions, index: number): HTMLElement {
		const isHero = options.showHeroCard && index == 0 && options.layout == FeaturedHomepageLayout.Magazine;
		const card = doc.createElement("a");
		card.className = `internal-link featured-card${isHero ? " featured-card--hero" : ""}${item.imageURL ? " has-image" : " no-image"}`;
		card.setAttribute("href", item.targetPath);
		card.setAttribute("aria-label", `Read ${item.title}`);

		const content = card.createDiv({ cls: "featured-card__content" });
		const media = content.createDiv({ cls: "featured-card__media" });
		if (item.imageURL) {
			const image = media.createEl("img", {
				attr: {
					src: item.imageURL,
					alt: item.imageAlt,
					loading: isHero ? "eager" : "lazy",
					decoding: "async",
				},
			});
			if (isHero) image.setAttribute("fetchpriority", "high");
		} else {
			media.createDiv({ cls: "featured-card__placeholder", text: "✦" });
		}

		const meta = content.createDiv({ cls: "featured-card__meta" });
		if (options.showDate) {
			const time = meta.createEl("time", { cls: "featured-card__date" });
			time.setAttribute("datetime", new Date(item.date).toISOString());
			time.textContent = this.formatDate(item.date);
		}
		if (item.category) {
			meta.createSpan({ cls: "featured-card__category", text: item.category });
		}

		const title = content.createEl(isHero ? "h2" : "h3", { cls: "featured-card__title" });
		title.textContent = item.title;

		if (options.showTags && item.tags.length > 0) {
			const tags = content.createDiv({ cls: "featured-card__tags" });
			item.tags.slice(0, Math.max(0, options.tagLimit)).forEach((tag) => {
				tags.createSpan({
					cls: "featured-card__tag",
					text: tag,
					attr: {
						"data-featured-tag-search": tag,
						role: "button",
						tabindex: "0",
						"aria-label": `Search ${tag}`,
					},
				});
			});
		}

		if (options.showExcerpt && item.excerpt) {
			content.createEl("p", { cls: "featured-card__excerpt", text: item.excerpt });
		}

		return card;
	}

	private static getTargetPath(website: Website, file: TFile): Path {
		const targetPath = website.getTargetPathForFile(file).setExtension("html");
		if (website.exportOptions.flattenExportPaths) targetPath.parent = Path.emptyPath;
		return this.removeExportRootFromPath(targetPath, website);
	}

	private static normalizeTargetPath(path: string, website: Website): string {
		const targetPath = new Path(path || "index.html", website.destination.path);
		targetPath.setExtension("html");
		return targetPath.slugified(website.exportOptions.slugifyPaths).path;
	}

	public static normalizeHomepageSourcePath(path: string): string {
		return new Path((path || "").trim()).pathname.replace(/^\/+/, "");
	}

	private static removeExportRootFromPath(path: Path, website: Website): Path {
		const root = new Path(website.exportOptions.exportRoot ?? "").slugify(website.exportOptions.slugifyPaths).path + "/";
		if (root != "/" && path.path.startsWith(root)) path.reparse(path.path.substring(root.length));
		return path;
	}

	private static isSameVaultPath(a: string, b: string): boolean {
		return new Path(a).pathname.replace(/^\/+/, "") == new Path(b).pathname.replace(/^\/+/, "");
	}

	private static async getTitle(file: TFile, frontmatter: FrontMatterCache): Promise<string> {
		const titleProperty = Settings.titleProperty || "title";
		const frontmatterTitle = this.toString(frontmatter[titleProperty]) || this.toString(frontmatter["title"]);
		if (frontmatterTitle) return frontmatterTitle;

		try {
			const titleInfo = await _MarkdownRendererInternal.getTitleForFile(file);
			if (titleInfo?.title) return titleInfo.title;
		} catch (error) {
			ExportLog.warning(error, "Could not resolve featured homepage title for " + file.path);
		}

		return file.basename;
	}

	private static getDate(file: TFile, frontmatter: FrontMatterCache, options: FeaturedHomepageOptions): number {
		if (options.sortBy == FeaturedHomepageSortBy.CreatedTime) return file.stat.ctime || file.stat.mtime || Date.now();
		if (options.sortBy == FeaturedHomepageSortBy.ModifiedTime) return file.stat.mtime || file.stat.ctime || Date.now();

		const frontmatterDate = this.toDate(frontmatter["created"]) ?? this.toDate(frontmatter[options.dateProperty]);
		if (frontmatterDate) return frontmatterDate;
		return file.stat.mtime || file.stat.ctime || Date.now();
	}

	private static getOrder(frontmatter: FrontMatterCache, options: FeaturedHomepageOptions): number {
		const value = Number(frontmatter[options.featuredOrderProperty]);
		return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
	}

	private static getTags(cache: CachedMetadata | null | undefined, frontmatter: FrontMatterCache): string[] {
		const tags = new Set<string>();
		const frontmatterTags = frontmatter["tags"];
		const normalizedFrontmatterTags = Array.isArray(frontmatterTags) ? frontmatterTags : (frontmatterTags ? [frontmatterTags] : []);
		normalizedFrontmatterTags.forEach((tag) => this.addTag(tags, tag));
		cache?.tags?.forEach((tagCache) => this.addTag(tags, tagCache.tag));
		return Array.from(tags);
	}

	private static addTag(tags: Set<string>, value: unknown): void {
		const tag = this.toString(value).trim();
		if (!tag) return;
		tags.add(tag.startsWith("#") ? tag : `#${tag}`);
	}

	private static getCategory(frontmatter: FrontMatterCache, options: FeaturedHomepageOptions): string {
		const value = frontmatter[options.categoryProperty] ?? frontmatter["categories"];
		if (Array.isArray(value)) return this.toString(value[0]);
		return this.toString(value);
	}

	private static async getExcerpt(file: TFile, frontmatter: FrontMatterCache, options: FeaturedHomepageOptions): Promise<string> {
		const explicit = this.toString(frontmatter["description"]) || this.toString(frontmatter["summary"]);
		if (explicit) return this.truncate(explicit, options.excerptLength);

		try {
			const raw = await app.vault.cachedRead(file);
			const paragraph = this.extractFirstParagraph(raw);
			return this.truncate(paragraph, options.excerptLength);
		} catch (error) {
			ExportLog.warning(error, "Could not read featured homepage excerpt for " + file.path);
			return "";
		}
	}

	private static async resolveFeaturedImage(file: TFile, frontmatter: FrontMatterCache, website: Website, options: FeaturedHomepageOptions): Promise<string> {
		const frontmatterImage = this.normalizeImageSource(frontmatter[options.imageProperty] ?? frontmatter["image"]);
		const src = frontmatterImage || await this.findFirstMarkdownImage(file);
		const resolved = await this.resolveImageSource(src, file, website);
		if (resolved) return resolved;
		return await this.resolveImageSource(options.fallbackImagePath, file, website) ?? "";
	}

	private static async findFirstMarkdownImage(file: TFile): Promise<string> {
		try {
			const content = await app.vault.cachedRead(file);
			const matches: { index: number, src: string }[] = [];
			const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
			const wikiImageRegex = /!\[\[([^\]]+)\]\]/g;
			const htmlImageRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gim;

			this.collectImageMatches(content, markdownImageRegex, matches);
			this.collectImageMatches(content, wikiImageRegex, matches);
			this.collectImageMatches(content, htmlImageRegex, matches);

			matches.sort((a, b) => a.index - b.index);
			return matches.find((match) => this.isLikelyImage(match.src))?.src ?? "";
		} catch {
			return "";
		}
	}

	private static collectImageMatches(content: string, regex: RegExp, matches: { index: number, src: string }[]): void {
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) != null) {
			matches.push({ index: match.index, src: this.normalizeImageSource(match[1]) });
		}
	}

	public static async resolveImageSource(src: string | undefined, file: TFile, website: Website): Promise<string | undefined> {
		src = this.normalizeImageSource(src);
		if (!src) return undefined;
		if (this.isExternalImage(src)) return src;

		const sourcePath = website.getFilePathFromSrc(src, file.path).pathname;
		if (!sourcePath) return undefined;

		let attachment = website.index.getFile(sourcePath, true) as Attachment | undefined;
		attachment ??= await website.createAttachmentFromSrc(src, file);
		if (!attachment) return undefined;

		await website.index.addFile(attachment);
		if (website.exportOptions.combineAsSingleFile && attachment.data instanceof Buffer) {
			const mime = AssetLoader.extentionToMime(attachment.extensionName);
			return `data:${mime};base64,${attachment.data.toString("base64")}`;
		}

		return attachment.targetPath.path;
	}

	private static sortItems(items: FeaturedHomepageItem[], options: FeaturedHomepageOptions): FeaturedHomepageItem[] {
		return items.sort((a, b) => {
			if (options.sortBy == FeaturedHomepageSortBy.ManualOrder && a.order != b.order) {
				return a.order - b.order;
			}

			return b.date - a.date;
		});
	}

	private static isTruthy(value: unknown): boolean {
		if (value === true) return true;
		if (typeof value == "number") return value == 1;
		if (typeof value == "string") return ["true", "yes", "1", "on"].includes(value.trim().toLowerCase());
		return false;
	}

	private static toDate(value: unknown): number | undefined {
		if (!value) return undefined;
		if (value instanceof Date) return value.getTime();
		if (typeof value == "number") return value;
		const raw = this.toString(value);
		const yamlDateTime = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
		if (yamlDateTime) {
			const [, year, month, day, hour = "0", minute = "0", second = "0"] = yamlDateTime;
			const localDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
			const time = localDate.getTime();
			if (!Number.isNaN(time)) return time;
		}

		const parsed = Date.parse(raw);
		return Number.isNaN(parsed) ? undefined : parsed;
	}

	private static toString(value: unknown): string {
		if (value == undefined || value == null) return "";
		if (Array.isArray(value)) return value.map((item) => this.toString(item)).filter(Boolean).join(", ");
		return String(value).trim();
	}

	public static normalizeImageSource(value: unknown): string {
		let src = this.toString(value);
		if (!src) return "";
		src = src.replace(/^!\[\[/, "").replace(/^\[\[/, "").replace(/\]\]$/, "");
		src = src.split("|")[0].trim();
		return src.replace(/^['"]|['"]$/g, "");
	}

	private static isExternalImage(src: string): boolean {
		return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:");
	}

	private static isLikelyImage(src: string): boolean {
		src = this.normalizeImageSource(src).split("#")[0].split("?")[0];
		if (this.isExternalImage(src)) return true;
		const extension = new Path(src).extensionName.toLowerCase();
		return extension == "" || this.imageExtensions.has(extension);
	}

	private static extractFirstParagraph(raw: string): string {
		let text = raw.replace(/^---[\s\S]*?---\s*/m, "");
		text = text.replace(/```[\s\S]*?```/g, " ");
		text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
		text = text.replace(/!\[\[[^\]]+\]\]/g, " ");
		text = text.replace(/<[^>]+>/g, " ");
		text = text.replace(/^#{1,6}\s+/gm, "");
		text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
		text = text.replace(/[*_`>#-]/g, " ");
		const paragraph = text.split(/\n\s*\n/).map((part) => part.replace(/\s+/g, " ").trim()).find((part) => part.length > 0) ?? "";
		return paragraph;
	}

	private static truncate(text: string, maxLength: number): string {
		text = text.replace(/\s+/g, " ").trim();
		if (maxLength <= 0 || text.length <= maxLength) return text;
		return text.substring(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
	}

	private static formatDate(value: number): string {
		const date = new Date(value);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hour = String(date.getHours()).padStart(2, "0");
		const minute = String(date.getMinutes()).padStart(2, "0");
		const dateText = `${year}-${month}-${day}`;
		return hour == "00" && minute == "00" ? dateText : `${dateText} ${hour}:${minute}`;
	}
}
