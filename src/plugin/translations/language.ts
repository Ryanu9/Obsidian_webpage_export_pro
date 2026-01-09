import moment from "moment";
import { language as cn } from './zh-cn';
import { language as en } from './en';
import { language as it } from './it';
import { language as uk } from './uk';
import { language as pt } from './pt';

export interface i18n {
	cancel: string;
	browse: string;
	pathInputPlaceholder: string;
	pathValidations:
	{
		noEmpty: string;
		mustExist: string;
		noTilde: string;
		noAbsolute: string;
		noRelative: string;
		noFiles: string;
		noFolders: string;
		mustHaveExtension: string;
	},
	updateAvailable: string;
	exportAsHTML: string;
	exportModal:
	{
		title: string;
		exportAsTitle: string;
		moreOptions: string;
		openAfterExport: string;
		exportButton: string;
		filePicker:
		{
			title: string;
			selectAll: string;
			save: string;
			newConfig: string;
			updateConfig: string;
			loadConfig: string;
			configManagement: string;
			configManagementTitle: string;
			newConfigTitle: string;
			updateConfigTitle: string;
			loadConfigTitle: string;
			configNamePlaceholder: string;
			configNameRequired: string;
			configSaved: string;
			configUpdated: string;
			configLoaded: string;
			configLoadFailed: string;
			noConfigs: string;
			selectConfigFirst: string;
			deleteConfig: string;
			deleteConfigConfirm: string;
			deleteConfigWarning: string;
			configDeleted: string;
			saveAsConfigTitle: string;
			saveAsConfigQuestion: string;
			yes: string;
		}
		currentSite:
		{
			noSite: string;
			oldSite: string;
			pathContainsSite: string;
			fileCount: string;
			lastExported: string;
		}
		exportMode: {
			title: string;
			online: string;
			local: string;
			rawDocuments: string;
		},
		purgeExport: {
			description: string;
			clearCache: string;
			confirmation: string;
			clearWarning: string;
		},
	}
	settings:
	{
		title: string;
		support: string;
		debug: string;
		unavailableSetting: string;
		pageFeatures: {
			title: string;
			description: string;
		},
		baseFeatures:
		{
			info_selector: string;
			info_type: string;
			info_displayTitle: string;
			info_featurePlacement: string;
		},
		document: {
			title: string;
			description: string;
			info_allowFoldingLists: string;
			info_allowFoldingHeadings: string;
			info_documentWidth: string;
			info_showCreatedUpdatedTime: string;
		},
		sidebars: {
			title: string;
			description: string;
			info_allowResizing: string;
			info_allowCollapsing: string;
			info_rightDefaultWidth: string;
			info_leftDefaultWidth: string;
		},
		fileNavigation: {
			title: string;
			description: string;
			info_showCustomIcons: string;
			info_showDefaultFolderIcons: string;
			info_showDefaultFileIcons: string;
			info_defaultFolderIcon: string;
			info_defaultFileIcon: string;
			info_defaultMediaIcon: string;
			info_exposeStartingPath: string;
		},
		outline: {
			title: string;
			description: string;
			info_startCollapsed: string;
			info_minCollapseDepth: string;
			info_autoCollapseDepth: string;
		},
		graphView: {
			title: string;
			description: string;
			info_showOrphanNodes: string;
			info_showAttachments: string;
			info_allowGlobalGraph: string;
			info_allowExpand: string;
			info_attractionForce: string;
			info_linkLength: string;
			info_repulsionForce: string;
			info_centralForce: string;
			info_edgePruning: string;
			info_minNodeRadius: string;
			info_maxNodeRadius: string;
		},
		search: {
			title: string;
			description: string;
			placeholder: string;
		},
		linkPreview: {
			title: string;
			description: string;
		},
		themeToggle: {
			title: string;
			description: string;
		},
		customHead: {
			title: string;
			description: string;
			info_sourcePath: string;
			validationError: string;
		},
		backlinks: {
			title: string;
			description: string;
		},
		tags: {
			title: string;
			description: string;
			info_showInlineTags: string;
			info_showFrontmatterTags: string;
		},
		aliases: {
			title: string;
			description: string;
		},
		navbar: {
			title: string;
			description: string;
			info_height: string;
			info_backgroundColor: string;
			info_links: string;
			info_moveThemeToggleToNavbar: string;
		},
		footerLinks: {
			title: string;
			description: string;
			info_links: string;
			info_linkColorDark: string;
			info_linkColorLight: string;
		},
		copyright: {
			title: string;
			description: string;
			info_copyrightText: string;
			info_copyrightTextPlaceholder: string;
			info_author: string;
			info_authorPlaceholder: string;
			info_authorUrl: string;
			info_authorUrlPlaceholder: string;
		},
		properties: {
			title: string;
			description: string;
			info_hideProperties: string;
			info_showYamlProperties: string;
			info_yamlPropertiesDefaultExpanded: string;
		},
		rss: {
			title: string;
			description: string;
			info_siteUrl: string;
			info_siteUrlPlaceholder: string;
			info_authorName: string;
		},
		styleOptionsSection: {
			title: string;
			description: string;
		},
		makeOfflineCompatible: {
			title: string;
			description: string;
		},
		includePluginCSS: {
			title: string;
			description: string;
		},
		includeStyleCssIds: {
			title: string;
			description: string;
		},
		generalSettingsSection: {
			title: string;
			description: string;
		},
		favicon: {
			title: string;
			description: string;
		},
		siteName: {
			title: string;
			description: string;
		},
		iconEmojiStyle: {
			title: string;
			description: string;
		},
		themeName: {
			title: string;
			description: string;
		},
		exportSettingsSection: {
			title: string;
			description: string;
		},
		relativeHeaderLinks: {
			title: string;
			description: string;
		},
		slugifyPaths: {
			title: string;
			description: string;
		},
		addPageIcon: {
			title: string;
			description: string;
		},
		obsidianSettingsSection: {
			title: string;
			description: string;
		},
		logLevel: {
			title: string;
			description: string;
		},
		titleProperty: {
			title: string;
			description: string;
		},
		pageEncryption: {
			title: string;
			description: string;
			info_enablePageEncryption: string;
			info_defaultEncryptionPassword: string;
			info_encryptionPromptText: string;
			info_encryptionDescriptionText: string;
			info_enableGiscusOnEncryptedPages: string;
		},
		lockScreen: {
			title: string;
			description: string;
			rememberPassword: string;
			unlock: string;
			inputPlaceholder: string;
			invalidPassword: string;
		},
		giscus: {
			title: string;
			description: string;
			info_repo: string;
			info_repoId: string;
			info_category: string;
			info_categoryId: string;
			info_mapping: string;
			info_strict: string;
			info_reactionsEnabled: string;
			info_emitMetadata: string;
			info_inputPosition: string;
			info_script: string;
			info_theme: string;
			info_lang: string;
			info_loading: string;
		},
		codeBlock: {
			title: string;
			description: string;
			info_showLineNumbers: string;
			info_defaultCollapse: string;
			info_collapseThreshold: string;
			info_defaultWrap: string;
			info_showBottomExpandButton: string;
		},
		vercelInsights: {
			title: string;
			description: string;
			info_enableVercelInsights: string;
			info_enableVercelSpeedInsights: string;
		},
	},
	codeBlock: {
		copy: string;
		copied: string;
		wrap: string;
		expandCollapse: string;
	}
}

function getUserLanguage(): string {
	let locale = window.moment.locale();

	if (!locale) {
		locale = "en";
	}

	return locale;
}

function getLanguage() {
	const settingLanguages = getUserLanguage();
	const language = translations[settingLanguages];
	if (!language) {
		console.log(`Language ${settingLanguages} not found, defaulting to English`);
		return translations["en"];
	}
	return language;
}

export let translations: { [key: string]: i18n } =
{
	"en": en, // English
	"zh-cn": cn, // Chinese
	"it": it, // Italian
	"uk": uk, // Ukrainian
	"pt": pt, // Brazilian Portuguese
};

export let i18n: i18n = getLanguage();
