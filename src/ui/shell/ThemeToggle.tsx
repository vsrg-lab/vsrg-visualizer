import { useSettingsStore } from "../../store/settings";
import { nextTheme, resolveTheme } from "../../theme";

/** Theme pin button - shows the current choice and pins the opposite of the resolved theme. */
export function ThemeToggle() {
	const theme = useSettingsStore(state => state.theme);
	const setTheme = useSettingsStore(state => state.setTheme);

	const icon = theme === "system" ? "◐" : theme === "light" ? "☀" : "☾";

	function toggle(): void {
		const systemDark = window.matchMedia("(preferes-color-scheme: dark)").matches;
		setTheme(nextTheme(resolveTheme(theme, systemDark)));
	}

	return (
		<button type="button" className="btn btn-sm btn-ghost" onClick={toggle} title={`Theme: ${theme}`}>
			{icon}
		</button>
	);
}
