/**
 * Image Zoom Handler - 图片缩放处理模块
 * 提供点击图片后的全屏预览和缩放功能
 */

export class ImageZoom {
    private static instance: ImageZoom | null = null;

    private overlay: HTMLElement | null = null;
    private zoomImage: HTMLImageElement | null = null;

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
			
			.image-zoom-overlay {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.85);
				z-index: 9999;
				display: none;
				cursor: zoom-out;
			}
			
			.image-zoom-overlay.active {
				display: flex;
				justify-content: center;
				align-items: center;
			}
			
			.image-zoom-img {
				max-width: none;
				max-height: none;
				transform-origin: center center;
				cursor: grab;
				user-select: none;
				-webkit-user-drag: none;
			}
			
			.image-zoom-img.dragging {
				cursor: grabbing;
			}
		`;
        document.head.appendChild(style);
    }

    /**
     * 创建遮罩层和图片容器
     */
    private createOverlay(): void {
        if (document.querySelector(".image-zoom-overlay")) {
            this.overlay = document.querySelector(".image-zoom-overlay");
            this.zoomImage = this.overlay?.querySelector(".image-zoom-img") as HTMLImageElement;
            return;
        }

        this.overlay = document.createElement("div");
        this.overlay.className = "image-zoom-overlay";

        this.zoomImage = document.createElement("img");
        this.zoomImage.className = "image-zoom-img";

        this.overlay.appendChild(this.zoomImage);
        document.body.appendChild(this.overlay);
    }

    /**
     * 绑定全局事件
     */
    private bindGlobalEvents(): void {
        if (!this.overlay || !this.zoomImage) return;

        // 点击遮罩层关闭
        this.overlay.addEventListener("click", (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // 滚轮缩放
        this.overlay.addEventListener("wheel", (e) => {
            e.preventDefault();
            this.handleZoom(e);
        }, { passive: false });

        // 拖拽事件 - pointermove/pointerup only attached during active drag
        this.zoomImage.addEventListener("pointerdown", (e) => {
            this.startDrag(e);
        });

        // ESC 关闭
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen()) {
                this.close();
            }
        });
    }

    /**
     * 显示图片
     */
    public show(sourceImg: HTMLImageElement): void {
        if (!this.overlay || !this.zoomImage) return;

        // 重置状态
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;

        // 设置图片源
        const src = sourceImg.getAttribute("src") || sourceImg.src;
        this.zoomImage.src = src;

        // 计算适合视口的初始尺寸
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const naturalW = sourceImg.naturalWidth || sourceImg.width || 500;
        const naturalH = sourceImg.naturalHeight || sourceImg.height || 500;

        // 保持宽高比，最大占用视口的 85%
        const maxScale = 0.85;
        let width = naturalW;
        let height = naturalH;

        if (width > viewportW * maxScale) {
            const ratio = (viewportW * maxScale) / width;
            width *= ratio;
            height *= ratio;
        }

        if (height > viewportH * maxScale) {
            const ratio = (viewportH * maxScale) / height;
            width *= ratio;
            height *= ratio;
        }

        this.baseWidth = width;
        this.baseHeight = height;

        // 设置图片尺寸和初始变换
        this.zoomImage.style.width = `${width}px`;
        this.zoomImage.style.height = `${height}px`;
        this.updateTransform();

        // 显示遮罩层
        this.overlay.classList.add("active");
    }

    /**
     * 关闭预览
     */
    public close(): void {
        if (!this.overlay) return;
        this.overlay.classList.remove("active");
        this.isDragging = false;
    }

    /**
     * 是否已打开
     */
    public isOpen(): boolean {
        return this.overlay?.classList.contains("active") || false;
    }

    /**
     * 处理缩放
     */
    private handleZoom(e: WheelEvent): void {
        if (!this.zoomImage) return;

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
        // 公式：newTranslate = oldTranslate - mouseOffset * (scaleRatio - 1)
        this.translateX -= mouseOffsetX * (scaleRatio - 1);
        this.translateY -= mouseOffsetY * (scaleRatio - 1);

        this.scale = newScale;
        this.updateTransform();
    }

    /**
     * 开始拖拽
     */
    private boundDrag = (e: PointerEvent) => this.drag(e);
    private boundEndDrag = () => this.endDrag();

    private startDrag(e: PointerEvent): void {
        if (!this.zoomImage) return;

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
        if (!this.zoomImage) return;

        this.isDragging = false;
        this.zoomImage.classList.remove("dragging");

        document.removeEventListener("pointermove", this.boundDrag);
        document.removeEventListener("pointerup", this.boundEndDrag);
    }

    /**
     * 更新图片变换
     */
    private updateTransform(): void {
        if (!this.zoomImage) return;

        this.zoomImage.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }

    /**
     * 为文档中的图片绑定点击事件
     */
    public initImagesInElement(container: HTMLElement): void {
        const images = container.querySelectorAll("img:not(.callout-icon):not(.file-list-item-icon):not(.image-zoom-img)");

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
