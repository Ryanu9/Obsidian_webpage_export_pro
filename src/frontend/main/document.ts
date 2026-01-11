import { WebpageData, DocumentType } from "src/shared/website-data";
import { Shared } from "src/shared/shared";
import { BacklinkList } from "./backlinks";
import { Callout } from "./callouts";
import { Canvas } from "./canvas";
import { Header } from "./headers";
import { LinkHandler } from "./links";
import { List } from "./lists";
import { Bounds } from "./utils";
import { Notice } from "./notifications";
import { Tags } from "./tags";
import { Tree } from "./trees";
import { Aliases } from "./aliases";
import { YamlProperties } from "./yaml-properties";
import { Giscus } from "./giscus";
import { CodeBlockManager } from "./code-block-manager";
import { MediaManager } from "./media";
import { ImageZoom } from "./image-zoom";
import { LongImageCollapse } from "./long-image-collapse";
import { MachineGalleryFilters } from "./machine-gallery";


export class WebpageDocument {
	public title: string = "";
	public headers: Header[] = [];
	public callouts: Callout[] = [];
	public lists: List[] = [];
	public children: WebpageDocument[] = [];
	public parent: WebpageDocument | null;
	public isPreview: boolean = false;
	public canvas: Canvas;

	public documentType: DocumentType;
	public containerEl: HTMLElement;
	public documentEl: HTMLElement;
	public sizerEl: HTMLElement | undefined;
	public footerEl: HTMLElement;
	public headerEl: HTMLElement;
	public info: WebpageData;

	public sourceHtml: Document;

	// url stuff
	public pathname: string;
	public hash: string;
	public query: string;
	public queryParameters: URLSearchParams;

	public initialized: boolean = false;
	public get isMainDocument(): boolean {
		return this.parent == null && !this.isPreview;
	}

	public get bounds(): Bounds {
		return Bounds.fromElement(this.documentEl);
	}

	private _exists: boolean = false;
	public get exists(): boolean {
		return this._exists;
	}

	public constructor(url: string) {
		if (!window?.location) return;

		url = url.trim();

		if (
			url.startsWith("http") ||
			url.startsWith("www") ||
			url.startsWith("/") ||
			url.startsWith("\\")
		) {
			console.error(
				"Please use a relative path from the root of the wesite to load a webpage"
			);
			return;
		}

		this.pathname = LinkHandler.getPathnameFromURL(url);
		this.hash = LinkHandler.getHashFromURL(url);
		this.query = LinkHandler.getQueryFromURL(url);
		let origin = window?.location?.origin;
		if (origin == "null") origin = "file://";

		// load webpage data
		this.info = ObsidianSite.getWebpageData(this.pathname) as WebpageData;
		if (!this.info && !ObsidianSite.metadata.ignoreMetadata) {
			new Notice("This page does not exist yet.");
			console.warn("This page does not exist yet.", this.pathname);
			return;
		}

		this._exists = true;

		// set type
		this.documentType =
			(this.info?.type as DocumentType) ?? DocumentType.Markdown;

		// set title
		this.title = this.info?.title ?? this.pathname;
	}

	public findHeader(predicate: (header: Header) => boolean): Header | null {
		for (const header of this.headers) {
			let result = header.find(predicate);
			if (result) return result;
		}
		return null;
	}

	public getFlatHeaders(): Header[] {
		return this.headers.flatMap((h) => h.getFlatChildren());
	}

	public scrollToHeader(headerId: string) {
		console.log("Scrolling to header", headerId);
		const header = this.findHeader((h) => h.id == headerId);
		if (header) header.scrollTo();
	}

	private findElements() {
		if (!this.containerEl) this.containerEl = ObsidianSite.centerContentEl;
		this.sizerEl = (
			this.documentType == DocumentType.Markdown
				? this.containerEl.querySelector(".markdown-preview-sizer")
				: undefined
		) as HTMLElement;
		this.documentEl = this.containerEl.querySelector(
			".obsidian-document"
		) as HTMLElement;
		this.headerEl = this.containerEl.querySelector(
			".header"
		) as HTMLElement;
		this.footerEl = this.containerEl.querySelector(
			".footer"
		) as HTMLElement;
	}

	public async load(
		parent: WebpageDocument | null = null,
		containerEl: HTMLElement = ObsidianSite.centerContentEl,
		isPreview: boolean = false,
		headerOnly: boolean = false
	): Promise<WebpageDocument | undefined> {
		this.parent = parent;
		this.isPreview = isPreview;

		if (!this.pathname || !this.exists) return this;

		let oldDocument = ObsidianSite.document;
		await ObsidianSite.showLoading(true, containerEl);

		this.containerEl = containerEl;

		const documentReq = await ObsidianSite.fetch(this.pathname);
		if (documentReq?.ok) {
			const documentText = await documentReq.text();
			this.sourceHtml = new DOMParser().parseFromString(
				documentText,
				"text/html"
			);

			let newDocumentEl = this.sourceHtml.querySelector(".obsidian-document") as HTMLElement;
			if (!newDocumentEl) newDocumentEl = this.sourceHtml.querySelector(".password-lock") as HTMLElement;

			if (newDocumentEl) {
				newDocumentEl = document.adoptNode(newDocumentEl);
				const docEl = containerEl.querySelector(".obsidian-document") || containerEl.querySelector(".password-lock");
				if (docEl) {
					docEl.before(newDocumentEl);
					docEl.remove();
				} else {
					containerEl.appendChild(newDocumentEl);
				}
			}

			// Clean up previous page's TOC observer if it exists
			if ((window as any).__tocHideObserver) {
				(window as any).__tocHideObserver.disconnect();
				(window as any).__tocHideObserver = null;
			}

			// Clean up previous page's unlock scripts
			const oldScripts = document.querySelectorAll('script[data-unlock-script]');
			oldScripts.forEach(oldScript => oldScript.remove());

			// Check for new page unlock script
			const unlockScripts = this.sourceHtml.querySelectorAll('script[data-unlock-script]');
			if (unlockScripts.length > 0) {
				const fragment = document.createDocumentFragment();
				unlockScripts.forEach(script => {
					const newScript = document.createElement('script');
					newScript.textContent = script.textContent;
					newScript.setAttribute('data-unlock-script', 'true');
					fragment.appendChild(newScript);
				});
				document.body.appendChild(fragment);
			}

			await this.loadChildDocuments();
			await this.postLoadInit();

			if (this.sizerEl && headerOnly && this.hash && this.hash != "") {
				var header = this.headers
					.find((h) => h.findByID(this.hash))
					?.findByID(this.hash);
				if (header) {
					this.sizerEl.innerHTML = header
						.getHeaderWithContentRecursive()
						.map((e) => e.outerHTML)
						.join("");
				}
			}

			this.initialized = false;
		} else {
			new Notice("This document could not be loaded.");
			console.error("Failed to load document", this.pathname);
			return undefined;
		}

		return this;
	}

	public async show() {
		await ObsidianSite.showLoading(false, this.containerEl);
	}

	public async postLoadInit(): Promise<WebpageDocument> {
		this.findElements();
		await this.postProcess();

		// Handle encrypted page TOC visibility
		const isLocked = document.querySelector('#password-lock-container') !== null;
		if (isLocked) {
			const outline = document.querySelector('#outline');
			if (outline) {
				(outline as HTMLElement).style.setProperty('display', 'none', 'important');
				outline.setAttribute('data-toc-hidden', 'true');
			}
			Giscus.initOnEncryptedPage();
		}

		if ((this.isMainDocument || this.isPreview) && this.documentEl) {
			this.processHeaders();
			this.processCallouts();
			this.processLists();
			this.initNewImageZoom();
			new YamlProperties().parseAndDisplayYamlProperties(this.info, this.documentEl ?? this.containerEl);
			this.renderCreatedUpdatedBar();
		}

		if (this.documentType == DocumentType.Canvas) {
			this.canvas = new Canvas(this);
		}

		if ((this.isMainDocument || this.isPreview) && this.documentEl) {
			LinkHandler.initializeLinks(this.documentEl ?? this.containerEl);
			MachineGalleryFilters.initialize(this.containerEl ?? this.documentEl);
			this.initMachineTypeTags();
			this.initFootnotes();
		}

		return this;
	}


	private renderCreatedUpdatedBar() {
		if (!this.headerEl) return;

		// 检查设置是否启用
		if (!ObsidianSite.metadata?.featureOptions?.document?.showCreatedUpdatedTime) {
			return;
		}

		// 移除之前的元素
		this.headerEl.querySelector('.created-updated-bar')?.remove();

		const { createdTime, modifiedTime } = this.info || {};
		if (!createdTime && !modifiedTime) return;

		// 创建容器
		const bar = document.createElement('div');
		bar.className = 'created-updated-bar';

		// 辅助函数：创建时间条目
		const createTimeEntry = (time: number, type: 'created' | 'updated') => {
			const el = document.createElement('span');
			el.className = `${type}-time`;

			// 创建SVG图标
			const icon = document.createElement('span');
			icon.className = `${type}-icon`;

			if (type === 'created') {
				// 使用 date-range-svgrepo-com.svg
				icon.innerHTML = `<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M20 10V7C20 5.89543 19.1046 5 18 5H6C4.89543 5 4 5.89543 4 7V10M20 10V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V10M20 10H4M8 3V7M16 3V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				<rect x="6" y="12" width="3" height="3" rx="0.5" fill="currentColor"/>
				<rect x="10.5" y="12" width="3" height="3" rx="0.5" fill="currentColor"/>
				<rect x="15" y="12" width="3" height="3" rx="0.5" fill="currentColor"/>
			</svg>`;
			} else {
				// 使用 date.svg
				icon.innerHTML = `<svg width="1.2em" height="1.2em" viewBox="0 0 1024 1024" fill="currentColor">
				<path d="M512 192c179.2 0 320 140.8 320 320s-140.8 320-320 320-320-140.8-320-320S332.8 192 512 192M512 128C300.8 128 128 300.8 128 512s172.8 384 384 384 384-172.8 384-384S723.2 128 512 128L512 128z"/>
				<path d="M640 672c-6.4 0-19.2 0-25.6-6.4l-128-128C486.4 531.2 480 518.4 480 512L480 288C480 268.8 492.8 256 512 256s32 12.8 32 32l0 211.2 121.6 121.6c12.8 12.8 12.8 32 0 44.8C659.2 672 646.4 672 640 672z"/>
			</svg>`;
			}

			// 创建时间文本（无背景高亮，加粗）
			const timeSpan = document.createElement('span');
			timeSpan.className = `${type}-time-value`;

			const date = new Date(time);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');

			if (type === 'created') {
				// created只显示 yyyy-mm-dd
				timeSpan.textContent = `${year}-${month}-${day}`;
			} else {
				// updated显示 yyyy-mm-dd hh:mm
				const hours = String(date.getHours()).padStart(2, '0');
				const minutes = String(date.getMinutes()).padStart(2, '0');
				timeSpan.textContent = `${year}-${month}-${day} ${hours}:${minutes}`;
			}

			el.appendChild(icon);
			el.appendChild(timeSpan);
			return el;
		};

		// 添加时间条目
		if (createdTime) {
			bar.appendChild(createTimeEntry(createdTime, 'created'));
		}
		if (modifiedTime) {
			bar.appendChild(createTimeEntry(modifiedTime, 'updated'));
		}

		// 插入到page-title下方
		const pageTitle = this.headerEl.querySelector('h1.page-title');
		if (pageTitle?.nextSibling) {
			pageTitle.parentNode?.insertBefore(bar, pageTitle.nextSibling);
		} else if (pageTitle) {
			pageTitle.parentNode?.appendChild(bar);
		} else {
			// 如果没有找到page-title，插入到header开头
			this.headerEl.insertBefore(bar, this.headerEl.firstChild);
		}
	}

	private initFootnotes() {
		// Use dynamic import to load footnotes handler only when needed
		import('./footnotes').then(({ FootnoteHandler }) => {
			const footnoteHandler = FootnoteHandler.getInstance();
			footnoteHandler.initializeFootnotes(this.documentEl ?? this.containerEl);
		});
	}

	private initNewImageZoom() {
		if (!this.documentEl) return;
		// 初始化长图片折叠功能（需要在图片缩放之前处理，因为会包裹图片元素）
		LongImageCollapse.getInstance().initImagesInElement(this.documentEl);
		// 初始化图片缩放功能
		ImageZoom.getInstance().initImagesInElement(this.documentEl);
	}

	public processHeaders() {
		if (!this.documentEl) return;
		this.headers = Header.createHeaderTree(this.documentEl);
	}

	public processCallouts() {
		if (!this.documentEl) return;
		const calloutEls = Array.from(
			this.documentEl.querySelectorAll(".callout")
		);
		this.callouts = [];
		for (const calloutEl of calloutEls) {
			this.callouts.push(new Callout(calloutEl as HTMLElement));
		}
	}

	public processLists() {
		if (!this.documentEl) return;
		const listEls = Array.from(
			this.documentEl.querySelectorAll(
				":is(ul, ol):not(:is(ul, ol) :is(ul, ol))"
			)
		);
		this.lists = [];
		for (const listEl of listEls) {
			this.lists.push(new List(listEl as HTMLElement, undefined));
		}
	}

	public async postProcess() {
		if (!this.documentEl) return;

		// Initialize Giscus
		if (this.isMainDocument && !ObsidianSite.metadata.ignoreMetadata && ObsidianSite.metadata.featureOptions.giscus.enabled) {
			if (window.requestIdleCallback) {
				window.requestIdleCallback(() => new Giscus());
			} else {
				setTimeout(() => new Giscus(), 1000);
			}
		}

		// make completed kanban checkboxes checked
		this.documentEl
			?.querySelectorAll(
				".kanban-plugin__item.is-complete input[type='checkbox']"
			)
			.forEach((el: HTMLInputElement) => (el.checked = true));

		// toggle list and header collapse CSS
		if (!ObsidianSite.metadata.ignoreMetadata) {
			this.documentEl?.classList.toggle(
				"allow-fold-headings",
				ObsidianSite.metadata.featureOptions.document
					.allowFoldingHeadings
			);
			this.documentEl?.classList.toggle(
				"allow-fold-lists",
				ObsidianSite.metadata.featureOptions.document.allowFoldingLists
			);
		}

		// Initialize Code Blocks
		if (this.documentEl) {
			await new CodeBlockManager(this.documentEl).init();
			await new MediaManager(this.documentEl).init();
		}
	}

	public async loadChildDocuments() {
		if (!this.documentEl) return;
		this.findElements();
		// prevent infinite recursion
		let parentTemp: WebpageDocument | null = this;
		let parentCount = 0;
		while (parentTemp) {
			parentTemp = parentTemp.parent;
			parentCount++;
		}
		if (parentCount > 4) return;

		// load child documents
		const childRefs = Array.from(
			this.documentEl.querySelectorAll(
				"link[itemprop='include-document']"
			)
		);
		const promises: Promise<WebpageDocument | undefined>[] = [];
		for (const ref of childRefs) {
			const url = ref.getAttribute("href");
			if (!url) continue;
			const childPromise = new WebpageDocument(url).load(
				this,
				ref.parentElement as HTMLElement
			);
			promises.push(childPromise);
			console.log("Loading child", url);
			ref.remove();
		}

		const childrenTemp = await Promise.all(promises);
		console.log("Loaded child documents", childrenTemp);
		this.children.push(...childrenTemp.filter((c) => c != undefined) as WebpageDocument[]);
	}

	public async loadChild(
		url: string,
		containerEl: HTMLElement
	): Promise<WebpageDocument | undefined> {
		let child = new WebpageDocument(url);
		let loaded = await child.load(this, containerEl);
		if (loaded) this.children.push(loaded);
		return loaded;
	}

	public async unloadChild(child: WebpageDocument) {
		this.children = this.children.filter((c) => c != child);
		child.documentEl?.remove();
	}

	public getMinReadableWidth(): number {
		const fontSize = parseFloat(
			getComputedStyle(this.sizerEl ?? this.documentEl).fontSize
		);
		return fontSize * 30;
	}

	/**
 * 初始化机器类型标签图标
 * 根据 machine-type-tag 的 title 属性显示对应的 SVG 图标
 */
	private initMachineTypeTags() {
		const scope = this.containerEl ?? this.documentEl;
		if (!scope) return;

		const tags = Array.from(scope.querySelectorAll<HTMLElement>('.machine-type-tag'));

		for (const tag of tags) {
			const title = tag.getAttribute('title')?.toLowerCase() || '';

			// 清空原有内容
			tag.replaceChildren();

			// 根据 title 显示对应的图标
			if (title === 'windows') {
				this.createSVGIcon(tag, 'windows');
			} else if (title === 'linux') {
				this.createSVGIcon(tag, 'linux');
			} else if (title === 'both') {
				this.createSVGIcon(tag, 'both');
			}
		}
	}

	/**
	 * 创建 SVG 图标
	 */
	private createSVGIcon(container: HTMLElement, type: 'windows' | 'linux' | 'both') {
		// 创建图标并设置基础属性
		const img = document.createElement('img');
		img.classList.add('machine-type-icon__image', `machine-type-icon__image--${type}`);
		const filename = type === 'both' ? 'both.svg' : `${type}.svg`;
		img.src = `${Shared.libFolderName}/${Shared.mediaFolderName}/${filename}`;
		switch (type) {
			case 'both':
				img.alt = 'Windows 和 Linux';
				break;
			case 'windows':
				img.alt = 'Windows';
				break;
			default:
				img.alt = 'Linux';
		}
		img.decoding = 'async';
		img.loading = 'lazy';

		if (!this.moveMachineTypeIconToTitle(container, img)) {
			container.appendChild(img);
		}
	}

	// 将系统图标移动到标题前方
	private moveMachineTypeIconToTitle(container: HTMLElement, icon: HTMLImageElement): boolean {
		const card = container.closest<HTMLElement>('.machine-card');
		if (!card) {
			return false;
		}
		const titleLink = card.querySelector<HTMLAnchorElement>('.machine-title');
		if (!titleLink) {
			return false;
		}

		const iconWrapper = this.ensureMachineTitleIconWrapper(titleLink);
		iconWrapper.replaceChildren(icon);
		this.ensureMachineTitleTextWrapper(titleLink);
		container.remove();
		return true;
	}

	// 确保标题存在用于放置图标的容器
	private ensureMachineTitleIconWrapper(titleLink: HTMLAnchorElement): HTMLSpanElement {
		let wrapper = titleLink.querySelector<HTMLSpanElement>('.machine-title__icon');
		if (!wrapper) {
			wrapper = document.createElement('span');
			wrapper.className = 'machine-title__icon';
			titleLink.insertBefore(wrapper, titleLink.firstChild);
		}
		return wrapper;
	}

	// 确保标题文本被包裹，方便实现省略号效果
	private ensureMachineTitleTextWrapper(titleLink: HTMLAnchorElement): void {
		let textWrapper = titleLink.querySelector<HTMLSpanElement>('.machine-title__text');
		const iconWrapper = titleLink.querySelector<HTMLSpanElement>('.machine-title__icon');
		if (!textWrapper) {
			textWrapper = document.createElement('span');
			textWrapper.className = 'machine-title__text';
			titleLink.appendChild(textWrapper);
		}

		const nodesToWrap = Array.from(titleLink.childNodes).filter((node) => {
			if (node === textWrapper || node === iconWrapper) {
				return false;
			}
			if (node instanceof HTMLElement && node.classList.contains('machine-title__icon')) {
				return false;
			}
			return true;
		});

		if (nodesToWrap.length > 0) {
			for (const node of nodesToWrap) {
				textWrapper.appendChild(node);
			}
		}

		titleLink.classList.add('machine-title--with-icon');
	}
}

