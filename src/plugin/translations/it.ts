import { i18n } from "./language";

export const language: i18n =
{
	cancel: "Annulla",
	browse: "Sfoglia",
	pathInputPlaceholder: "Digita o sfoglia un percorso...",
	pathValidations: {
		noEmpty: "Il percorso non può essere vuoto",
		mustExist: "Il percorso non esiste",
		noTilde: "La directory home con tilde (~) non è consentita",
		noAbsolute: "Il percorso non può essere assoluto",
		noRelative: "Il percorso non può essere relativo",
		noFiles: "Il percorso non può essere un file",
		noFolders: "Il percorso non può essere una directory",
		mustHaveExtension: "Il percorso deve avere estensione: {0}"
	},
	updateAvailable: "Aggiornamento disponibile",
	exportAsHTML: "Esporta come HTML",
	exportModal: {
		title: "Esporta in HTML",
		exportAsTitle: "Esporta {0} come HTML",
		moreOptions: "Altre opzioni nella pagina delle impostazioni del plugin.",
		openAfterExport: "Apri dopo l'esportazione",
		exportButton: "Esporta",
		filePicker: {
			title: "Seleziona tutti i file nel vault esportato",
			selectAll: "Seleziona tutto",
			save: "Salva",
			newConfig: "Nuova Configurazione",
			updateConfig: "Aggiorna Configurazione",
			loadConfig: "Carica Configurazione",
			configManagement: "Gestione Configurazioni",
			configManagementTitle: "Gestione Configurazioni",
			newConfigTitle: "Nuova Configurazione Esportazione",
			updateConfigTitle: "Aggiorna Configurazione Esportazione",
			loadConfigTitle: "Carica Configurazione Esportazione",
			configNamePlaceholder: "Inserisci il nome della configurazione...",
			configNameRequired: "Il nome della configurazione è obbligatorio",
			configSaved: "Configurazione '{0}' salvata con successo",
			configUpdated: "Configurazione '{0}' aggiornata con successo",
			configLoaded: "Configurazione '{0}' caricata con successo",
			configLoadFailed: "Impossibile caricare la configurazione",
			noConfigs: "Nessuna configurazione salvata trovata",
			selectConfigFirst: "Seleziona prima una configurazione",
			deleteConfig: "Elimina Configurazione",
			deleteConfigConfirm: "Conferma Eliminazione",
			deleteConfigWarning: "Sei sicuro di voler eliminare la configurazione '{0}'? Questa azione non può essere annullata.",
			configDeleted: "Configurazione '{0}' eliminata",
			saveAsConfigTitle: "Salva Selezione File",
			saveAsConfigQuestion: "Vuoi salvare la selezione corrente dei file come nuova configurazione?",
			yes: "Sì",
		},
		currentSite: {
			noSite: "Questo percorso attualmente non contiene un sito esportato.",
			oldSite: "Questo percorso contiene un'esportazione creata con una versione diversa del plugin.",
			pathContainsSite: "Sito",
			fileCount: "Numero di file",
			lastExported: "Ultima esportazione"
		},
		exportMode: {
			title: "Modalità di Esportazione",
			online: "Usa questa opzione se i tuoi file saranno accessibili online (tramite un server http).",
			local: "Esporta un singolo file HTML (grande) con l'intera esportazione. Usalo solo per la condivisione offline.",
			rawDocuments: "Esporta documenti HTML semplici con stile e script di base, senza funzioni aggiuntive."
		},
		purgeExport: {
			description: "Cancella la cache del sito per riesportare tutti i file.",
			clearCache: "Cancella cache",
			confirmation: "Sei sicuro?",
			clearWarning: "Questo eliminerà i metadati del sito (ma non tutti gli HTML esportati).\n\nCiò forzerà la riesportazione di tutti i file.\n\nInoltre, se cambi i file selezionati per l'esportazione, alcuni potrebbero rimanere inutilizzati sul sistema.\n\nQuesta azione non può essere annullata.",
		},
	},
	settings: {
		title: "Impostazioni Esportazione HTML",
		support: "Supporta lo sviluppo continuo di questo plugin.",
		debug: "Copia info di debug negli appunti",
		unavailableSetting: "⚠️ Questa funzionalità non è disponibile in modalità {0}.",
		pageFeatures: {
			title: "Funzionalità della pagina",
			description: "Controlla varie funzionalità della pagina esportata."
		},
		baseFeatures: {
			info_selector: "Selettore CSS per un elemento. La funzionalità verrà posizionata rispetto a questo elemento.",
			info_type: "Dove posizionare questa funzionalità: prima, dopo o dentro (all'inizio o alla fine).",
			info_displayTitle: "Titolo descrittivo da mostrare sopra la funzionalità",
			info_featurePlacement: "Dove posizionare questa funzionalità nella pagina. (Rispetto al selettore)"
		},
		document: {
			title: "Documento",
			description: "Controlla le impostazioni del documento",
			info_allowFoldingLists: "Permettere o meno il piegamento delle liste",
			info_allowFoldingHeadings: "Permettere o meno il piegamento dei titoli",
			info_documentWidth: "Larghezza del documento",
			info_showCreatedUpdatedTime: "Mostra l'ora di creazione e aggiornamento sotto il titolo della pagina"
		},
		sidebars: {
			title: "Barre laterali",
			description: "Contiene altre funzionalità come navigazione file, struttura, cambio tema, vista grafo, ecc.",
			info_allowResizing: "Permettere o meno il ridimensionamento delle barre laterali",
			info_allowCollapsing: "Permettere o meno il collasso delle barre laterali",
			info_rightDefaultWidth: "Larghezza predefinita della barra laterale destra",
			info_leftDefaultWidth: "Larghezza predefinita della barra laterale sinistra"
		},
		fileNavigation: {
			title: "Navigazione File",
			description: "Mostra un albero di file per esplorare il vault esportato.",
			info_showCustomIcons: "Mostra un'icona personalizzata per ogni file nell'albero",
			info_showDefaultFolderIcons: "Mostra un'icona predefinita per ogni cartella nell'albero",
			info_showDefaultFileIcons: "Mostra un'icona predefinita per ogni file nell'albero",
			info_defaultFolderIcon: "Icona da usare per le cartelle. Usa il prefisso \"lucide//\" per usare un'icona Lucide",
			info_defaultFileIcon: "Icona da usare per i file. Usa il prefisso \"lucide//\" per usare un'icona Lucide",
			info_defaultMediaIcon: "Icona da usare per i file multimediali. Usa il prefisso \"lucide//\" per usare un'icona Lucide",
			info_exposeStartingPath: "Mostra il file corrente nell'albero all'apertura della pagina"
		},
		outline: {
			title: "Struttura",
			description: "Mostra un elenco dei titoli del documento aperto.",
			info_startCollapsed: "La struttura deve partire collassata?",
			info_minCollapseDepth: "Profondità minima a cui i titoli devono essere collassati",
			info_autoCollapseDepth: "Profondità di collasso iniziale (es. se 3, i titoli di livello 3 e inferiori saranno inizialmente collassati)"
		},
		graphView: {
			title: "Vista Grafo",
			description: "Mostra una rappresentazione visiva e interattiva del vault. (NOTA: disponibile solo per esportazioni su un server web)",
			info_showOrphanNodes: "Mostra nodi non collegati ad altri nodi.",
			info_showAttachments: "Mostra allegati come immagini e PDF come nodi nel grafo.",
			info_allowGlobalGraph: "Permetti la visualizzazione del grafo globale di tutti i nodi.",
			info_allowExpand: "Permetti di espandere la vista grafo a schermo intero",
			info_attractionForce: "Quanto dovrebbero attrarsi i nodi collegati? Questo renderà il grafo più concentrato.",
			info_linkLength: "Quanto devono essere lunghi i collegamenti tra i nodi? Collegamenti più corti rendono i nodi più vicini.",
			info_repulsionForce: "Quanto dovrebbero respingersi i nodi? Questo renderà le parti disconnesse più distanti.",
			info_centralForce: "Quanto dovrebbero attrarsi i nodi verso il centro? Questo renderà il grafo più denso e circolare.",
			info_edgePruning: "I collegamenti oltre questa soglia non verranno visualizzati, ma contribuiranno comunque alla simulazione. Passando il mouse su un nodo verranno comunque mostrati.",
			info_minNodeRadius: "Quanto devono essere piccoli i nodi più piccoli? Nodi più piccoli attrarranno meno altri nodi.",
			info_maxNodeRadius: "Quanto devono essere grandi i nodi più grandi? I nodi sono dimensionati in base ai collegamenti. Nodi più grandi attrarranno più nodi, creando gruppi intorno a quelli più importanti."
		},
		search: {
			title: "Barra di Ricerca",
			description: "Permette di cercare nel vault, elencando file e titoli corrispondenti. (NOTA: disponibile solo per esportazioni su un server web)",
			placeholder: "Cerca..."
		},
		linkPreview: {
			title: "Anteprime dei Collegamenti",
			description: "Mostra anteprime al passaggio del mouse sui collegamenti interni ad altri documenti."
		},
		themeToggle: {
			title: "Cambio Tema",
			description: "Permette di passare dinamicamente tra tema scuro e chiaro."
		},
		customHead: {
			title: "HTML / JS Personalizzato",
			description: "Inserisci un file .html nella pagina, che può includere JS o CSS personalizzato",
			info_sourcePath: "Percorso locale del file .html da includere.",
			validationError: "Deve essere un percorso a un file .html"
		},
		backlinks: {
			title: "Collegamenti di ritorno",
			description: "Mostra tutti i documenti che si collegano al documento attualmente aperto."
		},
		tags: {
			title: "Etichette",
			description: "Mostra le etichette del documento attualmente aperto.",
			info_showInlineTags: "Mostra le etichette definite all'interno del documento in cima alla pagina.",
			info_showFrontmatterTags: "Mostra le etichette definite nell'intestazione del documento in cima alla pagina."
		},
		aliases: {
			title: "Alias",
			description: "Mostra gli alias del documento attualmente aperto."
		},
		navbar: {
			title: "Top Navbar",
			description: "Display a horizontal navigation bar at the top of the page.",
			info_height: "Height of the navbar (for example: 40px, 3rem).",
			info_backgroundColor: "Background color of the navbar. Leave empty to use the theme default.",
			info_links: "Navbar links list, each link contains text and URL",
			info_moveThemeToggleToNavbar: "When enabled, move the theme toggle button into the right side of the top navbar (instead of the right sidebar).",
		},
		footerLinks: {
			title: "Link Footer",
			description: "Mostra i link in fondo agli articoli.",
			info_links: "Elenco link footer, ogni link contiene testo e URL",
			info_linkColorDark: "Colore del link nel tema scuro",
			info_linkColorLight: "Colore del link nel tema chiaro"
		},
		copyright: {
			title: "Copyright",
			description: "Mostra le informazioni sul copyright in fondo agli articoli.",
			info_copyrightText: "Testo del copyright, puoi usare le variabili {year} e {author}",
			info_copyrightTextPlaceholder: "© {year} {author}. All rights reserved.",
			info_author: "Nome dell'autore",
			info_authorPlaceholder: "Nome dell'autore",
			info_authorUrl: "URL dell'autore (opzionale)",
			info_authorUrlPlaceholder: "https://example.com"
		},
		properties: {
			title: "Proprietà",
			description: "Mostra tutte le proprietà del documento attualmente aperto in una tabella.",
			info_hideProperties: "Un elenco di proprietà da nascondere nella vista delle proprietà",
			info_showYamlProperties: "Show YAML Properties",
			info_yamlPropertiesDefaultExpanded: "YAML Properties Default Expanded"
		},
		rss: {
			title: "RSS",
			description: "Genera un feed RSS per il sito esportato",
			info_siteUrl: "L'URL su cui sarà ospitato questo sito",
			info_siteUrlPlaceholder: "https://example.com/mysite",
			info_authorName: "Il nome dell'autore del sito"
		},
		styleOptionsSection: {
			title: "Opzioni di Stile",
			description: "Configura quali stili includere nell'esportazione"
		},
		makeOfflineCompatible: {
			title: "Rendi compatibile offline",
			description: "Scarica risorse, immagini o script online per visualizzare la pagina offline o per non dipendere da una CDN."
		},
		includePluginCSS: {
			title: "Includi CSS dai plugin",
			description: "Includi il CSS dei seguenti plugin nell'HTML esportato. Se le funzionalità dei plugin non si visualizzano correttamente, prova ad aggiungere il plugin a questo elenco. Evita di aggiungere plugin se non noti problemi specifici, poiché più CSS aumenterà il tempo di caricamento della pagina."
		},
		includeStyleCssIds: {
			title: "Includi stili con ID",
			description: "Includi CSS dai tag di stile con i seguenti ID nell'HTML esportato."
		},
		generalSettingsSection: {
			title: "Impostazioni Generali",
			description: "Controlla impostazioni semplici come favicon e metadati del sito",
		},
		favicon: {
			title: "Immagine Favicon",
			description: "Il percorso locale della favicon per il sito",
		},
		siteName: {
			title: "Nome del Sito",
			description: "Il nome del vault / sito esportato",
		},
		iconEmojiStyle: {
			title: "Stile emoji per le icone",
			description: "Lo stile di emoji da utilizzare per le icone personalizzate",
		},
		themeName: {
			title: "Tema",
			description: "Il tema installato da utilizzare per l'esportazione",
		},
		exportSettingsSection: {
			title: "Impostazioni di Esportazione",
			description: "Controlla impostazioni tecniche più avanzate come la generazione dei link",
		},
		relativeHeaderLinks: {
			title: "Usa Link Relativi per i Titoli",
			description: "Usa link relativi per i titoli invece di link assoluti",
		},
		slugifyPaths: {
			title: "Percorsi Slugificati",
			description: "Rendi tutti i percorsi e i nomi dei file in stile web (minuscoli, senza spazi)",
		},
		addPageIcon: {
			title: "Aggiungi Icona Pagina",
			description: "Aggiungi l'icona del file all'intestazione della pagina",
		},
		obsidianSettingsSection: {
			title: "Impostazioni Obsidian",
			description: "Controlla come funziona il plugin all'interno di Obsidian",
		},
		logLevel: {
			title: "Livello di Log",
			description: "Imposta il livello di registrazione da visualizzare nella console",
		},
		titleProperty: {
			title: "Proprietà del Titolo",
			description: "La proprietà da utilizzare come titolo del documento",
		},
		pageEncryption: {
			title: "Crittografia Pagina",
			description: "Impostazioni per le pagine protette da password.",
			info_enablePageEncryption: "Abilita la crittografia per le pagine contrassegnate con 'locked: true' nel frontmatter.",
			info_defaultEncryptionPassword: "Password di riserva se nessuna è specificata nel frontmatter della pagina.",
			info_encryptionPromptText: "Testo del titolo mostrato nella schermata di blocco.",
			info_encryptionDescriptionText: "Testo della descrizione mostrato nella schermata di blocco.",
			info_enableGiscusOnEncryptedPages: "Se abilitato, i commenti di Giscus verranno caricati anche prima che la pagina venga sbloccata. Disabilita se i commenti contengono informazioni sensibili.",
		},
		lockScreen: {
			title: "Questo contenuto è crittografato",
			description: "Inserisci la password per visualizzare il contenuto",
			rememberPassword: "Ricorda la password",
			unlock: "Sblocca",
			inputPlaceholder: "Inserisci la password",
			invalidPassword: "Password errata o dati corrotti",
		},
		giscus: {
			title: "Giscus Comments",
			description: "Add a comment system based on GitHub Discussions to the bottom of the page.",
			info_repo: "GitHub repository name (e.g. owner/repo)",
			info_repoId: "Repository ID",
			info_category: "Discussion category name",
			info_categoryId: "Category ID",
			info_mapping: "Page to discussion mapping",
			info_strict: "Enable strict mode",
			info_reactionsEnabled: "Enable reactions",
			info_emitMetadata: "Emit metadata to discussions",
			info_inputPosition: "Input box position",
			info_script: "Paste the giscus script tag here to automatically fill the fields below.",
			info_theme: "Comments theme",
			info_lang: "Comments language",
			info_loading: "Loading method",
		},
		codeBlock: {
			title: "Blocco di codice",
			description: "Configura le opzioni di visualizzazione dei blocchi di codice",
			info_showLineNumbers: "Mostra i numeri di riga per i blocchi di codice",
			info_defaultCollapse: "Comprimi i blocchi di codice per impostazione predefinita (per blocchi più lunghi della soglia)",
			info_collapseThreshold: "Soglia del numero di righe per la compressione automatica (predefinito: 30)",
			info_defaultWrap: "Abilita l'avvolgimento delle parole per i blocchi di codice per impostazione predefinita",
			info_showBottomExpandButton: "Mostra il pulsante espandi/comprimi in basso a destra dei blocchi di codice",
			info_enableHighlightLine: "Abilita l'evidenziazione delle righe di codice (righe che iniziano con >>>> )",
			info_highlightLineColor: "Colore di sfondo della riga evidenziata",
			info_highlightLineOpacity: "Opacità dello sfondo della riga evidenziata (0-1)",
		},
		vercelInsights: {
			title: "Vercel Insights",
			description: "Configura Vercel Analytics e Speed Insights",
			info_enableVercelInsights: "Abilita Vercel Web Analytics (traccia visualizzazioni di pagina e interazioni utente)",
			info_enableVercelSpeedInsights: "Abilita Vercel Speed Insights (monitora Core Web Vitals e metriche di performance)",
		},
	},
	codeBlock: {
		copy: "Copia",
		copied: "Copiato",
		wrap: "A capo automatico",
		expandCollapse: "Espandi/Comprimi",
	}
};
