import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export interface NavbarLinkItem {
	text: string;
	url: string;
}

export class NavbarOptions extends FeatureOptions {
	/**
	 * Links rendered in the top navbar.
	 */
	links: NavbarLinkItem[] = [];
	info_links = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.navbar.info_links,
	});

	/**
	 * CSS height value for the navbar (e.g. "40px", "3rem").
	 */
	height: string = "40px";
	info_height = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.navbar.info_height,
		placeholder: "40px",
	});

	/**
	 * Optional background color. When empty, theme defaults are used.
	 */
	backgroundColor: string = "";
	info_backgroundColor = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.navbar.info_backgroundColor,
		placeholder: "#202124",
		isColor: true,
	});

	/**
	 * When enabled, move the theme toggle button into the top navbar.
	 */
	moveThemeToggleToNavbar: boolean = false;
	info_moveThemeToggleToNavbar = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.navbar.info_moveThemeToggleToNavbar,
	});

	constructor() {
		super();
		this.featureId = "navbar";
		this.enabled = false;
	}
}

