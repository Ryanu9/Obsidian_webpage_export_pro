import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	FeatureSettingInfo,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export enum FeaturedHomepageLayout {
	Magazine = "magazine",
	Grid = "grid",
	List = "list",
}

export enum FeaturedHomepageSortBy {
	DateProperty = "dateProperty",
	ModifiedTime = "modifiedTime",
	CreatedTime = "createdTime",
	ManualOrder = "manualOrder",
}

export class FeaturedHomepageOptions extends InsertedFeatureOptionsWithTitle {
	featuredProperty: string = "featured";
	info_featuredProperty = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_featuredProperty,
		placeholder: "featured",
	});

	imageProperty: string = "image";
	info_imageProperty = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_imageProperty,
		placeholder: "image",
	});

	dateProperty: string = "created";
	info_dateProperty = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_dateProperty,
		placeholder: "created",
	});

	categoryProperty: string = "category";
	info_categoryProperty = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_categoryProperty,
		placeholder: "category",
	});

	featuredOrderProperty: string = "featuredOrder";
	info_featuredOrderProperty = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_featuredOrderProperty,
		placeholder: "featuredOrder",
	});

	homepageSourcePath: string = "";
	info_homepageSourcePath = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_homepageSourcePath,
		placeholder: "path/to/home.md",
		vaultMarkdownPath: true,
	});

	homepageTargetPath: string = "index.html";
	info_homepageTargetPath = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_homepageTargetPath,
		placeholder: "index.html",
	});

	subtitle: string = "精选文章 / 最近重点内容";
	info_subtitle = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_subtitle,
		placeholder: "精选文章 / 最近重点内容",
	});

	maxItems: number = 6;
	info_maxItems = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_maxItems,
	});

	tagLimit: number = 4;
	info_tagLimit = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_tagLimit,
	});

	excerptLength: number = 140;
	info_excerptLength = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_excerptLength,
	});

	layout: FeaturedHomepageLayout = FeaturedHomepageLayout.Magazine;
	info_layout = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_layout,
		dropdownTypes: FeaturedHomepageLayout,
	});

	sortBy: FeaturedHomepageSortBy = FeaturedHomepageSortBy.DateProperty;
	info_sortBy = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_sortBy,
		dropdownTypes: FeaturedHomepageSortBy,
	});

	showHeroCard: boolean = true;
	info_showHeroCard = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_showHeroCard,
	});

	showDate: boolean = true;
	info_showDate = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_showDate,
	});

	showTags: boolean = true;
	info_showTags = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_showTags,
	});

	showExcerpt: boolean = true;
	info_showExcerpt = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_showExcerpt,
	});

	fallbackImagePath: string = "";
	info_fallbackImagePath = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_fallbackImagePath,
		placeholder: "attachments/default-cover.png",
	});

	hideWhenEmpty: boolean = true;
	info_hideWhenEmpty = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.featuredHomepage.info_hideWhenEmpty,
	});

	constructor() {
		super("featured-homepage", new FeatureRelation(".markdown-preview-sizer", RelationType.Start));
		this.featureId = "featured-homepage";
		this.enabled = true;
		this.displayTitle = "Featured";
	}
}
