import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptions,
	RelationType,
} from "./feature-options-base";

export class CopyrightOptions extends InsertedFeatureOptions {
	copyrightText: string = "© {year} {author}. All rights reserved.";
	info_copyrightText = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.copyright.info_copyrightText,
		placeholder: i18n.settings.copyright.info_copyrightTextPlaceholder,
		multiline: true,
	});

	author: string = "";
	info_author = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.copyright.info_author,
		placeholder: i18n.settings.copyright.info_authorPlaceholder,
	});

	authorUrl: string = "";
	info_authorUrl = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.copyright.info_authorUrl,
		placeholder: i18n.settings.copyright.info_authorUrlPlaceholder,
	});

	constructor() {
		super();
		this.featureId = "copyright";
		this.featurePlacement = new FeatureRelation(
			".footer .data-bar",
			RelationType.End
		);
	}
}
