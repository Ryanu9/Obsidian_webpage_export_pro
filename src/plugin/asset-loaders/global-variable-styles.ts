import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Settings } from "src/plugin/settings/settings";
import { AssetHandler } from "./asset-handler.js";

export class GlobalVariableStyles extends AssetLoader
{
    constructor()
    {
        super("global-variable-styles.css", "", null, AssetType.Style, InlinePolicy.AutoHead, true, Mutability.Dynamic, LoadMethod.Async, 6);
    }
    
    override async load()
    {
        // Wait for background image assets to finish loading first (fixes race condition)
        await Promise.all([
            AssetHandler.backgroundImageLight?.load(),
            AssetHandler.backgroundImageDark?.load(),
        ].filter(Boolean));

        const bodyStyle = (document.body.getAttribute("style") ?? "").replaceAll("\"", "'").replaceAll("; ", " !important;\n\t");
		let lineWidth = this.exportOptions.documentOptions.documentWidth || "45em";
		let sidebarWidthRight = this.exportOptions.sidebarOptions.rightDefaultWidth;
		let sidebarWidthLeft = this.exportOptions.sidebarOptions.leftDefaultWidth;
		if (!isNaN(Number(lineWidth))) lineWidth += "px";
		if (!isNaN(Number(sidebarWidthRight))) sidebarWidthRight += "px";
		if (!isNaN(Number(sidebarWidthLeft))) sidebarWidthLeft += "px";

		const lineWidthCss = `min(${lineWidth}, calc(100vw - 2em))`;
		this.data = 
        `
        :root body
        {
			--line-width: ${lineWidthCss};
			--line-width-adaptive: ${lineWidthCss};
			--file-line-width: ${lineWidthCss};
			--sidebar-width-right: min(${sidebarWidthRight}, 80vw);
			--sidebar-width-left: min(${sidebarWidthLeft}, 80vw);
        }

		body
        {
            ${bodyStyle}
        }
        ${this.getBackgroundImageCSS()}
        `

        await super.load();
    }

    private getBackgroundImageCSS(): string
    {
        const lightUrl = AssetHandler.backgroundImageLight?.getBackgroundCSSUrl() ?? "";
        const darkUrl = AssetHandler.backgroundImageDark?.getBackgroundCSSUrl() ?? "";

        if (lightUrl.length === 0 && darkUrl.length === 0) return "";

        const blur = this.exportOptions.backgroundBlur ?? 0;
        const opacity = this.exportOptions.backgroundOpacity ?? 1;
        const hasBlurOrOpacity = blur > 0 || opacity < 1;

        let css = "";

        // Use ::before pseudo-element for blur/opacity support
        if (lightUrl.length > 0)
        {
            css += `
            body.theme-light
            {
                position: relative;
            }
            body.theme-light::before
            {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
                background-image: url('${lightUrl}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                ${hasBlurOrOpacity ? `filter: blur(${blur}px);` : ""}
                ${hasBlurOrOpacity ? `opacity: ${opacity};` : ""}
            }
            `;
        }

        if (darkUrl.length > 0)
        {
            css += `
            body.theme-dark
            {
                position: relative;
            }
            body.theme-dark::before
            {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
                background-image: url('${darkUrl}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                ${hasBlurOrOpacity ? `filter: blur(${blur}px);` : ""}
                ${hasBlurOrOpacity ? `opacity: ${opacity};` : ""}
            }
            `;
        }

        // If only one is set, also apply it when no theme class is present (fallback)
        const fallbackUrl = lightUrl.length > 0 ? lightUrl : darkUrl;
        if (fallbackUrl.length > 0 && (lightUrl.length === 0 || darkUrl.length === 0))
        {
            css += `
            body:not(.theme-light):not(.theme-dark)
            {
                position: relative;
            }
            body:not(.theme-light):not(.theme-dark)::before
            {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
                background-image: url('${fallbackUrl}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                ${hasBlurOrOpacity ? `filter: blur(${blur}px);` : ""}
                ${hasBlurOrOpacity ? `opacity: ${opacity};` : ""}
            }
            `;
        }

        return css;
    }
}
