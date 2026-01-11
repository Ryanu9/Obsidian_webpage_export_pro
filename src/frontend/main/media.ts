export class MediaManager {
    public containerEl: HTMLElement;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
    }

    public async init() {
        this.addMediaLabels();
    }

    private addMediaLabels() {
        // Inject CSS
        if (!document.getElementById("media-label-style")) {
            const style = document.createElement("style");
            style.id = "media-label-style";
            style.innerHTML = `
                .media-embed-label {
                    font-size: 0.85em;
                    color: var(--text-muted);
                    margin-bottom: 8px;
                    display: block;
                    font-family: var(--font-interface);
                    font-weight: 500;
                    opacity: 0.8;
                }
                .internal-embed.media-embed {
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 1em;
                }
            `;
            document.head.appendChild(style);
        }

        const embeds = this.containerEl.querySelectorAll(".internal-embed.media-embed.audio-embed, .internal-embed.media-embed.video-embed");
        embeds.forEach((embed: HTMLElement) => {
            if (embed.querySelector(".media-embed-label")) return;

            const filename = embed.getAttribute("alt");
            if (filename) {
                const label = document.createElement("div");
                label.className = "media-embed-label";
                label.innerText = filename;
                embed.prepend(label);
            }
        });
    }
}
