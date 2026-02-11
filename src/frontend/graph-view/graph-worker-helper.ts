/**
 * Official Obsidian Publish GraphRenderer architecture.
 * Main-thread PIXI rendering + sim.js worker physics.
 * Ported from graph.js (extracted from app.js).
 */

import { Shared } from "src/shared/shared";
import { LinkHandler } from "../main/links";

declare const PIXI: any;
declare const ObsidianSite: any;

/* ==========================================================
   Helper Functions
   ========================================================== */

const RGBA_REGEX = /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)$/i;

function parseColor(colorStr: string): { r: number; g: number; b: number; a: number } | null {
	const match = colorStr.match(RGBA_REGEX);
	if (!match) return null;
	const clampByte = (val: string) => 255 & parseInt(val);
	return {
		r: clampByte(match[1]),
		g: clampByte(match[2]),
		b: clampByte(match[3]),
		a: match[4] ? Math.min(Math.max(parseFloat(match[4].substring(1)), 0), 1) : 1,
	};
}

function lerp(current: number, target: number, factor: number = 0.9): number {
	return current * factor + target * (1 - factor);
}

function blendColor(colorA: number, colorB: number): number {
	return (
		(lerp((colorA >> 16) & 255, (colorB >> 16) & 255) << 16) +
		(lerp((colorA >> 8) & 255, (colorB >> 8) & 255) << 8) +
		(0 | lerp(colorA & 255, colorB & 255))
	);
}

interface Rect { left: number; right: number; top: number; bottom: number; }

function rectsDisjoint(a: Rect, b: Rect): boolean {
	return b.right < a.left || b.left > a.right || b.bottom < a.top || b.top > a.bottom;
}

function rectFromPoint(x: number, y: number, size: number): Rect {
	return { left: x - size, right: x + size, top: y - size, bottom: y + size };
}

function rectUnion(a: Rect, b: Rect): Rect {
	return {
		left: Math.min(a.left, b.left),
		right: Math.max(a.right, b.right),
		top: Math.min(a.top, b.top),
		bottom: Math.max(a.bottom, b.bottom),
	};
}

function fillParent(el: HTMLElement) {
	el.style.margin = "0";
	el.style.padding = "0";
	el.style.border = "0";
	el.style.width = "100%";
	el.style.height = "100%";
	el.style.overflow = "hidden";
}

/* ==========================================================
   Constants
   ========================================================== */

const DEFAULT_FADE_ALPHA = 0.2;

const COLOR_CLASS_MAP: Record<string, string> = {
	fill: "color-fill",
	fillFocused: "color-fill-focused",
	fillTag: "color-fill-tag",
	fillUnresolved: "color-fill-unresolved",
	fillAttachment: "color-fill-attachment",
	arrow: "color-arrow",
	circle: "color-circle",
	line: "color-line",
	text: "color-text",
	fillHighlight: "color-fill-highlight",
	lineHighlight: "color-line-highlight",
};

const CIRCLE_RADIUS = 100;

const GRAPH_FONT_FAMILY =
	'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, ' +
	'"Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", ' +
	'"Segoe UI Symbol", "Microsoft YaHei Light", sans-serif';

export interface ColorValue { a: number; rgb: number; }

export interface GraphNodeData {
	type: string;
	links: Record<string, boolean>;
	displayText?: string;
	color?: ColorValue | null;
}

export interface GraphData {
	nodes: Record<string, GraphNodeData>;
	weights?: Record<string, number>;
}

export interface GraphForces {
	centerStrength?: number;
	linkStrength?: number;
	linkDistance?: number;
	repelStrength?: number;
}

export interface GraphRenderOptions {
	nodeSizeMultiplier?: number;
	lineSizeMultiplier?: number;
	showArrow?: boolean;
	textFadeMultiplier?: number;
}

/* ==========================================================
   GraphNode
   ========================================================== */

class GraphNode {
	x: number | null = null;
	y: number | null = null;
	fx: number | null = null;
	fy: number | null = null;
	forward: Record<string, GraphLink> = {};
	reverse: Record<string, GraphLink> = {};
	weight: number = 0;
	color: ColorValue | null = null;
	rendered: boolean = false;
	fadeAlpha: number = 0;
	moveText: number = 0;
	fontDirty: boolean = false;
	_displayText: string;

	circle: any = null;
	highlight: any = null;
	text: any = null;

	constructor(public renderer: GraphRenderer, public id: string, public type: string) {
		this._displayText = id;
	}

	initGraphics(): boolean {
		if (this.rendered) return false;
		this.rendered = true;

		const renderer = this.renderer;
		const self = this;

		const circle = this.circle = new PIXI.Graphics();
		circle.eventMode = "static";
		circle.beginFill(0xffffff);
		circle.drawCircle(CIRCLE_RADIUS, CIRCLE_RADIUS, CIRCLE_RADIUS);
		circle.endFill();

		// Large invisible touch target - only on actual mobile devices
		// (official code uses wa.isMobile). "ontouchstart" in window is true
		// on many desktops and causes new nodes' hit areas to block old nodes.
		if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
			circle.beginFill(0xffffff, 1e-4);
			circle.drawCircle(CIRCLE_RADIUS, CIRCLE_RADIUS, 500);
			circle.endFill();
		}

		circle.pivot.x = CIRCLE_RADIUS;
		circle.pivot.y = CIRCLE_RADIUS;
		circle.cursor = "pointer";
		circle.zIndex = 1;

		circle
			.on("pointerdown", (evt: any) => renderer.onPointerDown(self, evt))
			.on("pointerover", (evt: any) => renderer.onPointerOver(self, evt))
			.on("pointerout", () => renderer.onPointerOut());

		const fillColor = this.getFillColor();
		circle.alpha = fillColor.a;
		circle.tint = fillColor.rgb;
		renderer.hanger.addChild(circle);

		const textStyle = new PIXI.TextStyle(this.getTextStyle());
		const text = this.text = new PIXI.Text(this.getDisplayText(), textStyle);
		text.eventMode = "none";
		text.resolution = 2;
		text.anchor.set(0.5, 0);
		text.zIndex = 2;
		renderer.hanger.addChild(text);

		this.fadeAlpha = 0;
		return true;
	}

	clearGraphics() {
		if (!this.rendered) return;
		this.rendered = false;

		if (this.circle) {
			if (this.circle.parent) this.circle.parent.removeChild(this.circle);
			this.circle.destroy();
			this.circle = null;
		}
		if (this.highlight) {
			if (this.highlight.parent) this.highlight.parent.removeChild(this.highlight);
			this.highlight.destroy();
			this.highlight = null;
		}
		if (this.text) {
			if (this.text.parent) this.text.parent.removeChild(this.text);
			this.text.destroy();
			this.text = null;
		}
	}

	getTextStyle(): any {
		const size = this.getSize();
		return {
			fontSize: 14 + size / 4,
			fill: this.renderer.colors.text.rgb,
			fontFamily: GRAPH_FONT_FAMILY,
			wordWrap: true,
			wordWrapWidth: 300,
			align: "center",
		};
	}

	render() {
		if (!this.rendered) return;

		const renderer = this.renderer;
		const x = this.x!;
		const y = this.y!;
		const circle = this.circle;
		const text = this.text;

		const nodeSize = this.getSize();
		const fillColor = this.getFillColor();
		const textColor = renderer.colors.text;
		const highlightNode = renderer.getHighlightNode();
		const isFocused = highlightNode === this;
		const nodeScale = renderer.nodeScale;
		const wasTextVisible = text.visible;

		let targetFade = DEFAULT_FADE_ALPHA;
		if (!highlightNode || isFocused ||
			this.forward.hasOwnProperty(highlightNode.id) ||
			this.reverse.hasOwnProperty(highlightNode.id)) {
			targetFade = 1;
		}

		const alpha = this.fadeAlpha = lerp(this.fadeAlpha, targetFade);
		const circleAlpha = alpha * fillColor.a;

		let textAlpha = renderer.textAlpha * alpha;
		if (isFocused) textAlpha = 1;
		textAlpha *= textColor.a;

		const targetMoveText = isFocused ? 15 : 0;
		this.moveText = wasTextVisible ? lerp(this.moveText, targetMoveText) : targetMoveText;

		let showText = textAlpha > 0.001;
		const viewport = renderer.viewport;
		const showCircle = isFocused || !rectsDisjoint(viewport!, rectFromPoint(x, y, nodeSize * nodeScale + 1));

		if (showText) {
			showText = isFocused || !rectsDisjoint(viewport!, {
				left: x - 300, right: x + 300, top: y, bottom: y + 200,
			});
		}

		circle.tint = blendColor(circle.tint, fillColor.rgb);
		circle.visible = showCircle;
		if (showCircle) {
			circle.x = x;
			circle.y = y;
			circle.scale.x = circle.scale.y = nodeSize / 100 * nodeScale;
			circle.alpha = circleAlpha;
		}

		text.visible = showText;
		if (showText) {
			text.x = x;
			text.y = y + (nodeSize + 5) * nodeScale + this.moveText / renderer.scale;
			text.scale.x = text.scale.y = nodeScale;
			if (isFocused && renderer.scale < 1) {
				text.scale.x = text.scale.y = 1 / renderer.scale;
			}
			text.alpha = textAlpha;
		}

		if (isFocused) {
			if (!this.highlight) {
				this.highlight = new PIXI.Graphics();
				this.highlight.eventMode = "none";
				this.highlight.zIndex = 1;
				renderer.hanger.addChild(this.highlight);
			}
			this.highlight.x = x;
			this.highlight.y = y;
			this.highlight.scale.x = this.highlight.scale.y = nodeScale;
			this.highlight.clear();
			const lineWidth = Math.max(1, 1 / renderer.scale / nodeScale);
			const circleColor = renderer.colors.circle;
			this.highlight.alpha = circleColor.a;
			this.highlight.lineStyle(lineWidth, circleColor.rgb, 1);
			this.highlight.drawCircle(0, 0, nodeSize + lineWidth / 2);
		} else if (this.highlight) {
			this.highlight.parent.removeChild(this.highlight);
			this.highlight.destroy();
			this.highlight = null;
		}

		if (this.fontDirty) {
			this.fontDirty = false;
			text.style = this.getTextStyle();
		}
	}

	getFillColor(): ColorValue {
		const renderer = this.renderer;
		if (renderer.getHighlightNode() === this) return renderer.colors.fillHighlight;
		if (this.type === "focused") {
			const fc = renderer.colors.fillFocused;
			if (fc.a > 0) return fc;
		} else {
			if (this.color) return this.color;
			if (this.type === "tag") return renderer.colors.fillTag;
			if (this.type === "unresolved") return renderer.colors.fillUnresolved;
			if (this.type === "attachment") return renderer.colors.fillAttachment;
		}
		return renderer.colors.fill;
	}

	getSize(): number {
		return this.renderer.fNodeSizeMult * Math.max(8, Math.min(3 * Math.sqrt(this.weight + 1), 30));
	}

	getDisplayText(): string {
		return this._displayText || this.id;
	}

	getRelated(): string[] {
		return Object.keys(this.forward).concat(Object.keys(this.reverse));
	}
}

/* ==========================================================
   GraphLink
   ========================================================== */

class GraphLink {
	rendered: boolean = false;
	px: any = null;
	line: any = null;
	arrow: any = null;

	constructor(public renderer: GraphRenderer, public source: GraphNode, public target: GraphNode) {}

	initGraphics() {
		if (this.rendered) return;
		if (!this.source.rendered || !this.target.rendered) return;
		this.rendered = true;

		const renderer = this.renderer;
		const container = this.px = new PIXI.Container();
		renderer.hanger.addChild(container);

		const line = this.line = new PIXI.Sprite(PIXI.Texture.WHITE);
		line.eventMode = "none";
		const lineColor = renderer.colors.line;
		line.alpha = DEFAULT_FADE_ALPHA * lineColor.a;
		line.tint = lineColor.rgb;
		container.addChild(line);

		const arrow = this.arrow = new PIXI.Graphics();
		arrow.eventMode = "none";
		const textColor = renderer.colors.text;
		arrow.alpha = DEFAULT_FADE_ALPHA * textColor.a;
		arrow.tint = textColor.rgb;
		arrow.beginFill(0xffffff);
		arrow.moveTo(0, 0);
		arrow.lineTo(-4, -2);
		arrow.lineTo(-3, 0);
		arrow.lineTo(-4, 2);
		arrow.lineTo(0, 0);
		arrow.endFill();
		arrow.zIndex = 1;
		renderer.hanger.addChild(arrow);
	}

	clearGraphics() {
		if (!this.rendered) return;
		this.rendered = false;
		if (this.px) {
			if (this.px.parent) this.px.parent.removeChild(this.px);
			this.px.destroy();
			this.px = null;
		}
		if (this.line) { this.line.destroy(); this.line = null; }
		if (this.arrow) {
			if (this.arrow.parent) this.arrow.parent.removeChild(this.arrow);
			this.arrow.destroy();
			this.arrow = null;
		}
	}

	render() {
		if (!this.rendered) return;

		const container = this.px;
		const line = this.line;
		const arrow = this.arrow;
		const renderer = this.renderer;
		const source = this.source;
		const target = this.target;

		const highlightNode = renderer.getHighlightNode();
		const isHighlighted = source === highlightNode || target === highlightNode;

		let fadeTarget = DEFAULT_FADE_ALPHA;
		if (!highlightNode || isHighlighted) fadeTarget = 1;

		let arrowAlpha = fadeTarget * Math.min(Math.max(2 * (renderer.scale - 0.3), 0), 1);

		let lineColorObj = renderer.colors.line;
		if (isHighlighted) lineColorObj = renderer.colors.lineHighlight;
		const arrowColorObj = renderer.colors.arrow;

		let showLine = !(
			source.reverse.hasOwnProperty(target.id) &&
			source.id.localeCompare(target.id) < 0
		);
		let showArrow = renderer.fShowArrow;
		const lineWidth = renderer.fLineSizeMult / renderer.scale;

		const viewport = renderer.viewport!;
		const sourceRect = rectFromPoint(source.x!, source.y!, lineWidth);
		const targetRect = rectFromPoint(target.x!, target.y!, lineWidth);
		const inView = !rectsDisjoint(viewport, rectUnion(sourceRect, targetRect));

		fadeTarget *= lineColorObj.a;
		arrowAlpha *= arrowColorObj.a;
		line.alpha = lerp(line.alpha, fadeTarget);
		arrow.alpha = lerp(arrow.alpha, arrowAlpha);

		showLine = showLine && inView;
		showArrow = showArrow && inView && arrow.alpha > 0.001;

		line.visible = showLine;
		arrow.visible = showArrow;

		if (!showLine && !showArrow) return;

		const dx = target.x! - source.x!;
		const dy = target.y! - source.y!;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const sourceSize = source.getSize() * renderer.nodeScale;
		const targetSize = target.getSize() * renderer.nodeScale;

		arrow.visible = showArrow = showArrow && dist > lineWidth;

		if (showLine) {
			container.x = source.x! + (dx * sourceSize) / dist;
			container.y = source.y! + (dy * sourceSize) / dist;
			container.pivot.set(0, 0);
			container.rotation = Math.atan2(dy, dx);
			line.x = 0;
			line.y = -lineWidth / 2;
			line.width = Math.max(0, dist - sourceSize - targetSize);
			line.height = lineWidth;
			line.tint = blendColor(line.tint, lineColorObj.rgb);
		}

		if (showArrow) {
			const arrowOffset = targetSize + 1;
			arrow.x = target.x! - (dx * arrowOffset) / dist;
			arrow.y = target.y! - (dy * arrowOffset) / dist;
			arrow.pivot.set(0, 0);
			arrow.rotation = Math.atan2(dy, dx);
			arrow.scale.x = arrow.scale.y = 2 * Math.sqrt(renderer.fLineSizeMult) / renderer.scale;
			arrow.tint = arrowColorObj.rgb;
		}
	}
}

/* ==========================================================
   GraphRenderer - Official OB Publish rendering engine
   ========================================================== */

export class GraphRenderer {
	interactiveEl: HTMLCanvasElement;
	onNodeClick: ((event: Event, nodeId: string, nodeType: string) => void) | null = null;
	onNodeHover: ((event: Event, nodeId: string, nodeType: string) => void) | null = null;
	onNodeUnhover: (() => void) | null = null;

	workerResults: any = null;
	nodeLookup: Record<string, GraphNode> = {};
	nodes: GraphNode[] = [];
	links: GraphLink[] = [];

	dragNode: GraphNode | null = null;
	highlightNode: GraphNode | null = null;

	px: any = null;
	hanger: any = null;

	scale: number = 1;
	nodeScale: number = 1;
	textAlpha: number = 1;
	targetScale: number = 1;
	panX: number = 0;
	panY: number = 0;
	panvX: number = 0;
	panvY: number = 0;
	panning: boolean = false;

	width: number = 0;
	height: number = 0;
	viewport: Rect | null = null;

	zoomCenterX: number = 0;
	zoomCenterY: number = 0;

	fNodeSizeMult: number = 1;
	fLineSizeMult: number = 1;
	fTextShowMult: number = 1;
	fShowArrow: boolean = false;

	mouseX: number | null = null;
	mouseY: number | null = null;

	colors: Record<string, ColorValue> = {};
	renderTimer: number | null = null;
	idleFrames: number = 0;

	containerEl: HTMLElement;
	worker: Worker;

	onPointerDown: (node: GraphNode, evt: any) => void = () => {};
	onPointerOver: (node: GraphNode, evt: any) => void = () => {};
	onPointerOut: () => void = () => {};

	private renderCallback: (() => void) | null = null;

	constructor(containerEl: HTMLElement, worker: Worker) {
		this.containerEl = containerEl;
		this.worker = worker;
		this.testCSS();

		containerEl.style.padding = "0";
		containerEl.style.overflow = "hidden";

		// Render canvas (PIXI draws here, below interactive canvas)
		const renderCanvas = document.createElement("canvas");
		containerEl.appendChild(renderCanvas);
		fillParent(renderCanvas);
		renderCanvas.style.position = "absolute";
		renderCanvas.style.left = "0";
		renderCanvas.style.top = "0";
		renderCanvas.style.pointerEvents = "none";

		// Interactive canvas (transparent, on top, captures pointer events)
		const canvas = this.interactiveEl = document.createElement("canvas") as HTMLCanvasElement;
		containerEl.appendChild(canvas);
		fillParent(canvas);
		canvas.style.position = "absolute";
		canvas.style.left = "0";
		canvas.style.top = "0";
		canvas.style.zIndex = "10";

		canvas.addEventListener("mousedown", (e) => e.preventDefault());
		canvas.addEventListener("wheel", this._onWheel.bind(this), { passive: false });
		canvas.addEventListener("mousemove", this._onMouseMove.bind(this), { passive: true });
		canvas.addEventListener("mouseout", this._onMouseMove.bind(this));

		worker.onmessage = (e: MessageEvent) => {
			if (!e.data.ignore) {
				this.workerResults = e.data;
				this.changed();
			}
		};

		// PIXI.js must be loaded on the main page for rendering.
		// Previously it was inside the offscreen render worker via importScripts.
		this.ensurePixiLoaded(() => {
			try { this.initGraphics(renderCanvas); }
			catch { setTimeout(() => this.initGraphics(renderCanvas), 300); }
		});
	}

	private ensurePixiLoaded(callback: () => void) {
		if (typeof PIXI !== "undefined") {
			setTimeout(callback, 50);
			return;
		}

		const PIXI_CDN = "https://pixijs.download/v7.2.4/pixi.min.js";
		const PIXI_CDN_ALT = "https://cdn.jsdelivr.net/npm/pixi.js@7.2.4/dist/pixi.min.js";

		const loadScript = (url: string, onSuccess: () => void, onError: () => void) => {
			const script = document.createElement("script");
			script.src = url;
			script.onload = onSuccess;
			script.onerror = onError;
			document.head.appendChild(script);
		};

		loadScript(PIXI_CDN, callback, () => {
			// Fallback CDN
			loadScript(PIXI_CDN_ALT, callback, () => {
				console.error("Failed to load PIXI.js from CDN");
			});
		});
	}

	/* ------ Lifecycle ------ */

	destroy() {
		this.worker.terminate();
		this.workerResults = null;
		this.destroyGraphics();
	}

	/* ------ Input Handlers ------ */

	private _onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!this.px) return;

		let deltaY = e.deltaY;
		if (e.deltaMode === 1) deltaY *= 40;
		else if (e.deltaMode === 2) deltaY *= 800;

		let newScale = this.targetScale;
		newScale *= Math.pow(1.5, -deltaY / 120);
		this.targetScale = newScale;

		if (newScale < this.scale) {
			this.zoomCenterX = 0;
			this.zoomCenterY = 0;
		} else {
			const dpr = window.devicePixelRatio;
			this.zoomCenterX = e.offsetX * dpr;
			this.zoomCenterY = e.offsetY * dpr;
		}
		this.changed();
	}

	private _onMouseMove(e: MouseEvent) {
		if (e.type === "mouseout") {
			this.mouseX = this.mouseY = null;
		} else {
			this.mouseX = e.offsetX;
			this.mouseY = e.offsetY;
		}
	}

	/* ------ Graphics Initialization ------ */

	private initGraphics(canvasEl: HTMLCanvasElement) {
		const self = this;
		const interactiveEl = this.interactiveEl;
		const worker = this.worker;

		if (PIXI.settings?.RENDER_OPTIONS) PIXI.settings.RENDER_OPTIONS.hello = false;

		const pixiApp = this.px = new PIXI.Application({
			view: canvasEl,
			antialias: true,
			backgroundAlpha: 0,
			autoStart: false,
		});

		pixiApp.renderer.events.setTargetElement(interactiveEl);

		// --- Node Drag Interaction ---
		let clickOrigin: any = null;
		let multiTouchB: Touch | null = null;
		let touchA: Touch | null = null;

		this.onPointerDown = (node: GraphNode, pointerEvent: any) => {
			if (pointerEvent.nativeEvent.target === interactiveEl) {
				if (!multiTouchB) {
					self.dragNode = node;
					clickOrigin = pointerEvent.getLocalPosition(pixiApp.stage);
				}
			}
		};

		const onPointerUp = (pointerEvent: any) => {
			if (pointerEvent.nativeEvent instanceof TouchEvent) {
				touchHandler(pointerEvent.nativeEvent);
			}
			const dragNode = self.dragNode;
			if (dragNode) {
				const nativeEvt = pointerEvent.nativeEvent;
				if (clickOrigin && self.onNodeClick) {
					if ((nativeEvt instanceof MouseEvent && (nativeEvt.button === 0 || nativeEvt.button === 1)) ||
						nativeEvt instanceof TouchEvent) {
						self.onNodeClick(nativeEvt, dragNode.id, dragNode.type);
					}
				}
				dragNode.fx = null;
				dragNode.fy = null;
				worker.postMessage({ alphaTarget: 0, forceNode: { id: dragNode.id, x: null, y: null } });
				clickOrigin = null;
				self.dragNode = null;
				self.changed();
			}
		};

		pixiApp.stage
			.on("pointermove", (pointerEvent: any) => {
				const dragNode = self.dragNode;
				if (!dragNode) return;
				if (multiTouchB) { clickOrigin = null; self.dragNode = null; return; }
				if (clickOrigin) {
					const pos = pointerEvent.getLocalPosition(pixiApp.stage);
					const dx = pos.x - clickOrigin.x;
					const dy = pos.y - clickOrigin.y;
					if (dx * dx + dy * dy > 25) clickOrigin = null;
				}
				const worldPos = pointerEvent.getLocalPosition(self.hanger);
				dragNode.fx = worldPos.x;
				dragNode.fy = worldPos.y;
				worker.postMessage({
					alpha: 0.3, alphaTarget: 0.3, run: true,
					forceNode: { id: dragNode.id, x: worldPos.x, y: worldPos.y },
				});
				self.changed();
			})
			.on("pointerup", onPointerUp)
			.on("pointerupoutside", onPointerUp).eventMode = "static";

		// --- Hover ---
		this.onPointerOver = (node: GraphNode, pointerEvent: any) => {
			if (pointerEvent.pointerType === "touch") return;
			self.highlightNode = node;
			self.changed();
			const nativeEvt = pointerEvent.nativeEvent;
			if (nativeEvt instanceof MouseEvent) {
				self.mouseX = nativeEvt.offsetX;
				self.mouseY = nativeEvt.offsetY;
			}
			if (self.onNodeHover) self.onNodeHover(nativeEvt, node.id, node.type);
		};

		this.onPointerOut = () => {
			self.highlightNode = null;
			self.changed();
			if (self.onNodeUnhover) self.onNodeUnhover();
		};

		// --- Scene Setup ---
		const hanger = this.hanger = new PIXI.Container();
		hanger.eventMode = "static";

		this.onResize();
		this.resetPan();

		const bgRect = new PIXI.Graphics();
		bgRect.eventMode = "static";
		bgRect.beginFill(0);
		bgRect.drawRect(0, 0, 1e4, 1e4);
		bgRect.endFill();
		bgRect.alpha = 0;

		// --- Touch Panning & Pinch Zoom ---
		let panStart: any = null;
		let panOrigin: any = null;
		let lastTime = performance.now();
		let smoothDt = 0;
		let velocityX = 0;
		let velocityY = 0;

		const touchHandler = (touchEvent: TouchEvent) => {
			const now = performance.now();
			const dt = now - lastTime;
			const touches = Array.prototype.slice.call(touchEvent.touches) as Touch[];
			let newA: Touch | null = null;
			let newB: Touch | null = null;

			for (const t of touches) {
				if (touchA && t.identifier === touchA.identifier) newA = t;
				if (multiTouchB && t.identifier === multiTouchB.identifier) newB = t;
			}
			if (newB && !newA) { touchA = multiTouchB; newA = newB; multiTouchB = null; newB = null; }
			if (newA) { const idx = touches.indexOf(newA); if (idx >= 0) touches.splice(idx, 1); }
			else if (touches.length > 0) { newA = touches[0]; touches.splice(0, 1); }
			if (newB) { const idx2 = touches.indexOf(newB); if (idx2 >= 0) touches.splice(idx2, 1); }
			else if (touches.length > 0) { newB = touches[0]; touches.splice(0, 1); }

			if (!clickOrigin && !self.dragNode && touchA && newA && touchA.identifier === newA.identifier) {
				const dpr = window.devicePixelRatio;
				if (multiTouchB && newB && multiTouchB.identifier === newB.identifier) {
					const rect = self.interactiveEl.getBoundingClientRect();
					const oldMidX = ((touchA.clientX + multiTouchB.clientX) / 2 - rect.x) * dpr;
					const oldMidY = ((touchA.clientY + multiTouchB.clientY) / 2 - rect.y) * dpr;
					const newMidX = ((newA.clientX + newB.clientX) / 2 - rect.x) * dpr;
					const newMidY = ((newA.clientY + newB.clientY) / 2 - rect.y) * dpr;
					const oldDx = touchA.clientX - multiTouchB.clientX;
					const oldDy = touchA.clientY - multiTouchB.clientY;
					const newDx = newA.clientX - newB.clientX;
					const newDy = newA.clientY - newB.clientY;
					const oldDist = oldDx * oldDx + oldDy * oldDy;
					const newDist = newDx * newDx + newDy * newDy;
					if (oldDist !== 0 && newDist !== 0) {
						const ratio = Math.sqrt(newDist / oldDist);
						self.zoomCenterX = newMidX;
						self.zoomCenterY = newMidY;
						self.setPan(self.panX + (newMidX - oldMidX), self.panY + (newMidY - oldMidY));
						self.targetScale = self.targetScale * ratio;
						self.changed();
					}
					velocityX = 0; velocityY = 0;
				} else {
					const panDx = (newA.clientX - touchA.clientX) * dpr;
					const panDy = (newA.clientY - touchA.clientY) * dpr;
					smoothDt = lerp(smoothDt, dt, 0.8);
					lastTime = now;
					velocityX = lerp(velocityX, panDx, 0.8);
					velocityY = lerp(velocityY, panDy, 0.8);
					self.setPan(self.panX + panDx, self.panY + panDy);
					self.changed();
				}
			} else {
				smoothDt = lerp(smoothDt, dt, 0.8);
				if (dt < 100) { self.panvX = velocityX / smoothDt; self.panvY = velocityY / smoothDt; }
				velocityX = velocityY = 0;
			}
			touchA = newA;
			multiTouchB = newB;
		};

		const onBgPointerUp = (pointerEvent: any) => {
			if (pointerEvent.nativeEvent instanceof TouchEvent) {
				touchHandler(pointerEvent.nativeEvent);
			} else {
				panStart = null;
				document.body.classList.remove("is-grabbing");
				self.panning = false;
				const dt = performance.now() - lastTime;
				smoothDt = lerp(smoothDt, dt, 0.8);
				if (dt > 100) { self.panvX = self.panvY = 0; }
				else { self.panvX /= smoothDt; self.panvY /= smoothDt; }
			}
		};

		bgRect.on("pointerdown", (pointerEvent: any) => {
			if (pointerEvent.nativeEvent instanceof TouchEvent) {
				touchHandler(pointerEvent.nativeEvent);
			} else {
				panStart = pointerEvent.getLocalPosition(pixiApp.stage);
				panOrigin = { x: hanger.x, y: hanger.y };
				document.body.classList.add("is-grabbing");
				self.panning = true;
			}
		});

		pixiApp.stage
			.on("pointermove", (pointerEvent: any) => {
				if (pointerEvent.nativeEvent instanceof TouchEvent) {
					touchHandler(pointerEvent.nativeEvent);
				} else if (panStart) {
					const pos = pointerEvent.getLocalPosition(pixiApp.stage);
					const newX = panOrigin.x + pos.x - panStart.x;
					const newY = panOrigin.y + pos.y - panStart.y;
					const now = performance.now();
					smoothDt = lerp(smoothDt, now - lastTime, 0.8);
					lastTime = now;
					self.panvX = lerp(self.panvX, newX - self.panX, 0.8);
					self.panvY = lerp(self.panvY, newY - self.panY, 0.8);
					self.setPan(newX, newY);
					self.changed();
				}
			})
			.on("pointerup", onBgPointerUp)
			.on("pointerupoutside", onBgPointerUp).eventMode = "static";

		pixiApp.stage.addChild(bgRect);
		pixiApp.stage.addChild(hanger);
		this.updateZoom();

		// ==========================================
		// Main Render Loop
		// ==========================================
		this.renderCallback = () => {
			self.renderTimer = null;
			if (!self.px) return;
			if (self.idleFrames > 60) return;

			const nodes = self.nodes;
			const links = self.links;

			// --- Process worker results ---
			const results = self.workerResults;
			if (results) {
				const nodeIds = results.id;
				const buffer = results.buffer;
				let shouldUpdate = true;

				if (buffer instanceof ArrayBuffer) {
					self.workerResults = null;
				} else {
					const versionView = new Uint32Array(buffer, buffer.byteLength - 4, 1);
					if (versionView[0] === results.v) shouldUpdate = false;
					else results.v = versionView[0];
				}

				if (shouldUpdate) {
					const positions = new Float32Array(buffer);
					for (let i = 0; i < nodeIds.length; i++) {
						const node = self.nodeLookup[nodeIds[i]];
						if (node) {
							node.x = positions[2 * i];
							node.y = positions[2 * i + 1];
							if (node.fx) node.x = node.fx;
							if (node.fy) node.y = node.fy;
						}
					}
				}
			}

			// --- Inertial panning ---
			if (!self.panning) {
				self.panX += (1000 * self.panvX) / 60;
				self.panY += (1000 * self.panvY) / 60;
				self.panvX = lerp(self.panvX, 0, 0.9);
				self.panvY = lerp(self.panvY, 0, 0.9);
			}

			self.updateZoom();

			// --- Compute viewport ---
			const scale = self.scale;
			const dpr2 = window.devicePixelRatio;
			const viewLeft = -self.panX / scale;
			const viewTop = -self.panY / scale;
			const viewRight = viewLeft + (self.width / scale) * dpr2;
			const viewBottom = viewTop + (self.height / scale) * dpr2;
			self.viewport = { left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom };

			const centerX = (viewLeft + viewRight) / 2;
			const centerY = (viewTop + viewBottom) / 2;

			// --- Lazy init closest unrendered nodes ---
			const toInit: { node: GraphNode; dist: number }[] = [];
			for (const nd of nodes) {
				if (!nd.rendered) {
					const ddx = (nd.x ?? 0) - centerX;
					const ddy = (nd.y ?? 0) - centerY;
					const dist2 = ddx * ddx + ddy * ddy;
					if (toInit.length < 50 || dist2 < toInit[toInit.length - 1].dist) {
						toInit.push({ node: nd, dist: dist2 });
						toInit.sort((a, b) => a.dist - b.dist);
						if (toInit.length > 50) toInit.pop();
					}
				}
			}
			if (toInit.length > 0) {
				for (const item of toInit) item.node.initGraphics();
				self.idleFrames = 0;
			}

			for (const lnk of links) lnk.initGraphics();
			for (const nd of nodes) nd.render();
			for (const lnk of links) lnk.render();

			hanger.sortChildren();
			pixiApp.render();

			self.idleFrames++;
			self.queueRender();

			// --- Hover detection ---
			const mx = self.mouseX;
			const my = self.mouseY;
			const hn = self.highlightNode;
			if (mx !== null && my !== null && hn) {
				const worldX = (mx * dpr2 - self.panX) / scale;
				const worldY = (my * dpr2 - self.panY) / scale;
				const hdx = (hn.x ?? 0) - worldX;
				const hdy = (hn.y ?? 0) - worldY;
				const hSize = hn.getSize() * self.nodeScale + 2;
				if (hdx * hdx + hdy * hdy > hSize * hSize) {
					self.highlightNode = null;
					self.idleFrames = 0;
					if (self.onNodeUnhover) self.onNodeUnhover();
				}
			}
		};

		this.queueRender();
	}

	/* ------ Graphics Teardown ------ */

	private destroyGraphics() {
		this.hanger = null;
		for (const lnk of this.links) lnk.clearGraphics();
		for (const nd of this.nodes) nd.clearGraphics();
		if (this.px) {
			this.px.renderer.events.setTargetElement(null);
			this.px.destroy(true, { children: true, texture: true, baseTexture: true });
			this.px = null;
		}
		if (this.renderTimer) window.cancelAnimationFrame(this.renderTimer);
		this.renderTimer = null;
		this.renderCallback = null;
		document.body.classList.remove("is-grabbing");
	}

	/* ------ View Transform ------ */

	zoomTo(targetScale: number, center?: { x: number; y: number }) {
		this.targetScale = targetScale;
		if (center) { this.zoomCenterX = center.x; this.zoomCenterY = center.y; }
		else { this.zoomCenterX = this.zoomCenterY = 0; }
	}

	onResize() {
		const px = this.px;
		const hanger = this.hanger;
		const container = this.containerEl;
		const canvas = this.interactiveEl;
		const dpr = window.devicePixelRatio;

		const w = container.clientWidth;
		const h = container.clientHeight;
		this.width = w;
		this.height = h;

		if (px) {
			const pixelW = Math.round(w * dpr);
			const pixelH = Math.round(h * dpr);
			const renderer = px.renderer;
			const oldW = renderer.width;
			const oldH = renderer.height;

			renderer.view.style.width = w + "px";
			renderer.view.style.height = h + "px";
			renderer.resize(pixelW, pixelH);
			canvas.width = w;
			canvas.height = h;
			px.renderer.events.resolutionChange(1 / dpr);

			if (hanger) {
				this.setPan(this.panX + (pixelW - oldW) / 2, this.panY + (pixelH - oldH) / 2);
			}
		}
		this.changed();
	}

	resetPan() {
		const dpr = window.devicePixelRatio;
		this.setPan((this.width / 2) * dpr, (this.height / 2) * dpr);
	}

	autoResizeCanvas() {
		this.onResize();
	}

	centerCamera() {
		this.resetPan();
	}

	/* ------ Data Management ------ */

	clearData() {
		for (const link of this.links) link.clearGraphics();
		for (const node of this.nodes) node.clearGraphics();
		this.links = [];
		this.nodes = [];
		this.nodeLookup = {};
	}

	getNodePositions(): Record<string, [number, number]> {
		const positions: Record<string, [number, number]> = {};
		for (const node of this.nodes) {
			if (node.x !== null && node.y !== null) {
				positions[node.id] = [node.x, node.y];
			}
		}
		return positions;
	}

	setNodePosition(id: string, x: number, y: number) {
		const node = this.nodeLookup[id];
		if (node) { node.x = x; node.y = y; }
	}

	resyncWorker() {
		const nodePositions: Record<string, [number, number]> = {};
		for (const node of this.nodes) {
			nodePositions[node.id] = [node.x ?? 0, node.y ?? 0];
		}
		const linkPairs: [string, string][] = [];
		for (const lnk of this.links) linkPairs.push([lnk.source.id, lnk.target.id]);
		this.worker.postMessage({ nodes: nodePositions, links: linkPairs, alpha: 0.3, run: true });
		this.changed();
	}

	setData(data: GraphData) {
		const existingNodes = this.nodes;
		const nodeLookup = this.nodeLookup;
		const existingLinks = this.links;
		const newNodeMap = data.nodes;

		const removedLinks: GraphLink[] = [];
		const removedNodes: GraphNode[] = [];
		let changed = false;
		let colorChanged = false;
		let maxDistSq = 0;

		for (const node of existingNodes) {
			if (newNodeMap.hasOwnProperty(node.id)) {
				maxDistSq = Math.max(maxDistSq, (node.x ?? 0) * (node.x ?? 0) + (node.y ?? 0) * (node.y ?? 0));
			} else {
				removedNodes.push(node);
				changed = true;
			}
		}
		const maxDist = Math.sqrt(maxDistSq);

		const addedNodes: GraphNode[] = [];
		for (const id in newNodeMap) {
			if (!newNodeMap.hasOwnProperty(id)) continue;
			const nodeData = newNodeMap[id];

			if (nodeLookup.hasOwnProperty(id)) {
				const existingNode = nodeLookup[id];
				const newColor = nodeData.color || null;
				if (existingNode.color !== newColor) { existingNode.color = newColor; colorChanged = true; }
				if (existingNode.type !== nodeData.type) { existingNode.type = nodeData.type; colorChanged = true; }
			} else {
				const newNode = new GraphNode(this, id, nodeData.type);
				newNode.color = nodeData.color || null;
				newNode._displayText = nodeData.displayText || id;
				existingNodes.push(newNode);
				nodeLookup[id] = newNode;
				changed = true;
				addedNodes.push(newNode);
			}
		}

		for (const id2 in newNodeMap) {
			if (!newNodeMap.hasOwnProperty(id2) || !nodeLookup.hasOwnProperty(id2)) continue;
			const node2 = nodeLookup[id2];
			const targetLinks = newNodeMap[id2].links;

			for (const fwdId in node2.forward) {
				if (node2.forward.hasOwnProperty(fwdId) && !targetLinks.hasOwnProperty(fwdId)) {
					removedLinks.push(node2.forward[fwdId]);
					changed = true;
				}
			}

			for (const targetId in targetLinks) {
				if (targetLinks.hasOwnProperty(targetId) &&
					!node2.forward.hasOwnProperty(targetId) &&
					nodeLookup.hasOwnProperty(targetId)) {
					const targetNode = nodeLookup[targetId];
					const link = new GraphLink(this, node2, targetNode);
					existingLinks.push(link);
					node2.forward[targetNode.id] = link;
					targetNode.reverse[node2.id] = link;
					changed = true;
				}
			}
		}

		const removeLink = (lnk: GraphLink) => {
			lnk.clearGraphics();
			const idx = existingLinks.indexOf(lnk);
			if (idx >= 0) existingLinks.splice(idx, 1);
			delete lnk.source.forward[lnk.target.id];
			delete lnk.target.reverse[lnk.source.id];
		};

		for (const rl of removedLinks) removeLink(rl);

		for (const rmNode of removedNodes) {
			rmNode.clearGraphics();
			const rmIdx = existingNodes.indexOf(rmNode);
			if (rmIdx >= 0) existingNodes.splice(rmIdx, 1);
			delete nodeLookup[rmNode.id];
			for (const fId in rmNode.forward) { if (rmNode.forward.hasOwnProperty(fId)) removeLink(rmNode.forward[fId]); }
			for (const rId in rmNode.reverse) { if (rmNode.reverse.hasOwnProperty(rId)) removeLink(rmNode.reverse[rId]); }
		}

		if (addedNodes.length > 0) {
			const area = 60 * addedNodes.length * 60;
			const ringRadius = Math.sqrt(area / Math.PI + maxDist * maxDist) - maxDist;
			const scatterSize = Math.sqrt(area);

			for (const addNode of addedNodes) {
				let sumX = 0, sumY = 0, neighborCount = 0;
				for (const neighborId of addNode.getRelated()) {
					if (nodeLookup.hasOwnProperty(neighborId)) {
						const neighbor = nodeLookup[neighborId];
						if (neighbor.x !== null && neighbor.y !== null) {
							sumX += neighbor.x; sumY += neighbor.y; neighborCount++;
						}
					}
				}
				if (neighborCount > 0) {
					addNode.x = sumX / neighborCount + (Math.random() - 0.5) * scatterSize;
					addNode.y = sumY / neighborCount + (Math.random() - 0.5) * scatterSize;
				} else {
					const angle = 2 * Math.random() * Math.PI;
					const dist = maxDist + Math.sqrt(Math.random()) * ringRadius;
					addNode.x = dist * Math.cos(angle);
					addNode.y = dist * Math.sin(angle);
				}
			}
		}

		const weights = data.weights;
		for (const wid in nodeLookup) {
			if (!nodeLookup.hasOwnProperty(wid)) continue;
			const wNode = nodeLookup[wid];
			const newWeight = weights
				? (weights.hasOwnProperty(wid) ? weights[wid] : 0)
				: wNode.getRelated().length;
			if (wNode.weight !== newWeight) { wNode.weight = newWeight; changed = true; }
		}

		if (changed) {
			const linkPairs: [string, string][] = [];
			for (const lnk2 of existingLinks) linkPairs.push([lnk2.source.id, lnk2.target.id]);

			const nodePositions: Record<string, [number, number]> = {};
			for (const an of addedNodes) nodePositions[an.id] = [an.x ?? 0, an.y ?? 0];

			this.worker.postMessage({ nodes: nodePositions, links: linkPairs, alpha: 0.3, run: true });
			this.changed();
		} else if (colorChanged) {
			this.changed();
		}
	}

	/* ------ Render Options ------ */

	setRenderOptions(options: GraphRenderOptions) {
		if (typeof options.nodeSizeMultiplier === "number") this.fNodeSizeMult = options.nodeSizeMultiplier;
		if (typeof options.lineSizeMultiplier === "number") this.fLineSizeMult = options.lineSizeMultiplier;
		if (typeof options.textFadeMultiplier === "number") this.fTextShowMult = options.textFadeMultiplier;
		if (typeof options.showArrow === "boolean") this.fShowArrow = options.showArrow;
		this.changed();
	}

	setForces(forces: GraphForces) {
		this.worker.postMessage({ forces, alpha: 0.3, run: true });
	}

	getHighlightNode(): GraphNode | null {
		return this.dragNode || this.highlightNode;
	}

	/* ------ Zoom / Pan / Scale ------ */

	private updateZoom() {
		let scale = this.scale;
		let targetScale = this.targetScale;
		let panX = this.panX;
		let panY = this.panY;

		targetScale = this.targetScale = Math.min(8, Math.max(1 / 128, targetScale));

		const ratio = scale > targetScale ? scale / targetScale : targetScale / scale;
		if (ratio - 1 >= 0.01) {
			let cx = this.zoomCenterX;
			let cy = this.zoomCenterY;
			if (cx === 0 && cy === 0) {
				const dpr = window.devicePixelRatio;
				cx = (this.width / 2) * dpr;
				cy = (this.height / 2) * dpr;
			}
			const worldPoint = { x: (cx - panX) / scale, y: (cy - panY) / scale };
			scale = lerp(scale, targetScale, 0.85);
			panX -= worldPoint.x * scale + panX - cx;
			panY -= worldPoint.y * scale + panY - cy;
			this.changed();
		}

		this.setPan(panX, panY);
		this.setScale(scale);
	}

	setPan(x: number, y: number) {
		this.panX = x;
		this.panY = y;
		if (this.hanger) { this.hanger.x = x; this.hanger.y = y; }
	}

	setScale(s: number) {
		this.scale = s;
		this.nodeScale = Math.sqrt(1 / s);
		const logScale = Math.log(s) / Math.log(2);
		this.textAlpha = Math.min(Math.max(logScale + 1 - this.fTextShowMult, 0), 1);
		if (this.hanger) { this.hanger.scale.x = this.hanger.scale.y = s; }
	}

	changed() {
		this.idleFrames = 0;
		this.queueRender();
	}

	queueRender() {
		if (!this.renderTimer && this.renderCallback) {
			this.renderTimer = window.requestAnimationFrame(this.renderCallback);
		}
	}

	/* ------ CSS Color Detection ------ */

	testCSS() {
		const readColor = (cssClass: string): ColorValue => {
			const div = document.createElement("div");
			div.className = "graph-view " + cssClass;
			document.body.appendChild(div);
			const computed = getComputedStyle(div);
			const colorStr = computed.color;
			const opacityStr = computed.opacity;
			div.remove();

			const parsed = parseColor(colorStr);
			const opacity = parseFloat(opacityStr);
			const safeOpacity = isNaN(opacity) ? 1 : opacity;

			return parsed
				? { a: safeOpacity * parsed.a, rgb: (parsed.r << 16) | (parsed.g << 8) | parsed.b }
				: { a: safeOpacity, rgb: 0x888888 };
		};

		for (const key in COLOR_CLASS_MAP) {
			if (COLOR_CLASS_MAP.hasOwnProperty(key)) {
				this.colors[key] = readColor(COLOR_CLASS_MAP[key]);
			}
		}

		for (const node of this.nodes) node.fontDirty = true;
		this.changed();
	}

	/* ------ Worker Creation Helper ------ */

	static createSimWorker(): Worker {
		const workerPath = `${ObsidianSite.document.info.pathToRoot}/${Shared.libFolderName}/${Shared.scriptsFolderName}/graph-sim-worker.js`;

		if (window.location.protocol === "file:") {
			const fileInfo = ObsidianSite.getLocalDataFromId(LinkHandler.getFileDataIdFromURL(workerPath));
			const data = Uint8Array.from(Array.from(fileInfo.data).map((s: string) => s.charCodeAt(0)));
			return new Worker(URL.createObjectURL(new Blob([data], { type: "application/javascript" })));
		} else {
			return new Worker(new URL(workerPath, window.location.href).pathname);
		}
	}
}

