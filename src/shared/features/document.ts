import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class DocumentOptions extends FeatureOptions
{
	allowFoldingLists: boolean = true;
	allowFoldingHeadings: boolean = true;
	documentWidth: string = "45em";
	showCreatedUpdatedTime: boolean = true;

	info_allowFoldingLists = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.document.info_allowFoldingLists
	});
	info_allowFoldingHeadings = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.document.info_allowFoldingHeadings
	});
	info_documentWidth = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.document.info_documentWidth
	});
	info_showCreatedUpdatedTime = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.document.info_showCreatedUpdatedTime
	});

	constructor()
	{
		super();
		this.featureId = "obsidian-document";
		this.alwaysEnabled = true;
	}
}
