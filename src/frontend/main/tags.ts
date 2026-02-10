import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { InsertedFeatureOptions } from "src/shared/features/feature-options-base";
import { LinkHandler } from "./links";

interface TagsDependencies {
	tags: string[];
}

export class Tags extends DynamicInsertedFeature<
	InsertedFeatureOptions,
	TagsDependencies
> {
	constructor(tags: string[]) {
		super(ObsidianSite.metadata.featureOptions.tags, { tags });
	}

	protected generateContent(container: HTMLElement) {
		const deps = this.getDependencies();

		// Add tag icon before tags
		const iconEl = document.createElement("span");
		iconEl.className = "tags-icon";
		iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;
		container.appendChild(iconEl);

		for (const tagName of deps.tags) {
			const tagEl = document.createElement("a");
			tagEl.classList.add("tag");
			tagEl.setAttribute(
				"href",
				`?query=tags:${tagName.replace("#", "")}`
			);
			tagEl.innerText = tagName;
			container.appendChild(tagEl);
		}

		LinkHandler.initializeLinks(container);
	}
}
