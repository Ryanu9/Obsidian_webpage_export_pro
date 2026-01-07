import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class OutlineOptions extends InsertedFeatureOptionsWithTitle {
	startCollapsed: boolean = false;
	minCollapseDepth: number = 0;
	autoCollapseDepth: number = 3;

	info_startCollapsed = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.outline.info_startCollapsed,
	});
	info_minCollapseDepth = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.outline.info_minCollapseDepth,
		dropdownTypes: {
			"1": 1,
			"2": 2,
			"No Collapse": 100,
		},
	});
	info_autoCollapseDepth = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.outline.info_autoCollapseDepth,
		dropdownTypes: {
			"1": 1,
			"2": 2,
			"3": 3,
			"4": 4,
			"5": 5,
			"No Collapse": 100,
		},
	});

	constructor() {
		super();
		this.featureId = "outline";
		this.displayTitle = i18n.settings.outline.title;
		this.featurePlacement = new FeatureRelation(
			"#right-sidebar-content",
			RelationType.End
		);
	}
}
