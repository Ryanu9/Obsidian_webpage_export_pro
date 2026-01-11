import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class CodeBlockOptions extends FeatureOptions {
	showLineNumbers: boolean = true;
	defaultCollapse: boolean = true;
	collapseThreshold: number = 30;
	defaultWrap: boolean = false;
	showBottomExpandButton: boolean = true;
	enableHighlightLine: boolean = true;
	highlightLineColor: string = "#464646"; // 默认 RGB(70,70,70) 的 hex 格式
	highlightLineOpacity: number = 0.5;

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
	info_enableHighlightLine = new FeatureSettingInfo({
		show: false,
		description: i18n.settings.codeBlock.info_enableHighlightLine
	});
	info_highlightLineColor = new FeatureSettingInfo({
		show: false,
		description: i18n.settings.codeBlock.info_highlightLineColor,
		isColor: true
	});
	info_highlightLineOpacity = new FeatureSettingInfo({
		show: false,
		description: i18n.settings.codeBlock.info_highlightLineOpacity
	});

	constructor() {
		super();
		this.featureId = "code-block";
		this.alwaysEnabled = true;
	}
}
