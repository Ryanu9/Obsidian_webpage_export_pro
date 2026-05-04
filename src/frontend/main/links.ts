import { FilePreviewPopover } from "./link-preview";
import { ImageZoom } from "./image-zoom";

const LINK_SELECTOR = ".internal-link, a.tag, a.tree-item-self, a.footnote-link";
const FEATURED_TAG_SELECTOR = "[data-featured-tag-search]";
const FEATURED_CARD_SELECTOR = ".featured-card";
const FEATURED_CARD_IMAGE_SELECTOR = ".featured-card__media img";
const BREADCRUMB_TARGET_SELECTOR = ".breadcrumb-element[data-breadcrumb-target]";

export class LinkHandler
{
	private static delegationInitialized = false;

	private static initDelegation()
	{
		if (this.delegationInitialized) return;
		this.delegationInitialized = true;

		document.body.addEventListener("keydown", (event) =>
		{
			if (event.key != "Enter" && event.key != " ") return;

			const target = event.target as HTMLElement;
			const breadcrumb = target.closest(BREADCRUMB_TARGET_SELECTOR) as HTMLElement | null;
			if (breadcrumb)
			{
				event.preventDefault();
				this.openBreadcrumbTarget(breadcrumb);
				return;
			}

			const tag = target.closest(FEATURED_TAG_SELECTOR) as HTMLElement | null;
			if (!tag) return;

			event.preventDefault();
			this.searchFeaturedTag(tag);
		});

		document.body.addEventListener("click", (event) =>
		{
			const target = event.target as HTMLElement;
			const featuredImage = target.closest(FEATURED_CARD_IMAGE_SELECTOR) as HTMLImageElement | null;
			if (featuredImage && this.shouldZoomFeaturedCardImage())
			{
				event.preventDefault();
				event.stopPropagation();
				ImageZoom.getInstance().show(featuredImage);
				return;
			}

			const breadcrumb = target.closest(BREADCRUMB_TARGET_SELECTOR) as HTMLElement | null;
			if (breadcrumb)
			{
				event.preventDefault();
				this.openBreadcrumbTarget(breadcrumb);
				return;
			}

			const tag = target.closest(FEATURED_TAG_SELECTOR) as HTMLElement | null;
			if (tag)
			{
				event.preventDefault();
				event.stopPropagation();
				this.searchFeaturedTag(tag);
				return;
			}

			const link = target.closest(LINK_SELECTOR) as HTMLElement | null;

			if (!link) return;

			const href = link.getAttribute("href");
			if (!href || href === "null") return;
			if (href.startsWith("http") || href.startsWith("mailto:")) return;

			event.preventDefault();
			ObsidianSite.loadURL(href);

			if (ObsidianSite.deviceSize === "phone")
			{
				const leftSidebar = link.closest("#left-sidebar");
				const rightSidebar = link.closest("#right-sidebar");

				if (leftSidebar && ObsidianSite.leftSidebar?.collapsed === false)
				{
					ObsidianSite.leftSidebar.collapsed = true;
				}
				else if (rightSidebar && ObsidianSite.rightSidebar?.collapsed === false)
				{
					ObsidianSite.rightSidebar.collapsed = true;
				}
			}
		});
	}

	private static shouldZoomFeaturedCardImage(): boolean
	{
		return ObsidianSite.deviceSize === "large-screen" && !document.body.classList.contains("floating-sidebars");
	}

	private static searchFeaturedTag(tag: HTMLElement)
	{
		const query = tag.dataset.featuredTagSearch;
		if (!query) return;

		const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
		input?.focus();
		if (input) input.value = query;
		input?.closest("#search-container")?.classList.add("has-content");
		void ObsidianSite.search?.searchParseFilters(query);
	}

	private static openBreadcrumbTarget(breadcrumb: HTMLElement)
	{
		const target = breadcrumb.dataset.breadcrumbTarget;
		if (!target) return;

		void ObsidianSite.loadURL(target);
	}

	public static initializeLinks(onElement: HTMLElement)
	{
		this.initDelegation();

		onElement?.querySelectorAll(LINK_SELECTOR).forEach(function(link: HTMLElement)
		{
			const target = link.getAttribute("href") ?? "null";

			if(target == "null")
			{
				return;
			}

			if(target && !target.startsWith("http") && !ObsidianSite.documentExists(target))
			{
				link.classList.add("is-unresolved");
			}
			else if (link.classList.contains("internal-link"))
			{
				if (link.matches(FEATURED_CARD_SELECTOR)) return;

				if (!ObsidianSite.metadata?.ignoreMetadata && 
					ObsidianSite.metadata?.featureOptions?.linkPreview?.enabled)
				{
					FilePreviewPopover.initializeLink(link, target);
				}
			}
		});
	}

	public static getPathnameFromURL(url: string): string
	{
		if(url == "" || url == "/" || url == "\\") return "index.html";
		if(url?.startsWith("#") || url?.startsWith("?")) return (ObsidianSite.document?.pathname?.split("#")[0]?.split("?")[0] ?? "") + (url ?? "");
		return url?.split("?")[0]?.split("#")[0]?.trim() ?? "";
	}

	public static getHashFromURL(url: string): string
	{
		return url.split("#")[1]?.trim() ?? "";
	}

	public static getQueryFromURL(url: string): string
	{
		const beforeHash = url.split("#")[0] ?? "";
		return beforeHash.split("?")[1]?.trim() ?? "";
	}

	public static getFileDataIdFromURL(url: string): string
	{
		url = this.getPathnameFromURL(url);
		if (url.startsWith("./")) url = url.substring(2);
		while (url.startsWith("../")) {
			url = url.substring(3);
		}
		return btoa(encodeURI(url));
	}
}
