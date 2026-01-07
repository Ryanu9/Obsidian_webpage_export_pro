import { i18n } from "src/plugin/translations/language";
import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export enum GiscusMapping {
    Pathname = "pathname",
    URL = "url",
    Title = "title",
    OgTitle = "og:title",
}

export enum GiscusInputPosition {
    Top = "top",
    Bottom = "bottom",
}

export enum GiscusLoading {
    Lazy = "lazy",
    Eager = "eager",
}

export class GiscusOptions extends InsertedFeatureOptions {
    repo: string = "";
    repoId: string = "";
    category: string = "";
    categoryId: string = "";
    mapping: GiscusMapping = GiscusMapping.Pathname;
    strict: boolean = true;
    reactionsEnabled: boolean = true;
    emitMetadata: boolean = false;
    inputPosition: GiscusInputPosition = GiscusInputPosition.Bottom;
    theme: string = "preferred_color_scheme";
    lang: string = "zh-CN";
    loading: GiscusLoading = GiscusLoading.Lazy;

    info_repo = new FeatureSettingInfo({ description: i18n.settings.giscus.info_repo });
    info_repoId = new FeatureSettingInfo({ description: i18n.settings.giscus.info_repoId });
    info_category = new FeatureSettingInfo({ description: i18n.settings.giscus.info_category });
    info_categoryId = new FeatureSettingInfo({ description: i18n.settings.giscus.info_categoryId });
    info_mapping = new FeatureSettingInfo({ description: i18n.settings.giscus.info_mapping, dropdownTypes: GiscusMapping });
    info_strict = new FeatureSettingInfo({ description: i18n.settings.giscus.info_strict });
    info_reactionsEnabled = new FeatureSettingInfo({ description: i18n.settings.giscus.info_reactionsEnabled });
    info_emitMetadata = new FeatureSettingInfo({ description: i18n.settings.giscus.info_emitMetadata });
    info_inputPosition = new FeatureSettingInfo({ description: i18n.settings.giscus.info_inputPosition, dropdownTypes: GiscusInputPosition });
    info_theme = new FeatureSettingInfo({ description: i18n.settings.giscus.info_theme });
    info_lang = new FeatureSettingInfo({ description: i18n.settings.giscus.info_lang });
    info_loading = new FeatureSettingInfo({ description: i18n.settings.giscus.info_loading, dropdownTypes: GiscusLoading });
    info_script = new FeatureSettingInfo({ description: i18n.settings.giscus.info_script, show: false });

    constructor() {
        super();
        this.featureId = "giscus";
        this.enabled = false;
        this.featurePlacement = new FeatureRelation(".footer", RelationType.End);
    }
}
