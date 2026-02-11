import { Bounds, Vector2 } from "src/frontend/main/utils";
import { Shared } from "src/shared/shared";
import { LinkHandler } from "../main/links";

// GraphWASMHelper is no longer used - GraphRenderer in graph-worker-helper.ts
// handles both rendering and sim worker communication directly.
// Kept for reference but all GraphView references typed as any.
type GraphView = any;

/**
 * Async Web Worker physics simulation matching Obsidian Publish exactly.
 * Uses sim.js (Publish's own worker) for d3-force with quadtree + Barnes-Hut.
 * Physics runs in a separate thread — no jitter, no blocking rendering.
 *
 * Message protocol (from app.js analysis):
 *   Init:    {nodes: {id: [x,y]}, links: [[s,t]], forces: {...}, alpha: 0.3, run: true}
 *   Drag:    {alpha: 0.3, alphaTarget: 0.3, run: true, forceNode: {id, x, y}}
 *   Release: {alphaTarget: 0, forceNode: {id, x: null, y: null}}
 *   Output:  {id: [nodeIds], buffer: ArrayBuffer|SharedArrayBuffer}
 */

declare const ObsidianSite: any;

export class GraphWASMHelper
{
	nodeCount = 0;
	linkCount = 0;
	hoveredNode = -1;

	startPositions: Float32Array = new Float32Array(0);
	linkSources = new Int32Array(0);
	linkTargets = new Int32Array(0);
	radii = new Float32Array(0);
	maxRadius = 0;
	averageRadius = 0;
	minRadius = 0;

	graphView: GraphView;

	// Worker and async state
	private worker: Worker | null = null;
	private latestPositions: Float32Array = new Float32Array(0);
	private nodeIdToIndex: Map<string, number> = new Map();
	private _grabbedNode = -1;
	private _workerResult: { id: string[]; buffer: ArrayBuffer | SharedArrayBuffer; v?: number } | null = null;

	// Progressive rendering (matching OB's renderCallback)
	public nodeRendered: Uint8Array = new Uint8Array(0);
	private static readonly NODES_PER_FRAME = 50;
	private hasReceivedWorkerResult = false;
	private initTime = 0;

	init(graph: GraphView, positions?: number[])
	{
		// Terminate old worker before creating a new one
		if (this.worker)
		{
			this.worker.terminate();
			this.worker = null;
		}
		this._workerResult = null;
		this._grabbedNode = -1;

		this.graphView = graph;
		this.nodeCount = graph.nodeCount;
		this.linkCount = graph.linkCount;

		if (positions?.length != this.nodeCount * 2)
		{
			throw new Error("Invalid positions array length");
		}

		this.radii = new Float32Array(graph.radii);
		this.linkSources = new Int32Array(graph.linkSources);
		this.linkTargets = new Int32Array(graph.linkTargets);

		this.maxRadius = this.radii.reduce((a, b) => Math.max(a, b));
		this.averageRadius = this.radii.reduce((a, b) => a + b) / this.radii.length;
		this.minRadius = this.radii.reduce((a, b) => Math.min(a, b));

		this.startPositions = new Float32Array(this.nodeCount * 2);
		this.startPositions = this.generatePositions(positions);

		// Initialize position buffer
		this.latestPositions = new Float32Array(this.startPositions);

		// Progressive rendering: all nodes start unrendered
		this.nodeRendered = new Uint8Array(this.nodeCount);
		this.hasReceivedWorkerResult = false;
		this.initTime = performance.now();

		// Build node ID mapping
		this.nodeIdToIndex.clear();
		for (let i = 0; i < this.nodeCount; i++)
		{
			this.nodeIdToIndex.set(String(i), i);
		}

		// Create and init the sim worker
		this.createWorker();
		this.initWorker();
	}

	private createWorker()
	{
		const workerPath = `${ObsidianSite.document.info.pathToRoot}/${Shared.libFolderName}/${Shared.scriptsFolderName}/graph-sim-worker.js`;

		if (window.location.protocol === 'file:')
		{
			const fileInfo = ObsidianSite.getLocalDataFromId(LinkHandler.getFileDataIdFromURL(workerPath));
			const data = Uint8Array.from(Array.from(fileInfo.data).map((s: string) => s.charCodeAt(0)));
			this.worker = new Worker(URL.createObjectURL(new Blob([data], { type: 'application/javascript' })));
		}
		else
		{
			this.worker = new Worker(new URL(workerPath, window.location.href).pathname);
		}

		this.worker.onmessage = (e: MessageEvent) =>
		{
			const data = e.data;
			if (data.ignore) return;
			this._workerResult = data;
		};
	}

	private initWorker()
	{
		if (!this.worker) return;

		// Build nodes: {id: [x, y], ...}
		const nodes: Record<string, [number, number]> = {};
		for (let i = 0; i < this.nodeCount; i++)
		{
			nodes[String(i)] = [this.startPositions[i * 2], this.startPositions[i * 2 + 1]];
		}

		// Build links: [[sourceId, targetId], ...]
		const links: [string, string][] = [];
		for (let i = 0; i < this.linkCount; i++)
		{
			links.push([String(this.linkSources[i]), String(this.linkTargets[i])]);
		}

		// Send init message (hardcoded OB official values, ignoring user settings)
		this.worker.postMessage({
			nodes: nodes,
			links: links,
			forces: {
				centerStrength: 0.1,
				linkStrength: 1,
				linkDistance: 250,
				repelStrength: 1000,
			},
			alpha: 0.3,
			run: true,
		});
	}

	/** Reveal up to 50 closest-to-center unrendered nodes per frame (matching OB) */
	private revealNodes()
	{
		const candidates: { index: number; dist: number }[] = [];
		for (let i = 0; i < this.nodeCount; i++)
		{
			if (this.nodeRendered[i]) continue;
			const x = this.latestPositions[i * 2];
			const y = this.latestPositions[i * 2 + 1];
			const dist = x * x + y * y;
			if (candidates.length < GraphWASMHelper.NODES_PER_FRAME || dist < candidates[candidates.length - 1].dist)
			{
				candidates.push({ index: i, dist });
				candidates.sort((a, b) => a.dist - b.dist);
				if (candidates.length > GraphWASMHelper.NODES_PER_FRAME) candidates.pop();
			}
		}
		for (const c of candidates)
		{
			this.nodeRendered[c.index] = 1;
		}
	}

	/** Consume latest worker result and update latestPositions */
	private consumeWorkerResult()
	{
		const result = this._workerResult;
		if (!result) return;

		const ids = result.id;
		const buffer = result.buffer;
		if (!ids || !buffer) return;

		let shouldUpdate = true;

		if (buffer instanceof ArrayBuffer)
		{
			// Transferable: consume and clear
			this._workerResult = null;
		}
		else
		{
			// SharedArrayBuffer: check version
			const versionArr = new Uint32Array(buffer, buffer.byteLength - 4, 1);
			if (versionArr[0] === result.v)
			{
				shouldUpdate = false;
			}
			else
			{
				result.v = versionArr[0];
			}
		}

		if (shouldUpdate)
		{
			this.hasReceivedWorkerResult = true;

			// Directly update positions (no interpolation, matching OB)
			const positions = new Float32Array(buffer);
			for (let i = 0; i < ids.length; i++)
			{
				const nodeIndex = this.nodeIdToIndex.get(String(ids[i]));
				if (nodeIndex !== undefined)
				{
					this.latestPositions[nodeIndex * 2] = positions[2 * i];
					this.latestPositions[nodeIndex * 2 + 1] = positions[2 * i + 1];
				}
			}
		}
	}

	get positions(): any
	{
		return new Float32Array(this.latestPositions).buffer;
	}

	get positionsF(): Float32Array
	{
		return new Float32Array(this.latestPositions);
	}

	generatePositions(defaultPositions?: number[]): Float32Array
	{
		let positions = new Float32Array(defaultPositions ?? new Array(this.nodeCount * 2).fill(0));
		// Random circular distribution (matching Obsidian Publish's app.js)
		const area = 60 * this.nodeCount * 60;
		const radius = Math.sqrt(area / Math.PI);
		for (let i = 0; i < this.nodeCount; i++)
		{
			const value = positions[i * 2];
			if (value != 0 && !isNaN(value) && value != undefined)
			{
				continue;
			}

			const angle = Math.random() * 2 * Math.PI;
			const dist = Math.sqrt(Math.random()) * radius;
			positions[i * 2] = dist * Math.cos(angle);
			positions[i * 2 + 1] = dist * Math.sin(angle);
		}

		return positions;
	}

	public getBounds(): Bounds
	{
		let bounds = new Bounds(0, 0, 0, 0);
		for (let i = 0; i < this.nodeCount; i++)
		{
			const pos = new Vector2(this.latestPositions[i * 2], this.latestPositions[i * 2 + 1]);
			bounds.encapsulatePoint(pos.scale(2));
		}

		const centerDelta = bounds.center;
		const centerDist = centerDelta.magnitude;
		bounds = bounds.expand(50 + centerDist);
		bounds.translate(centerDelta.inverse);
		return bounds;
	}

	update(mousePosition: Vector2, grabbedNode: number, cameraScale: number)
	{
		if (!this.worker) return;

		// Consume latest positions from worker
		this.consumeWorkerResult();

		// Progressive rendering: delay 50ms after init (matching OB's setTimeout(initGraphics, 50))
		// This lets the physics engine run ~3 ticks before nodes appear
		if (this.hasReceivedWorkerResult && (performance.now() - this.initTime > 50))
		{
			this.revealNodes();
		}

		// Handle grabbed node (matching app.js drag protocol exactly)
		if (grabbedNode != -1 && grabbedNode < this.nodeCount)
		{
			this.worker.postMessage({
				alpha: 0.3,
				alphaTarget: 0.3,
				run: true,
				forceNode: { id: String(grabbedNode), x: mousePosition.x, y: mousePosition.y },
			});
			this._grabbedNode = grabbedNode;
		}
		else if (this._grabbedNode != -1)
		{
			// Release
			this.worker.postMessage({
				alphaTarget: 0,
				forceNode: { id: String(this._grabbedNode), x: null, y: null },
			});
			this._grabbedNode = -1;
		}

		// Hover detection on main thread using latest positions
		this.hoveredNode = -1;
		for (let i = 0; i < this.nodeCount; i++)
		{
			const dx = this.latestPositions[i * 2] - mousePosition.x;
			const dy = this.latestPositions[i * 2 + 1] - mousePosition.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < this.radii[i] / Math.sqrt(cameraScale))
			{
				this.hoveredNode = i;
				break;
			}
		}
	}

	// Keep for backward compatibility
	applyCollisionDetection(_collisionRadius: number, _strength: number): void { }

	free()
	{
		if (this.worker)
		{
			this.worker.terminate();
			this.worker = null;
		}
		this._workerResult = null;
		this.latestPositions = new Float32Array(0);
	}

	set batchFraction(_value: number) { /* no-op */ }
	set attractionForce(value: number)
	{
		if (!this.worker) return;
		this.worker.postMessage({
			forces: { linkStrength: value },
			alpha: 0.3,
			run: true,
		});
	}
	set repulsionForce(value: number)
	{
		if (!this.worker) return;
		this.worker.postMessage({
			forces: { repelStrength: value },
			alpha: 0.3,
			run: true,
		});
	}
	set centralForce(value: number)
	{
		if (!this.worker) return;
		this.worker.postMessage({
			forces: { centerStrength: value },
			alpha: 0.3,
			run: true,
		});
	}
	set linkLength(value: number)
	{
		if (!this.worker) return;
		this.worker.postMessage({
			forces: { linkDistance: value },
			alpha: 0.3,
			run: true,
		});
	}
	set dt(_value: number) { /* no-op */ }
	set settleness(value: number)
	{
		if (!this.worker) return;
		this.worker.postMessage({ alpha: value, run: true });
	}
}
