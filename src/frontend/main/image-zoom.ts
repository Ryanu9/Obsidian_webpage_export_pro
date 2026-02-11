/**
 * Image Zoom Handler - 图片缩放处理模块
 * 提供点击图片后的全屏预览、画廊导航、缩略图条和展开/收起动画
 */

export class ImageZoom {
    private static instance: ImageZoom | null = null;

    // DOM elements
    private overlay!: HTMLElement;
    private zoomImage!: HTMLImageElement;
    private counter!: HTMLElement;
    private prevBtn!: HTMLElement;
    private nextBtn!: HTMLElement;
    private closeBtn!: HTMLElement;
    private thumbStrip!: HTMLElement;

    // Gallery state
    private galleryImages: HTMLImageElement[] = [];
    private currentIndex: number = 0;

    // 缩放状态
    private scale: number = 1;
    private translateX: number = 0;
    private translateY: number = 0;

    // 拖拽状态
    private isDragging: boolean = false;
    private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };

    // 图片原始尺寸（在视口中居中后的尺寸）
    private baseWidth: number = 0;
    private baseHeight: number = 0;

    // Animation state
    private isAnimating: boolean = false;
    private readonly animDuration: number = 350;

    // 缩放限制
    private readonly minScale: number = 0.5;
    private readonly maxScale: number = 10;
    private readonly zoomStep: number = 0.15;

    private constructor() {
        this.injectStyles();
        this.createOverlay();
        this.bindGlobalEvents();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): ImageZoom {
        if (!ImageZoom.instance) {
            ImageZoom.instance = new ImageZoom();
        }
        return ImageZoom.instance;
    }

    /**
     * 注入样式
     */
    private injectStyles(): void {
        if (document.getElementById("image-zoom-style")) return;

        const style = document.createElement("style");
        style.id = "image-zoom-style";
        style.textContent = `
.markdown-rendered img:not(.callout-icon):not(.file-list-item-icon) {
    cursor: zoom-in;
}

/* overlay */
.image-zoom-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: none;
    justify-content: center;
    align-items: center;
    cursor: zoom-out;
    -webkit-user-select: none;
    user-select: none;
}
.image-zoom-overlay *::selection {
    background: transparent;
}
.image-zoom-overlay.active {
    display: flex;
}

/* main image */
.image-zoom-img {
    max-width: none;
    max-height: none;
    transform-origin: center center;
    cursor: grab;
    -webkit-user-select: none;
    user-select: none;
    -webkit-user-drag: none;
    -webkit-touch-callout: none;
    will-change: transform;
    z-index: 10000;
}
.image-zoom-img.dragging {
    cursor: grabbing;
}

/* counter top-left */
.image-zoom-counter {
    position: absolute;
    top: 16px;
    left: 20px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: rgba(0, 0, 0, 0.5);
    padding: 4px 12px;
    border-radius: 6px;
    z-index: 10001;
    pointer-events: none;
    user-select: none;
}

/* close button */
.image-zoom-close {
    position: absolute;
    top: 16px;
    right: 20px;
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    transition: background 0.2s;
    padding: 0;
}
.image-zoom-close:hover {
    background: rgba(255, 255, 255, 0.18);
}

/* prev / next arrows */
.image-zoom-prev,
.image-zoom-next {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    background: rgba(0, 0, 0, 0.55);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    transition: background 0.2s;
    padding: 0;
}
.image-zoom-prev { left: 16px; }
.image-zoom-next { right: 16px; }
.image-zoom-prev:hover,
.image-zoom-next:hover {
    background: rgba(255, 255, 255, 0.18);
}

/* thumbnail strip */
.image-zoom-thumbs {
    position: absolute;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 10px;
    z-index: 10001;
    max-width: 80vw;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}
.image-zoom-thumbs::-webkit-scrollbar { height: 4px; }
.image-zoom-thumbs::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
}
.image-zoom-thumb {
    width: 64px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.5;
    border: 2px solid transparent;
    transition: opacity 0.2s, border-color 0.2s;
    flex-shrink: 0;
}
.image-zoom-thumb:hover { opacity: 0.85; }
.image-zoom-thumb.active {
    opacity: 1;
    border-color: rgba(255, 255, 255, 0.85);
}
        `;
        document.head.appendChild(style);
    }

    /**
     * 创建遮罩层和所有UI元素
     */
    private createOverlay(): void {
        // Remove any stale overlay from previous instance
        document.querySelector(".image-zoom-overlay")?.remove();

        this.overlay = document.createElement("div");
        this.overlay.className = "image-zoom-overlay";

        // Counter (top-left)
        this.counter = document.createElement("div");
        this.counter.className = "image-zoom-counter";

        // Close button (top-right)
        this.closeBtn = document.createElement("button");
        this.closeBtn.className = "image-zoom-close";
        this.closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        // Prev arrow (left)
        this.prevBtn = document.createElement("button");
        this.prevBtn.className = "image-zoom-prev";
        this.prevBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

        // Next arrow (right)
        this.nextBtn = document.createElement("button");
        this.nextBtn.className = "image-zoom-next";
        this.nextBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

        // Main zoom image
        this.zoomImage = document.createElement("img");
        this.zoomImage.className = "image-zoom-img";

        // Thumbnail strip (bottom)
        this.thumbStrip = document.createElement("div");
        this.thumbStrip.className = "image-zoom-thumbs";

        this.overlay.append(
            this.counter, this.closeBtn,
            this.prevBtn, this.nextBtn,
            this.zoomImage, this.thumbStrip
        );
        document.body.appendChild(this.overlay);
    }

    /**
     * 绑定全局事件
     */
    private bindGlobalEvents(): void {
        // 点击遮罩层关闭
        this.overlay.addEventListener("click", (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Close button
        this.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.close();
        });

        // Prev / Next
        this.prevBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.goToPrev();
        });
        this.nextBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.goToNext();
        });

        // 滚轮缩放
        this.overlay.addEventListener("wheel", (e) => {
            e.preventDefault();
            this.handleZoom(e);
        }, { passive: false });

        // 拖拽事件
        this.zoomImage.addEventListener("pointerdown", (e) => {
            this.startDrag(e);
        });

        // 键盘事件
        document.addEventListener("keydown", (e) => {
            if (!this.isOpen()) return;
            switch (e.key) {
                case "Escape": this.close(); break;
                case "ArrowLeft": this.goToPrev(); break;
                case "ArrowRight": this.goToNext(); break;
            }
        });
    }

    /* ================================================================== */
    /*  Show / Close with animation                                       */
    /* ================================================================== */

    /**
     * 显示图片（带展开动画）
     */
    public show(sourceImg: HTMLImageElement): void {
        if (this.isAnimating) return;

        // 收集当前页面中所有已初始化的图片作为画廊
        this.galleryImages = Array.from(
            document.querySelectorAll<HTMLImageElement>("[data-zoom-initialized]")
        );
        this.currentIndex = this.galleryImages.indexOf(sourceImg);
        if (this.currentIndex < 0) this.currentIndex = 0;

        // 准备图片尺寸
        this.prepareImage(sourceImg);

        // 更新UI元素
        this.updateCounter();
        this.buildThumbnails();
        this.updateNavVisibility();

        // 执行展开动画
        this.animateOpen(sourceImg);
    }

    /**
     * 关闭预览（带收起动画）
     */
    public close(): void {
        if (!this.isOpen() || this.isAnimating) return;
        this.animateClose();
    }

    /**
     * 是否已打开
     */
    public isOpen(): boolean {
        return this.overlay.classList.contains("active");
    }

    /* ================================================================== */
    /*  Image preparation                                                 */
    /* ================================================================== */

    private prepareImage(img: HTMLImageElement): void {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;

        this.zoomImage.src = img.src;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const nw = img.naturalWidth || img.width || 500;
        const nh = img.naturalHeight || img.height || 500;

        // 保持宽高比，最大占用视口的 85%
        let w = nw, h = nh;
        const fit = 0.85;
        if (w > vw * fit) { const r = (vw * fit) / w; w *= r; h *= r; }
        if (h > vh * fit) { const r = (vh * fit) / h; w *= r; h *= r; }

        this.baseWidth = w;
        this.baseHeight = h;
        this.zoomImage.style.width = `${w}px`;
        this.zoomImage.style.height = `${h}px`;
    }

    /* ================================================================== */
    /*  Open / Close animation (FLIP technique)                           */
    /* ================================================================== */

    /**
     * 展开动画：图片从源位置飞到视口中心
     */
    private animateOpen(sourceImg: HTMLImageElement): void {
        const srcRect = sourceImg.getBoundingClientRect();
        const canFly = this.baseWidth > 0 && srcRect.width > 0 && this.isRectInViewport(srcRect);

        if (canFly) {
            // 计算从源图片位置到视口中心的偏移量
            const vpCX = window.innerWidth / 2;
            const vpCY = window.innerHeight / 2;
            const startTX = srcRect.left + srcRect.width / 2 - vpCX;
            const startTY = srcRect.top + srcRect.height / 2 - vpCY;
            const startS = srcRect.width / this.baseWidth;

            // 将图片定位到源图片位置（无过渡）
            this.zoomImage.style.transition = "none";
            this.zoomImage.style.transform = `translate(${startTX}px, ${startTY}px) scale(${startS})`;
        } else {
            this.zoomImage.style.transition = "none";
            this.zoomImage.style.transform = "translate(0px, 0px) scale(1)";
        }

        this.overlay.style.transition = "none";
        this.overlay.style.opacity = "0";
        this.overlay.classList.add("active");

        // 强制重排，确保初始状态被渲染
        void this.overlay.offsetHeight;

        // 启动过渡动画到最终位置
        const ease = "cubic-bezier(0.25, 0.1, 0.25, 1)";
        this.zoomImage.style.transition = `transform ${this.animDuration}ms ${ease}`;
        this.overlay.style.transition = `opacity ${this.animDuration}ms ease`;
        this.zoomImage.style.transform = "translate(0px, 0px) scale(1)";
        this.overlay.style.opacity = "1";

        this.isAnimating = true;
        setTimeout(() => {
            this.zoomImage.style.transition = "";
            this.overlay.style.transition = "";
            this.isAnimating = false;
        }, this.animDuration);
    }

    /**
     * 收起动画：图片从当前位置飞回源图片位置
     */
    private animateClose(): void {
        const sourceImg = this.galleryImages[this.currentIndex];
        const srcRect = sourceImg?.getBoundingClientRect();
        const canFly = sourceImg && srcRect && this.baseWidth > 0 &&
                       srcRect.width > 0 && this.isRectInViewport(srcRect);

        const ease = "cubic-bezier(0.25, 0.1, 0.25, 1)";

        if (canFly) {
            const vpCX = window.innerWidth / 2;
            const vpCY = window.innerHeight / 2;
            const endTX = srcRect!.left + srcRect!.width / 2 - vpCX;
            const endTY = srcRect!.top + srcRect!.height / 2 - vpCY;
            const endS = srcRect!.width / this.baseWidth;

            this.zoomImage.style.transition = `transform ${this.animDuration}ms ${ease}`;
            this.zoomImage.style.transform = `translate(${endTX}px, ${endTY}px) scale(${endS})`;
        }

        this.overlay.style.transition = `opacity ${this.animDuration}ms ease`;
        this.overlay.style.opacity = "0";

        this.isAnimating = true;
        setTimeout(() => {
            this.overlay.classList.remove("active");
            this.overlay.style.transition = "";
            this.overlay.style.opacity = "";
            this.zoomImage.style.transition = "";
            this.isAnimating = false;
            this.isDragging = false;
        }, this.animDuration);
    }

    /* ================================================================== */
    /*  Gallery navigation                                                */
    /* ================================================================== */

    private goToPrev(): void {
        if (this.isAnimating || this.galleryImages.length <= 1) return;
        this.currentIndex = (this.currentIndex - 1 + this.galleryImages.length) % this.galleryImages.length;
        this.switchImage();
    }

    private goToNext(): void {
        if (this.isAnimating || this.galleryImages.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.galleryImages.length;
        this.switchImage();
    }

    private switchImage(): void {
        const img = this.galleryImages[this.currentIndex];
        if (!img) return;

        // 切换淡入效果
        this.zoomImage.style.transition = "opacity 120ms ease";
        this.zoomImage.style.opacity = "0.3";

        setTimeout(() => {
            this.prepareImage(img);
            this.updateTransform();
            this.zoomImage.style.opacity = "1";
            setTimeout(() => {
                this.zoomImage.style.transition = "";
            }, 120);
        }, 120);

        this.updateCounter();
        this.highlightThumb();
    }

    /* ================================================================== */
    /*  UI updates                                                        */
    /* ================================================================== */

    private updateCounter(): void {
        if (this.galleryImages.length <= 1) {
            this.counter.style.display = "none";
        } else {
            this.counter.style.display = "";
            this.counter.textContent = `${this.currentIndex + 1} / ${this.galleryImages.length}`;
        }
    }

    private updateNavVisibility(): void {
        const show = this.galleryImages.length > 1;
        this.prevBtn.style.display = show ? "" : "none";
        this.nextBtn.style.display = show ? "" : "none";
    }

    private buildThumbnails(): void {
        this.thumbStrip.innerHTML = "";

        if (this.galleryImages.length <= 1) {
            this.thumbStrip.style.display = "none";
            return;
        }

        this.thumbStrip.style.display = "";

        this.galleryImages.forEach((img, i) => {
            const t = document.createElement("img");
            t.className = "image-zoom-thumb" + (i === this.currentIndex ? " active" : "");
            t.src = img.src;
            t.alt = "";
            t.draggable = false;
            t.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.isAnimating || i === this.currentIndex) return;
                this.currentIndex = i;
                this.switchImage();
            });
            this.thumbStrip.appendChild(t);
        });

        this.scrollActiveThumb();
    }

    private highlightThumb(): void {
        const thumbs = this.thumbStrip.querySelectorAll(".image-zoom-thumb");
        thumbs.forEach((t, i) => t.classList.toggle("active", i === this.currentIndex));
        this.scrollActiveThumb();
    }

    private scrollActiveThumb(): void {
        const active = this.thumbStrip.querySelector(".image-zoom-thumb.active") as HTMLElement | null;
        active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    /* ================================================================== */
    /*  Zoom (mouse wheel)                                                */
    /* ================================================================== */

    /**
     * 处理缩放
     */
    private handleZoom(e: WheelEvent): void {
        // 计算鼠标相对于图片中心的位置（在缩放前）
        const rect = this.zoomImage.getBoundingClientRect();
        const imgCenterX = rect.left + rect.width / 2;
        const imgCenterY = rect.top + rect.height / 2;

        // 鼠标位置相对于图片中心
        const mouseOffsetX = e.clientX - imgCenterX;
        const mouseOffsetY = e.clientY - imgCenterY;

        // 计算新的缩放比例
        const oldScale = this.scale;
        const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
        let newScale = this.scale + delta;

        // 限制缩放范围
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

        if (newScale === oldScale) return;

        // 计算缩放比例变化
        const scaleRatio = newScale / oldScale;

        // 调整位移，使缩放以鼠标位置为中心
        this.translateX -= mouseOffsetX * (scaleRatio - 1);
        this.translateY -= mouseOffsetY * (scaleRatio - 1);

        this.scale = newScale;
        this.updateTransform();
    }

    /* ================================================================== */
    /*  Drag                                                              */
    /* ================================================================== */

    /**
     * 开始拖拽
     */
    private boundDrag = (e: PointerEvent) => this.drag(e);
    private boundEndDrag = () => this.endDrag();

    private startDrag(e: PointerEvent): void {
        if (this.isAnimating) return;

        this.isDragging = true;
        this.lastPointerPos = { x: e.clientX, y: e.clientY };
        this.zoomImage.classList.add("dragging");
        this.zoomImage.setPointerCapture(e.pointerId);
        e.preventDefault();

        document.addEventListener("pointermove", this.boundDrag);
        document.addEventListener("pointerup", this.boundEndDrag);
    }

    /**
     * 拖拽中
     */
    private drag(e: PointerEvent): void {
        if (!this.isDragging) return;

        const dx = e.clientX - this.lastPointerPos.x;
        const dy = e.clientY - this.lastPointerPos.y;

        this.translateX += dx;
        this.translateY += dy;

        this.lastPointerPos = { x: e.clientX, y: e.clientY };
        this.updateTransform();
    }

    /**
     * 结束拖拽
     */
    private endDrag(): void {
        this.isDragging = false;
        this.zoomImage.classList.remove("dragging");

        document.removeEventListener("pointermove", this.boundDrag);
        document.removeEventListener("pointerup", this.boundEndDrag);
    }

    /* ================================================================== */
    /*  Helpers                                                           */
    /* ================================================================== */

    /**
     * 更新图片变换
     */
    private updateTransform(): void {
        this.zoomImage.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }

    /**
     * 判断矩形是否在视口内
     */
    private isRectInViewport(r: DOMRect): boolean {
        return r.bottom > 0 && r.top < window.innerHeight &&
               r.right > 0 && r.left < window.innerWidth;
    }

    /**
     * 为文档中的图片绑定点击事件
     */
    public initImagesInElement(container: HTMLElement): void {
        const images = container.querySelectorAll(
            "img:not(.callout-icon):not(.file-list-item-icon):not(.image-zoom-img):not(.image-zoom-thumb)"
        );

        images.forEach((img) => {
            if (img.hasAttribute("data-zoom-initialized")) return;

            img.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.show(img as HTMLImageElement);
            });

            img.setAttribute("data-zoom-initialized", "true");
        });
    }
}
