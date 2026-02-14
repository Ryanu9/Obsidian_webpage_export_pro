import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class CodeBlockOptions extends FeatureOptions {
	showLineNumbers: boolean = true;
	defaultCollapse: boolean = true;
	collapseThreshold: number = 30;
	defaultWrap: boolean = false;
	showBottomExpandButton: boolean = true;

	info_showLineNumbers = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.codeBlock.info_showLineNumbers
	});
	info_defaultCollapse = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.codeBlock.info_defaultCollapse
	});
	info_collapseThreshold = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.codeBlock.info_collapseThreshold
	});
	info_defaultWrap = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.codeBlock.info_defaultWrap
	});
	info_showBottomExpandButton = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.codeBlock.info_showBottomExpandButton
	});
	constructor() {
		super();
		this.featureId = "code-block";
		this.alwaysEnabled = true;
	}
}
