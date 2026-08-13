(function () {
	"use strict";

	var SWITCH_IN_ENABLED_STORAGE_KEY = "astralSwitchInEnabled";
	var switchInEnabled = sessionStorage.getItem(SWITCH_IN_ENABLED_STORAGE_KEY) === "1";

	function getSwitchInButton() {
		return document.getElementById("settings-switch-in");
	}

	function setSwitchInStatus(message) {
		var status = document.getElementById("settings-switch-in-status");
		if (status) status.textContent = message;
	}

	function syncSwitchInButton() {
		var button = getSwitchInButton();
		if (!button) return;
		button.classList.toggle("is-active", switchInEnabled);
		button.setAttribute("aria-pressed", switchInEnabled ? "true" : "false");
		setSwitchInStatus(switchInEnabled ? "On - Astral smart post-KO order" : "Off");
	}

	function setSwitchInEnabled(enabled) {
		switchInEnabled = !!enabled;
		if (switchInEnabled) sessionStorage.setItem(SWITCH_IN_ENABLED_STORAGE_KEY, "1");
		else sessionStorage.removeItem(SWITCH_IN_ENABLED_STORAGE_KEY);
		if (window.AstralSwitchIn && typeof window.AstralSwitchIn.setEnabled === "function") {
			window.AstralSwitchIn.setEnabled(switchInEnabled);
		}
		syncSwitchInButton();
	}

	function bindSwitchInToggle() {
		var button = getSwitchInButton();
		if (!button) return;
		button.addEventListener("click", function () {
			setSwitchInEnabled(!switchInEnabled);
		});
		setSwitchInEnabled(switchInEnabled);
	}

	function bindSwitchInHelp() {
		var button = document.getElementById("switch-in-guide-help-button");
		var helpText = document.getElementById("switch-in-guide-help-text");
		if (!button || !helpText) return;
		button.addEventListener("click", function () {
			var willOpen = helpText.hidden;
			helpText.hidden = !willOpen;
			button.setAttribute("aria-expanded", willOpen ? "true" : "false");
		});
	}

	function bindSwitchInControls() {
		bindSwitchInToggle();
		bindSwitchInHelp();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", bindSwitchInControls);
	} else {
		bindSwitchInControls();
	}
})();
