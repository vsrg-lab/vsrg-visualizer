import { Monitor, Moon, Sun } from "lucide-react";

import { useSettingsStore } from "../../store/settings";
import { nextTheme, resolveTheme } from "../../theme";

/** Theme pin button - shows the current choice and pins the opposite of the resolved theme. */
export function ThemeToggle() {
	const theme = useSettingsStore(state => state.theme);
	const setTheme = useSettingsStore(state => state.setTheme);

	const icon = theme === "system"
		? <Monitor size={16} />
		: theme === "light" ? <Sun size={16} /> : <Moon size={16} />;

	function toggle(): void {
		const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		setTheme(nextTheme(resolveTheme(theme, systemDark)));
	}

	return (
		<button type="button" className="btn btn-sm btn-ghost" onClick={toggle} title={`Theme: ${theme}`}>
			{icon}
		</button>
	);
}
