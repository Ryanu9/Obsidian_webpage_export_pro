import { DynamicInsertedFeature } from "src/shared/dynamic-inserted-feature";
import { GiscusOptions } from "src/shared/features/giscus";
import { InsertedFeature } from "src/shared/inserted-feature";

export class Giscus extends DynamicInsertedFeature<GiscusOptions> {
    private themeChangeListener: any;

    constructor() {
        const existing = document.getElementById(ObsidianSite.metadata.featureOptions.giscus.featureId);
        super(ObsidianSite.metadata.featureOptions.giscus, {}, existing || undefined);
    }

    protected generateContent(container: HTMLElement) {
        if (window.location.protocol === "file:") {
            container.innerText = "Giscus does not work on local files (file://). Please host your site on a server.";
            return;
        }

        const options = this.options;
        if (!options.repo || !options.repoId || !options.category || !options.categoryId) {
            console.warn("Giscus is enabled but not fully configured. Please check your settings.");
            return;
        }

        // Remove existing giscus scripts and iframes to avoid conflicts in SPA
        document.querySelectorAll('script[src="https://giscus.app/client.js"]').forEach(s => s.remove());
        document.querySelectorAll('iframe.giscus-frame').forEach(f => f.remove());

        const giscusContainer = document.createElement("div");
        giscusContainer.classList.add("giscus");
        container.appendChild(giscusContainer);

        const script = document.createElement("script");
        script.src = "https://giscus.app/client.js";
        script.setAttribute("data-repo", options.repo);
        script.setAttribute("data-repo-id", options.repoId);
        script.setAttribute("data-category", options.category);
        script.setAttribute("data-category-id", options.categoryId);
        script.setAttribute("data-mapping", options.mapping);
        script.setAttribute("data-strict", options.strict ? "1" : "0");
        script.setAttribute("data-reactions-enabled", options.reactionsEnabled ? "1" : "0");
        script.setAttribute("data-emit-metadata", options.emitMetadata ? "1" : "0");
        script.setAttribute("data-input-position", options.inputPosition);
        script.setAttribute("data-theme", this.getCurrentTheme());
        script.setAttribute("data-lang", options.lang);
        script.setAttribute("data-loading", options.loading);
        script.crossOrigin = "anonymous";
        script.async = true;

        container.appendChild(script);

        this.setupThemeSync();
    }

    private getCurrentTheme(): string {
        const isDark = document.body.classList.contains("theme-dark");
        return isDark ? "dark" : "light";
    }

    private setupThemeSync() {
        if (this.themeChangeListener) return;

        this.themeChangeListener = () => {
            const isDark = document.body.classList.contains("theme-dark");
            const theme = isDark ? "dark" : "light";
            const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    giscus: {
                        setConfig: { theme: theme }
                    }
                }, 'https://giscus.app');
            }
        };

        // Listen to theme changes
        const themeToggle = document.querySelector(".theme-toggle-input");
        if (themeToggle) {
            themeToggle.addEventListener("change", this.themeChangeListener);
        }
    }

    public static initOnEncryptedPage() {
        const options = ObsidianSite.metadata.featureOptions.giscus as GiscusOptions;
        if (!options.enabled || !ObsidianSite.metadata.exportOptions.enableGiscusOnEncryptedPages) return;

        const passwordContainer = document.querySelector('#password-lock-container');
        if (!passwordContainer) return;

        // Cleanup any existing giscus wrapper on the lock screen
        passwordContainer.querySelectorAll('.password-lock__giscus').forEach(el => el.remove());

        const giscusWrapper = document.createElement("div");
        giscusWrapper.classList.add("password-lock__giscus");
        giscusWrapper.style.marginTop = "3rem";
        giscusWrapper.style.width = "100%";
        giscusWrapper.style.maxWidth = "var(--file-line-width)";
        passwordContainer.appendChild(giscusWrapper);

        const giscus = new Giscus();
        const featureEl = giscus.getElement(InsertedFeature.FEATURE_KEY);
        if (featureEl) {
            featureEl.classList.remove("hide");
            giscusWrapper.appendChild(featureEl);
        }
    }
}
