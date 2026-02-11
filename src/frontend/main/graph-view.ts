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
	private savedPositions: Record<string, [number, number]> = {};

	public graphRenderer: GraphRenderer;
	public graphContainer: HTMLElement;
	public globalGraphButton: HTMLElement;
	public expandGraphButton: HTMLElement;

	private _isGlobalGraph: boolean = false;
	public get isGlobalGraph(): boolean {
		return this._isGlobalGraph;
	}
	private set isGlobalGraph(value: boolean) {
		this._isGlobalGraph = value;
	}

	private eventsInitialized: boolean = false;

	constructor(featureEl: HTMLElement) {
		super(ObsidianSite.metadata.featureOptions.graphView, featureEl);
		this.graphContainer = document.querySelector(".graph-view-container") as HTMLElement;
		this.globalGraphButton = document.querySelector(".graph-global.graph-icon") as HTMLElement;
		this.expandGraphButton = document.querySelector(".graph-expand.graph-icon") as HTMLElement;

		// Remove old static canvas if present
		const oldCanvas = this.graphContainer?.querySelector("#graph-canvas");
		if (oldCanvas) oldCanvas.remove();

		// Create sim worker and GraphRenderer
		const worker = GraphRenderer.createSimWorker();
		this.graphRenderer = new GraphRenderer(this.graphContainer, worker);
		this.graphRenderer.setScale(0.5);
		this.graphRenderer.targetScale = 0.5;
		this.graphRenderer.setRenderOptions({ textFadeMultiplier: -1 });

		// Node click → navigation (save positions before navigating)
		this.graphRenderer.onNodeClick = (_event: Event, nodeId: string, _nodeType: string) => {
			this.savedPositions = this.graphRenderer.getNodePositions();
			this.navigateToNode(nodeId);
		};

		// Resize handling
		window.addEventListener("resize", () => this.graphRenderer?.onResize());

		// Theme toggle → re-read CSS colors
		document.querySelector(".theme-toggle-input")?.addEventListener("change", () => {
			setTimeout(() => this.graphRenderer?.testCSS(), 0);
		});

		// Show initial graph
		this.showGraph([ObsidianSite.document.pathname]);

		this.initUIEvents();
	}

	private initUIEvents() {
		const localThis = this;

		this.expandGraphButton?.addEventListener("click", event => {
			event.stopPropagation();
			localThis.toggleExpandedGraph();
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
		const weights: Record<string, number> = {};
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
			if (isFocused) weights[path] = 30;
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

		return { nodes, weights };
	}

	public async showGraph(paths?: string[]) {
		let linked: string[] = [];
		if (paths) {
			for (const element of paths) {
				const fileInfo = ObsidianSite.getWebpageData(element);
				if (fileInfo?.backlinks)
					linked.push(...fileInfo.backlinks);
				if (fileInfo?.links)
					linked.push(...fileInfo.links.map((l: string) => LinkHandler.getPathnameFromURL(l)));
				if (fileInfo?.attachments)
					linked.push(...fileInfo.attachments);
			}
			linked.push(...paths);
		} else {
			linked = ObsidianSite.metadata.allFiles;
		}

		this.isGlobalGraph = linked.length == ObsidianSite.metadata.allFiles.length;

		linked = linked.filter((l) => {
			const data = ObsidianSite.getWebpageData(l);
			if (!data || !data.type) return false;

			const backlinks = data.backlinks || [];
			const links = data.links || [];

			if (!this.options.showOrphanNodes && backlinks.length == 0 && links.length == 0)
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

		// Determine focused path (the current page)
		const focusedPath = paths ? paths[0] : undefined;

		// Save positions of old nodes before clearing
		const oldPositions = this.graphRenderer.getNodePositions();
		// Merge with any positions saved from click navigation
		for (const id in this.savedPositions) {
			if (this.savedPositions.hasOwnProperty(id)) {
				oldPositions[id] = this.savedPositions[id];
			}
		}
		this.savedPositions = {};

		// Clear old graph and set new data
		const graphData = this.buildGraphData(uniquePaths, focusedPath);
		this.graphRenderer.clearData();
		this.graphRenderer.setData(graphData);

		// Restore positions for nodes that exist in both old and new graphs
		let hasRestoredPositions = false;
		for (const id in oldPositions) {
			if (oldPositions.hasOwnProperty(id) && this.graphRenderer.nodeLookup[id]) {
				this.graphRenderer.setNodePosition(id, oldPositions[id][0], oldPositions[id][1]);
				hasRestoredPositions = true;
			}
		}
		// Re-send corrected positions to the sim worker
		if (hasRestoredPositions) {
			this.graphRenderer.resyncWorker();
		}

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
	}

	private async navigateToNode(path: string) {
		if (!path) return;
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
