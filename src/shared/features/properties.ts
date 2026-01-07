import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class PropertiesOptions extends InsertedFeatureOptionsWithTitle {
	hideProperties: string[];
	info_hideProperties = new FeatureSettingInfo({
		show: true,
		name: i18n.settings.properties.info_hideProperties,
	});

	showYamlProperties: boolean = true;
	info_showYamlProperties = new FeatureSettingInfo({
		show: true,
		name: i18n.settings.properties.info_showYamlProperties,
	});

	yamlPropertiesDefaultExpanded: boolean = false;
	info_yamlPropertiesDefaultExpanded = new FeatureSettingInfo({
		show: true,
		name: i18n.settings.properties.info_yamlPropertiesDefaultExpanded,
	});

	constructor() {
		super();
		this.featureId = "properties";
		this.displayTitle = i18n.settings.properties.title;
		this.featurePlacement = new FeatureRelation(
			".header",
			RelationType.Start
		);
	}
}
