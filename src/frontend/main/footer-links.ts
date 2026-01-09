import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { FooterLinksOptions, FooterLinkItem } from "src/shared/features/footer-links";
import { InsertedFeature } from "src/shared/inserted-feature";

interface FooterLinksDependencies {
}

export class FooterLinks extends DynamicInsertedFeature<
	FooterLinksOptions,
	FooterLinksDependencies
> {
	private themeChangeListener: (() => void) | null = null;

	constructor() {
		super(ObsidianSite.metadata.featureOptions.footerLinks, {});
	}

	protected getElementDefinitions() {
		
		return {
			[InsertedFeature.FEATURE_KEY]: {
				type: "div",
				className: ["feature", "hide"],
				id: this.options.featureId,
			},
			[InsertedFeature.CONTENT_KEY]: {
				type: "div",
				className: `${this.options.featureId}-content`,
			},
		};
	}

	protected getElementHierarchy() {
		
		return {
			[InsertedFeature.FEATURE_KEY]: null, // root
			[InsertedFeature.CONTENT_KEY]: InsertedFeature.FEATURE_KEY,
		};
	}

	protected generateContent(container: HTMLElement) {
		const links = this.options.links || [];
		
		if (links.length === 0) {
			return;
		}

		// 创建底部链接容器
		const linksEl = document.createElement("div");
		linksEl.id = "footer-links";
		linksEl.classList.add("copy-link");

		// 检测当前主题（亮色或暗色）
		const isDarkTheme = document.body.classList.contains("theme-dark") || 
			document.body.classList.contains("obsidian-appearance-dark") ||
			(!document.body.classList.contains("theme-light") && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
		
		const linkColor = isDarkTheme 
			? (this.options.linkColorDark || "#3ac4df")
			: (this.options.linkColorLight || "#0c6fff");

		// 创建链接
		links.forEach((link, index) => {
			if (link.text && link.url) {
				const linkEl = document.createElement("a");
				linkEl.href = link.url;
				linkEl.textContent = link.text;
				linkEl.style.color = linkColor;
				linkEl.style.textDecoration = "none";
				linkEl.target = "_blank";
				linkEl.rel = "noopener noreferrer";
				
				linkEl.addEventListener("mouseenter", () => {
					linkEl.style.opacity = "0.8";
				});
				linkEl.addEventListener("mouseleave", () => {
					linkEl.style.opacity = "1";
				});

				linksEl.appendChild(linkEl);

				// 分隔符 " | "
				if (index < links.length - 1) {
					const separator = document.createTextNode(" | ");
					linksEl.appendChild(separator);
				}
			}
		});

		container.appendChild(linksEl);
	}

	private updateLinkColors() {
		const linksContainer = document.getElementById("footer-links");
		if (!linksContainer) {
			return;
		}

		const isDarkTheme = document.body.classList.contains("theme-dark");
		const linkColor = isDarkTheme
			? (this.options.linkColorDark || "#3ac4df")
			: (this.options.linkColorLight || "#0c6fff");

		const linkEls = linksContainer.querySelectorAll<HTMLAnchorElement>("a");
		linkEls.forEach(linkEl => {
			linkEl.style.color = linkColor;
		});
	}

	private setupThemeSync() {
		if (this.themeChangeListener) return;

		this.themeChangeListener = () => {
			this.updateLinkColors();
		};

		const themeToggle = document.querySelector(".theme-toggle-input");
		if (themeToggle) {
			themeToggle.addEventListener("change", this.themeChangeListener);
		}
	}

	protected onAfterMount(): void {
		super.onAfterMount();

		const footerBar = document.querySelector(".footer .data-bar") as HTMLElement;
		if (footerBar) {
			const footerLinksEl = this.getElement(InsertedFeature.FEATURE_KEY);
			const copyrightEl = document.querySelector("#copyright")?.closest(".feature");
			
			if (footerLinksEl && footerLinksEl.parentElement === footerBar) {

				if (copyrightEl && copyrightEl.parentElement === footerBar) {
					footerBar.insertBefore(footerLinksEl, copyrightEl);
				}
			}
		}

		// 在挂载后初始化主题联动，使切换主题时根据配置颜色更新底部链接颜色
		this.setupThemeSync();
		// 确保当前主题下的颜色也是正确的
		this.updateLinkColors();
	}
}
