import { Monitor, Moon, Sun } from "lucide-react";

import { useSettingsStore } from "../../store/settings";
import { toggleTheme } from "../../theme";
import { IconButton } from "../common/IconButton";

/** Theme pin button - shows the current choice and pins the opposite of the resolved theme. */
export function ThemeToggle() {
	const theme = useSettingsStore(state => state.theme);
	const setTheme = useSettingsStore(state => state.setTheme);

	const icon = theme === "system"
		? <Monitor size={15} strokeWidth={1.8} />
		: theme === "light" ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />;

	return (
		<IconButton label={`Theme: ${theme} (T)`} size={28} onClick={() => setTheme(toggleTheme(theme))}>
			{icon}
		</IconButton>
	);
}
