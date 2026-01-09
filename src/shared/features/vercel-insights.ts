import { i18n } from "src/plugin/translations/language";
import { FeatureOptions, FeatureSettingInfo } from "./feature-options-base";

export class VercelInsightsOptions extends FeatureOptions
{
	enableVercelInsights: boolean = false;
	enableVercelSpeedInsights: boolean = false;

	info_enableVercelInsights = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.vercelInsights.info_enableVercelInsights
	});
	info_enableVercelSpeedInsights = new FeatureSettingInfo({
		show: true,
		description: i18n.settings.vercelInsights.info_enableVercelSpeedInsights
	});

	constructor()
	{
		super();
		this.featureId = "vercel-insights";
		this.alwaysEnabled = true;
	}
}
