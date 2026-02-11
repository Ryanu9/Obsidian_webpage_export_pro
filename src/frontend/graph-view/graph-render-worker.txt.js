if ('function' === typeof importScripts) {
	importScripts('https://d157l7jdn8e5sf.cloudfront.net/v7.2.0/webworker.js');

	addEventListener('message', onMessage);

	self.WebGLRenderingContext = self.WebGL2RenderingContext || self.WebGLRenderingContext;

	let app = null;
	let container = null;
	let graphics = null;

	isDrawing = false;

	let linkCount = 0;
	let linkSources = [];
	let linkTargets = [];
	let nodeCount = 0;
	let radii = [];
	let labels = [];
	let labelFade = [];
	let labelWidths = [];
	let pixiLabels = [];
	let cameraOffset = { x: 0, y: 0 };
	let positions = new Float32Array(0);
	let linkLength = 0;
	let edgePruning = 0;
	let colors =
	{
		background: 0x232323,
		link: 0xAAAAAA,
		node: 0xCCCCCC,
		outline: 0xAAAAAA,
		text: 0xFFFFFF,
		accent: 0x4023AA
	}

	let hoveredNode = -1;
	let lastHoveredNode = -1;
	let grabbedNode = -1;
	let updateAttached = false;
	let attachedToGrabbed = [];
	let activeNode = -1;
	let attachedToActive = [];
	let nodeRendered = null;
	let nodeFadeAlpha = [];

	// OB's exponential smoothing: _l(current, target, factor=0.9) = current*factor + target*(1-factor)
	function _l(current, target, factor) {
		if (factor === undefined) factor = 0.9;
		return current * factor + target * (1 - factor);
	}

	let cameraScale = 1;
	let cameraScaleRoot = 1;

	function toScreenSpace(x, y, floor = true) {
		if (floor) {
			return { x: Math.floor((x * cameraScale) + cameraOffset.x), y: Math.floor((y * cameraScale) + cameraOffset.y) };
		}
		else {
			return { x: (x * cameraScale) + cameraOffset.x, y: (y * cameraScale) + cameraOffset.y };
		}
	}

	function vecToScreenSpace({ x, y }, floor = true) {
		return toScreenSpace(x, y, floor);
	}

	function toWorldspace(x, y) {
		return { x: (x - cameraOffset.x) / cameraScale, y: (y - cameraOffset.y) / cameraScale };
	}

	function vecToWorldspace({ x, y }) {
		return toWorldspace(x, y);
	}

	function setCameraCenterWorldspace({ x, y }) {
		cameraOffset.x = (canvas.width / 2) - (x * cameraScale);
		cameraOffset.y = (canvas.height / 2) - (y * cameraScale);
	}

	function getCameraCenterWorldspace() {
		return toWorldspace(canvas.width / 2, canvas.height / 2);
	}

	function getNodeScreenRadius(radius) {
		return radius * cameraScaleRoot;
	}

	function getNodeWorldspaceRadius(radius) {
		return radius / cameraScaleRoot;
	}

	function getPosition(index) {
		return { x: positions[index * 2], y: positions[index * 2 + 1] };
	}
	
	function parseHex(hex) 
	{
		if (typeof hex === 'number') {
			return hex;
		} else if (typeof hex === 'string') {
			// Remove '#' if present
			hex = hex.replace(/^#/, '');
			// Parse the string as a hexadecimal number
			return parseInt(hex, 16);
		} else {
			throw new Error('Invalid hex color. Must be a string or number.');
		}
	}
	
	function hexToRgb(hex) 
	{
		const parsed = parseHex(hex);
		return {
			r: (parsed >> 16) & 255,
			g: (parsed >> 8) & 255,
			b: parsed & 255
		};
	}
	
	function rgbToHex(r, g, b) {
		return (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255);
	}
	
	function mixColors(hexStart, hexEnd, factor) {
		const start = hexToRgb(hexStart);
		const end = hexToRgb(hexEnd);
		const safeFactor = clamp(factor, 0, 1);
		return rgbToHex(
			Math.round(start.r + (end.r - start.r) * safeFactor),
			Math.round(start.g + (end.g - start.g) * safeFactor),
			Math.round(start.b + (end.b - start.b) * safeFactor)
		);
	}
	
	function toHexString(hexNumber) {
		return '#' + hexNumber.toString(16).padStart(6, '0');
	}

	
	

	function invertColor(hex, bw) {
		hex = hex.toString(16); // force conversion
		// fill extra space up to 6 characters with 0
		while (hex.length < 6) hex = "0" + hex;

		if (hex.indexOf('#') === 0) {
			hex = hex.slice(1);
		}
		// convert 3-digit hex to 6-digits.
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		if (hex.length !== 6) {
			throw new Error('Invalid HEX color:' + hex);
		}
		var r = parseInt(hex.slice(0, 2), 16),
			g = parseInt(hex.slice(2, 4), 16),
			b = parseInt(hex.slice(4, 6), 16);
		if (bw) {
			// https://stackoverflow.com/a/3943023/112731
			return (r * 0.299 + g * 0.587 + b * 0.114) > 186
				? '#000000'
				: '#FFFFFF';
		}
		// invert color components
		r = (255 - r).toString(16);
		g = (255 - g).toString(16);
		b = (255 - b).toString(16);
		// pad each with zeros and return
		return "#" + padZero(r) + padZero(g) + padZero(b);
	}

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	function lerp(a, b, t) {
		return a + (b - a) * t;
	}

	let hoverFade = 0;
	let hoverFadeSpeed = 0.06;
	let hoverFadeSecondary = 0;
	let hoverFadeSecondarySpeed = 0.1;
	let hoverFontSize = 14;
	let normalFontSize = 11;
	let fontRatio = hoverFontSize / normalFontSize;

	function showLabel(index, fade, hoverFade = 0) {
		let label = pixiLabels[index];
		if (!label) return;
		labelFade[index] = fade;

		if (fade > 0.01) label.visible = true;
		else {
			hideLabel(index);
			return;
		}

		label.style.fontSize = lerp(normalFontSize, hoverFontSize, hoverFade);

		let nodePos = vecToScreenSpace(getPosition(index));
		let width = labelWidths[index] * lerp(1, fontRatio, hoverFade) / 2;
		label.x = nodePos.x - width;
		label.y = nodePos.y + getNodeScreenRadius(radii[index]) + 5;
		label.alpha = fade;
	}

	function hideLabel(index) {
		let label = pixiLabels[index];
		label.visible = false;
	}

	function draw() {
		graphics.clear();

		let topLines = [];
		if (updateAttached) {
			attachedToGrabbed = [];
		}

		if (hoveredNode != -1 || grabbedNode != -1) {
			hoverFade = Math.min(1, hoverFade + hoverFadeSpeed);
			hoverFadeSecondary = Math.min(1, hoverFadeSecondary + hoverFadeSecondarySpeed);
		}
		else {
			hoverFade = Math.max(0, hoverFade - hoverFadeSpeed);
			hoverFadeSecondary = Math.max(0, hoverFadeSecondary - hoverFadeSecondarySpeed);
		}

		// Update per-node fade alpha (OB's _l smoothing)
		for (let i = 0; i < nodeCount; i++) {
			let target = (nodeRendered && nodeRendered[i]) ? 1 : 0;
			nodeFadeAlpha[i] = _l(nodeFadeAlpha[i] || 0, target);
		}

		// --- Draw links (background layer) ---
		let dimmedLinkColor = mixColors(colors.link, colors.background, hoverFade * 0.6);

		for (let i = 0; i < linkCount; i++) {
			let target = linkTargets[i];
			let source = linkSources[i];

			// Link fades in based on min of both endpoints' fadeAlpha
			let linkAlpha = Math.min(nodeFadeAlpha[source] || 0, nodeFadeAlpha[target] || 0);
			if (linkAlpha < 0.01) continue;

			graphics.lineStyle(1, dimmedLinkColor, lerp(0.5, 0.25, hoverFade) * linkAlpha);

			if (hoveredNode == source || hoveredNode == target || ((lastHoveredNode == source || lastHoveredNode == target) && hoverFade != 0)) {
				if (updateAttached && hoveredNode == source)
					attachedToGrabbed.push(target);
				else if (updateAttached && hoveredNode == target)
					attachedToGrabbed.push(source);
				topLines.push(i);
			}

			let startWorld = getPosition(source);
			let endWorld = getPosition(target);
			let start = vecToScreenSpace(startWorld);
			let end = vecToScreenSpace(endWorld);

			let dist = Math.sqrt(Math.pow(startWorld.x - endWorld.x, 2) + Math.pow(startWorld.y - endWorld.y, 2));

			if (dist < (radii[source] + radii[target]) * edgePruning) {
				graphics.moveTo(start.x, start.y);
				graphics.lineTo(end.x, end.y);
			}
		}

		// --- Draw nodes (background layer) ---
		let nodeOpacity = lerp(1, 0.35, hoverFade);
		let dimmedNodeColor = mixColors(colors.node, colors.background, hoverFade * 0.5);
		graphics.lineStyle(0);
		graphics.beginFill(dimmedNodeColor, nodeOpacity);

		for (let i = 0; i < nodeCount; i++) {
			let fade = nodeFadeAlpha[i] || 0;
			if (fade < 0.01) {
				hideLabel(i);
				continue;
			}

			let screenRadius = getNodeScreenRadius(radii[i]);

			if (hoveredNode != i) {
				// Labels also fade in with the node
				let baseFade = clamp(screenRadius / 4, 0.4, 1.0);
				let lf = lerp(baseFade, baseFade * 0.3, hoverFade) * fade;
				showLabel(i, lf);
			}

			if (hoveredNode == i || (lastHoveredNode == i && hoverFade != 0) || (hoveredNode != -1 && attachedToGrabbed.includes(i))) continue;

			// Per-node fade-in opacity (matching OB's fadeAlpha)
			graphics.endFill();
			graphics.beginFill(dimmedNodeColor, nodeOpacity * fade);
			let pos = vecToScreenSpace(getPosition(i));
			graphics.drawCircle(pos.x, pos.y, screenRadius);
		}
		graphics.endFill();

		// --- Draw highlighted links (foreground) ---
		let highlightLinkColor = mixColors(colors.link, colors.accent, hoverFade * 0.6);
		graphics.lineStyle(lerp(1, 1.5, hoverFade), highlightLinkColor, lerp(0, 0.8, hoverFade));

		for (let i = 0; i < topLines.length; i++) {
			let target = linkTargets[topLines[i]];
			let source = linkSources[topLines[i]];
			let start = vecToScreenSpace(getPosition(source));
			let end = vecToScreenSpace(getPosition(target));
			graphics.moveTo(start.x, start.y);
			graphics.lineTo(end.x, end.y);
		}

		// --- Draw hover-connected nodes + hovered node (foreground) ---
		if (hoveredNode != -1 || (lastHoveredNode != -1 && hoverFade != 0)) {
			// Connected neighbor nodes
			let neighborColor = mixColors(colors.node, colors.accent, hoverFade * 0.15);
			graphics.lineStyle(0);
			graphics.beginFill(neighborColor, lerp(0.5, 0.95, hoverFade));
			for (let i = 0; i < attachedToGrabbed.length; i++) {
				let point = attachedToGrabbed[i];
				let pos = vecToScreenSpace(getPosition(point));
				graphics.drawCircle(pos.x, pos.y, getNodeScreenRadius(radii[point]));
				showLabel(point, Math.max(hoverFade * 0.7, labelFade[point]));
			}
			graphics.endFill();

			// The hovered node itself
			let index = hoveredNode != -1 ? hoveredNode : lastHoveredNode;
			let pos = vecToScreenSpace(getPosition(index));
			let hoverNodeColor = mixColors(colors.node, colors.accent, hoverFade * 0.7);
			graphics.beginFill(hoverNodeColor, 1);
			graphics.lineStyle(lerp(0, 1.5, hoverFade), mixColors(colors.accent, colors.node, 0.3), hoverFade * 0.8);
			graphics.drawCircle(pos.x, pos.y, getNodeScreenRadius(radii[index]));
			graphics.endFill();

			showLabel(index, Math.max(hoverFade, labelFade[index]), hoverFadeSecondary);
		}

		updateAttached = false;

		// --- Draw the active (current page) node ring ---
		if (activeNode != -1) {
			let pos = vecToScreenSpace(getPosition(activeNode));
			let activeRadius = getNodeScreenRadius(radii[activeNode]);
			graphics.lineStyle(1.5, colors.accent, 0.9);
			graphics.drawCircle(pos.x, pos.y, activeRadius + 3);
		}
	}

	function onMessage(event) {
		if (event.data.type == "draw") {
			positions = new Float32Array(event.data.positions);
			if (event.data.nodeRendered) nodeRendered = event.data.nodeRendered;
			draw();
		}
		else if (event.data.type == "update_camera") {
			cameraOffset = event.data.cameraOffset;
			cameraScale = event.data.cameraScale;
			cameraScaleRoot = Math.sqrt(cameraScale);
		}
		else if (event.data.type == "update_interaction") {
			if (hoveredNode != event.data.hoveredNode && event.data.hoveredNode != -1) updateAttached = true;
			if (grabbedNode != event.data.grabbedNode && event.data.hoveredNode != -1) updateAttached = true;

			if (event.data.hoveredNode == -1) lastHoveredNode = hoveredNode;
			else lastHoveredNode = -1;

			hoveredNode = event.data.hoveredNode;
			grabbedNode = event.data.grabbedNode;
		}
		else if (event.data.type == "resize") {
			app.renderer.resize(event.data.width, event.data.height);
		}
		else if (event.data.type == "set_active") {
			activeNode = event.data.active;
		}
		else if (event.data.type == "update_colors") {
			colors = event.data.colors;

			for (let label of pixiLabels) {
				label.style.fill = invertColor(colors.background, true);
			}
		}
		else if (event.data.type == "init") {
			// Extract data from message
			linkCount = event.data.linkCount;
			linkSources = event.data.linkSources;
			linkTargets = event.data.linkTargets;
			nodeCount = event.data.nodeCount;
			radii = event.data.radii;
			labels = event.data.labels;
			linkLength = event.data.linkLength;
			edgePruning = event.data.edgePruning;
			positions = new Float32Array(nodeCount);

			if (!app) {
				app = new PIXI.Application({ ...event.data.options, antialias: true, resolution: 2, backgroundAlpha: 0, transparent: true });
				container = new PIXI.Container();
				graphics = new PIXI.Graphics();
				app.stage.addChild(container);
				container.addChild(graphics);
			}

			// destroy old labels
			for (let label of pixiLabels) {
				label.destroy();
			}

			pixiLabels = [];
			labelWidths = [];
			labelFade = [];
			for (let i = 0; i < nodeCount; i++) {
				let label = new PIXI.Text(labels[i], { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: normalFontSize, fontWeight: "normal", fill: invertColor(colors.background, true), align: 'center', anchor: 0.5 });
				pixiLabels.push(label);
				labelWidths.push(label.width);
				labelFade.push(0);
				nodeFadeAlpha.push(0);
				app.stage.addChild(label);
			}

		}
		else {
			console.log("Unknown message type sent to graph worker: " + event.data.type);
		}
	}
}


