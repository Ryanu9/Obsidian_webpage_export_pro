import { InsertedFeatureOptions } from "./features/feature-options-base";
import { InsertedFeature } from "./inserted-feature";

export abstract class DynamicInsertedFeature<
	TOptions extends InsertedFeatureOptions,
	TDependencies extends object = {}
> extends InsertedFeature<TOptions> {
	private dependencies: TDependencies;

	constructor(
		options: TOptions,
		dependencies: TDependencies,
		existingElement?: HTMLElement
	) {
		super(options, existingElement);
		this.dependencies = dependencies;
		this.updateContent(); // Initial content generation
	}

	/**
	 * Manually regenerate the feature content.
	 * Call this method whenever the dependencies have changed and the feature needs to update.
	 */
	public regenerate(): void {
		this.updateContent();
	}

	/**
	 * Update the dependencies object and optionally regenerate the content
	 * @param newDependencies The new dependencies object
	 * @param autoRegenerate Whether to automatically regenerate the content (defaults to true)
	 */
	public updateDependencies(
		newDependencies: TDependencies,
		autoRegenerate: boolean = true
	): void {
		this.dependencies = newDependencies;
		if (autoRegenerate) {
			this.regenerate();
		}
	}

	/**
	 * Modify dependencies using a lambda function and optionally regenerate the content
	 * @param modifier Function that takes current dependencies and returns modified dependencies
	 * @param autoRegenerate Whether to automatically regenerate the content (defaults to true)
	 */
	public modifyDependencies(
		modifier: (deps: TDependencies) => void,
		autoRegenerate: boolean = true
	): void {
		modifier(this.dependencies);
		if (autoRegenerate) {
			this.regenerate();
		}
	}

	/**
	 * Get the current dependencies
	 */
	protected getDependencies(): TDependencies {
		return this.dependencies;
	}

	/**
	 * Update the feature's content
	 */
	protected updateContent(): void {
		let contentEl = this.getElement(InsertedFeature.CONTENT_KEY);
		const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);

		if (!featureEl) return;

		// Check if feature element is disconnected from DOM
		if (!featureEl.isConnected) {
			// Reinsert the feature element
			this.options.insertFeature(document.body, featureEl);
		}


		if (!contentEl?.isConnected || !featureEl.contains(contentEl)) {
			// Content element is missing or was moved elsewhere and deleted
			// We need to recreate it
			const contentClassName = `${this.options.featureId}-content`;

			// First check if it still exists inside featureEl (unlikely but possible)
			let existingContent = featureEl.querySelector(`.${contentClassName}`) as HTMLElement;

			if (existingContent) {
				contentEl = existingContent;
			} else {
				// Create new content element
				contentEl = document.createElement("div");
				contentEl.className = contentClassName;
				featureEl.appendChild(contentEl);
			}

			// Update the reference in the elements map
			this.elements.set(InsertedFeature.CONTENT_KEY, contentEl);
		}

		if (!contentEl) return;

		// Clear existing content
		while (contentEl.firstChild) {
			contentEl.removeChild(contentEl.firstChild);
		}

		this.generateContent(contentEl);
	}

	/**
	 * Generate the feature content - must be implemented by subclasses
	 */
	protected abstract generateContent(container: HTMLElement): void;

	public hide(): void {
		const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);
		if (featureEl) {
			featureEl.style.display = "none";
		}
	}

	public show(): void {
		const featureEl = this.getElement(InsertedFeature.FEATURE_KEY);
		if (featureEl) {
			featureEl.style.display = "";
		}
	}
}
