import { FeatureGenerator } from "./feature-generator";


export class SearchInput implements FeatureGenerator
{
	public inputContainerEl: HTMLElement;
	public inputWrapperEl: HTMLElement;
	public inputEl: HTMLInputElement;
	public clearButtonEl: HTMLElement;

	async generate(container?: HTMLElement): Promise<HTMLElement> 
	{
		container = container ?? document.body;
		this.inputContainerEl = container.createDiv({ attr: {id: "search-container"} });

		// 放大镜图标，用于触发模态搜索（带有 CSS 动画）
		const searchIconEl = this.inputContainerEl.createDiv({ attr: { id: "search-icon", "aria-label": "Open search modal" } });
		searchIconEl.innerHTML = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
	<circle cx="11" cy="11" r="8"></circle>
	<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>`;

		this.inputWrapperEl = this.inputContainerEl.createDiv({ attr: {id: "search-wrapper"} });
		this.inputEl = this.inputWrapperEl.createEl("input");
		this.inputEl.setAttribute("enterkeyhint", "search");
		this.inputEl.setAttribute("type", "search");
		this.inputEl.setAttribute("spellcheck", "false");
		this.inputEl.setAttribute("placeholder", "Ctrl+K");
		this.clearButtonEl = this.inputWrapperEl.createDiv({ attr: { "aria-label": "Clear search", id: "search-clear-button" } });

		return this.inputContainerEl;
	}
	
}
