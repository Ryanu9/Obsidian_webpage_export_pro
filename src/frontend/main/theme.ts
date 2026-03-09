// the theme is loaded from local storage in a deffered inline script so it can be loaded before content is shown
// this handles "runtime" theme changes
export enum ThemeType
{
	Light = "light",
	Dark = "dark"
}

export class Theme 
{
	private themeToggle: HTMLInputElement | null;
	private themeToggleButton: HTMLButtonElement | null;
	private isTransitioning: boolean;

	public constructor()
	{
		this.themeToggle = document.querySelector(".theme-toggle-input") as HTMLInputElement | null;
		this.themeToggleButton = document.querySelector(".theme-toggle") as HTMLButtonElement | null;
		this.isTransitioning = false;
		this.themeToggleButton?.addEventListener("click", () =>
		{
			this.switchTheme();
		});

		const current = localStorage.getItem("theme") as ThemeType | null;
		const initialTheme = current ? current : (document.body.classList.contains("theme-dark") ? ThemeType.Dark : ThemeType.Light);
		this.syncThemeToggle(initialTheme);
	}

	private syncThemeToggle(theme: ThemeType)
	{
		const isDarkTheme = theme == ThemeType.Dark;

		if (this.themeToggle)
		{
			this.themeToggle.checked = isDarkTheme;
		}

		if (this.themeToggleButton)
		{
			this.themeToggleButton.setAttribute("aria-checked", isDarkTheme ? "true" : "false");
			this.themeToggleButton.setAttribute("aria-label", isDarkTheme ? "切换到亮色主题" : "切换到暗色主题");
		}
	}

	private getCurrentTheme()
	{
		const current = localStorage.getItem("theme") as ThemeType | null;
		return current ? current : (document.body.classList.contains("theme-dark") ? ThemeType.Dark : ThemeType.Light);
	}

	public switchTheme()
	{
		if (this.isTransitioning)
		{
			return;
		}

		const currentTheme = this.getCurrentTheme();
		const opposite = currentTheme == ThemeType.Dark ? ThemeType.Light : ThemeType.Dark;
		this.isTransitioning = true;
		this.syncThemeToggle(opposite);

		window.setTimeout(() =>
		{
			this.setTheme(opposite, false);
		}, 150);
	}

	public setTheme(theme: ThemeType, instant: boolean = false)
	{
		const isDarkTheme = theme == ThemeType.Dark;
		const overlayColor = isDarkTheme ? '#1e1e1e' : '#ffffff';
		this.syncThemeToggle(theme);

		const applyTheme = () =>
		{
			document.body.style.setProperty('--color-fade-speed', '0s');

			if(isDarkTheme)
			{
				if (document.body.classList.contains("theme-light"))
				{
					document.body.classList.remove("theme-light");
				}

				if (!document.body.classList.contains("theme-dark"))
				{
					document.body.classList.add("theme-dark");
				}
			}
			else
			{
				if (document.body.classList.contains("theme-dark"))
				{
					document.body.classList.remove("theme-dark");
				}

				if (!document.body.classList.contains("theme-light"))
				{
					document.body.classList.add("theme-light");
				}
			}

			localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
			document.dispatchEvent(new CustomEvent("theme-changed"));
		};

		if (instant)
		{
			applyTheme();
			requestAnimationFrame(() =>
			{
				requestAnimationFrame(() =>
				{
					document.body.style.removeProperty('--color-fade-speed');
				});
			});
			return;
		}

		this.isTransitioning = true;

		const overlay = document.createElement('div');
		overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;opacity:0;will-change:opacity;';
		overlay.style.backgroundColor = overlayColor;
		document.body.appendChild(overlay);

		overlay.animate(
			[{opacity: 0}, {opacity: 1}],
			{duration: 180, easing: 'ease-out', fill: 'forwards'}
		).finished.then(() =>
		{
			applyTheme();

			requestAnimationFrame(() =>
			{
				requestAnimationFrame(() =>
				{
					document.body.style.removeProperty('--color-fade-speed');

					overlay.animate(
						[{opacity: 1}, {opacity: 0}],
						{duration: 180, easing: 'ease-in-out', fill: 'forwards'}
					).finished.then(() =>
					{
						overlay.remove();
						this.isTransitioning = false;
					});
				});
			});
		});
	}
}
