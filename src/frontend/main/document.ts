import { WebpageData, DocumentType } from "src/shared/website-data";
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

			let newDocumentEl = this.sourceHtml.querySelector(".obsidian-document");

			if (newDocumentEl) {
				newDocumentEl = document.adoptNode(newDocumentEl);
				const docEl = containerEl.querySelector(".obsidian-document");
				if (docEl) {
					docEl.before(newDocumentEl);
					docEl.remove();
				} else containerEl.appendChild(newDocumentEl);
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
		this.postProcess();

		if (this.isMainDocument || this.isPreview) {
			this.processHeaders();
			this.processCallouts();
			this.processLists();
			this.initNewImageZoom();
		}

		if (this.documentType == DocumentType.Canvas) {
			this.canvas = new Canvas(this);
		}

		if (this.isMainDocument || this.isPreview)
			LinkHandler.initializeLinks(this.documentEl ?? this.containerEl);

		return this;
	}

	private initNewImageZoom() {
		// Inject CSS first
		if (!document.getElementById("image-zoom-style")) {
			const style = document.createElement("style");
			style.id = "image-zoom-style";
			style.innerHTML = `
			.markdown-rendered img:not(.callout-icon):not(.file-list-item-icon) {
				cursor: zoom-in;
				transition: none;
			}
			#outerdiv {
				position: fixed;
				top: 0;
				left: 0;
				background: rgba(0,0,0,0.5);
				z-index: 9999;
				width: 100%;
				height: 100%;
				display: none;
			}
			#bigimg {
				position: absolute;
				cursor: zoom-out;
			}
			`;
			document.head.appendChild(style);
		}

		// Inject HTML structure if not exists
		if (!document.getElementById("outerdiv")) {
			const zoomHtml = `<div id="outerdiv"><img id="bigimg" src="" /></div>`;
			document.body.insertAdjacentHTML('beforeend', zoomHtml);
		}

		const outerdiv = document.querySelector("#outerdiv") as HTMLElement;
		const image = document.querySelector("#bigimg") as HTMLImageElement;

		if (!outerdiv || !image) return;

		let initScale = 1;
		let x = 0;
		let y = 0;
		let isPointerdown = false;
		let lastPointermove = { x: 0, y: 0 };
		const maxZoom = 4;
		const minreduce = 0.5;

		const imgShow = (that: HTMLImageElement) => {
			let src = that.getAttribute("src");
			if (src) image.setAttribute("src", src);

			// Reset state
			initScale = 1;
			x = 0;
			y = 0;
			isPointerdown = false;

			let windowW = document.documentElement.clientWidth;
			let windowH = document.documentElement.clientHeight;
			let realWidth = that.naturalWidth;
			let realHeight = that.naturalHeight;
			let imgWidth, imgHeight;

			// Initial size calculation
			var scale = 0.8;
			if (realWidth == 0 || realHeight == 0) { // Fallback if natural dimensions aren't available yet
				realWidth = that.width || 0;
				realHeight = that.height || 0;
			}

			// If still 0, try to wait for load? Or just default?
			if (realWidth == 0) realWidth = 500;
			if (realHeight == 0) realHeight = 500;

			if (realWidth > windowW * scale) {
				imgWidth = windowW * scale;
				imgHeight = imgWidth / realWidth * realHeight;
			} else if (realHeight > windowH * scale) {
				imgHeight = windowH * scale;
				imgWidth = imgHeight / realHeight * realWidth;
			} else {
				imgWidth = realWidth;
				imgHeight = realHeight;
			}

			image.style.width = imgWidth + "px";
			image.style.height = imgHeight + "px";

			// Center the image
			x = (windowW - imgWidth) * 0.5;
			y = (windowH - imgHeight) * 0.5;
			image.style.transform = `translate3d(${x}px, ${y}px, 0)`;

			outerdiv.style.display = "block";
		};

		// Event handlers
		const handleStopWheel = (e: WheelEvent) => {
			let itemSizeChange = 1.1;
			if (e.deltaY > 0) { // e.deltaY > 0 means scrolling down (zoom out typically)
				itemSizeChange = 1 / 1.1;
			}

			let _initScale = initScale * itemSizeChange;
			if (_initScale > maxZoom) _initScale = maxZoom;
			else if (_initScale < minreduce) _initScale = minreduce;

			initScale = _initScale;
			image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${initScale})`;
			e.preventDefault();
		};

		const pointermove = (e: PointerEvent) => {
			if (isPointerdown) {
				const diffX = e.clientX - lastPointermove.x;
				const diffY = e.clientY - lastPointermove.y;

				x += diffX;
				y += diffY;

				image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${initScale})`;
				lastPointermove = { x: e.clientX, y: e.clientY };
				e.preventDefault();
			}
		};

		const pointerdown = (e: PointerEvent) => {
			isPointerdown = true;
			lastPointermove = { x: e.clientX, y: e.clientY };
			e.preventDefault();
		}

		const pointerup = (e: PointerEvent) => {
			isPointerdown = false;
			e.preventDefault();
		}

		// Attach listeners to new logic

		if (!outerdiv.hasAttribute('data-listeners-attached')) {
			outerdiv.addEventListener('wheel', handleStopWheel);
			outerdiv.addEventListener('pointerdown', pointerdown);
			outerdiv.addEventListener('pointermove', pointermove);
			outerdiv.addEventListener('pointerup', pointerup);
			outerdiv.addEventListener('click', (e) => {
				if (e.target === outerdiv) {
					outerdiv.style.display = 'none';
				}
			});
			outerdiv.setAttribute('data-listeners-attached', 'true');
		}

		// Attach click listeners to all images in the document
		// We filter out some icons
		const images = this.documentEl.querySelectorAll("img:not(.callout-icon):not(.file-list-item-icon)");
		images.forEach(img => {
			if (!img.hasAttribute('data-zoom-initialized')) {
				img.addEventListener('click', () => imgShow(img as HTMLImageElement));
				img.setAttribute('data-zoom-initialized', 'true');
			}
		});
	}

	public processHeaders() {
		this.headers = Header.createHeaderTree(this.documentEl);
	}

	public processCallouts() {
		const calloutEls = Array.from(
			this.documentEl.querySelectorAll(".callout")
		);
		this.callouts = [];
		for (const calloutEl of calloutEls) {
			this.callouts.push(new Callout(calloutEl as HTMLElement));
		}
	}

	public processLists() {
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

	public postProcess() {
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
	}

	public async loadChildDocuments() {
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
}
