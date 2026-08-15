/*
* Dark mode toggle
*
* In its current state, it will cause a minor FOIT.
* Basically, the background behind the panels will
* briefly flash white before turning dark. It's
* better than before, but not perfect.
*/

/*
* localStorage will only store strings
* This means that if it has the value 'false',
* It will be truey and incorrectly cause the
* dark theme to load.
*/
var THEME_MODES = {
	LIGHT: 'light',
	DARK: 'dark',
	DEX: 'dex'
};

function normalizeThemeMode(themeMode) {
	var normalized = String(themeMode || '').toLowerCase();
	if (normalized === THEME_MODES.LIGHT || normalized === THEME_MODES.DARK || normalized === THEME_MODES.DEX) {
		return normalized;
	}
	return (localStorage.getItem('darkTheme') === 'true') ? THEME_MODES.DARK : THEME_MODES.LIGHT;
}

var currentThemeMode = normalizeThemeMode(localStorage.getItem('themeMode'));
var prefersDarkTheme = currentThemeMode !== THEME_MODES.LIGHT;
var darkThemeButton = document.getElementById('dark-theme-toggle');

function getDarkStylesheet() {
	return document.getElementById('dark-theme-styles');
}

function getCurrentThemeMode() {
	return currentThemeMode;
}

function updateThemeButtonLabel() {
	if (!darkThemeButton) return;
	if (currentThemeMode === THEME_MODES.LIGHT) {
		darkThemeButton.innerText = 'Click for Dark Theme';
	} else if (currentThemeMode === THEME_MODES.DARK) {
		darkThemeButton.innerText = 'Click for Dex Theme';
	} else {
		darkThemeButton.innerText = 'Click for Light Theme';
	}
}

function emitThemeChange() {
	if (typeof window.jQuery !== 'undefined' && window.jQuery) {
		window.jQuery(document).trigger('calc-theme-change', [prefersDarkTheme]);
	}
}

function applyThemeState() {
	currentThemeMode = normalizeThemeMode(currentThemeMode);
	prefersDarkTheme = currentThemeMode !== THEME_MODES.LIGHT;
	if (document.body) {
		document.body.classList.remove('dark-theme', 'theme-dex');
		if (currentThemeMode === THEME_MODES.DARK || currentThemeMode === THEME_MODES.DEX) document.body.classList.add('dark-theme');
		if (currentThemeMode === THEME_MODES.DEX) document.body.classList.add('theme-dex');
	}
	if (!prefersDarkTheme) {
		document.documentElement.style.cssText = "--fieldset-color: white";
	} else {
		document.documentElement.style.cssText = "--fieldset-color: #2a2a2a";
	}
	var darkStyles = getDarkStylesheet();
	if (darkStyles) darkStyles.disabled = currentThemeMode === THEME_MODES.LIGHT;
	localStorage.setItem('darkTheme', String(prefersDarkTheme));
	localStorage.setItem('themeMode', currentThemeMode);
	updateThemeButtonLabel();
	emitThemeChange();
}

/*
* Function that toggles light and dark mode
* Doesn't use jQuery, probably could with some modification
*/
function toggleTheme() {
	if (currentThemeMode === THEME_MODES.LIGHT) {
		currentThemeMode = THEME_MODES.DARK;
	} else if (currentThemeMode === THEME_MODES.DARK) {
		currentThemeMode = THEME_MODES.DEX;
	} else {
		currentThemeMode = THEME_MODES.LIGHT;
	}
	applyThemeState();
}

function setThemeMode(isDarkModeOrTheme) {
	if (typeof isDarkModeOrTheme === 'string') {
		currentThemeMode = normalizeThemeMode(isDarkModeOrTheme);
	} else {
		currentThemeMode = !!isDarkModeOrTheme ? THEME_MODES.DARK : THEME_MODES.LIGHT;
	}
	applyThemeState();
}

function isDarkThemeEnabled() {
	return currentThemeMode !== THEME_MODES.LIGHT;
}

window.toggleTheme = toggleTheme;
window.setThemeMode = setThemeMode;
window.isDarkThemeEnabled = isDarkThemeEnabled;
window.getCurrentThemeMode = getCurrentThemeMode;

updateThemeButtonLabel();
applyThemeState();

if (darkThemeButton) {
	darkThemeButton.addEventListener('click', toggleTheme);
}
