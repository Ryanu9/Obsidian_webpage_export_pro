import { LinkHandler } from "./links";
import { GraphViewOptions } from "src/shared/features/graph-view";
import { InsertedFeature } from "src/shared/inserted-feature";
import { GraphRenderer, GraphData } from "../graph-view/graph-worker-helper";

declare const ObsidianSite: any;

export class GraphView extends InsertedFeature<GraphViewOptions> {
	public get options(): GraphViewOptions {
		return this._options as GraphViewOptions;
	}

	// node data
	public paths: string[] = [];
	public graphExpanded: boolean = false;
	private currentFocusedPath: string | undefined = undefined;

	public graphRenderer: GraphRenderer;
	public graphContainer: HTMLElement;
	public backGraphButton: HTMLElement;
	public globalGraphButton: HTMLElement;
	public expandGraphButton: HTMLElement;
	private graphNavigationHistory: string[] = [];

	private _isGlobalGraph: boolean = false;
	public get isGlobalGraph(): boolean {
		return this._isGlobalGraph;
	}
	private set isGlobalGraph(value: boolean) {
		this._isGlobalGraph = value;
	}

	constructor(featureEl: HTMLElement) {
		super(ObsidianSite.metadata.featureOptions.graphView, featureEl);
		this.graphContainer = featureEl.querySelector(".graph-view-container") as HTMLElement;
		this.backGraphButton = this.ensureBackGraphButton();
		this.globalGraphButton = featureEl.querySelector(".graph-global.graph-icon") as HTMLElement;
		this.expandGraphButton = featureEl.querySelector(".graph-expand.graph-icon") as HTMLElement;

		// Remove old static canvas if present
		const oldCanvas = this.graphContainer?.querySelector("#graph-canvas");
		if (oldCanvas) oldCanvas.remove();

		// Create sim worker and GraphRenderer
		const worker = GraphRenderer.createSimWorker();
		this.graphRenderer = new GraphRenderer(this.graphContainer, worker);
		this.graphRenderer.setScale(0.5);
		this.graphRenderer.targetScale = 0.5;
		this.graphRenderer.setRenderOptions({ textFadeMultiplier: -1 });

		// Node click → navigation. The renderer keeps shared nodes alive between
		// data updates, matching the official Publish graph transition behavior.
		this.graphRenderer.onNodeClick = (_event: Event, nodeId: string, _nodeType: string) => {
			this.navigateToNode(nodeId);
		};

		// Theme toggle → re-read CSS colors (listen for custom event from Theme.setTheme)
		document.addEventListener("theme-changed", () => {
			this.graphRenderer?.testCSS();
		});

		this.initUIEvents();
		this.updateBackButtonState();
	}

	private ensureBackGraphButton(): HTMLElement {
		let button = this.graphContainer.querySelector(".graph-back.graph-icon") as HTMLElement | null;
		if (!button) {
			button = document.createElement("div");
			button.className = "graph-icon graph-back";
			button.setAttribute("role", "button");
			button.setAttribute("aria-label", "Back");
			button.setAttribute("data-tooltip-position", "top");
			this.graphContainer.prepend(button);
		}

		button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-undo-2"><path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path></svg>`;
		button.hidden = true;
		return button;
	}

	private initUIEvents() {
		const localThis = this;

		this.expandGraphButton?.addEventListener("click", event => {
			event.stopPropagation();
			localThis.toggleExpandedGraph();
		});

		this.backGraphButton?.addEventListener("click", event => {
			event.preventDefault();
			event.stopPropagation();
			void localThis.returnToPreviousGraphNode();
		});

		this.globalGraphButton?.addEventListener("click", event => {
			event.stopPropagation();
			if (!localThis.isGlobalGraph) {
				localThis.showGraph();
			} else {
				localThis.showGraph([ObsidianSite.document.pathname]);
			}
		});

		// recenter the graph on double click
		this.graphContainer.addEventListener("dblclick", () => {
			this.graphRenderer.resetPan();
			this.graphRenderer.zoomTo(0.5);
			this.graphRenderer.changed();
		});
	}

	/**
	 * Build node-map data from paths and call GraphRenderer.setData() + setForces()
	 */
	private buildGraphData(paths: string[], focusedPath?: string): GraphData {
		const nodes: Record<string, { type: string; links: Record<string, boolean>; displayText: string }> = {};
		const weights: Record<string, number> | undefined = focusedPath ? {} : undefined;
		const pathSet = new Set(paths);

		// Create node entries using file path as node ID
		for (const path of paths) {
			const fileInfo = ObsidianSite.getWebpageData(path);
			const isFocused = path === focusedPath;
			nodes[path] = {
				type: isFocused ? "focused" : (fileInfo?.type || ""),
				links: {},
				displayText: fileInfo?.title || path,
			};
			// Focused node gets weight 30 (larger), like official filterLocalGraph
			if (isFocused && weights) weights[path] = 30;
		}

		// Build links using file paths as IDs
		for (const source of paths) {
			const fileInfo = ObsidianSite.getWebpageData(source);
			if (!fileInfo) continue;

			const outLinks = (fileInfo.links || []).map((l: string) => LinkHandler.getPathnameFromURL(l))
				.concat(fileInfo.attachments || []);

			for (const link of outLinks) {
				if (pathSet.has(link) && link !== source) {
					nodes[source].links[link] = true;
				}
			}
		}

		return weights ? { nodes, weights } : { nodes };
	}

	public async showGraph(paths?: string[]) {
		let linked: string[] = [];
		const directlyLinked = new Set<string>();
		const focusedPath = paths ? paths[0] : undefined;
		this.isGlobalGraph = !paths;

		if (paths) {
			for (const element of paths) {
				const fileInfo = ObsidianSite.getWebpageData(element);
				const backlinks: string[] = fileInfo?.backlinks || [];
				const links = (fileInfo?.links || []).map((l: string) => LinkHandler.getPathnameFromURL(l));
				const attachments: string[] = fileInfo?.attachments || [];

				linked.push(...backlinks, ...links, ...attachments);
				backlinks.concat(links, attachments).forEach((link) => directlyLinked.add(link));
			}
			linked.push(...paths);
		} else {
			linked = ObsidianSite.metadata.allFiles;
		}

		linked = linked.filter((l) => {
			if (focusedPath && l === focusedPath) return true;

			const data = ObsidianSite.getWebpageData(l);
			if (!data || !data.type) return false;

			const backlinks = data.backlinks || [];
			const links = data.links || [];

			if (!this.options.showOrphanNodes && !directlyLinked.has(l) && backlinks.length == 0 && links.length == 0)
				return false;

			if (!this.options.showAttachments && (data.type == "attachment" || data.type == "media" || data.type == "other"))
				return false;

			return true;
		});

		if (linked.length == 0) {
			console.log("No nodes to display.");
			return;
		}

		const uniquePaths = [...new Set(linked)];
		this.paths = uniquePaths;

		if (focusedPath && this.currentFocusedPath !== focusedPath) {
			this.graphRenderer.resetPan();
			this.currentFocusedPath = focusedPath;
		} else if (!focusedPath) {
			this.currentFocusedPath = undefined;
		}

		// Set data incrementally. GraphRenderer.setData() removes stale nodes,
		// keeps shared nodes, and seeds new nodes near their neighbors like the
		// official Obsidian Publish graph.
		const graphData = this.buildGraphData(uniquePaths, focusedPath);
		this.graphRenderer.setData(graphData);

		// Set forces
		this.graphRenderer.setForces({
			centerStrength: this.options.centralForce || 0.1,
			linkStrength: this.options.attractionForce || 1,
			linkDistance: this.options.linkLength || 250,
			repelStrength: this.options.repulsionForce || 1000,
		});

		// Set icons
		const localSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-circle-dot"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>`;
		const globalSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-git-fork"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>`;
		this.globalGraphButton.innerHTML = this.isGlobalGraph ? localSVG : globalSVG;
		this.updateBackButtonState();
	}

	private pushGraphNavigationHistory(path: string | undefined) {
		if (!path) return;
		const lastPath = this.graphNavigationHistory[this.graphNavigationHistory.length - 1];
		if (lastPath === path) return;
		this.graphNavigationHistory.push(path);
	}

	private getCurrentDocumentPath(): string | undefined {
		return ObsidianSite.document?.pathname;
	}

	private popPreviousGraphPath(): string | undefined {
		const currentPath = this.getCurrentDocumentPath();
		while (this.graphNavigationHistory.length > 0) {
			const previousPath = this.graphNavigationHistory.pop();
			if (previousPath && previousPath !== currentPath) {
				return previousPath;
			}
		}
		return undefined;
	}

	private updateBackButtonState() {
		if (!this.backGraphButton) return;
		const currentPath = this.getCurrentDocumentPath();
		while (this.graphNavigationHistory.length > 0 && this.graphNavigationHistory[this.graphNavigationHistory.length - 1] === currentPath) {
			this.graphNavigationHistory.pop();
		}
		const canGoBack = this.graphNavigationHistory.length > 0;
		this.backGraphButton.hidden = !canGoBack;
		this.backGraphButton.setAttribute("aria-disabled", canGoBack ? "false" : "true");
		const previousPath = this.graphNavigationHistory[this.graphNavigationHistory.length - 1];
		const previousTitle = previousPath ? (ObsidianSite.getWebpageData(previousPath)?.title || previousPath) : "";
		this.backGraphButton.setAttribute("aria-label", previousTitle ? `Back to ${previousTitle}` : "Back");
	}

	private async returnToPreviousGraphNode() {
		const previousPath = this.popPreviousGraphPath();
		this.updateBackButtonState();
		if (!previousPath) return;
		if (this.graphExpanded) this.toggleExpandedGraph();
		await ObsidianSite.loadURL(previousPath);
		this.updateBackButtonState();
	}

	private async navigateToNode(path: string) {
		if (!path) return;
		const currentPath = this.getCurrentDocumentPath();
		if (currentPath && currentPath !== path) {
			this.pushGraphNavigationHistory(currentPath);
		}
		if (this.graphExpanded) this.toggleExpandedGraph();
		await ObsidianSite.loadURL(path);
	}

	public setActiveNodeByPath(_path: string) {
		// In the official GraphRenderer architecture, the active/focused node
		// is determined by the data passed to setData() (type "focused").
		// showGraph() already rebuilds data with the current path.
	}

	public toggleExpandedGraph() {
		const localThis = this;

		this.graphContainer.classList.add("scale-down");
		const fadeOutAnimation = this.graphContainer.animate({ opacity: 0 }, { duration: 100, easing: "ease-in", fill: "forwards" });
		fadeOutAnimation.addEventListener("finish", function () {
			localThis.graphContainer.classList.toggle("expanded");

			// Defer resize to next frame so browser reflows the fixed-position layout first
			requestAnimationFrame(() => {
				localThis.graphRenderer.onResize();

				if (localThis.graphExpanded) {
					localThis.graphRenderer.zoomTo(2 * localThis.graphRenderer.scale);
				}

				localThis.graphContainer.classList.remove("scale-down");
				localThis.graphContainer.classList.add("scale-up");
				localThis.graphRenderer.changed();

				const fadeInAnimation = localThis.graphContainer.animate({ opacity: 1 }, { duration: 200, easing: "ease-out", fill: "forwards" });
				fadeInAnimation.addEventListener("finish", function () {
					localThis.graphContainer.classList.remove("scale-up");
				});
			});
		});

		this.graphExpanded = !this.graphExpanded;

		if (this.graphExpanded) {
			document.addEventListener("pointerdown", handleOutsideClick, { once: true });
		} else {
			document.removeEventListener("pointerdown", handleOutsideClick);
		}

		function handleOutsideClick(event: PointerEvent) {
			if (!localThis.graphExpanded) return;
			if (event.composedPath().includes(localThis.graphContainer)) {
				document.addEventListener("pointerdown", handleOutsideClick, { once: true });
				return;
			}
			localThis.toggleExpandedGraph();
		}

	}
}
