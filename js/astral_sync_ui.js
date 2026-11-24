/* global AstralSync, gen, pokedex, moves, items, abilities, calc, setdex, buildAeLuaPokemonSet, setSelectedSetIdForSide, collectPlayerRosterLayout, applyPlayerRosterLayout, applyPlayerRosterSearchFilter, syncFragRoster, renderFragSheet, updateDex, Promise */
(function () {
	"use strict";
	var snapshot = {party: [], pc: [], battle: null};
	var busy = false;
	var resetTimer;
	var connectionTimer;
	var connectionVersion = 0;
	var currentLabel = "Sync";
	var currentStatus = "Not connected to Astral Emerald.";
	function savedSets() {
		try {
			var value = JSON.parse(window.localStorage.getItem("customsets") || "{}");
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		} catch (error) { return {}; }
	}
	function restoreSavedSnapshot() {
		var saved = savedSets();
		Object.keys(saved).forEach(function (species) {
			Object.keys(saved[species] || {}).forEach(function (label) {
				var set = saved[species][label];
				var live = set && set.astralSync;
				if (!live || !Number.isInteger(live.slot) || live.slot < 1 ||
					live.slot > 30 || typeof live.location !== "string") return;
				var list = live.location === "Party" ? snapshot.party :
					/^PC Box (?:[1-9]|1[0-4])$/.test(live.location) ? snapshot.pc : null;
				if (list) list.push({species: species, label: label, id: species + " (" + label + ")",
					location: live.location, slot: live.slot, set: set});
			});
		});
		snapshot.party.sort(function (a, b) { return a.slot - b.slot; });
		snapshot.pc.sort(function (a, b) {
			return Number(a.location.slice(7)) - Number(b.location.slice(7)) || a.slot - b.slot;
		});
	}
	function persistSnapshot() {
		var saved = savedSets();
		Object.keys(saved).forEach(function (species) {
			Object.keys(saved[species] || {}).forEach(function (label) {
				if (saved[species][label] && saved[species][label].astralSync) delete saved[species][label];
			});
			if (!Object.keys(saved[species] || {}).length) delete saved[species];
		});
		entries().forEach(function (entry) {
			if (!saved[entry.species]) saved[entry.species] = {};
			entry.set.isCustomSet = true;
			saved[entry.species][entry.label] = entry.set;
		});
		if (typeof updateDex === "function") updateDex(saved);
		else window.localStorage.setItem("customsets", JSON.stringify(saved));
	}
	function names(data) {
		return Array.isArray(data) ? data : Object.keys(data || {});
	}
	function entries() { return snapshot.party.concat(snapshot.pc); }
	function displayName(entry, speciesName) {
		var species = speciesName || entry.species;
		var nickname = String(entry.set.nickname || "").trim();
		var isDistinct = nickname && nickname.toLowerCase() !== entry.species.toLowerCase() &&
			nickname.toLowerCase() !== species.toLowerCase();
		return isDistinct ? nickname + " (" + species + ")" : species + " (Custom Set)";
	}
	function displayNameForId(setId, speciesName) {
		var all = entries();
		for (var i = 0; i < all.length; i++) {
			if (all[i].id !== setId) continue;
			var name = displayName(all[i], speciesName);
			var duplicate = 0;
			for (var j = 0; j < i; j++) {
				if (displayName(all[j], all[j].species) === displayName(all[i], all[i].species)) duplicate++;
			}
			return duplicate ? name + " #" + (duplicate + 1) : name;
		}
		return "";
	}
	function install() {
		if (gen !== 9 || !setdex) return;
		Object.keys(setdex).forEach(function (species) {
			Object.keys(setdex[species]).forEach(function (label) {
				if (setdex[species][label].astralSync) delete setdex[species][label];
			});
		});
		entries().forEach(function (entry) {
			if (!setdex[entry.species]) setdex[entry.species] = {};
			var base = entry.label || "Synced " + entry.location + " Slot " + entry.slot;
			var label = base;
			var suffix = 1;
			while (Object.prototype.hasOwnProperty.call(setdex[entry.species], label)) label = base + " Sync " + (++suffix);
			entry.label = label;
			entry.id = entry.species + " (" + label + ")";
			setdex[entry.species][label] = entry.set;
		});
	}
	function options() {
		if (gen !== 9) return [];
		return entries().map(function (entry) {
			return {pokemon: entry.species, set: entry.label, text: displayNameForId(entry.id),
				id: entry.id, isSynced: true, isCustom: true, nickname: entry.set.nickname || ""};
		});
	}
	function uiState(label, status) {
		currentLabel = label;
		currentStatus = status;
		document.querySelectorAll(".astral-sync-button").forEach(function (button) {
			button.textContent = label;
			button.disabled = busy;
		});
		document.querySelectorAll(".astral-sync-status").forEach(function (node) { node.textContent = status; });
	}
	function applyRoster(previous, next) {
		// Other calculator pages can show the Sync control without a Team/Box
		// panel. Do not replace their stored layout with an empty DOM snapshot.
		if (!document.getElementById("team-poke-list") || !document.getElementById("box-poke-list")) return false;
		var layout = AstralSync.mergeRosterLayout(collectPlayerRosterLayout(), previous, next);
		applyPlayerRosterLayout(layout);
		applyPlayerRosterSearchFilter();
		syncFragRoster();
		renderFragSheet();
		return true;
	}
	function refreshSelectedSyncedPokemon(previous, next) {
		var selected = String($("#p1 input.set-selector").val() || "");
		var oldEntry = previous.party.concat(previous.pc).filter(function (entry) { return entry.id === selected; })[0];
		if (!oldEntry) return;
		var replacement = next.party.concat(next.pc).filter(function (entry) {
			return entry.location === oldEntry.location && entry.slot === oldEntry.slot;
		})[0] || next.party[0];
		if (replacement) setSelectedSetIdForSide("p1", replacement.id);
	}
	function disconnectedStatus() {
		return "Not connected to Astral Emerald." + (entries().length ? " Saved party available." : "");
	}
	function scheduleConnectionCheck() {
		clearTimeout(connectionTimer);
		var version = connectionVersion;
		connectionTimer = setTimeout(function () {
			if (busy || version !== connectionVersion) return;
			// /update also checks that the ROM is readable; /ping alone only
			// proves the Lua service is running. Do not replace the imported party.
			return AstralSync.fetchSnapshot(window, 1500).then(function () {
				if (version !== connectionVersion) return;
				uiState("Sync", "Astral Emerald is connected. Party imported.");
				scheduleConnectionCheck();
			}).catch(function () {
				if (version !== connectionVersion) return;
				clearTimeout(resetTimer);
				uiState("Sync", disconnectedStatus());
			});
		}, 5000);
	}
	function fetchWhenReady(attempts) {
		return AstralSync.fetchSnapshot(window).catch(function (error) {
			if (error.code !== "ready" || attempts <= 1) throw error;
			return new Promise(function (resolve) { setTimeout(resolve, 350); }).then(function () {
				return fetchWhenReady(attempts - 1);
			});
		});
	}
	function sync() {
		if (busy) return;
		clearTimeout(resetTimer);
		clearTimeout(connectionTimer);
		connectionVersion++;
		busy = true;
		uiState("Connecting...", "Checking Astral Emerald...");
		console.info("[Astral Sync] Checking " + AstralSync.url);
		return fetchWhenReady(7).then(function (payload) {
			if (gen !== 9) throw new Error("Choose Astral generation 9 before syncing.");
			var next = AstralSync.parseSnapshot(payload, {
				species: names(pokedex), moves: names(moves), item: names(items), ability: names(abilities),
				nature: names(calc.NATURES), buildSet: buildAeLuaPokemonSet
			});
			var previous = snapshot;
			next = AstralSync.mergeIncompletePc(previous, next);
			snapshot = next;
			install();
			persistSnapshot();
			applyRoster(previous, next);
			refreshSelectedSyncedPokemon(previous, next);
			busy = false;
			var status = "Astral Emerald is connected. Party imported.";
			next.warnings.forEach(function (warning) { console.warn("[Astral Sync] " + warning); });
			console.info("[Astral Sync] Imported " + next.party.length + " party Pokemon.");
			uiState("Synced", status);
			scheduleConnectionCheck();
			resetTimer = setTimeout(function () { uiState("Sync", status); }, 2200);
		}).catch(function (error) {
			busy = false;
			console.warn("[Astral Sync]", error);
			uiState("Sync Failed", disconnectedStatus() + " " + error.message);
			resetTimer = setTimeout(function () { uiState("Sync", disconnectedStatus() + " " + error.message); }, 2200);
		});
	}
	function ensureControls() {
		document.querySelectorAll(".ae-lua-frag-import-button").forEach(function (existing) {
			if (existing.nextElementSibling && existing.nextElementSibling.classList.contains("astral-sync-controls")) return;
			var group = document.createElement("div");
			group.className = "astral-sync-controls";
			var button = document.createElement("button");
			button.type = "button";
			button.className = "btn calc-side-btn astral-sync-button";
			button.textContent = "Sync";
			button.title = "Read the current party and PC from Astral Emerald";
			button.addEventListener("click", sync);
			group.appendChild(button);
			var status = document.createElement("div");
			status.className = "astral-sync-status";
			status.setAttribute("role", "status");
			group.appendChild(status);

			existing.parentNode.insertBefore(group, existing.nextSibling);
		});
		uiState(currentLabel, currentStatus);
	}
	restoreSavedSnapshot();
	currentStatus = disconnectedStatus();
	window.AstralSyncUI = {ensureControls: ensureControls, install: install, options: options,
		displayNameForId: displayNameForId,
		getBattle: function () { return snapshot.battle; }};
	$(ensureControls);
})();
