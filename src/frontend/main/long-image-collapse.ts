/**
 * Long Image Collapse Handler - 长图片折叠处理模块
 * 当图片高度超过阈值时自动折叠，只显示部分内容，提供展开按钮
 */

export class LongImageCollapse {
    private static instance: LongImageCollapse | null = null;

    // 折叠配置
    private readonly collapseThreshold: number = 1200; // 超过此高度触发折叠
    private readonly collapsedHeight: number = 700; // 折叠后显示的高度

    private constructor() {
        this.injectStyles();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): LongImageCollapse {
        if (!LongImageCollapse.instance) {
            LongImageCollapse.instance = new LongImageCollapse();
        }
        return LongImageCollapse.instance;
    }

    /**
     * 注入样式
     */
    private injectStyles(): void {
        if (document.getElementById("long-image-collapse-style")) return;

        const style = document.createElement("style");
        style.id = "long-image-collapse-style";
        style.textContent = `
			/* 外层包裹器 - 用于控制按钮居中于图片宽度 */
			.long-image-wrapper {
				display: inline-block;
				width: fit-content;
				max-width: 100%;
			}
			
			/* 长图片容器 */
			.long-image-container {
				position: relative;
				overflow: hidden;
				border-radius: var(--image-radius, 4px);
			}
			
			/* 折叠状态 */
			.long-image-container.collapsed {
				max-height: ${this.collapsedHeight}px;
				overflow: hidden;
			}
			
			/* 渐变遮罩 */
			.long-image-container.collapsed::after {
				content: '';
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 150px;
				background: linear-gradient(to bottom, transparent 0%, var(--background-primary, #fff) 100%);
				pointer-events: none;
				z-index: 10;
			}
			
			/* 展开按钮容器 - 宽度继承自外层包裹器 */
			.long-image-expand-container {
				display: none;
				justify-content: center;
				padding: 12px 0;
				width: 100%;
			}
			
			.long-image-container.collapsed + .long-image-expand-container,
			.long-image-container:not(.collapsed) + .long-image-expand-container.show-collapse {
				display: flex;
			}
			
			/* 展开/收起按钮 */
			.long-image-expand-btn {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 8px 20px;
				background-color: var(--background-secondary, #f5f5f5);
				border: 1px solid var(--background-modifier-border, #ddd);
				border-radius: 20px;
				cursor: pointer;
				font-size: 0.9em;
				color: var(--text-muted, #666);
				transition: all 0.2s ease;
			}
			
			.long-image-expand-btn:hover {
				background-color: var(--background-modifier-hover, #eee);
				color: var(--text-normal, #333);
			}
			
			.long-image-expand-btn svg {
				width: 16px;
				height: 16px;
				transition: transform 0.3s ease;
			}
			
			.long-image-container:not(.collapsed) + .long-image-expand-container .long-image-expand-btn svg {
				transform: rotate(180deg);
			}
			
			/* 确保图片在容器内正常显示 */
			.long-image-container img {
				display: block;
				max-width: 100%;
				height: auto;
			}
		`;
        document.head.appendChild(style);
    }

    /**
     * 获取国际化文本
     */
    private getTranslation(key: string, defaultValue: string): string {
        try {
            const i18n = (window as any).i18n;
            if (i18n?.longImage?.[key]) {
                return i18n.longImage[key];
            }
        } catch (e) {
            // Fallback to default
        }
        return defaultValue;
    }

    /**
     * 为文档中的图片初始化折叠功能
     */
    public initImagesInElement(container: HTMLElement): void {
        // 获取所有图片（排除已处理的、图标等）
        const images = container.querySelectorAll(
            "img:not(.callout-icon):not(.file-list-item-icon):not(.long-image-processed)"
        );

        images.forEach((img) => {
            const imgEl = img as HTMLImageElement;

            // 如果图片已经加载，直接处理
            if (imgEl.complete && imgEl.naturalHeight > 0) {
                this.processImage(imgEl);
            } else {
                // 等待图片加载完成后处理
                imgEl.addEventListener("load", () => {
                    this.processImage(imgEl);
                }, { once: true });
            }
        });
    }

    /**
     * 处理单个图片
     */
    private processImage(img: HTMLImageElement): void {
        // 标记为已处理
        img.classList.add("long-image-processed");

        // 检查图片高度是否超过阈值
        const naturalHeight = img.naturalHeight;
        const displayHeight = img.offsetHeight;

        // 使用显示高度判断（因为可能有CSS缩放）
        const effectiveHeight = displayHeight > 0 ? displayHeight : naturalHeight;

        if (effectiveHeight <= this.collapseThreshold) {
            return; // 图片高度未超过阈值，不需要折叠
        }

        // 创建外层包裹器（用于控制按钮居中于图片宽度）
        const outerWrapper = document.createElement("div");
        outerWrapper.className = "long-image-wrapper";

        // 创建图片容器
        const imgContainer = document.createElement("div");
        imgContainer.className = "long-image-container collapsed";

        // 创建展开按钮容器
        const btnContainer = document.createElement("div");
        btnContainer.className = "long-image-expand-container";

        const expandBtn = document.createElement("button");
        expandBtn.className = "long-image-expand-btn";
        expandBtn.innerHTML = `
			${this.getExpandIcon()}
			<span>${this.getTranslation("expand", "展开长图")}</span>
		`;
        btnContainer.appendChild(expandBtn);

        // 构建 DOM 结构
        img.parentNode?.insertBefore(outerWrapper, img);
        imgContainer.appendChild(img);
        outerWrapper.appendChild(imgContainer);
        outerWrapper.appendChild(btnContainer);

        // 绑定点击事件
        expandBtn.addEventListener("click", () => {
            this.toggleCollapse(imgContainer, expandBtn);
        });
    }

    /**
     * 切换折叠状态
     */
    private toggleCollapse(wrapper: HTMLElement, btn: HTMLButtonElement): void {
        const isCollapsed = wrapper.classList.contains("collapsed");
        const btnContainer = btn.closest(".long-image-expand-container");

        if (isCollapsed) {
            // 展开
            wrapper.classList.remove("collapsed");
            btnContainer?.classList.add("show-collapse");
            btn.innerHTML = `
				${this.getExpandIcon()}
				<span>${this.getTranslation("collapse", "收起长图")}</span>
			`;
        } else {
            // 收起
            wrapper.classList.add("collapsed");
            btnContainer?.classList.remove("show-collapse");
            btn.innerHTML = `
				${this.getExpandIcon()}
				<span>${this.getTranslation("expand", "展开长图")}</span>
			`;

            // 滚动到图片顶部
            wrapper.scrollIntoView({ behavior: "auto", block: "start" });
        }
    }

    /**
     * 获取展开图标
     */
    private getExpandIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="m6 9 6 6 6-6"/>
		</svg>`;
    }
}
