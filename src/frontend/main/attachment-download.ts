export class AttachmentDownload {
    private static initialized = false;
    private static lastDownloadTime = 0;
    private static downloadThrottleDelay = 1000;

    constructor() {
        this.init();
    }

    private init() {
        if (AttachmentDownload.initialized) return;

        this.replaceFileIcons();

        // Use event delegation on document body to handle clicks on file embed titles
        document.addEventListener('click', this.handleFileDownloadClick.bind(this), true);

        AttachmentDownload.initialized = true;
    }

    /**
     * Replaces default file icons with a custom download icon
     */
    private replaceFileIcons() {
        const fileIcons = document.querySelectorAll('.file-embed-icon svg');
        const downloadIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1024 1024" fill="currentColor"><path d="M656 240V16H144v992h736V240z" fill="currentColor"></path><path d="M656 16v224h224z" fill="currentColor"></path><path d="M544 608V400h-64v208h-80l112 112 112-112z" fill="currentColor"></path><path d="M895.904 239.824a15.536 15.536 0 0 0-4.464-10.48L666.656 4.56a15.376 15.376 0 0 0-10.336-4.432L656 0H160a32 32 0 0 0-32 32v960a32 32 0 0 0 32 32h704a32 32 0 0 0 32-32V240.432 240l-0.096-0.176zM672 54.096L841.904 224H672V54.096zM864 992H160V32h480v224h224v736zM387.28 617.216c0.528 0.768 0.864 1.648 1.536 2.32l111.664 111.696c0.048 0.048 0.048 0.112 0.096 0.16 3.04 3.04 7.024 4.528 11.024 4.608 0.144 0 0.272 0.08 0.4 0.08s0.272-0.08 0.4-0.08a15.92 15.92 0 0 0 11.024-4.608c0.048-0.048 0.048-0.112 0.096-0.16l111.664-111.696c0.672-0.672 0.992-1.552 1.536-2.32 0.72-0.992 1.552-1.888 2.032-3.024 0.816-1.984 1.232-4.064 1.248-6.176V608c0-0.256-0.128-0.448-0.144-0.704a16.384 16.384 0 0 0-1.104-5.52c-0.064-0.128-0.176-0.208-0.224-0.336a16.048 16.048 0 0 0-3.216-4.88 15.888 15.888 0 0 0-12-4.576H560V400a16 16 0 0 0-16-16h-64a16 16 0 0 0-16 16v192h-63.312a15.888 15.888 0 0 0-12 4.576 15.856 15.856 0 0 0-3.216 4.88c-0.048 0.128-0.16 0.208-0.224 0.336a16.32 16.32 0 0 0-1.104 5.52c-0.016 0.24-0.144 0.432-0.144 0.688v0.016c0.016 2.112 0.432 4.192 1.248 6.176 0.48 1.136 1.312 2.048 2.032 3.024zM480 624a16 16 0 0 0 16-16V416h32v192a16 16 0 0 0 16 16h41.072L512 697.12 438.928 624H480zM288 816a16 16 0 0 0 16 16h416a16 16 0 1 0 0-32H304a16 16 0 0 0-16 16z" fill="currentColor"></path></svg>`;

        fileIcons.forEach(icon => {
            icon.outerHTML = downloadIconSvg;
        });
    }

    private handleFileDownloadClick(e: Event) {
        const target = e.target as HTMLElement;
        const fileTitle = target.closest('.file-embed-title');

        if (fileTitle) {
            e.preventDefault();
            e.stopPropagation();

            // Throttle downloads
            const now = Date.now();
            if (now - AttachmentDownload.lastDownloadTime < AttachmentDownload.downloadThrottleDelay) {
                return;
            }
            AttachmentDownload.lastDownloadTime = now;

            // Find associated file embed element
            const parent = fileTitle.parentElement;
            const fileEmbed = parent?.querySelector('.internal-embed.file-embed') as HTMLElement;

            if (fileEmbed) {
                const src = fileEmbed.getAttribute('src');
                if (src) {
                    const fullUrl = window.location.origin + '/' + src;
                    this.downloadFile(fullUrl, src);
                }
            }
        }
    }

    private downloadFile(url: string, filename: string) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
