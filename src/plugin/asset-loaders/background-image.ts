import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { Path } from "src/plugin/utils/path";

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
        const bgUrl = this.variant === "light" 
            ? this.exportOptions.backgroundImageLightUrl 
            : this.exportOptions.backgroundImageDarkUrl;
        const bgPath = this.variant === "light" 
            ? this.exportOptions.backgroundImageLightPath 
            : this.exportOptions.backgroundImageDarkPath;

        // If URL is set, we don't need to load a local file - CSS will reference the URL directly
        if (bgUrl && bgUrl.trim().length > 0)
        {
            this.data = "";
            await super.load();
            return;
        }

        if (!bgPath || bgPath.trim().length === 0)
        {
            this.data = "";
            await super.load();
            return;
        }

        const imagePath = new Path(bgPath);
        if (imagePath.isEmpty)
        {
            await super.load();
            return;
        }
        
        const imageData = await imagePath.readAsBuffer();
        if (imageData) 
        {
            this.data = imageData;
            this.targetPath.fullName = `background-image-${this.variant}` + imagePath.extension;
            this.source = app.vault.getFileByPath(imagePath.path);
            if (!this.source)
            {
                const stat = imagePath.stat;
                if (stat)
                {
                    this.sourceStat = {ctime: stat.ctimeMs, mtime: stat.mtimeMs, size: stat.size};
                }
            }
        }

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

        if (this.data && this.data.length > 0)
        {
            if (this.exportOptions.inlineMedia)
            {
                const ext = this.targetPath.extension.replace(".", "");
                const mimeType = ext === "gif" ? "image/gif" : 
                                 ext === "webp" ? "image/webp" :
                                 ext === "svg" ? "image/svg+xml" :
                                 ext === "png" ? "image/png" : 
                                 ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
                return `data:${mimeType};base64,${this.data.toString("base64")}`;
            }
            else
            {
                return this.getAssetPath(undefined).path;
            }
        }

        return "";
    }
}
