import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";
import { ExportLog } from "src/plugin/render-api/render-api";
import { ExportPipelineOptions } from "./pipeline-options";
import { AssetHandler } from "../asset-loaders/asset-handler";
import { AssetType } from "../asset-loaders/asset-types";
import { Utils } from "../utils/utils";



export class WebpageTemplate
{
	private doc: Document;
	private options: ExportPipelineOptions;
	private rssURL: string;
	public deferredFeatures: {feature: HTMLElement, featureOptions: InsertedFeatureOptions}[] = [];


	constructor (options: ExportPipelineOptions, rssURL: string)
	{
		this.options = options;
		this.rssURL = rssURL;
	}

	public async loadLayout(): Promise<void>
	{
		this.doc = document.implementation.createHTMLDocument();

		const collapseSidebarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path><path d="M10 4V20"></path><path d="M4 7H7"></path><path d="M4 10H7"></path><path d="M4 13H7"></path></svg>`;
		
		const head = this.doc.head;
		head.innerHTML = `<meta charset="UTF-8">` + head.innerHTML;
		head.innerHTML += `<meta property="og:site_name" content="${this.options.siteName}">`;
		head.innerHTML += `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=5.0">`;

		if (!this.options.combineAsSingleFile)
		{
			if (this.options.rssOptions.enabled)
			{
				head.innerHTML += `<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${this.rssURL}">`;
			}

			head.innerHTML += AssetHandler.getHeadReferences(this.options);
		}

		const body = this.doc.body;
		if (this.options.addBodyClasses)
			body.setAttribute("class", await WebpageTemplate.getValidBodyClasses());

		const main = body.createDiv({attr: {id: "main"}});
		const navbarHost = main.createDiv({ attr: { id: "navbar" } });
		const mobileTopbar = main.createDiv({attr: {id: "mobile-topbar"}});
			const hamburgerBtn = mobileTopbar.createDiv({attr: {id: "mobile-hamburger", class: "clickable-icon", "aria-label": "Toggle navigation"}});
			hamburgerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
			const mobileActions = mobileTopbar.createDiv({attr: {class: "mobile-topbar-actions"}});
		if (this.options.searchOptions.enabled)
		{
			const mobileSearchBtn = mobileActions.createDiv({attr: {class: "mobile-topbar-btn", id: "mobile-search-btn", "aria-label": "Search"}});
			mobileSearchBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
		}
			const mobileThemeBtn = mobileActions.createDiv({attr: {class: "mobile-topbar-btn", id: "mobile-theme-toggle", "aria-label": "Toggle theme"}});
			mobileThemeBtn.innerHTML = `<svg class="theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><svg class="theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
			const mobileReaderBtn = mobileActions.createDiv({attr: {class: "mobile-topbar-btn", id: "mobile-reader-toggle", "aria-label": "Reader mode"}});
			mobileReaderBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0.2" aria-label="Reader mode"><g transform="translate(-1.8, -1.8) scale(1.15, 1.2)"><path d="M8.9891247,2.5 C10.1384702,2.5 11.2209868,2.96705384 12.0049645,3.76669482 C12.7883914,2.96705384 13.8709081,2.5 15.0202536,2.5 L18.7549359,2.5 C19.1691495,2.5 19.5049359,2.83578644 19.5049359,3.25 L19.5046891,4.004 L21.2546891,4.00457396 C21.6343849,4.00457396 21.9481801,4.28672784 21.9978425,4.6528034 L22.0046891,4.75457396 L22.0046891,20.25 C22.0046891,20.6296958 21.7225353,20.943491 21.3564597,20.9931534 L21.2546891,21 L2.75468914,21 C2.37499337,21 2.06119817,20.7178461 2.01153575,20.3517706 L2.00468914,20.25 L2.00468914,4.75457396 C2.00468914,4.37487819 2.28684302,4.061083 2.65291858,4.01142057 L2.75468914,4.00457396 L4.50368914,4.004 L4.50444233,3.25 C4.50444233,2.87030423 4.78659621,2.55650904 5.15267177,2.50684662 L5.25444233,2.5 L8.9891247,2.5 Z M4.50368914,5.504 L3.50468914,5.504 L3.50468914,19.5 L10.9478955,19.4998273 C10.4513189,18.9207296 9.73864328,18.5588115 8.96709342,18.5065584 L8.77307039,18.5 L5.25444233,18.5 C4.87474657,18.5 4.56095137,18.2178461 4.51128895,17.8517706 L4.50444233,17.75 L4.50368914,5.504 Z M19.5049359,17.75 C19.5049359,18.1642136 19.1691495,18.5 18.7549359,18.5 L15.2363079,18.5 C14.3910149,18.5 13.5994408,18.8724714 13.0614828,19.4998273 L20.5046891,19.5 L20.5046891,5.504 L19.5046891,5.504 L19.5049359,17.75 Z M18.0059359,3.999 L15.0202536,4 L14.8259077,4.00692283 C13.9889509,4.06666544 13.2254227,4.50975805 12.7549359,5.212 L12.7549359,17.777 L12.7782651,17.7601316 C13.4923805,17.2719483 14.3447024,17 15.2363079,17 L18.0059359,16.999 L18.0056891,4.798 L18.0033792,4.75457396 L18.0056891,4.71 L18.0059359,3.999 Z M8.9891247,4 L6.00368914,3.999 L6.00599909,4.75457396 L6.00599909,4.75457396 L6.00368914,4.783 L6.00368914,16.999 L8.77307039,17 C9.57551536,17 10.3461406,17.2202781 11.0128313,17.6202194 L11.2536891,17.776 L11.2536891,5.211 C10.8200889,4.56369974 10.1361548,4.13636104 9.37521067,4.02745763 L9.18347055,4.00692283 L8.9891247,4 Z"/></g></svg>`;
		const mainHorizontal = main.createDiv({ attr: { id: "main-horizontal" } });
			const leftContent = mainHorizontal.createDiv({attr: {id: "left-content", class: "leaf"}});
				const leftSidebar = leftContent.createDiv({attr: {id: "left-sidebar", class: "sidebar"}});
					const leftSidebarHandle = leftSidebar.createDiv({attr: {class: "sidebar-handle"}});
				const leftTopbar = leftSidebar.createDiv({attr: {class: "sidebar-topbar"}});
					const leftTopbarContent = leftTopbar.createDiv({attr: {class: "topbar-content"}});
					const leftCollapseIcon = leftTopbar.createDiv({attr: {class: "clickable-icon sidebar-collapse-icon"}});
						leftCollapseIcon.innerHTML = collapseSidebarIcon;
				const leftSidebarToolbar = leftSidebar.createDiv({attr: {class: "sidebar-toolbar"}});
			if (this.options.searchOptions.enabled)
			{
				const searchContainer = leftSidebarToolbar.createDiv({attr: {id: "search-container"}});
				const searchIcon = searchContainer.createDiv({attr: {id: "search-icon", "aria-label": "Open search modal"}});
				searchIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
				const searchWrapper = searchContainer.createDiv({attr: {id: "search-wrapper"}});
				const searchInput = searchWrapper.createEl("input");
				searchInput.setAttribute("type", "search");
				searchInput.setAttribute("placeholder", "Ctrl+K");
				searchInput.setAttribute("spellcheck", "false");
				searchInput.setAttribute("enterkeyhint", "search");
				searchWrapper.createDiv({attr: {id: "search-clear-button", "aria-label": "Clear search"}});
			}
			const toolbarActions = leftSidebarToolbar.createDiv({attr: {class: "sidebar-toolbar-actions"}});
						const toolbarThemeBtn = toolbarActions.createDiv({attr: {class: "sidebar-toolbar-btn", id: "sidebar-theme-toggle", "aria-label": "Toggle theme"}});
							toolbarThemeBtn.innerHTML = `<svg class="theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><svg class="theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
						const toolbarReaderBtn = toolbarActions.createDiv({attr: {class: "sidebar-toolbar-btn", id: "reader-mode-toggle", "aria-label": "Reader mode"}});
							toolbarReaderBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0.2" aria-label="Reader mode"><g transform="translate(-1.8, -1.8) scale(1.15, 1.2)"><path d="M8.9891247,2.5 C10.1384702,2.5 11.2209868,2.96705384 12.0049645,3.76669482 C12.7883914,2.96705384 13.8709081,2.5 15.0202536,2.5 L18.7549359,2.5 C19.1691495,2.5 19.5049359,2.83578644 19.5049359,3.25 L19.5046891,4.004 L21.2546891,4.00457396 C21.6343849,4.00457396 21.9481801,4.28672784 21.9978425,4.6528034 L22.0046891,4.75457396 L22.0046891,20.25 C22.0046891,20.6296958 21.7225353,20.943491 21.3564597,20.9931534 L21.2546891,21 L2.75468914,21 C2.37499337,21 2.06119817,20.7178461 2.01153575,20.3517706 L2.00468914,20.25 L2.00468914,4.75457396 C2.00468914,4.37487819 2.28684302,4.061083 2.65291858,4.01142057 L2.75468914,4.00457396 L4.50368914,4.004 L4.50444233,3.25 C4.50444233,2.87030423 4.78659621,2.55650904 5.15267177,2.50684662 L5.25444233,2.5 L8.9891247,2.5 Z M4.50368914,5.504 L3.50468914,5.504 L3.50468914,19.5 L10.9478955,19.4998273 C10.4513189,18.9207296 9.73864328,18.5588115 8.96709342,18.5065584 L8.77307039,18.5 L5.25444233,18.5 C4.87474657,18.5 4.56095137,18.2178461 4.51128895,17.8517706 L4.50444233,17.75 L4.50368914,5.504 Z M19.5049359,17.75 C19.5049359,18.1642136 19.1691495,18.5 18.7549359,18.5 L15.2363079,18.5 C14.3910149,18.5 13.5994408,18.8724714 13.0614828,19.4998273 L20.5046891,19.5 L20.5046891,5.504 L19.5046891,5.504 L19.5049359,17.75 Z M18.0059359,3.999 L15.0202536,4 L14.8259077,4.00692283 C13.9889509,4.06666544 13.2254227,4.50975805 12.7549359,5.212 L12.7549359,17.777 L12.7782651,17.7601316 C13.4923805,17.2719483 14.3447024,17 15.2363079,17 L18.0059359,16.999 L18.0056891,4.798 L18.0033792,4.75457396 L18.0056891,4.71 L18.0059359,3.999 Z M8.9891247,4 L6.00368914,3.999 L6.00599909,4.75457396 L6.00599909,4.75457396 L6.00368914,4.783 L6.00368914,16.999 L8.77307039,17 C9.57551536,17 10.3461406,17.2202781 11.0128313,17.6202194 L11.2536891,17.776 L11.2536891,5.211 C10.8200889,4.56369974 10.1361548,4.13636104 9.37521067,4.02745763 L9.18347055,4.00692283 L8.9891247,4 Z"/></g></svg>`;
				const leftSidebarContentWrapper = leftSidebar.createDiv({attr: {class: "sidebar-content-wrapper"}});
					const leftSidebarContent = leftSidebarContentWrapper.createDiv({attr: {id: "left-sidebar-content", class: "leaf-content"}});
			const centerContent = mainHorizontal.createDiv({attr: {id: "center-content", class: "leaf"}});
			const rightContent = mainHorizontal.createDiv({attr: {id: "right-content", class: "leaf"}});
				const rightSidebar = rightContent.createDiv({attr: {id: "right-sidebar", class: "sidebar"}});
					const rightSidebarHandle = rightSidebar.createDiv({attr: {class: "sidebar-handle"}});
					const rightTopbar = rightSidebar.createDiv({attr: {class: "sidebar-topbar"}});
						const rightTopbarContent = rightTopbar.createDiv({attr: {class: "topbar-content"}});
						const rightCollapseIcon = rightTopbar.createDiv({attr: {class: "clickable-icon sidebar-collapse-icon"}});
							rightCollapseIcon.innerHTML = collapseSidebarIcon;
					const rightSidebarContentWrapper = rightSidebar.createDiv({attr: {class: "sidebar-content-wrapper"}});
						const rightSidebarContent = rightSidebarContentWrapper.createDiv({attr: {id: "right-sidebar-content", class: "leaf-content"}});

		leftContent.style.setProperty("--sidebar-width", "var(--sidebar-width-left)");
		rightContent.style.setProperty("--sidebar-width", "var(--sidebar-width-right)");

		let leftSidebarScript = leftSidebar.createEl("script");
		let rightSidebarScript = rightSidebar.createEl("script");
		leftSidebarScript.setAttribute("defer", "");
		rightSidebarScript.setAttribute("defer", "");
		leftSidebarScript.innerHTML = `let ls = document.querySelector("#left-sidebar"); ls.classList.toggle("is-collapsed", window.innerWidth < 768); ls.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-left-width"));`;
		rightSidebarScript.innerHTML = `let rs = document.querySelector("#right-sidebar"); rs.classList.toggle("is-collapsed", window.innerWidth < 768); rs.style.setProperty("--sidebar-width", localStorage.getItem("sidebar-right-width"));`;

		// delete sidebars if they are not needed
		if (!this.options.sidebarOptions.enabled)
		{
			leftSidebar.remove();
			rightSidebar.remove();
			mobileTopbar.remove();
		}

		// build top navbar after layout is created
		this.buildNavbar(navbarHost);
	}

	private buildNavbar(navbarHost: HTMLElement): void
	{
		const navbarOptions = (this.options as any).navbarOptions;
		if (!navbarOptions || !navbarOptions.enabled || !navbarHost) return;

		const nav = this.doc.createElement("nav");
		nav.id = "website-navbar";
		nav.className = "website-navbar";

		// allow height & background to be configured
		if (navbarOptions.height)
		{
			nav.style.height = navbarOptions.height;
			nav.style.setProperty("--navbar-height", navbarOptions.height);
		}
		if (navbarOptions.backgroundColor)
		{
			nav.style.backgroundColor = navbarOptions.backgroundColor;
		}

		const linksContainer = this.doc.createElement("div");
		linksContainer.className = "navbar-links";

		const links = navbarOptions.links ?? [];
		for (const link of links)
		{
			if (!link || !link.text || !link.url) continue;

			const anchor = this.doc.createElement("a");
			anchor.className = "navbar-link";
			anchor.href = link.url;
			anchor.textContent = link.text;

			// 外部链接（如 http://、https://、obsidian:// 等）在新标签页打开
			if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(link.url))
			{
				anchor.setAttribute("target", "_blank");
				anchor.setAttribute("rel", "noopener noreferrer");
			}

			linksContainer.appendChild(anchor);
		}

		// only attach if there is content
		if (linksContainer.childElementCount > 0)
		{
			nav.appendChild(linksContainer);
			navbarHost.appendChild(nav);
		}
	}

	public insertFeature(feature: HTMLElement, featureOptions: InsertedFeatureOptions): void
	{
		const existingFeature = this.doc.body.querySelector("#" + featureOptions.featureId);
		if (existingFeature)
		{
			console.warn(`Feature with id ${featureOptions.featureId} already exists in the layout. Removing the existing feature.`);
			existingFeature.remove();
		}

		let insertedSuccesfully = featureOptions.insertFeature(this.doc.documentElement, feature);

		if (insertedSuccesfully)
		{
			// check if there are any deferred features that can now be inserted
			let deferredFeatures = this.deferredFeatures;
			this.deferredFeatures = [];
			for (let deferredFeature of deferredFeatures)
			{
				if (deferredFeature.feature === feature) continue;
				this.insertFeature(deferredFeature.feature, deferredFeature.featureOptions);
			}
		}
		else
		{
			// try to insert the feature later when new features are added
			this.deferredFeatures.push({feature, featureOptions});
		}
	}

	public insertFeatureString(feature: string, featureOptions: InsertedFeatureOptions): void
	{
		let div = this.doc.createElement("div");
		div.classList.add("parsed-feature-container");
		div.style.display = "contents";
		div.innerHTML = feature;
		this.insertFeature(div as HTMLElement, featureOptions);
	}

	public getDocElementInner(): string
	{
		for (let feature of this.deferredFeatures)
		{
			ExportLog.warning(`Could not insert feature ${feature.featureOptions.featureId} with placement: ${feature.featureOptions.featurePlacement}`);
		}

		return this.doc.documentElement.innerHTML;
	}

	private static readonly ignoreClasses = ["publish", "css-settings-manager", "theme-light", "theme-dark"];
	public static async getValidBodyClasses(): Promise<string>
	{
		const bodyClasses = Array.from(document.body.classList); 

		let validClasses = "";
		validClasses += " publish ";
		validClasses += " css-settings-manager ";
		
		// keep body classes that are referenced in the styles
		const styles = AssetHandler.getAssetsOfType(AssetType.Style);
		let i = 0;
		let classes: string[] = [];

		for (const style of styles)
		{
			ExportLog.progress(0, "Compiling css classes", "Scanning: " + style.filename, "var(--color-yellow)");
			if (typeof(style.data) != "string") continue;
			
			// this matches every class name with the dot
			const matches = Array.from(style.data.matchAll(/\.([A-Za-z_-]+[\w-]+)/g));
			let styleClasses = matches.map(match => match[0].substring(1).trim());
			// remove duplicates
			styleClasses = styleClasses.filter((value, index, self) => self.indexOf(value) === index);
			classes = classes.concat(styleClasses);
			i++;
			await Utils.delay(0);
		}

		// remove duplicates
		ExportLog.progress(0, "Filtering classes", "...", "var(--color-yellow)");
		classes = classes.filter((value, index, self) => self.indexOf(value) === index);
		ExportLog.progress(0, "Sorting classes", "...", "var(--color-yellow)");
		classes = classes.sort();

		i = 0;
		for (const bodyClass of bodyClasses)
		{
			ExportLog.progress(0, "Collecting valid classes", "Scanning: " + bodyClass, "var(--color-yellow)");

			if (classes.includes(bodyClass) && !WebpageTemplate.ignoreClasses.includes(bodyClass))
			{
				validClasses += bodyClass + " ";
			}

			i++;
		}

		ExportLog.progress(0, "Cleanup classes", "...", "var(--color-yellow)");
		let result = validClasses.replace(/\s\s+/g, ' ');

		// convert to array and remove duplicates
		ExportLog.progress(0, "Filter duplicate classes", result.length + " classes", "var(--color-yellow)");
		result = result.split(" ").filter((value, index, self) => self.indexOf(value) === index).join(" ").trim();
		
		ExportLog.progress(0, "Classes done", "...", "var(--color-yellow)");

		return result;
	}
}
