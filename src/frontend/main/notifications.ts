
export class Notice
{
	private static container: HTMLElement;
	public notification: HTMLElement;

	constructor(public message: string, public duration: number = 5000)
	{
		this.show();
	}

	public show()
	{
		if (!Notice.container)
		{
			Notice.container = document.createElement("div");
			Notice.container.classList.add("notice-container");

			// 优先挂载到 #layout 内部，这样通知会自然跟随主布局，
			// 并通过 CSS 与顶部导航栏互相避让，避免重叠。
			const layout = document.getElementById("layout");
			const targetContainer = layout || document.body;
			targetContainer.appendChild(Notice.container);
		}

		this.notification = document.createElement("div");
		this.notification.classList.add("notice");
		this.notification.innerHTML = this.message;
		Notice.container.appendChild(this.notification);

		// slide in from left
		this.notification.style.opacity = "0";
		this.notification.style.transform = "translateX(350px)";
		this.notification.style.transition = "all 0.5s";
		setTimeout(() =>
		{
			this.notification.style.opacity = "1";
			this.notification.style.transform = "translateX(0)";
			this.notification.style.height = this.notification.scrollHeight + "px";
		}, 100);

		// slide up
		setTimeout(() =>
		{
			this.dismiss();
		}, this.duration);

		// dismiss on click
		this.notification.addEventListener("click", () =>
		{
			this.dismiss();
		}, { once: true });
	}

	public dismiss()
	{
		if (!this.notification) return;
		this.notification.style.opacity = "0";
		this.notification.style.height = "0";
		this.notification.style.margin = "0";
		this.notification.style.padding = "0";
		setTimeout(() =>
		{
			this.notification.remove();
		}, 500);
	}
}
