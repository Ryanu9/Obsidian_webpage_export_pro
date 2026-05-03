import { Search } from "./search";
import { Sidebar } from "./sidebars";
import { Tree } from "./trees";
import { Bounds, delay, getLengthInPixels, waitUntil } from "./utils";
import { WebpageDocument as ObsidianDocument } from "./document";
import {
	DocumentType,
	FileData,
	WebpageData,
	WebsiteData,
	WebsiteOptions,
} from "src/shared/website-data";
import { GraphView } from "./graph-view";
import { Notice } from "./notifications";
import { Theme } from "./theme";
import { LinkHandler } from "./links";
import { Shared } from "src/shared/shared";
import { FilePreviewPopover } from "./link-preview";
import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { CounterFeature } from "./counter-feature";
import {
	FeatureRelation,
	InsertedFeatureOptions,
	RelationType,
} from "src/shared/features/feature-options-base";
import { BacklinkList } from "./backlinks";
import { Tags } from "./tags";
import { Aliases } from "./aliases";
import { Copyright } from "./copyright";
import { FooterLinks } from "./footer-links";
import { TocScrollSpy } from "./toc-scrollspy";
import { AttachmentDownload } from "./attachment-download";
import { ModalSearch } from "./modal-search";
import MiniSearch from "minisearch";

type Constructor<T> = new () => T;

function isConstructor(value: any): value is Constructor<any> {
	return (
		typeof value === "function" &&
		value.prototype &&
		value.prototype.constructor === value &&
		value.prototype.constructor.name !== "Object"
	);
}

export class ObsidianWebsite {
	public LinkHandler: LinkHandler = LinkHandler;
	public LinkPreview: unknown = FilePreviewPopover;

	public bodyEl: HTMLElement;
	public horizontalLayout: HTMLElement;
	public centerContentEl: HTMLElement;
	public loadingEl: HTMLElement;

	public isLoaded: boolean = false;
	public isHttp: boolean = window.location.protocol != "file:";
	public metadata: WebsiteData;
	public theme: Theme;
	public fileTree: Tree | undefined = undefined;
	public outlineTree: Tree | undefined = undefined;
	public search: Search | undefined = undefined;
	public modalSearch: ModalSearch | undefined = undefined;
	public leftSidebar: Sidebar | undefined = undefined;
	public rightSidebar: Sidebar | undefined = undefined;
	public document: ObsidianDocument;
	public graphView: GraphView | undefined = undefined;
	public backlinkList: BacklinkList | undefined = undefined;
	public tags: Tags | undefined = undefined;
	public aliases: Aliases | undefined = undefined;
	public footerLinks: FooterLinks | undefined = undefined;
	public copyright: Copyright | undefined = undefined;
	public tocScrollSpy: TocScrollSpy | undefined = undefined;
	private mobileTocToggleEl: HTMLButtonElement | undefined = undefined;
	private mobileTocOverlayEl: HTMLElement | undefined = undefined;
	private mobileTocDrawerEl: HTMLElement | undefined = undefined;
	private mobileTocTitleEl: HTMLElement | undefined = undefined;
	private mobileTocContentEl: HTMLElement | undefined = undefined;
	private sharedSearchIndex: MiniSearch | undefined = undefined;
	private searchIndexPromise: Promise<MiniSearch | undefined> | undefined = undefined;
	private graphViewInitPromise: Promise<GraphView | undefined> | undefined = undefined;

	public entryPage: string;

	public onloadCallbacks: ((document: ObsidianDocument) => void)[] = [];
	public onDocumentLoad(callback: (document: ObsidianDocument) => void) {
		this.onloadCallbacks.push(callback);
	}

	public triggerOnDocumentLoad(doc: ObsidianDocument) {
		this.onloadCallbacks.forEach((cb) => cb(doc));
	}

	public async init() {
		window.addEventListener("load", () => ObsidianSite.onInit());

		if (this.isHttp) {
			this.metadata = (await this.loadWebsiteData()) as WebsiteData;
			if (!this.metadata) {
				console.error("Failed to load website data.");
				return;
			}
		}
	}

	private async onInit() {
		if (!this.isHttp) {
			this.metadata = (await this.loadWebsiteData()) as WebsiteData;
			if (!this.metadata) {
				console.error("Failed to load website data.");
				this.metadata = new WebsiteData();
				this.metadata.ignoreMetadata = true;
			}
		}

		await waitUntil(() => this.metadata != undefined, 16);

		console.log("Website init");
		if (window.location.protocol != "file:") {
			// @ts-expect-error defined in deferred.js
			await loadIncludes();
		}

		this.theme = new Theme();

		this.bodyEl = document.body;
		this.bodyEl.classList.add("no-transition");
		this.horizontalLayout = document.querySelector("#main-horizontal") as HTMLElement;
		this.centerContentEl = document.querySelector(
			"#center-content"
		) as HTMLElement;

		const fileTreeEl = document.querySelector(
			"#file-explorer"
		) as HTMLElement;
		const outlineTreeEl = document.querySelector("#outline") as HTMLElement;
		const leftSidebarEl = document.querySelector(
			".sidebar#left-sidebar"
		) as HTMLElement;
		const rightSidebarEl = document.querySelector(
			".sidebar#right-sidebar"
		) as HTMLElement;

		this.bodyEl.className += " " + this.metadata.bodyClasses;

		this.createLoadingEl();

		if (fileTreeEl) this.fileTree = new Tree(fileTreeEl);
		if (outlineTreeEl) {
			this.outlineTree = new Tree(outlineTreeEl, 1);
		}
		if (leftSidebarEl) this.leftSidebar = new Sidebar(leftSidebarEl);
		if (rightSidebarEl) this.rightSidebar = new Sidebar(rightSidebarEl);
		this.tocScrollSpy = new TocScrollSpy();
		new AttachmentDownload();
		// Initialize search UIs without loading the search index until the user interacts with search.
		this.initSearchDeferred();

		this.initSidebarToolbar();
		this.initMobileToc();

		const pathname =
			document
				.querySelector("meta[name='pathname']")
				?.getAttribute("content") ?? "unknown";
		this.entryPage = pathname;

		this.centerContentEl.style.visibility = "hidden";
		this.document = await new ObsidianDocument(pathname);
		await this.document.loadChildDocuments();
		await this.document.postLoadInit();

		if (
			!ObsidianSite.metadata.ignoreMetadata &&
			ObsidianSite.metadata.featureOptions.graphView.enabled
		) {
			this.initGraphViewDeferred();
		}

		this.initEvents();

		FilePreviewPopover.loadPinnedPreviews();

		this.onDocumentLoad((doc) => {
			this.normalizeFeaturedCards();
			this.normalizeBreadcrumbTargets();

			if (!ObsidianSite.metadata.ignoreMetadata) {
				const insertBacklinks =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.backlinks.enabled &&
					doc.documentType == DocumentType.Markdown;
				const insertTags =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.tags.enabled &&
					doc.documentType == DocumentType.Markdown;
				const insertAliases =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.alias.enabled &&
					doc.documentType == DocumentType.Markdown;
				const insertFooterLinks =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.footerLinks.enabled &&
					doc.documentType == DocumentType.Markdown;
				const insertCopyright =
					doc.isMainDocument &&
					!ObsidianSite.metadata.ignoreMetadata &&
					ObsidianSite.metadata.featureOptions.copyright.enabled &&
					doc.documentType == DocumentType.Markdown;

				// ------------------ BACKLINKS -----------------
				if (insertBacklinks) {
					const backlinks = doc.info.backlinks?.filter(
						(b) => b != doc.pathname
					) ?? [];

					if (!this.backlinkList) {
						const existingEl = document.getElementById("backlinks") as HTMLElement | null;
						this.backlinkList = new BacklinkList(backlinks, existingEl || undefined);
					} else {
						this.backlinkList?.modifyDependencies((d) => {
							d.backlinkPaths = backlinks;
						});
					}

					if (backlinks.length == 0) {
						this.backlinkList?.hide();
					} else {
						this.backlinkList?.show();
					}
				} else {
					this.backlinkList?.hide();
				}

				// ------------------ TAGS -----------------
				if (insertTags) {
					const tags: string[] = [];

					if (ObsidianSite.metadata.featureOptions.tags.showInlineTags &&
						doc.info.inlineTags
					) {
						tags.push(...doc.info.inlineTags);
					}
					if (ObsidianSite.metadata.featureOptions.tags
						.showFrontmatterTags &&
						doc.info.frontmatterTags
					) {
						tags.push(...doc.info.frontmatterTags);
					}

					if (!this.tags) {
						this.tags = new Tags(tags);
					} else {
						this.tags?.modifyDependencies((d) => {
							d.tags = tags;
						});
					}

					if (tags.length == 0) {
						this.tags?.hide();
					} else {
						this.tags?.show();
					}
				} else {
					this.tags?.hide();
				}

				// ------------------ ALIASES -----------------
				if (insertAliases) {
					const aliases = doc.info.aliases;

					if (!this.aliases) {
						this.aliases = new Aliases(aliases ?? []);
					} else {
						this.aliases?.modifyDependencies((d) => {
							d.aliases = aliases ?? [];
						});
					}

					if (!aliases || aliases.length == 0) {
						this.aliases?.hide();
					} else {
						this.aliases?.show();
						// Move aliases after created-updated-bar (between date and 文档属性)
						const aliasEl = document.getElementById("aliases");
						const dateBar = document.querySelector(".header .created-updated-bar");
						if (aliasEl && dateBar && dateBar.parentElement) {
							dateBar.parentElement.insertBefore(aliasEl, dateBar.nextSibling);
						}
					}
				} else {
					this.aliases?.hide();
				}

				// ------------------ FOOTER LINKS -----------------
				if (insertFooterLinks) {
					if (!this.footerLinks) {
						this.footerLinks = new FooterLinks();
					} else {
						this.footerLinks.regenerate();
					}

					this.footerLinks?.show();
				} else {
					this.footerLinks?.hide();
				}

				// ------------------ COPYRIGHT -----------------
				if (insertCopyright) {
					if (!this.copyright) {
						this.copyright = new Copyright();
					} else {
						this.copyright.regenerate();
					}

					this.copyright?.show();
				} else {
					this.copyright?.hide();
				}
			}

			this.tocScrollSpy?.updateHeadings();

			// Setup collapsible section headers
			this.setupSectionCollapse();
			this.syncMobileToc();

		});

		// Set initial history state
		if (this.isHttp) {
			let initialPath = this.document.pathname;

			// Preserve query parameters (especially for OAuth callbacks like Giscus)
			const currentUrl = new URL(window.location.href);
			const queryString = currentUrl.search;
			// Only preserve query params if they exist (e.g., OAuth callbacks with code/state)
			if (queryString) {
				initialPath = initialPath + queryString;
			}

			history.replaceState(
				{ pathname: this.document.pathname },
				this.document.title,
				this.toHistoryURL(initialPath)
			);
		}

		this.centerContentEl.style.visibility = "";
		this.isLoaded = true;
		this.onloadCallbacks.forEach((cb) => cb(this.document));

		requestAnimationFrame(() => {
			document.body.classList.add("sidebar-loaded");
		});
	}

	/**
	 * Get internationalized title for a feature
	 * @param featureKey The feature key (e.g., "outline", "backlinks")
	 * @param fallback The fallback English text
	 * @returns The internationalized title
	 */
	private getI18nTitle(featureKey: "outline" | "backlinks", fallback: string): string {
		// First try to get from metadata (which should already contain i18n text)
		if (this.metadata?.featureOptions?.[featureKey]?.displayTitle) {
			return this.metadata.featureOptions[featureKey].displayTitle;
		}

		// Try to get from window.i18n if available
		try {
			const i18n = (window as any).i18n;
			if (i18n?.settings?.[featureKey]?.title) {
				return i18n.settings[featureKey].title;
			}
		} catch (e) {
			// Fallback to default if i18n is not available
		}

		// Return fallback
		return fallback;
	}

	public async getSearchIndex(): Promise<MiniSearch | undefined> {
		if (this.sharedSearchIndex) {
			return this.sharedSearchIndex;
		}

		if (this.searchIndexPromise) {
			return this.searchIndexPromise;
		}

		this.searchIndexPromise = (async () => {
			try {
				const indexResp = await ObsidianSite.fetch(Shared.libFolderName + '/' + Shared.searchIndexFileName);
				if (!indexResp?.ok) {
					return undefined;
				}

				const indexJSON = await indexResp.json();
				this.sharedSearchIndex = MiniSearch.loadJS(indexJSON, {
					fields: ['title', 'path', 'tags', 'headers', 'aliases', 'content']
				});
				return this.sharedSearchIndex;
			} catch (e) {
				console.error("Failed to load shared search index:", e);
				return undefined;
			} finally {
				if (!this.sharedSearchIndex) {
					this.searchIndexPromise = undefined;
				}
			}
		})();

		return this.searchIndexPromise;
	}

	private normalizeFeaturedCards() {
		document.querySelectorAll<HTMLElement>(".featured-card > .featured-card__media").forEach((media) => {
			const card = media.closest(".featured-card") as HTMLElement | null;
			const content = card?.querySelector(".featured-card__content") as HTMLElement | null;
			if (!content) return;

			const excerpt = content.querySelector(".featured-card__excerpt");
			if (excerpt?.parentElement == content) {
				excerpt.before(media);
			} else {
				content.appendChild(media);
			}
		});

		document.querySelectorAll<HTMLElement>(".featured-card__meta > .featured-card__tags").forEach((tags) => {
			const content = tags.closest(".featured-card__content") as HTMLElement | null;
			if (!content) return;

			const excerpt = content.querySelector(".featured-card__excerpt");
			if (excerpt?.parentElement == content) {
				excerpt.after(tags);
			} else {
				content.appendChild(tags);
			}
		});

		document.querySelectorAll<HTMLElement>(".featured-card__content").forEach((content) => {
			const orderedSelectors = [
				".featured-card__media",
				".featured-card__meta",
				".featured-card__title",
				".featured-card__tags",
				".featured-card__excerpt",
			];

			for (const selector of orderedSelectors) {
				const element = content.querySelector(`:scope > ${selector}`);
				if (element) content.appendChild(element);
			}
		});
	}

	private normalizeBreadcrumbTargets() {
		const target = ObsidianSite.metadata?.featureOptions?.document?.breadcrumbHomePath?.trim().replace(/^\/+/, "");
		if (!target) return;

		document.querySelectorAll<HTMLElement>(".breadcrumb-container > .breadcrumb-element:first-child").forEach((breadcrumb) => {
			breadcrumb.dataset.breadcrumbTarget = target;
			breadcrumb.setAttribute("role", "link");
			breadcrumb.setAttribute("tabindex", "0");

			const link = breadcrumb.querySelector<HTMLAnchorElement>("a");
			if (link) link.setAttribute("href", target);
		});
	}

	private initMobileToc() {
		if (this.mobileTocToggleEl) return;

		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "toc-toggle";
		toggle.hidden = true;
		toggle.setAttribute("aria-label", "Open table of contents");
		toggle.setAttribute("aria-expanded", "false");
		toggle.innerHTML = `
			<svg class="toc-toggle__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M4 7h16M4 12h16M4 17h16" />
			</svg>
			<span>TOC</span>
		`;
		toggle.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.toggleMobileToc();
		});

		const overlay = document.createElement("div");
		overlay.className = "toc-overlay";
		overlay.addEventListener("click", () => this.closeMobileToc());

		const drawer = document.createElement("aside");
		drawer.className = "toc-drawer";
		drawer.setAttribute("aria-label", "Table of contents");
		drawer.setAttribute("aria-hidden", "true");

		const header = document.createElement("div");
		header.className = "toc-drawer__header";

		const title = document.createElement("div");
		title.className = "toc-drawer__title";
		title.textContent = this.getI18nTitle("outline", "Table of Contents");

		const closeButton = document.createElement("button");
		closeButton.type = "button";
		closeButton.className = "toc-drawer__close";
		closeButton.setAttribute("aria-label", "Close table of contents");
		closeButton.innerHTML = "×";
		closeButton.addEventListener("click", () => this.closeMobileToc());

		header.append(title, closeButton);

		const content = document.createElement("div");
		content.className = "toc-drawer__content";
		content.addEventListener("click", (event) => {
			if ((event.target as HTMLElement).closest("a[href]")) this.closeMobileToc();
		});

		drawer.append(header, content);
		document.body.append(toggle, overlay, drawer);
		document.addEventListener("keydown", (event) => {
			if (event.key == "Escape") this.closeMobileToc();
		});

		this.mobileTocToggleEl = toggle;
		this.mobileTocOverlayEl = overlay;
		this.mobileTocDrawerEl = drawer;
		this.mobileTocTitleEl = title;
		this.mobileTocContentEl = content;
	}

	private syncMobileToc() {
		if (!this.mobileTocToggleEl || !this.mobileTocContentEl || !this.mobileTocTitleEl) return;

		const outline = document.querySelector("#outline") as HTMLElement | null;
		const hasOutline = !!outline?.querySelector(".tree-item-self[href]");
		this.mobileTocToggleEl.hidden = !hasOutline;

		if (!outline || !hasOutline) {
			this.mobileTocContentEl.replaceChildren();
			this.closeMobileToc();
			return;
		}

		this.mobileTocTitleEl.textContent = this.getI18nTitle("outline", "Table of Contents");

		const clone = outline.cloneNode(true) as HTMLElement;
		clone.id = "toc-mobile";
		clone.classList.add("toc-drawer__outline");
		clone.querySelectorAll("[id]").forEach((element) => {
			if (element != clone) element.removeAttribute("id");
		});
		clone.querySelector(".feature-header")?.remove();
		clone.querySelectorAll(".collapse-icon, .tree-collapse-all").forEach((element) => element.remove());
		clone.querySelectorAll(".is-collapsed").forEach((element) => element.classList.remove("is-collapsed"));
		clone.querySelectorAll<HTMLElement>(".tree-item-children").forEach((element) => element.style.removeProperty("display"));

		this.mobileTocContentEl.replaceChildren(clone);
		LinkHandler.initializeLinks(this.mobileTocContentEl);
	}

	private toggleMobileToc() {
		if (document.body.classList.contains("toc-open")) this.closeMobileToc();
		else this.openMobileToc();
	}

	private openMobileToc() {
		if (this.mobileTocToggleEl?.hidden) return;

		this.leftSidebar && (this.leftSidebar.collapsed = true);
		this.rightSidebar && (this.rightSidebar.collapsed = true);
		document.body.classList.add("toc-open");
		this.mobileTocToggleEl?.setAttribute("aria-expanded", "true");
		this.mobileTocDrawerEl?.setAttribute("aria-hidden", "false");
	}

	private closeMobileToc() {
		document.body.classList.remove("toc-open");
		this.mobileTocToggleEl?.setAttribute("aria-expanded", "false");
		this.mobileTocDrawerEl?.setAttribute("aria-hidden", "true");
	}

	private setupSectionCollapse() {
		// Make outline section collapsible — Quartz toc-header style
		const outline = document.querySelector("#outline");
		if (outline) {
			const header = outline.querySelector(".feature-header") as HTMLElement;
			if (header && !header.dataset.collapseInit) {
				header.dataset.collapseInit = "true";

				// Set outline header title to "Table of Contents"
				let titleEl = header.querySelector(".feature-title") as HTMLElement;
				if (!titleEl) {
					titleEl = document.createElement("div");
					titleEl.className = "feature-title";
					header.prepend(titleEl);
				}
				titleEl.textContent = "Table of Contents";

				// Add Quartz-style fold chevron SVG if not already present
				if (!header.querySelector(".fold")) {
					const fold = document.createElementNS("http://www.w3.org/2000/svg", "svg");
					fold.setAttribute("xmlns", "http://www.w3.org/2000/svg");
					fold.setAttribute("width", "24");
					fold.setAttribute("height", "24");
					fold.setAttribute("viewBox", "0 0 24 24");
					fold.setAttribute("fill", "none");
					fold.setAttribute("stroke", "currentColor");
					fold.setAttribute("stroke-width", "2");
					fold.setAttribute("stroke-linecap", "round");
					fold.setAttribute("stroke-linejoin", "round");
					fold.classList.add("fold");
					const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
					polyline.setAttribute("points", "6 9 12 15 18 9");
					fold.appendChild(polyline);
					// Insert fold after title, before other children
					if (titleEl?.nextSibling) {
						header.insertBefore(fold, titleEl.nextSibling);
					} else {
						header.appendChild(fold);
					}
				}

				header.addEventListener("click", (e) => {
					if ((e.target as HTMLElement).closest(".tree-collapse-all")) return;
					outline.classList.toggle("is-collapsed");
				});
			}
		}

		// Override backlinks title to "Backlinks"
		const backlinks = document.querySelector("#backlinks");
		if (backlinks) {
			const blTitle = backlinks.querySelector(".feature-title") as HTMLElement;
			if (blTitle) {
				blTitle.textContent = "Backlinks";
			}
		}
	}

	private initSidebarToolbar() {
		// Theme toggle icon button
		const themeBtn = document.getElementById('sidebar-theme-toggle');
		themeBtn?.addEventListener('click', () => {
			this.theme?.switchTheme();
		});

		// Reader mode toggle button
		const readerModeBtn = document.getElementById('reader-mode-toggle');
		readerModeBtn?.addEventListener('click', () => {
			const isReaderMode = document.body.classList.toggle('reader-mode');
			if (isReaderMode) {
				if (this.leftSidebar) this.leftSidebar.collapsed = false;
				if (this.rightSidebar) this.rightSidebar.collapsed = false;
			}
		});

		// Transform sidebar-toolbar-search fallback into a proper search trigger
		const fallbackSearch = document.querySelector('.sidebar-toolbar-search');
		if (fallbackSearch) {
			const span = fallbackSearch.querySelector('span');
			if (span) span.textContent = 'Ctrl+K';
		}

		this.initMobileTopbar();
	}

	private initMobileTopbar() {
		// Hamburger button toggles left sidebar
		const hamburger = document.getElementById('mobile-hamburger');
		hamburger?.addEventListener('click', (e) => {
			e.stopPropagation();
			if (this.leftSidebar) {
				this.leftSidebar.collapsed = !this.leftSidebar.collapsed;
			}
		});

		// Mobile search button opens modal search (Quartz-style .search-container)
		const mobileSearch = document.getElementById('mobile-search-btn');
		mobileSearch?.addEventListener('click', () => {
			this.modalSearch?.open();
		});

		// Mobile theme toggle
		const mobileTheme = document.getElementById('mobile-theme-toggle');
		mobileTheme?.addEventListener('click', () => {
			this.theme?.switchTheme();
		});

		// Mobile right sidebar toggle
		const mobileRightSidebar = document.getElementById('mobile-right-sidebar-toggle');
		mobileRightSidebar?.addEventListener('click', (e) => {
			e.stopPropagation();
			if (this.rightSidebar) {
				this.rightSidebar.collapsed = !this.rightSidebar.collapsed;
			}
		});
	}

	private initSearchDeferred() {
		// Initialize both search entry points immediately, but keep the expensive
		// search-index.json fetch and MiniSearch parsing on-demand.
		(async () => {
			try {
				this.search = await new Search().init();
				this.modalSearch = await new ModalSearch().init();
			} catch (e) {
				console.error("Failed to initialize search:", e);
			}
		})();
	}

	private initEvents() {
		window.addEventListener("popstate", async (e) => {
			console.log("popstate", e);
			if (!e.state) return;
			const pathname = e.state.pathname;
			await ObsidianSite.loadURL(pathname, false);
		});

		const localThis = this;
		window.addEventListener("resize", () => {
			if (localThis.resizeRAF) return;
			localThis.resizeRAF = requestAnimationFrame(() => {
				localThis.resizeRAF = null;
				localThis.onResize();
			});
		});
		this.onResize();
		requestAnimationFrame(() => {
			document.body.classList.remove("no-transition");
		});

		document.addEventListener('contentDecrypted', () => {
			if (this.graphView && this.document) {
				this.graphView.showGraph([this.document.pathname]);
			}
		});
	}

	public updateMetaTag(name: string, content: string) {
		let meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
		if (!meta) {
			meta = document.createElement('meta');
			if (name.startsWith('og:')) {
				meta.setAttribute('property', name);
			} else {
				meta.setAttribute('name', name);
			}
			document.head.appendChild(meta);
		}
		meta.setAttribute('content', content);
	}

	public async loadURL(url: string, pushState: boolean = true): Promise<ObsidianDocument | undefined> {
		const header = LinkHandler.getHashFromURL(url);
		const query = LinkHandler.getQueryFromURL(url);
		url = LinkHandler.getPathnameFromURL(url);
		console.log("Loading URL", url, header, query);

		if (query && query.startsWith("query=")) {
			await this.search?.searchParseFilters(decodeURIComponent(query.substring(6)));
			return;
		}

		// if this document is already loaded
		if (this.document.pathname == url || this.document.pathname == url.split('#')[0]) {
			this.pushDocumentHistory(this.document.pathname, this.document.title, pushState);
			if (header) this.document.scrollToHeader(header);
			else if (!url.includes('#')) {
				new Notice("This page is already loaded.");
			}
			return this.document;
		}

		const data = ObsidianSite.getWebpageData(url) as WebpageData;
		if (!data) {
			new Notice("This page does not exist yet.");
			console.warn("Page does not exist", url);
			return undefined;
		}

		const previousDocument = this.document;
		const page = await new ObsidianDocument(url).load(
			null,
			ObsidianSite.centerContentEl,
			false,
			false,
			() => previousDocument?.dispose()
		);

		if (!page) {
			new Notice("Failed to load page. Unknown error.");
			return;
		}

		// Update meta tags
		document.title = page.title;
		this.updateMetaTag("pathname", page.pathname);
		this.updateMetaTag("description", page.info?.description || "");
		this.updateMetaTag("author", page.info?.author || "");
		this.updateMetaTag("og:title", page.title);
		this.updateMetaTag("og:description", page.info?.description || "");
		this.updateMetaTag("og:url", window.location.href);
		this.updateMetaTag("og:image", page.info?.coverImageURL || "");

		// Update graph view and file tree
		await this.graphView?.showGraph([page.pathname]);
		this.fileTree?.findByPath(page.pathname)?.setActive();
		this.fileTree?.revealPath(page.pathname);
		this.graphView?.setActiveNodeByPath(page.pathname);
		this.document = page;

		this.pushDocumentHistory(this.document.pathname, this.document.title, pushState);

		// update outline - TODO: make this a dynamic inserted feature
		let newOutlineEl = page.sourceHtml.querySelector("#outline") as HTMLElement;
		if (newOutlineEl) {
			newOutlineEl = document.adoptNode(newOutlineEl);
			document.querySelector("#outline")?.replaceWith(newOutlineEl);
			ObsidianSite.outlineTree = new Tree(newOutlineEl, 1);
		}

		setTimeout(async () => {

			this.onloadCallbacks.forEach((cb) => cb(page));

			await page.show();

			if (header) {
				page.scrollToHeader(header);
			} else {
				this.horizontalLayout.scrollTo({
					top: 0,
					left: 0,
					behavior: "auto"
				});
			}
		}, 100); // Small delay to ensure the DOM is updated

		return page;
	}

	private pushDocumentHistory(pathname: string, title: string, pushState: boolean): void {
		if (!this.isHttp || !pushState) return;

		const historyURL = this.toHistoryURL(pathname);
		if (window.location.href == historyURL) return;

		history.pushState({ pathname }, title, historyURL);
	}

	private toHistoryURL(pathname: string): string {
		if (pathname == "" || pathname == "/" || pathname == "\\") pathname = "index.html";
		return new URL(pathname, document.baseURI).href;
	}

	public async fetch(url: string): Promise<Response | undefined> {
		url = LinkHandler.getPathnameFromURL(url);

		if (this.isHttp || url.startsWith("http")) {
			const req = await fetch(url);
			if (req.ok) {
				return req;
			} else {
				console.error("Failed to fetch", url);
				return;
			}
		} else {
			const file = this.getFileData(url);
			if (!file?.data) {
				console.error("Failed to fetch", url);
				return;
			}

			const req = new Response(file.data, { status: 200 });
			return req;
		}
	}

	public documentExists(url: string): boolean {
		url = LinkHandler.getPathnameFromURL(url);
		if (this.isHttp) {
			return !!this.metadata.webpages[url];
		} else {
			return !!this.getFileData(url)?.data;
		}
	}

	private async loadWebsiteData(): Promise<WebsiteData | undefined> {
		if (this.isHttp) {
			try {
				const dataReq = await fetch(
					Shared.libFolderName + "/metadata.json"
				);
				if (dataReq.ok) {
					const jsonStr = await dataReq.text();
					return WebsiteData.fromJSON(jsonStr);
				}
			} catch (e) {
				console.error("Failed to load website metadata.", e);
				new Notice("Failed to load website metadata.");
			}
		} else {
			const jsonData = this.getLocalDataFromId("website-metadata");
			return jsonData
				? WebsiteData.fromJSON(JSON.stringify(jsonData))
				: undefined;
		}
		return undefined;
	}

	private initGraphViewDeferred() {
		const graphViewFeature = document.querySelector(
			".graph-view-wrapper"
		) as HTMLElement;
		if (!graphViewFeature) return;

		const graphContainer = graphViewFeature.querySelector(
			".graph-view-container"
		) as HTMLElement | null;
		const globalGraphButton = graphViewFeature.querySelector(
			".graph-global.graph-icon"
		) as HTMLElement | null;
		const expandGraphButton = graphViewFeature.querySelector(
			".graph-expand.graph-icon"
		) as HTMLElement | null;

		const withGraphView = (action: (graphView: GraphView) => void | Promise<void>) => {
			void this.loadGraphView().then((graphView) => {
				if (graphView) {
					void action(graphView);
				}
			});
		};

		const initializeLocalGraph = () => {
			if (this.graphView) return;
			withGraphView((graphView) => graphView.showGraph([this.document.pathname]));
		};

		const initializeGlobalGraph = (event: Event) => {
			if (this.graphView) return;
			event.preventDefault();
			event.stopPropagation();
			withGraphView((graphView) => graphView.showGraph());
		};

		const initializeExpandedGraph = (event: Event) => {
			if (this.graphView) return;
			event.preventDefault();
			event.stopPropagation();
			withGraphView(async (graphView) => {
				await graphView.showGraph([this.document.pathname]);
				if (!graphView.graphExpanded) {
					graphView.toggleExpandedGraph();
				}
			});
		};

		graphContainer?.addEventListener("pointerenter", initializeLocalGraph, { once: true });
		graphContainer?.addEventListener("focusin", initializeLocalGraph, { once: true });
		globalGraphButton?.addEventListener("click", initializeGlobalGraph, { once: true });
		expandGraphButton?.addEventListener("click", initializeExpandedGraph, { once: true });

		const requestIdle = (window as any).requestIdleCallback as
			| ((callback: () => void, options?: { timeout?: number }) => number)
			| undefined;
		if (requestIdle) {
			requestIdle(() => initializeLocalGraph(), { timeout: 2000 });
		} else {
			setTimeout(() => initializeLocalGraph(), 500);
		}
	}

	private async loadGraphView(): Promise<GraphView | undefined> {
		if (this.graphView) return this.graphView;
		if (this.graphViewInitPromise) return this.graphViewInitPromise;

		const graphViewFeature = document.querySelector(
			".graph-view-wrapper"
		) as HTMLElement;
		if (!graphViewFeature) return undefined;

		this.graphViewInitPromise = new Promise((resolve) => {
			//@ts-ignore
			waitLoadScripts(["graph-sim-worker"], () => {
				const graphView = new GraphView(graphViewFeature);
				this.graphView = graphView;
				resolve(graphView);
			});
		});

		return this.graphViewInitPromise;
	}

	public getLocalDataFromId(id: string): any | undefined {
		const el = document.getElementById(id);
		if (!el) return;
		return JSON.parse(decodeURI(atob(el.getAttribute("value") ?? "")));
	}

	private cachedWebpageDataMap: Map<string, WebpageData> = new Map();
	public getWebpageData(url: string): WebpageData | undefined {
		if (!this.isHttp) {
			if (this.cachedWebpageDataMap.has(url)) {
				return this.cachedWebpageDataMap.get(url) as WebpageData;
			} else {
				const data = this.getLocalDataFromId(
					LinkHandler.getFileDataIdFromURL(url)
				) as WebpageData;
				this.cachedWebpageDataMap.set(url, data);
				return data;
			}
		}

		if (this.metadata) {
			const data = this.metadata.webpages[url];
			if (data) {
				return data;
			}
		}

		return;
	}

	private cachedFileDataMap: Map<string, FileData> = new Map();
	public getFileData(url: string): FileData {
		if (!this.isHttp) {
			if (this.cachedFileDataMap.has(url)) {
				return this.cachedFileDataMap.get(url) as FileData;
			} else {
				const data = this.getLocalDataFromId(
					LinkHandler.getFileDataIdFromURL(url)
				) as FileData;
				this.cachedFileDataMap.set(url, data);
				return data;
			}
		}

		if (this.metadata) {
			const data = this.metadata.fileInfo[url];
			if (data) {
				return data;
			}
		}

		return {} as FileData;
	}

	public scrollTo(element: Element) {
		element.scrollIntoView();
	}

	public async showLoading(
		loading: boolean,
		inside: HTMLElement = this.centerContentEl
	) {
		inside.style.transitionDuration = "";
		inside.classList.toggle("hide", loading);
		this.loadingEl.classList.toggle("show", loading);
		// this.graphView?.graphRenderer?.canvas.classList.toggle("hide", loading);

		if (loading) {
			// position loading icon in the center of the screen
			const viewBounds = Bounds.fromElement(inside);
			this.loadingEl.style.left =
				viewBounds.center.x - this.loadingEl.offsetWidth / 2 + "px";
			this.loadingEl.style.top =
				viewBounds.center.y - this.loadingEl.offsetHeight / 2 + "px";
		}

		await delay(200);
	}

	private createLoadingEl() {
		this.loadingEl = document.createElement("div");
		this.loadingEl.classList.add("loading-icon");
		document.body.appendChild(this.loadingEl);
		this.loadingEl.innerHTML = `<div></div><div></div><div></div><div></div>`;
	}

	public get documentBounds(): Bounds {
		return Bounds.fromElement(this.centerContentEl);
	}

	private onEndResize() {
		this.graphView?.graphRenderer?.autoResizeCanvas();
		document.body.classList.toggle("resizing", false);
	}

	private onStartResize() {
		document.body.classList.toggle("resizing", true);
	}

	private lastScreenWidth: number | undefined = undefined;
	private isResizing = false;
	private checkStillResizingTimeout: NodeJS.Timeout | undefined = undefined;
	private resizeRAF: number | null = null;
	private _deviceSize: string = "large-screen";
	public get deviceSize(): string {
		return this._deviceSize;
	}
	private set deviceSize(size: string) {
		this._deviceSize = size;
	}

	private onResize() {
		if (!this.isResizing) {
			this.onStartResize();
			this.isResizing = true;
		}

		const localThis = this;

		const bodyStyle = getComputedStyle(document.body);
		const cssLength = (value: string | undefined, fallback: string, context: Element): number => {
			const cssValue = value?.trim() || fallback;
			const pixels = getLengthInPixels(cssValue, context);
			return Number.isFinite(pixels) && pixels > 0
				? pixels
				: getLengthInPixels(fallback, context);
		};

		// These widths can depend on viewport-sized CSS such as
		// `min(60em, calc(100vw - 2em))`, so they must be recomputed while resizing.
		const docWidth = cssLength(
			bodyStyle.getPropertyValue("--line-width") ||
				bodyStyle.getPropertyValue("--file-line-width") ||
				this.metadata.featureOptions.document?.documentWidth,
			"45em",
			this.centerContentEl
		);
		const leftWidth = this.leftSidebar
			? cssLength(
				getComputedStyle(this.leftSidebar.containerEl).getPropertyValue("--sidebar-width") ||
					this.metadata.featureOptions.sidebar?.leftDefaultWidth,
				"20em",
				this.leftSidebar.containerEl
			)
			: 0;
		const rightWidth = this.rightSidebar
			? cssLength(
				getComputedStyle(this.rightSidebar.containerEl).getPropertyValue("--sidebar-width") ||
					this.metadata.featureOptions.sidebar?.rightDefaultWidth,
				"20em",
				this.rightSidebar.containerEl
			)
			: 0;
		const smallScreenLeftEdgeInset = Math.min(
			Math.max(window.innerWidth * 0.02, 12),
			24
		);
		const smallScreenRightEdgeInset = smallScreenLeftEdgeInset / 4;
		const smallScreenLeftColumnGap = Math.min(
			Math.max(window.innerWidth * 0.008, 4),
			10
		);
		const smallScreenRightColumnGap = smallScreenLeftColumnGap * (4 / 9);
		const edgeAndGapWidth =
			smallScreenLeftColumnGap +
			smallScreenRightColumnGap +
			smallScreenLeftEdgeInset +
			smallScreenRightEdgeInset;
		const centerContentMaxWidth =
			docWidth + getLengthInPixels("6em", this.centerContentEl);
		const largeScreenMinWidth = Math.max(
			centerContentMaxWidth + leftWidth + rightWidth + edgeAndGapWidth,
			1025
		);
		const smallScreenMinWidth = Math.max(
			centerContentMaxWidth +
				rightWidth +
				smallScreenRightColumnGap +
				smallScreenRightEdgeInset,
			769
		);
		const tabletMinWidth = 481;
		const collapseLeftSidebarMinWidth = largeScreenMinWidth;
		const collapseRightSidebarMinWidth = smallScreenMinWidth;
		const currentWidth = window.innerWidth;

		if (currentWidth > largeScreenMinWidth) {
			this.deviceSize = "large-screen";
			document.body.classList.toggle("floating-sidebars", false);
			document.body.classList.toggle("is-large-screen", true);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", false);

			if (this.leftSidebar) this.leftSidebar.collapsed = false;
			if (this.rightSidebar) this.rightSidebar.collapsed = false;
		} else if (currentWidth > smallScreenMinWidth) {
			const shouldCollapseLeftSidebar = currentWidth < collapseLeftSidebarMinWidth;
			const shouldCollapseRightSidebar = currentWidth < collapseRightSidebarMinWidth;
			this.deviceSize = "small screen";
			document.body.classList.toggle("floating-sidebars", shouldCollapseRightSidebar);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", true);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", false);

			if (this.leftSidebar) this.leftSidebar.collapsed = shouldCollapseLeftSidebar;
			if (this.rightSidebar) this.rightSidebar.collapsed = shouldCollapseRightSidebar;
		} else if (currentWidth > tabletMinWidth) {
			this.deviceSize = "tablet";
			document.body.classList.toggle("floating-sidebars", true);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", true);
			document.body.classList.toggle("is-phone", false);

			if (this.leftSidebar) this.leftSidebar.collapsed = true;
			if (this.rightSidebar) this.rightSidebar.collapsed = true;
		} else {
			this.deviceSize = "phone";
			document.body.classList.toggle("floating-sidebars", true);
			document.body.classList.toggle("is-large-screen", false);
			document.body.classList.toggle("is-small-screen", false);
			document.body.classList.toggle("is-tablet", false);
			document.body.classList.toggle("is-phone", true);
			if (this.leftSidebar) this.leftSidebar.collapsed = true;
			if (this.rightSidebar) this.rightSidebar.collapsed = true;
		}

		this.lastScreenWidth = window.innerWidth;

		if (this.checkStillResizingTimeout != undefined)
			clearTimeout(this.checkStillResizingTimeout);

		// wait a little bit of time and if the width is still the same then we are done resizing
		const screenWidthSnapshot = window.innerWidth;
		this.checkStillResizingTimeout = setTimeout(function () {
			if (window.innerWidth == screenWidthSnapshot) {
				localThis.checkStillResizingTimeout = undefined;
				localThis.isResizing = false;
				localThis.onEndResize();
			}
		}, 200);
	}
}
