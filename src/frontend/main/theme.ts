
// the theme is loaded from local storage in a deffered inline script so it can be loaded before content is shown
// this handles "runtime" theme changes
export enum ThemeType
{
	Light = "light",
	Dark = "dark"
}

export class Theme 
{
	private themeToggle: HTMLInputElement;

	public constructor()
	{
		this.themeToggle = document.querySelector(".theme-toggle-input") as HTMLInputElement;
		this.themeToggle?.addEventListener("change", event =>
		{
			this.switchTheme();
		});
	}

	public switchTheme()
	{
		const current = localStorage.getItem("theme") as ThemeType;
		let opposite = current == ThemeType.Light ? ThemeType.Dark : ThemeType.Light;
		this.setTheme(opposite, false);
	}

	public setTheme(theme: ThemeType, instant: boolean = false)
	{
		let state = theme == ThemeType.Light;
		this.themeToggle.checked = state;

		const applyTheme = () =>
		{
			document.body.style.setProperty('--color-fade-speed', '0s');

			if(!this.themeToggle.classList.contains("is-checked") && state)
			{
				this.themeToggle.classList.add("is-checked");
			}
			else if (this.themeToggle.classList.contains("is-checked") && !state)
			{
				this.themeToggle.classList.remove("is-checked");
			}

			if(!state)
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

			localStorage.setItem("theme", state ? "light" : "dark");
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

		const overlay = document.createElement('div');
		overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;will-change:opacity;';
		overlay.style.backgroundColor = state ? '#ffffff' : '#1e1e1e';
		document.body.appendChild(overlay);

		overlay.animate(
			[{opacity: 0}, {opacity: 1}],
			{duration: 150, easing: 'ease-out', fill: 'forwards'}
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
						{duration: 300, easing: 'ease-in-out', fill: 'forwards'}
					).finished.then(() => overlay.remove());
				});
			});
		});
	}
}
