/**
 * Image Zoom Module
 * Provides fullscreen image viewing with zoom and drag functionality
 */

export class ImageZoom {
    private outerdiv: HTMLElement | null = null;
    private bigimg: HTMLImageElement | null = null;
    private containerEl: HTMLElement;

    // Zoom and drag state
    private imgWidth: number = 0;
    private imgHeight: number = 0;
    private maxZoom: number = 10;
    private minZoom: number = 0.1;
    private currentScale: number = 1;
    private isPointerDown: boolean = false;
    private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };
    private translateX: number = 0;
    private translateY: number = 0;

    // Bound event handlers for proper cleanup
    private boundHandleWheel: (e: WheelEvent) => void;
    private boundPointerDown: (e: PointerEvent) => void;
    private boundPointerMove: (e: PointerEvent) => void;
    private boundPointerUp: (e: PointerEvent) => void;
    private boundPointerCancel: (e: PointerEvent) => void;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
        this.boundHandleWheel = this.handleWheel.bind(this);
        this.boundPointerDown = this.onPointerDown.bind(this);
        this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerUp = this.onPointerUp.bind(this);
        this.boundPointerCancel = this.onPointerCancel.bind(this);
        this.init();
    }

    /**
     * Initialize the image zoom overlay and attach event listeners
     */
    private init(): void {
        this.createOverlay();
        this.attachImageListeners();
    }

    /**
     * Create the fullscreen overlay for zoomed images
     */
    private createOverlay(): void {
        if (document.querySelector("#image-zoom-overlay")) return;

        const overlayHtml = `
			<div id="image-zoom-overlay" class="image-zoom-overlay">
				<img id="image-zoom-img" class="image-zoom-img" src="" alt="Zoomed image" />
			</div>
		`;
        document.body.insertAdjacentHTML("beforeend", overlayHtml);

        this.outerdiv = document.querySelector<HTMLElement>("#image-zoom-overlay");
        this.bigimg = this.outerdiv?.querySelector<HTMLImageElement>("#image-zoom-img") ?? null;

        if (!this.outerdiv || !this.bigimg) return;

        // Close on overlay click
        this.outerdiv.addEventListener("click", () => this.close());

        // Prevent close when clicking on image
        this.bigimg.addEventListener("click", (e) => e.stopPropagation());

        // Handle keyboard events
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen()) {
                this.close();
            }
        });
    }

    /**
     * Attach click listeners to images for zoom functionality
     */
    private attachImageListeners(): void {
        // Use requestAnimationFrame for performance optimization
        requestAnimationFrame(() => {
            const allImages = this.containerEl.querySelectorAll<HTMLImageElement>(
                ".markdown-rendered img, .markdown-preview-view img"
            );

            allImages.forEach((img) => {
                // Skip already processed images
                if (img.dataset.zoomEnabled) return;
                img.dataset.zoomEnabled = "true";

                const handleClick = () => this.openImage(img);

                if (img.naturalWidth > 0) {
                    img.addEventListener("click", handleClick);
                } else {
                    img.addEventListener("load", () => {
                        img.addEventListener("click", handleClick);
                    }, { once: true });
                }
            });
        });
    }

    /**
     * Check if the overlay is currently open
     */
    private isOpen(): boolean {
        return this.outerdiv?.classList.contains("active") ?? false;
    }

    /**
     * Open and display an image in the zoom overlay
     */
    private openImage(img: HTMLImageElement): void {
        if (!this.bigimg || !this.outerdiv) return;

        const src = img.getAttribute("src");
        if (src) this.bigimg.setAttribute("src", src);

        this.calculateImageSize(img);
        this.centerImage();
        this.outerdiv.classList.add("active");

        // Enable zoom and drag on non-mobile devices
        if (!this.isMobile()) {
            window.addEventListener("wheel", this.boundHandleWheel, { passive: false });
            this.enableDrag();
        } else {
            this.enableTouchZoom();
        }
    }

    /**
     * Close the zoom overlay and cleanup
     */
    private close(): void {
        if (!this.outerdiv) return;

        this.outerdiv.classList.remove("active");
        this.currentScale = 1;
        window.removeEventListener("wheel", this.boundHandleWheel);
        this.disableDrag();
        this.disableTouchZoom();
    }

    /**
     * Calculate appropriate image size based on viewport
     */
    private calculateImageSize(img: HTMLImageElement): void {
        const windowW = document.documentElement.clientWidth;
        const windowH = document.documentElement.clientHeight;
        const realWidth = img.naturalWidth;
        const realHeight = img.naturalHeight;
        const outsideScale = 0.8;
        const belowScale = 1.4;
        const realRatio = realWidth / realHeight;
        const windowRatio = windowW / windowH;

        if (realRatio >= windowRatio) {
            if (realWidth > windowW) {
                this.imgWidth = windowW * outsideScale;
                this.imgHeight = (this.imgWidth / realWidth) * realHeight;
            } else {
                if (realWidth * belowScale < windowW) {
                    this.imgWidth = realWidth * (belowScale - 0.2);
                    this.imgHeight = (this.imgWidth / realWidth) * realHeight;
                } else {
                    this.imgWidth = realWidth;
                    this.imgHeight = realHeight;
                }
            }
        } else {
            if (realHeight > windowH) {
                this.imgHeight = windowH * outsideScale;
                this.imgWidth = (this.imgHeight / realHeight) * realWidth;
            } else {
                if (realHeight * belowScale < windowH) {
                    this.imgHeight = realHeight * (belowScale - 0.2);
                    this.imgWidth = (this.imgHeight / realHeight) * realWidth;
                } else {
                    this.imgWidth = realWidth;
                    this.imgHeight = realHeight;
                }
            }
        }

        // Ensure image fits within viewport
        if (this.imgWidth > windowW) {
            const scale = windowW / this.imgWidth;
            this.imgWidth *= scale;
            this.imgHeight *= scale;
        }
        if (this.imgHeight > windowH) {
            const scale = windowH / this.imgHeight;
            this.imgWidth *= scale;
            this.imgHeight *= scale;
        }

        if (this.bigimg) {
            this.bigimg.style.width = `${this.imgWidth}px`;
            this.bigimg.style.height = `${this.imgHeight}px`;
        }
    }

    /**
     * Center the image in the viewport
     */
    private centerImage(): void {
        const windowW = document.documentElement.clientWidth;
        const windowH = document.documentElement.clientHeight;
        this.translateX = (windowW - this.imgWidth) * 0.5;
        this.translateY = (windowH - this.imgHeight) * 0.5;
        this.updateTransform();
    }

    /**
     * Update the image transform based on current state
     */
    private updateTransform(): void {
        if (!this.bigimg) return;
        this.bigimg.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.currentScale})`;
    }

    /**
     * Handle mouse wheel zoom - zooms from image center
     */
    private handleWheel(e: WheelEvent): void {
        if (!this.bigimg) return;

        const target = e.target as HTMLElement;
        if (target.id !== "image-zoom-img") return;

        e.preventDefault();

        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newScale = this.currentScale * zoomFactor;

        // Clamp scale to min/max
        if (newScale > this.maxZoom || newScale < this.minZoom) return;

        // Calculate image center in screen coordinates
        const imgCenterX = this.translateX + (this.imgWidth * this.currentScale) / 2;
        const imgCenterY = this.translateY + (this.imgHeight * this.currentScale) / 2;

        // Update scale
        this.currentScale = newScale;

        // Adjust translation to keep image center fixed
        this.translateX = imgCenterX - (this.imgWidth * this.currentScale) / 2;
        this.translateY = imgCenterY - (this.imgHeight * this.currentScale) / 2;

        this.updateTransform();
    }

    /**
     * Enable drag functionality for panning
     */
    private enableDrag(): void {
        if (!this.bigimg) return;
        this.bigimg.addEventListener("pointerdown", this.boundPointerDown);
        this.bigimg.addEventListener("pointermove", this.boundPointerMove);
        this.bigimg.addEventListener("pointerup", this.boundPointerUp);
        this.bigimg.addEventListener("pointercancel", this.boundPointerCancel);
    }

    /**
     * Disable drag functionality
     */
    private disableDrag(): void {
        if (!this.bigimg) return;
        this.bigimg.removeEventListener("pointerdown", this.boundPointerDown);
        this.bigimg.removeEventListener("pointermove", this.boundPointerMove);
        this.bigimg.removeEventListener("pointerup", this.boundPointerUp);
        this.bigimg.removeEventListener("pointercancel", this.boundPointerCancel);
    }

    private onPointerDown(e: PointerEvent): void {
        if (!this.bigimg) return;
        e.preventDefault();
        this.isPointerDown = true;
        this.bigimg.setPointerCapture(e.pointerId);
        this.lastPointerPos = { x: e.clientX, y: e.clientY };
    }

    private onPointerMove(e: PointerEvent): void {
        if (!this.isPointerDown) return;
        e.preventDefault();

        const dx = e.clientX - this.lastPointerPos.x;
        const dy = e.clientY - this.lastPointerPos.y;

        this.translateX += dx;
        this.translateY += dy;
        this.lastPointerPos = { x: e.clientX, y: e.clientY };

        this.updateTransform();
    }

    private onPointerUp(_e: PointerEvent): void {
        this.isPointerDown = false;
    }

    private onPointerCancel(_e: PointerEvent): void {
        this.isPointerDown = false;
    }

    /**
     * Enable touch pinch-to-zoom for mobile devices
     */
    private enableTouchZoom(): void {
        if (!this.bigimg) return;

        let initialDistance = 0;
        let initialScale = 1;

        const getTouchDistance = (touches: TouchList): number => {
            if (touches.length < 2) return 0;
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        this.bigimg.addEventListener("touchstart", (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                initialDistance = getTouchDistance(e.touches);
                initialScale = this.currentScale;
            }
        }, { passive: false });

        this.bigimg.addEventListener("touchmove", (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = getTouchDistance(e.touches);
                const scale = (currentDistance / initialDistance) * initialScale;

                if (scale >= this.minZoom && scale <= this.maxZoom) {
                    this.currentScale = scale;
                    this.updateTransform();
                }
            }
        }, { passive: false });
    }

    /**
     * Disable touch zoom (cleanup handled by overlay removal)
     */
    private disableTouchZoom(): void {
        // Touch events are automatically cleaned up when overlay is hidden
    }

    /**
     * Check if the device is mobile
     */
    private isMobile(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    }

    /**
     * Reinitialize image listeners (call after dynamic content load)
     */
    public refresh(): void {
        this.attachImageListeners();
    }
}
