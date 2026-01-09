import { ButtonComponent, Modal, Notice, Setting, TFile } from 'obsidian';
import { Utils } from 'src/plugin/utils/utils';
import HTMLExportPlugin from 'src/plugin/main';
import { ExportPreset, Settings, SettingsPage } from './settings';
import { FilePickerTree } from 'src/plugin/features/file-picker';
import { Path } from 'src/plugin/utils/path';
import { FileDialogs } from 'src/plugin/utils/file-dialogs';
import { createFileInput, createToggle } from './settings-components';
import { Website } from 'src/plugin/website/website';
import { Index } from 'src/plugin/website';
import { i18n } from '../translations/language';

export interface ExportInfo
{
	canceled: boolean;
	pickedFiles: TFile[];
	exportPath: Path;
	validPath: boolean;
}

export class ExportModal extends Modal 
{
	private isClosed: boolean = true;
	private canceled: boolean = true;
	private filePickerModalEl: HTMLElement;
	private filePicker: FilePickerTree;
	private pickedFiles: TFile[] | undefined = undefined;
	private validPath: boolean = true;
	public static title: string = i18n.exportModal.title;

	public exportInfo: ExportInfo;

	constructor() {
		super(app);
	}

	overridePickedFiles(files: TFile[])
	{
		this.pickedFiles = files;
	}

	/**
	 * @brief Opens the modal and async blocks until the modal is closed.
	 * @returns True if the EXPORT button was pressed, false is the export was canceled.
	 * @override
	*/
	async open(): Promise<ExportInfo> 
	{
		this.isClosed = false;
		this.canceled = true;
		const lang = i18n.exportModal;

		super.open();

		if(!this.filePickerModalEl)
		{
			this.filePickerModalEl = this.containerEl.createDiv({ cls: 'modal' });
			this.containerEl.insertBefore(this.filePickerModalEl, this.modalEl);
			this.filePickerModalEl.style.position = 'relative';
			this.filePickerModalEl.style.zIndex = "1";
			this.filePickerModalEl.style.width = "25em";
			this.filePickerModalEl.style.padding = "0";
			this.filePickerModalEl.style.margin = "10px";
			this.filePickerModalEl.style.maxHeight = "80%";
			this.filePickerModalEl.style.boxShadow = "0 0 7px 1px inset #00000060";
			
			const scrollArea = this.filePickerModalEl.createDiv({ cls: 'tree-scroll-area' });
			scrollArea.style.height = "100%";
			scrollArea.style.width = "100%";
			scrollArea.style.overflowY = "auto";
			scrollArea.style.overflowX = "hidden";
			scrollArea.style.padding = "1em";
			scrollArea.style.boxShadow = "0 0 7px 1px inset #00000060";

			const paths = app.vault.getFiles().map(file => new Path(file.path));
			this.filePicker = new FilePickerTree(paths, true, true);
			this.filePicker.regexBlacklist.push(...Settings.filePickerBlacklist);
			this.filePicker.regexBlacklist.push(...[Settings.exportOptions.customHeadOptions.sourcePath, Settings.exportOptions.faviconPath]);
			this.filePicker.regexWhitelist.push(...Settings.filePickerWhitelist);
			
			this.filePicker.generateWithItemsClosed = true;
			this.filePicker.showFileExtentionTags = true;
			this.filePicker.hideFileExtentionTags = ["md"];
			this.filePicker.title = lang.filePicker.title;
			this.filePicker.class = "file-picker";
			await this.filePicker.generate(scrollArea);
			
			if((this.pickedFiles?.length ?? 0 > 0) || Settings.exportOptions.filesToExport.length > 0) 
			{
				const filesToPick = this.pickedFiles?.map(file => file.path) ?? Settings.exportOptions.filesToExport;
				this.filePicker.setSelectedFiles(filesToPick);
			}

			const saveFiles = new Setting(this.filePickerModalEl).addButton((button) => 
			{
				button.setButtonText(lang.filePicker.save).onClick(async () =>
				{
					// Ask if user wants to save as new config
					const askModal = new Modal(app);
					askModal.titleEl.setText(lang.filePicker.saveAsConfigTitle);
					askModal.contentEl.createEl('p', { text: lang.filePicker.saveAsConfigQuestion });
					
					new Setting(askModal.contentEl)
						.addButton((btn) => btn.setButtonText(i18n.cancel).onClick(async () => {
							// Cancel: save normally
							Settings.exportOptions.filesToExport = this.filePicker.getSelectedFilesSavePaths();
							await SettingsPage.saveSettings();
							askModal.close();
						}))
						.addButton((btn) => btn.setButtonText(lang.filePicker.yes).onClick(async () => {
							askModal.close();
							
							// Yes: ask for config name
							const nameModal = new Modal(app);
							nameModal.titleEl.setText(lang.filePicker.newConfigTitle);
							const nameInput = nameModal.contentEl.createEl('input', { type: 'text', placeholder: lang.filePicker.configNamePlaceholder });
							nameInput.style.width = "100%";
							nameInput.style.marginBottom = "1em";
							
							new Setting(nameModal.contentEl)
								.addButton((btn) => btn.setButtonText(i18n.cancel).onClick(() => nameModal.close()))
								.addButton((btn) => btn.setButtonText(lang.filePicker.save).onClick(async () =>
								{
									const name = nameInput.value.trim();
									if (!name) {
										new Notice(lang.filePicker.configNameRequired, 3000);
										return;
									}
									
									// Update files to export before saving
									Settings.exportOptions.filesToExport = this.filePicker.getSelectedFilesSavePaths();
									Settings.saveExportConfig(name);
									new Notice(lang.filePicker.configSaved.replace("{0}", name || ""), 3000);
									nameModal.close();
								}));
							
							nameModal.open();
						}));
					
					askModal.open();
				});
			});

			saveFiles.settingEl.style.border = "none";
			saveFiles.settingEl.style.marginRight = "1em";

			// Add config management button
			let configModal: Modal | null = null;
			let selectedConfig: string | null = null;
			let configActionButton: ButtonComponent | null = null;
			let deleteButton: ButtonComponent | null = null;
			let loadButton: ButtonComponent | null = null;
			let configList: HTMLElement | null = null;
			let nameInput: HTMLInputElement | null = null;
			
			const refreshConfigList = () => {
				if (!configModal || !configList) return;
				
				configList.empty();
				selectedConfig = null;
				if (nameInput) nameInput.value = "";
				
				const configs = Settings.getExportConfigNames();
				
				// Show existing configs if any
				if (configs.length > 0 && configList) {
					configs.forEach(configName => {
						const configItem = configList!.createDiv();
						configItem.style.padding = "0.5em";
						configItem.style.cursor = "pointer";
						configItem.style.borderRadius = "4px";
						configItem.style.marginBottom = "0.25em";
						configItem.style.display = "flex";
						configItem.style.alignItems = "center";
						
						const radio = configItem.createEl('input', { type: 'radio' });
						radio.setAttribute('name', 'config-select');
						radio.value = configName;
						radio.style.marginRight = "0.5em";
						
						const label = configItem.createEl('span', { text: configName });
						label.style.flex = "1";
						
						radio.addEventListener('change', () => {
							selectedConfig = configName;
							if (configList) {
								configList.querySelectorAll('div').forEach(div => {
									div.style.backgroundColor = "";
								});
							}
							configItem.style.backgroundColor = "var(--background-modifier-hover)";
							// Clear input when selecting config
							if (nameInput) nameInput.value = "";
							// Update button text
							if (configActionButton) {
								configActionButton.setButtonText(lang.filePicker.updateConfig);
							}
							// Enable delete and load buttons
							if (deleteButton) deleteButton.setDisabled(false);
							if (loadButton) loadButton.setDisabled(false);
						});
						
						configItem.addEventListener('click', () => {
							radio.checked = true;
							radio.dispatchEvent(new Event('change'));
						});
					});
				}
				
				// Disable buttons if no config selected
				if (!selectedConfig) {
					if (configActionButton) configActionButton.setButtonText(lang.filePicker.newConfig);
					if (deleteButton) deleteButton.setDisabled(true);
					if (loadButton) loadButton.setDisabled(true);
				}
			};
			
			const openConfigModal = () => {
				configModal = new Modal(app);
				configModal.titleEl.setText(lang.filePicker.configManagementTitle);
				
				// Input for new config name
				const nameInputContainer = configModal.contentEl.createDiv();
				nameInputContainer.style.marginBottom = "1em";
				nameInput = nameInputContainer.createEl('input', { type: 'text', placeholder: lang.filePicker.configNamePlaceholder });
				nameInput.style.width = "100%";
				
				configList = configModal.contentEl.createDiv();
				configList.style.marginBottom = "1em";
				configList.style.maxHeight = "300px";
				configList.style.overflowY = "auto";
				
				refreshConfigList();
				
				nameInput.addEventListener('input', () => {
					// Clear selection when typing
					if (selectedConfig && configList) {
						selectedConfig = null;
						configList.querySelectorAll('input[type="radio"]').forEach((radio: HTMLInputElement) => {
							radio.checked = false;
						});
						configList.querySelectorAll('div').forEach(div => {
							div.style.backgroundColor = "";
						});
						if (configActionButton) {
							configActionButton.setButtonText(lang.filePicker.newConfig);
						}
						if (deleteButton) deleteButton.setDisabled(true);
						if (loadButton) loadButton.setDisabled(true);
					}
				});
				
				const buttonSetting = new Setting(configModal.contentEl);
				buttonSetting.addButton((btn) => btn.setButtonText(i18n.cancel).onClick(() => configModal?.close()));
				
				// Delete button
				buttonSetting.addButton((btn) => {
					deleteButton = btn;
					btn.setButtonText(lang.filePicker.deleteConfig).setDisabled(true).onClick(async () =>
					{
						if (!selectedConfig) return;
						
						const confirmModal = new Modal(app);
						confirmModal.titleEl.setText(lang.filePicker.deleteConfigConfirm);
						confirmModal.contentEl.createEl('p', { text: lang.filePicker.deleteConfigWarning.replace("{0}", selectedConfig) });
						
						new Setting(confirmModal.contentEl)
							.addButton((btn) => btn.setButtonText(i18n.cancel).onClick(() => confirmModal.close()))
							.addButton((btn) => btn.setButtonText(lang.filePicker.deleteConfig).onClick(async () =>
							{
								Settings.deleteExportConfig(selectedConfig!);
								new Notice(lang.filePicker.configDeleted.replace("{0}", selectedConfig || ""), 3000);
								confirmModal.close();
								refreshConfigList();
							}));
						
						confirmModal.open();
					});
				});
				
				// Load button
				buttonSetting.addButton((btn) => {
					loadButton = btn;
					btn.setButtonText(lang.filePicker.loadConfig).setDisabled(true).onClick(async () =>
					{
						if (!selectedConfig) return;
						
						if (Settings.loadExportConfig(selectedConfig)) {
							// Update file picker with loaded files
							if (this.filePicker) {
								this.filePicker.setSelectedFiles(Settings.exportOptions.filesToExport);
							}
							configModal?.close();
							// Reload the modal to reflect all loaded settings
							setTimeout(() => {
								this.open();
								new Notice(lang.filePicker.configLoaded.replace("{0}", selectedConfig || ""), 3000);
							}, 100);
						} else {
							new Notice(lang.filePicker.configLoadFailed, 3000);
						}
					});
				});
				
				// Save/Update button
				buttonSetting.addButton((btn) => {
					configActionButton = btn;
					btn.setButtonText(lang.filePicker.newConfig).onClick(async () =>
					{
						const configName = selectedConfig || nameInput?.value.trim();
						if (!configName) {
							new Notice(lang.filePicker.configNameRequired, 3000);
							return;
						}
						
						// Update files to export before saving
						Settings.exportOptions.filesToExport = this.filePicker.getSelectedFilesSavePaths();
						
						if (selectedConfig) {
							// Update existing config
							Settings.saveExportConfig(selectedConfig);
							new Notice(lang.filePicker.configUpdated.replace("{0}", selectedConfig || ""), 3000);
						} else {
							// Create new config
							Settings.saveExportConfig(configName);
							new Notice(lang.filePicker.configSaved.replace("{0}", configName || ""), 3000);
						}
						// Refresh list instead of closing
						refreshConfigList();
					});
				});
				
				configModal.open();
			};
			
			saveFiles.addButton((button) => 
			{
				button.setButtonText(lang.filePicker.configManagement).onClick(openConfigModal);
			});

		}


		const { contentEl } = this;

		contentEl.empty();

		this.titleEl.setText(ExportModal.title);

		if (HTMLExportPlugin.updateInfo.updateAvailable) 
		{
			// create red notice showing the update is available
			const updateNotice = contentEl.createEl('strong', { text: `${i18n.updateAvailable}: ${HTMLExportPlugin.updateInfo.currentVersion} ⟶ ${HTMLExportPlugin.updateInfo.latestVersion}` });
			updateNotice.setAttribute("style",
				`margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--interactive-normal);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--color-red);
			border-radius: 5px;
			display: block;
			width: fit-content;`)

			// create normal block with update notes
			const updateNotes = contentEl.createEl('div', { text: HTMLExportPlugin.updateInfo.updateNote });
			updateNotes.setAttribute("style",
				`margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--background-secondary-alt);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--text-normal);
			font-size: var(--font-ui-smaller);
			border-radius: 5px;
			display: block;
			width: fit-content;
			white-space: pre-wrap;`)
		}

		const modeDescriptions = 
		{
			"online": lang.exportMode.online,
			"local": lang.exportMode.local,
			"raw-documents":  lang.exportMode.rawDocuments
		}

		const exportModeSetting = new Setting(contentEl)
			.setName(lang.exportMode.title)
			// @ts-ignore
			.setDesc(modeDescriptions[Settings.exportPreset])
			.setHeading()
			.addDropdown((dropdown) => dropdown
				.addOption('online', 'Online Website')
				.addOption('local', 'Local Website')
				.addOption('raw-documents', 'Raw HTML Documents')
				.setValue(["online", "local", "raw-documents"].contains(Settings.exportPreset) ? Settings.exportPreset : 'website')
				.onChange(async (value) =>
				{
					Settings.exportPreset = value as ExportPreset;

					switch (value) {
						case 'online':
							await Settings.onlinePreset();
							break;
						case 'local':
							await Settings.localPreset();
							break;
						case 'raw-documents':
							await Settings.rawDocumentsPreset();
							break;
					}

					this.open();
				}
				));
		exportModeSetting.descEl.style.whiteSpace = "pre-wrap";
		exportModeSetting.settingEl.style.paddingRight = "1em";

		

		// add purge export button
		new Setting(contentEl)
			
			.addButton((button) => button
			.setButtonText(lang.purgeExport.clearCache)
			.onClick(async () =>
			{
				// create a modal to confirm the deletion
				const confirmModal = new Modal(app);
				confirmModal.titleEl.setText(lang.purgeExport.confirmation);
				let warning = confirmModal.contentEl.createEl('p', { text: lang.purgeExport.clearWarning });
				warning.style.whiteSpace = "pre-wrap";
				confirmModal.open();

				new Setting(confirmModal.contentEl)
				.addButton((button) => button
				.setButtonText(i18n.cancel)
				.onClick(() => confirmModal.close()))
				.addButton((button) => button
				.setButtonText(lang.purgeExport.clearCache)
				.onClick(async () =>
				{
					const path = new Path(exportPathInput.textInput.getValue());
					const website = await new Website(path).load();
					await website.index.clearCache();
					onChanged(path);
					confirmModal.close();
				}));
			})).setDesc(lang.purgeExport.description);

		

		createToggle(contentEl, lang.openAfterExport, () => Settings.openAfterExport, (value) => Settings.openAfterExport = value);

		let exportButton : ButtonComponent | undefined = undefined;

		function setExportDisabled(disabled: boolean)
		{
			if(exportButton) 
			{
				exportButton.setDisabled(disabled);
				if (exportButton.disabled) exportButton.buttonEl.style.opacity = "0.5";
				else exportButton.buttonEl.style.opacity = "1";
			}
		}

		const validatePath = (path: Path) => path.validate(
		{
			allowEmpty: false,
			allowRelative: false,
			allowAbsolute: true,
			allowDirectories: true,
			allowTildeHomeDirectory: true,
			requireExists: true
		});

		const onChangedValidate = (path: Path) => (!validatePath(path).valid) ? setExportDisabled(true) : setExportDisabled(false);

		const onChanged = async (path: Path) =>
		{
			onChangedValidate(path);
			const valid = validatePath(path);
			this.validPath = valid.valid;
			if (!valid)
			{
				exportDescription.setText("");
				return;
			}

			const website = new Website(path);
			const index = new Index();
			await index.load(website, website.exportOptions);

			if (!index.oldWebsiteData)
			{
				exportDescription.setText(lang.currentSite.noSite);
				return;
			}

			if (index.oldWebsiteData.pluginVersion != HTMLExportPlugin.pluginVersion)
			{
				exportDescription.setText(lang.currentSite.oldSite);
				return;
			}

			const lastExportDate = new Date(index.oldWebsiteData.modifiedTime).toLocaleString();
			const lastExportFiles = index.oldWebsiteData.allFiles?.length;
			const lastExportName = index.oldWebsiteData.siteName;

			exportDescription.setText(`${lang.currentSite.pathContainsSite}: "${lastExportName}"\n${lang.currentSite.fileCount}: ${lastExportFiles}\n${lang.currentSite.lastExported}: ${lastExportDate}`);
			exportDescription.style.whiteSpace = "pre-wrap";
		}

		const exportPathInput = createFileInput(contentEl, () => Settings.exportOptions.exportPath, (value) => Settings.exportOptions.exportPath = value,
		{
			name: '',
			description: '',
			placeholder: i18n.pathInputPlaceholder,
			defaultPath: FileDialogs.idealDefaultPath(),
			pickFolder: true,
			validation: validatePath,
			onChanged: onChanged
		});

		const { fileInput } = exportPathInput;
		
		fileInput.addButton((button) => {
			exportButton = button;
			setExportDisabled(!this.validPath);
			button.setButtonText(lang.exportButton).onClick(async () => 
			{
				this.canceled = false;
				this.close();
			});
		});

		// add description of export at this path
		const exportDescription = contentEl.createEl('div', { text: 'Loading site at path...', cls: 'setting-item-description'});
		exportDescription.style.marginBottom = "1em";
		onChanged(new Path(exportPathInput.textInput.getValue()));

		this.filePickerModalEl.style.height = this.modalEl.clientHeight * 2 + "px";

		new Setting(contentEl)
		.setDesc(lang.moreOptions)
		.addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() => {
			//@ts-ignore
			app.setting.open();
			//@ts-ignore
			app.setting.openTabById('webpage-html-export');
		}));

		await Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 10);
		
		this.pickedFiles = this.filePicker.getSelectedFiles();
		this.filePickerModalEl.remove();
		this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(Settings.exportOptions.exportPath), validPath: this.validPath};

		return this.exportInfo;
	}

	onClose() 
	{
		const { contentEl } = this;
		contentEl.empty();
		this.isClosed = true;
		ExportModal.title = i18n.exportModal.title;
	}
}
