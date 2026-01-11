import { i18n } from "src/plugin/translations/language";
import {
	FeatureRelation,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class BacklinksOptions extends InsertedFeatureOptionsWithTitle {
	noBacklinks: string = "";

	constructor() {
		super();
		this.featureId = "backlinks";
		this.displayTitle = i18n.settings.backlinks.title;
		this.noBacklinks = i18n.settings.backlinks.noBacklinks;
		// Place backlinks in the same location as outline (#right-sidebar-content)
		// so they can share the same header with toggle buttons
		this.featurePlacement = new FeatureRelation(
			"#right-sidebar-content",
			RelationType.End
		);
	}
}


