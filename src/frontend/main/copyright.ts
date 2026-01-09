import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { CopyrightOptions } from "src/shared/features/copyright";
import { InsertedFeature } from "src/shared/inserted-feature";

interface CopyrightDependencies {
}

export class Copyright extends DynamicInsertedFeature<
	CopyrightOptions,
	CopyrightDependencies
> {
	constructor() {
		super(ObsidianSite.metadata.featureOptions.copyright, {});
	}

	protected getElementDefinitions() {
		// 只创建 feature 和 content 元素，不创建 header 和 title
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
		// 只有 content 在 feature 内部，没有 header 和 title
		return {
			[InsertedFeature.FEATURE_KEY]: null, // root
			[InsertedFeature.CONTENT_KEY]: InsertedFeature.FEATURE_KEY,
		};
	}

	protected generateContent(container: HTMLElement) {
		// 替换模板变量
		let text = this.options.copyrightText || "© {year} {author}. All rights reserved.";
		
		// 获取当前年份
		const currentYear = new Date().getFullYear().toString();
		text = text.replace(/{year}/g, currentYear);

		// 获取作者名称（从设置中获取，如果没有则使用站点名称）
		const author = this.options.author || ObsidianSite.metadata.siteName || "Author";
		
		// 创建版权信息元素
		const copyrightEl = document.createElement("div");
		copyrightEl.id = "copyright";
		
		// 处理文本，将 {author} 替换为作者（如果有链接则创建链接）
		const parts = text.split(/{author}/);
		
		if (parts.length === 1) {
			// 没有 {author} 变量，需要处理多行文本
			this.appendTextWithLineBreaks(copyrightEl, text);
		} else {
			// 有 {author} 变量，需要替换
			parts.forEach((part, index) => {
				if (part) {
					this.appendTextWithLineBreaks(copyrightEl, part);
				}
				
				// 在最后一部分之前插入作者
				if (index < parts.length - 1) {
					if (this.options.authorUrl && this.options.authorUrl.trim()) {
						// 如果有作者链接，创建链接元素
						const authorLink = document.createElement("a");
						authorLink.href = this.options.authorUrl;
						authorLink.textContent = author;
						authorLink.style.color = "inherit";
						authorLink.style.textDecoration = "underline";
						authorLink.style.textDecorationColor = "var(--text-muted)";
						authorLink.target = "_blank";
						authorLink.rel = "noopener noreferrer";
						copyrightEl.appendChild(authorLink);
					} else {
						// 没有链接，直接显示作者名称
						copyrightEl.appendChild(document.createTextNode(author));
					}
				}
			});
		}
		
		container.appendChild(copyrightEl);
	}

	private appendTextWithLineBreaks(parent: HTMLElement, text: string) {
		// 处理多行文本，将换行符转换为 <br> 或使用段落
		const lines = text.split('\n');
		lines.forEach((line, index) => {
			if (line) {
				parent.appendChild(document.createTextNode(line));
			}
			if (index < lines.length - 1) {
				parent.appendChild(document.createElement('br'));
			}
		});
	}
}
