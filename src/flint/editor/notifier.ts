
export class Notifier {
    public static escapeHtml(html: string) {
        const div = document.createElement("div");
        div.textContent = html;
        return div.innerHTML;
    }

    public static async notify(message: string, variant: "primary" | "success" | "neutral" | "warning" | "danger", duration = 4000) {
        const icons = {
            "primary": "info-circle",
            "success": "check2-circle",
            "neutral": "gear",
            "warning": "exclamation-triangle",
            "danger": "exclamation-octagon",
        };

        const alert = Object.assign(document.createElement("sl-alert"), {
            countdown: "ltr",
            variant,
            closable: true,
            duration: duration,
            innerHTML: `
        <sl-icon name="${icons[variant]}" slot="icon"></sl-icon>
        ${this.escapeHtml(message)}
      `
        });

        document.body.append(alert);
        await customElements.whenDefined("sl-alert");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (alert as any).toast();
    }
}

