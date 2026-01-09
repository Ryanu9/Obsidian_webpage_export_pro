import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptions,
	RelationType,
} from "./feature-options-base";

export interface FooterLinkItem {
	text: string;
	url: string;
}

export class FooterLinksOptions extends InsertedFeatureOptions {
	links: FooterLinkItem[] = [
		{ text: "RSS", url: "site-lib/rss.xml" },
	];
	info_links = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.footerLinks.info_links,
	});

	linkColorDark: string = "#3ac4df";
	info_linkColorDark = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.footerLinks.info_linkColorDark,
		placeholder: "#3ac4df",
		isColor: true,
	});

	linkColorLight: string = "#0c6fff";
	info_linkColorLight = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.footerLinks.info_linkColorLight,
		placeholder: "#0c6fff",
		isColor: true,
	});

	constructor() {
		super();
		this.featureId = "footer-links";
		this.enabled = false;
		this.featurePlacement = new FeatureRelation(
			".footer .data-bar",
			RelationType.End
		);
	}
}
