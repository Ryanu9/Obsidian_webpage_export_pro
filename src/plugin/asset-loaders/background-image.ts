import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";

export class BackgroundImage extends AssetLoader
{
    public variant: "light" | "dark";
    public loaded: Promise<void> = Promise.resolve();

    constructor(variant: "light" | "dark")
    {
        super(`background-image-${variant}.png`, "", null, AssetType.Media, InlinePolicy.Download, false, Mutability.Dynamic);
        this.variant = variant;
    }
    
    override async load()
    {
        this.data = "";
        await super.load();
    }

    public getBackgroundCSSUrl(): string
    {
        const bgUrl = this.variant === "light" 
            ? this.exportOptions.backgroundImageLightUrl 
            : this.exportOptions.backgroundImageDarkUrl;

        if (bgUrl && bgUrl.trim().length > 0)
        {
            return bgUrl;
        }

        return "";
    }
}
