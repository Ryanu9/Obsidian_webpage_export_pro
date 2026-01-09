import { i18n } from "./language";

export const language: i18n =
{
	cancel: "Скасувати",
	browse: "Огляд",
	pathInputPlaceholder: "Введіть або оберіть шлях...",
	pathValidations:
	{
		noEmpty: "Шлях не може бути порожнім",
		mustExist: "Шлях не існує",
		noTilde: "Домашній каталог з тильдою (~) не дозволяється",
		noAbsolute: "Шлях не може бути абсолютним",
		noRelative: "Шлях не може бути відносним",
		noFiles: "Шлях не може бути файлом",
		noFolders: "Шлях не може бути каталогом",
		mustHaveExtension: "Шлях повинен мати розширення: {0}",
	},
	updateAvailable: "Доступне оновлення",
	exportAsHTML: "Експортувати як HTML",
	exportModal:
	{
		title: "Експортувати в HTML",
		exportAsTitle: "Експортувати {0} як HTML",
		moreOptions: "Більше опцій на сторінці налаштувань плагіна.",
		openAfterExport: "Відкрити після експорту",
		exportButton: "Експортувати",
		filePicker:
		{
			title: "Вибрати всі файли в експортованому сховищі",
			selectAll: "Вибрати все",
			save: "Зберегти",
		},
		currentSite:
		{
			noSite: "Цей шлях наразі не містить експортованого веб-сайту.",
			oldSite: "Цей шлях містить експорт, створений з іншою версією плагіна.",
			pathContainsSite: "Сайт",
			fileCount: "Кількість файлів",
			lastExported: "Останній експорт",
		},
		exportMode: {
			title: "Режим експорту",
			online: "Використовуйте цей режим, якщо ваші файли будуть доступні онлайн (через http-сервер).",
			local: "Цей режим експортує один (великий) HTML-файл, що містить весь експорт. Використовуйте лише для офлайн-поширення.",
			rawDocuments: "Експортувати прості HTML-документи з базовими стилями та скриптами, але без додаткових функцій.",
		},
		purgeExport: {
			description: "Очистити кеш сайту для повторного експорту всіх файлів.",
			clearCache: "Очистити кеш",
			confirmation: "Ви впевнені?",
			clearWarning: "Це видалить метадані сайту (але не весь експортований HTML).\n\nЦе змусить сайт повторно експортувати всі файли.\n\nТакож, якщо ви зміните вибрані для експорту файли перед повторним експортом, деякі файли можуть залишитися невикористаними у вашій файловій системі.\n\nЦю дію неможливо скасувати.",
		},
	},
	settings:
	{
		title: "Налаштування експорту HTML",
		support: "Підтримайте подальшу розробку цього плагіна.",
		debug: "Копіювати відлагоджувальну інформацію в буфер обміну",
		unavailableSetting: "⚠️ Ця функція недоступна в режимі {0}.",
		pageFeatures: {
			title: "Функції сторінки",
			description: "Керування різними функціями експортованої сторінки."
		},
		baseFeatures:
		{
			info_selector: "CSS-селектор для елемента. Функція буде розміщена відносно цього елемента.",
			info_type: "Ця функція буде розміщена перед, після чи всередині (на початку або в кінці) елемента.",
			info_displayTitle: "Описовий заголовок для відображення над функцією",
			info_featurePlacement: "Де розмістити цю функцію на сторінці (відносно селектора).",
		},
		document: {
			title: "Документ",
			description: "Керування налаштуваннями самого документа",
			info_allowFoldingLists: "Дозволити чи заборонити згортання списків",
			info_allowFoldingHeadings: "Дозволити чи заборонити згортання заголовків",
			info_documentWidth: "Ширина документа",
			info_showCreatedUpdatedTime: "Показати час створення та оновлення під заголовком сторінки"
		},
		sidebars: {
			title: "Бічні панелі",
			description: "Містить усі інші функції, такі як навігація по файлах, структура, перемикання теми, графічний вигляд тощо.",
			info_allowResizing: "Дозволити чи заборонити зміну розміру бічних панелей",
			info_allowCollapsing: "Дозволити чи заборонити згортання бічних панелей",
			info_rightDefaultWidth: "Стандартна ширина правої бічної панелі",
			info_leftDefaultWidth: "Стандартна ширина лівої бічної панелі"
		},
		fileNavigation: {
			title: "Навігація по файлах",
			description: "Показує дерево файлів для перегляду експортованого сховища.",
			info_showCustomIcons: "Показувати користувацькі іконки для файлів в дереві",
			info_showDefaultFolderIcons: "Показувати стандартну іконку для кожної папки в дереві",
			info_showDefaultFileIcons: "Показувати стандартну іконку для кожного файлу в дереві",
			info_defaultFolderIcon: "Іконка для папок. Використовуйте префікс \"lucide//\" для використання іконки Lucide",
			info_defaultFileIcon: "Іконка для файлів. Використовуйте префікс \"lucide//\" для використання іконки Lucide",
			info_defaultMediaIcon: "Іконка для медіа-файлів. Використовуйте префікс \"lucide//\" для використання іконки Lucide",
			info_exposeStartingPath: "Показувати поточний файл у дереві файлів при першому завантаженні сторінки"
		},
		outline: {
			title: "Структура",
			description: "Показує список заголовків відкритого документа.",
			info_startCollapsed: "Чи повинна структура починатись згорнутою?",
			info_minCollapseDepth: "Мінімальна глибина, на якій заголовки можуть бути згорнуті.",
			info_autoCollapseDepth: "Initial collapse depth (e.g. if 3, level 3 headings and below will be collapsed initially)"
		},
		graphView: {
			title: "Графічний вигляд",
			description: "Показує візуальне, інтерактивне представлення вашого сховища. (ПРИМІТКА: доступно лише для експортів, розміщених на веб-сервері)",
			info_showOrphanNodes: "Показувати вузли, не пов'язані з іншими вузлами.",
			info_showAttachments: "Показувати вкладення, такі як зображення та PDF, як вузли в графі.",
			info_allowGlobalGraph: "Дозволити користувачеві переглядати глобальний граф усіх вузлів.",
			info_allowExpand: "Дозволити користувачеві розгортати графічний вигляд на весь екран",
			info_attractionForce: "Наскільки пов'язані вузли повинні притягуватися один до одного? Сильніше притягання зробить граф більш кластеризованим.",
			info_linkLength: "Якої довжини повинні бути зв'язки між вузлами? Коротші зв'язки зблизять пов'язані вузли.",
			info_repulsionForce: "Наскільки вузли повинні відштовхуватися один від одного? Сильніше відштовхування розсіє незв'язані частини.",
			info_centralForce: "Наскільки вузли повинні притягуватися до центру? Сильніше притягання зробить граф щільнішим і круглішим.",
			info_edgePruning: "Зв'язки, довжина яких перевищує цей поріг, не будуть відображатися, але все одно впливатимуть на симуляцію. Це допоможе великим заплутаним графам виглядати організованіше. При наведенні на вузол ці зв'язки все одно будуть відображатися.",
			info_minNodeRadius: "Якого розміру повинні бути найменші вузли? Менші вузли менше притягуватимуть інші вузли.",
			info_maxNodeRadius: "Якого розміру повинні бути найбільші вузли? Розмір вузлів залежить від кількості їхніх зв'язків. Більші вузли сильніше притягуватимуть інші вузли. Це допоможе створити хороше групування навколо найважливіших вузлів."
		}, search: {
			title: "Панель пошуку",
			description: "Дозволяє шукати у сховищі, показуючи відповідні файли та заголовки. (ПРИМІТКА: доступно лише для експортів, розміщених на веб-сервері)",
			placeholder: "Пошук..."
		},
		linkPreview: {
			title: "Попередній перегляд посилань",
			description: "Показувати попередній перегляд при наведенні на внутрішні посилання до інших документів."
		},
		themeToggle: {
			title: "Перемикач теми",
			description: "Дозволяє динамічно перемикатися між темною та світлою темами."
		},
		customHead: {
			title: "Власний HTML / JS",
			description: "Вставити вказаний HTML-файл на сторінку, який може включати користувацький JS або CSS",
			info_sourcePath: "Локальний шлях до HTML-файлу, який буде включено.",
			validationError: "Має бути шлях до HTML-файлу"
		},
		backlinks: {
			title: "Зворотні посилання",
			description: "Показує всі документи, які посилаються на поточний відкритий документ."
		},
		tags: {
			title: "Теги",
			description: "Показує теги для поточного відкритого документа.",
			info_showInlineTags: "Показувати теги, визначені всередині документа, вгорі сторінки.",
			info_showFrontmatterTags: "Показувати теги, визначені у frontmatter документа, вгорі сторінки."
		},
		aliases: {
			title: "Псевдоніми",
			description: "Показує псевдоніми для поточного відкритого документа."
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
			title: "Посилання в футері",
			description: "Відображати посилання в нижній частині статей.",
			info_links: "Список посилань у футері, кожне посилання містить текст та URL",
			info_linkColorDark: "Колір посилання в темній темі",
			info_linkColorLight: "Колір посилання в світлій темі"
		},
		copyright: {
			title: "Авторське право",
			description: "Відображати інформацію про авторські права в нижній частині статей.",
			info_copyrightText: "Текст авторських прав, ви можете використовувати змінні {year} та {author}",
			info_copyrightTextPlaceholder: "© {year} {author}. All rights reserved.",
			info_author: "Ім'я автора",
			info_authorPlaceholder: "Ім'я автора",
			info_authorUrl: "URL автора (необов'язково)",
			info_authorUrlPlaceholder: "https://example.com"
		},
		properties: {
			title: "Властивості",
			description: "Показує всі властивості поточного відкритого документа у вигляді таблиці.",
			info_hideProperties: "Список властивостей, які слід приховати з перегляду властивостей",
			info_showYamlProperties: "Show YAML Properties",
			info_yamlPropertiesDefaultExpanded: "YAML Properties Default Expanded"
		},
		rss: {
			title: "RSS",
			description: "Генерувати RSS-стрічку для експортованого сайту",
			info_siteUrl: "URL, на якому буде розміщено цей сайт",
			info_siteUrlPlaceholder: "https://example.com/mysite",
			info_authorName: "Ім'я автора сайту"
		},
		styleOptionsSection: {
			title: "Параметри стилю",
			description: "Налаштувати, які стилі включені в експорт"
		},
		makeOfflineCompatible: {
			title: "Зробити сумісним офлайн",
			description: "Завантажити будь-які онлайн-ресурси / зображення / скрипти, щоб сторінку можна було переглядати офлайн. Або щоб веб-сайт не залежав від CDN."
		},
		includePluginCSS: {
			title: "Включити CSS з плагінів",
			description: "Включити CSS з наступних плагінів в експортований HTML. Якщо функції плагінів не відображаються коректно, спробуйте додати плагін до цього списку. Уникайте додавання плагінів, якщо ви не помітили конкретної проблеми, оскільки більше CSS збільшить час завантаження вашої сторінки."
		},
		includeStyleCssIds: {
			title: "Включити стилі з ID",
			description: "Включити CSS з тегів стилю з такими ID в експортований HTML"
		},
		generalSettingsSection: {
			title: "Загальні налаштування",
			description: "Керування простими налаштуваннями, такими як favicon та метадані сайту",
		},
		favicon: {
			title: "Зображення Favicon",
			description: "Локальний шлях до favicon для сайту",
		},
		siteName: {
			title: "Назва сайту",
			description: "Назва сховища / експортованого сайту",
		},
		iconEmojiStyle: {
			title: "Стиль іконок-емодзі",
			description: "Стиль емодзі для використання у користувацьких іконках",
		},
		themeName: {
			title: "Тема",
			description: "Встановлена тема для використання при експорті",
		},
		exportSettingsSection: {
			title: "Налаштування експорту",
			description: "Керування більш технічними налаштуваннями експорту, такими як генерація посилань",
		},
		relativeHeaderLinks: {
			title: "Використовувати відносні посилання заголовків",
			description: "Використовувати відносні посилання для заголовків замість абсолютних",
		},
		slugifyPaths: {
			title: "Slugify шляхи",
			description: "Зробити всі шляхи та імена файлів у веб-стилі (нижній регістр, без пробілів)",
		},
		addPageIcon: {
			title: "Додати іконку сторінки",
			description: "Додати іконку файлу до заголовка сторінки",
		},
		obsidianSettingsSection: {
			title: "Налаштування Obsidian",
			description: "Керування функціонуванням плагіна всередині Obsidian",
		},
		logLevel: {
			title: "Рівень журналювання",
			description: "Встановити рівень журналювання для відображення в консолі",
		},
		titleProperty: {
			title: "Властивість заголовка",
			description: "Властивість для використання як заголовок документа",
		},
		pageEncryption: {
			title: "Шифрування сторінок",
			description: "Налаштування для сторінок, захищених паролем.",
			info_enablePageEncryption: "Увімкнути шифрування для сторінок, позначених 'locked: true' у frontmatter.",
			info_defaultEncryptionPassword: "Резервний пароль, якщо він не вказаний у frontmatter сторінки.",
			info_encryptionPromptText: "Текст заголовка, що відображається на екрані блокування.",
			info_encryptionDescriptionText: "Текст опису, що відображається на екрані блокування.",
			info_enableGiscusOnEncryptedPages: "Якщо ввімкнено, коментарі Giscus завантажуватимуться навіть до розблокування сторінки. Вимкніть це, якщо коментарі містять конфіденційну інформацію.",
		},
		lockScreen: {
			title: "Цей вміст зашифровано",
			description: "Будь ласка, введіть пароль, щоб переглянути вміст",
			rememberPassword: "Запам'ятати пароль",
			unlock: "Розблокувати",
			inputPlaceholder: "Введіть пароль",
			invalidPassword: "Неправильний пароль або пошкоджені дані",
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
	}
}
