import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class GraphViewOptions extends InsertedFeatureOptionsWithTitle {
	showOrphanNodes: boolean = true;
	showAttachments: boolean = false;
	allowGlobalGraph: boolean = true;
	allowExpand: boolean = true;

	attractionForce: number = 1;
	linkLength: number = 250;
	repulsionForce: number = 1000;
	centralForce: number = 0.1;
	edgePruning: number = 100;
	minNodeRadius: number = 3;
	maxNodeRadius: number = 6;
	collisionRadius: number = 25;
	collisionStrength: number = 0.5;

	info_showOrphanNodes = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_showOrphanNodes,
	});
	info_showAttachments = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_showAttachments,
	});
	info_allowGlobalGraph = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_allowGlobalGraph,
	});
	info_allowExpand = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_allowExpand,
	});
	info_attractionForce = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_attractionForce,
	});
	info_linkLength = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_linkLength,
	});
	info_repulsionForce = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_repulsionForce,
	});
	info_centralForce = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_centralForce,
	});
	info_edgePruning = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_edgePruning,
	});
	info_minNodeRadius = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_minNodeRadius,
	});
	info_maxNodeRadius = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.graphView.info_maxNodeRadius,
	});
	info_collisionRadius = new FeatureSettingInfo({
		show: true,
		description: "Minimum distance between nodes to prevent overlap",
	});
	info_collisionStrength = new FeatureSettingInfo({
		show: true,
		description: "Strength of collision avoidance between nodes",
	});

	constructor() {
		super();
		this.featureId = "graph-view";
		this.displayTitle = i18n.settings.graphView.title;
		this.featurePlacement = new FeatureRelation(
			"#right-sidebar-content",
			RelationType.Start
		);
	}
}
