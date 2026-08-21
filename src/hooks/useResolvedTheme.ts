import { useEffect, useState } from "react";

import { useSettingsStore } from "../store/settings";
import { DARK_MEDIA_QUERY, resolveTheme } from "../theme";

/**
 * The theme actually in effect, "system" resolved against the OS preference. Shared so the
 * canvas-side consumers redraw off the same value the DOM theme attribute is set from.
 */
export function useResolvedTheme(): "light" | "dark" {
	const theme = useSettingsStore(state => state.theme);
	const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_MEDIA_QUERY).matches);

	useEffect(() => {
		const media = window.matchMedia(DARK_MEDIA_QUERY);
		const apply = () => setSystemDark(media.matches);

		apply();
		media.addEventListener("change", apply);

		return () => media.removeEventListener("change", apply);
	}, []);

	return resolveTheme(theme, systemDark);
}
