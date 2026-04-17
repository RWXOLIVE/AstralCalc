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
var prefersDarkTheme = localStorage.getItem('darkTheme') ? localStorage.getItem('darkTheme') === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
var darkThemeButton = document.getElementById('dark-theme-toggle');

function getDarkStylesheet() {
	return document.getElementById('dark-theme-styles');
}

function updateThemeButtonLabel() {
	if (!darkThemeButton) return;
	darkThemeButton.innerText = prefersDarkTheme ? 'Click for Light Theme' : 'Click for Dark Theme';
}

function emitThemeChange() {
	if (typeof window.jQuery !== 'undefined' && window.jQuery) {
		window.jQuery(document).trigger('calc-theme-change', [prefersDarkTheme]);
	}
}

function applyThemeState() {
	if (!prefersDarkTheme) {
		document.documentElement.style.cssText = "--fieldset-color: white";
	} else {
		document.documentElement.style.cssText = "--fieldset-color: #2a2a2a";
	}
	var darkStyles = getDarkStylesheet();
	if (darkStyles) darkStyles.disabled = !prefersDarkTheme;
	localStorage.setItem('darkTheme', prefersDarkTheme);
	updateThemeButtonLabel();
	emitThemeChange();
}

/*
* Function that toggles light and dark mode
* Doesn't use jQuery, probably could with some modification
*/
function toggleTheme() {
	prefersDarkTheme = !prefersDarkTheme;
	applyThemeState();
}

function setThemeMode(isDarkMode) {
	prefersDarkTheme = !!isDarkMode;
	applyThemeState();
}

function isDarkThemeEnabled() {
	return !!prefersDarkTheme;
}

window.toggleTheme = toggleTheme;
window.setThemeMode = setThemeMode;
window.isDarkThemeEnabled = isDarkThemeEnabled;

updateThemeButtonLabel();
applyThemeState();

if (darkThemeButton) {
	darkThemeButton.addEventListener('click', toggleTheme);
}
