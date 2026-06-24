function placeBsBtn() {
	var importBtn = "<button id='import' class='bs-btn bs-btn-default'>Import</button>";
	$("#import-1_wrapper").append(importBtn);

	$("#import.bs-btn").click(function () {
		var pokes = document.getElementsByClassName("import-team-text")[0].value;
		var name = document.getElementsByClassName("import-name-text")[0].value.trim() === "" ? "Custom Set" : document.getElementsByClassName("import-name-text")[0].value;
		addSets(pokes, name);
		//erase the import text area
		document.getElementsByClassName("import-team-text")[0].value="";
	});
}

function ExportPokemon(pokeInfo) {
	var pokemon = createPokemon(pokeInfo);
	var EV_counter = 0;
	var finalText = "";
	finalText = pokemon.name + (pokemon.item ? " @ " + pokemon.item : "") + "\n";
	finalText += "Level: " + pokemon.level + "\n";
	finalText += pokemon.nature && gen > 2 ? pokemon.nature + " Nature" + "\n" : "";
	finalText += pokemon.teraType && gen > 8 ? "Tera Type: " + pokemon.teraType : "";
	finalText += pokemon.ability ? "Ability: " + pokemon.ability + "\n" : "";
	if (gen > 2) {
		var EVs_Array = [];
		for (var stat in pokemon.evs) {
			var ev = pokemon.evs[stat] ? pokemon.evs[stat] : 0;
			if (ev > 0) {
				EVs_Array.push(ev + " " + calc.Stats.displayStat(stat));
			}
			EV_counter += ev;
			if (EV_counter > 510) break;
		}
		if (EVs_Array.length > 0) {
			finalText += "EVs: ";
			finalText += serialize(EVs_Array, " / ");
			finalText += "\n";
		}
	}

	var IVs_Array = [];
	for (var stat in pokemon.ivs) {
		var iv = pokemon.ivs[stat] ? pokemon.ivs[stat] : 0;
		if (iv < 31) {
			IVs_Array.push(iv + " " + calc.Stats.displayStat(stat));
		}
	}
	if (IVs_Array.length > 0) {
		finalText += "IVs: ";
		finalText += serialize(IVs_Array, " / ");
		finalText += "\n";
	}

	for (var i = 0; i < 4; i++) {
		var moveName = pokemon.moves[i].name;
		if (moveName !== "(No Move)") {
			finalText += "- " + moveName + "\n";
		}
	}
	finalText = finalText.trim();
	$("textarea.import-team-text").val(finalText);
}

function getSetNameFromSelection(selectionValue) {
	var selected = String(selectionValue || "").trim();
	var openParen = selected.indexOf("(");
	var closeParen = selected.lastIndexOf(")");
	if (openParen < 0 || closeParen <= openParen) return "";
	return selected.substring(openParen + 1, closeParen).trim();
}

function normalizeSavedMoveList(rawMoves) {
	var normalizedMoves = [];
	for (var i = 0; i < 4; i++) {
		var moveEntry = rawMoves && rawMoves[i];
		var moveName = "";
		if (typeof moveEntry === "string") {
			moveName = moveEntry;
		} else if (moveEntry && typeof moveEntry.name === "string") {
			moveName = moveEntry.name;
		}
		moveName = String(moveName || "").trim();
		normalizedMoves.push(moveName || "(No Move)");
	}
	return normalizedMoves;
}

function resolveCustomSetStorageKey(speciesSetMap, requestedSetName) {
	var preferred = String(requestedSetName || "").trim() || "Custom Set";
	if (!speciesSetMap || typeof speciesSetMap !== "object") return preferred;
	if (Object.prototype.hasOwnProperty.call(speciesSetMap, preferred)) return preferred;
	if (Object.prototype.hasOwnProperty.call(speciesSetMap, "Custom Set")) return "Custom Set";
	var existingSetNames = Object.keys(speciesSetMap);
	return existingSetNames.length ? existingSetNames[0] : preferred;
}

function collapseSpeciesSetMapToSingleEntry(speciesSetMap) {
	if (!speciesSetMap || typeof speciesSetMap !== "object") return {};
	var setNames = Object.keys(speciesSetMap);
	if (!setNames.length) return {};
	var selectedSetName = resolveCustomSetStorageKey(speciesSetMap, "Custom Set");
	var selectedSet = speciesSetMap[selectedSetName] || speciesSetMap[setNames[0]] || {};
	var collapsed = {};
	collapsed[selectedSetName] = selectedSet;
	return collapsed;
}

function normalizeCustomSetStorage(customsets) {
	var normalized = {};
	if (!customsets || typeof customsets !== "object") return normalized;
	for (var pokemon in customsets) {
		if (!Object.prototype.hasOwnProperty.call(customsets, pokemon)) continue;
		var speciesSets = customsets[pokemon];
		if (!speciesSets || typeof speciesSets !== "object") continue;
		var normalizedSpeciesSets = {};
		for (var setName in speciesSets) {
			if (!Object.prototype.hasOwnProperty.call(speciesSets, setName)) continue;
			var normalizedSetName = String(setName || "").trim() || "Custom Set";
			var normalizedSet = speciesSets[setName] || {};
			normalizedSet.moves = normalizeSavedMoveList(normalizedSet.moves);
			normalizedSpeciesSets[normalizedSetName] = normalizedSet;
		}
		if (Object.keys(normalizedSpeciesSets).length) normalized[pokemon] = normalizedSpeciesSets;
	}
	return normalized;
}

function getExistingSetMovesForSave(selectedSet) {
	if (!selectedSet || typeof setdex === "undefined" || !setdex) return ["(No Move)", "(No Move)", "(No Move)", "(No Move)"];
	var parsedSet = typeof parseSetId === "function" ? parseSetId(selectedSet) : null;
	if (!parsedSet || !parsedSet.species || !parsedSet.label) return ["(No Move)", "(No Move)", "(No Move)", "(No Move)"];
	var speciesSets = setdex[parsedSet.species];
	if (!speciesSets) return ["(No Move)", "(No Move)", "(No Move)", "(No Move)"];
	return normalizeSavedMoveList(speciesSets[parsedSet.label] && speciesSets[parsedSet.label].moves);
}

function getMoveNamesFromSelectors(pokeInfo, fallbackMoves) {
	var moves = [];
	for (var slot = 1; slot <= 4; slot++) {
		var moveSelector = pokeInfo.find(".move" + slot + " select.move-selector");
		var moveName = String(moveSelector.val() || "").trim();
		if (!moveName && moveSelector.length) {
			var chosenText = moveSelector.siblings(".select2-container").find(".select2-chosen").first().text().trim();
			if (chosenText && chosenText !== "Select a move") moveName = chosenText;
		}
		if (!moveName) moveName = (fallbackMoves && fallbackMoves[slot - 1]) || "(No Move)";
		moves.push(moveName);
	}
	return normalizeSavedMoveList(moves);
}

function SavePokemonSet(pokeInfo) {
	var pokemon = createPokemon(pokeInfo);
	if (!pokemon || !pokemon.name) return;
	var selectedSet = pokeInfo.find(".set-selector").val() || "";
	var parsedSet = typeof parseSetId === "function" ? parseSetId(selectedSet) : null;
	var baseSetName = (parsedSet && parsedSet.label) || getSetNameFromSelection(selectedSet) || "Custom Set";
	pokemon.nameProp = baseSetName;
	pokemon.isCustomSet = true;
	pokemon.moves = getMoveNamesFromSelectors(pokeInfo, getExistingSetMovesForSave(selectedSet));
	addToDex(pokemon);
	$(allPokemon("#importedSetsOptions")).css("display", "inline");
	var fullSetName = pokemon.name + " (" + baseSetName + ")";
	var selector = pokeInfo.find(".set-selector");
	selector.val(fullSetName).change();
	if (pokeInfo.prop("id") === "p1") {
		$(".player .select2-chosen").text(fullSetName);
	}
}

$("#exportL").click(function () {
	ExportPokemon($("#p1"));
});

$("#exportR").click(function () {
	ExportPokemon($("#p2"));
});

$("#saveL").click(function (ev) {
	ev.preventDefault();
	SavePokemonSet($("#p1"));
});

function serialize(array, separator) {
	var text = "";
	for (var i = 0; i < array.length; i++) {
		if (i < array.length - 1) {
			text += array[i] + separator;
		} else {
			text += array[i];
		}
	}
	return text;
}

function getAbility(row) {
	var ability = row[1] ? row[1].trim() : '';
	if (calc.ABILITIES[9].indexOf(ability) !== -1) return ability;
}

function getTeraType(row) {
	var teraType = row[1] ? row[1].trim() : '';
	if (Object.keys(calc.TYPE_CHART[9]).slice(1).indexOf(teraType) !== -1) return teraType;
}

function statToLegacyStat(stat) {
	switch (stat) {
	case 'hp':
		return "hp";
	case 'atk':
		return "at";
	case 'def':
		return "df";
	case 'spa':
		return "sa";
	case 'spd':
		return "sd";
	case 'spe':
		return "sp";
	}
}

function toLegacyStatsTable(statsTable) {
	var legacy = {};
	if (!statsTable || typeof statsTable !== "object") return legacy;
	var statMap = {
		hp: "hp",
		atk: "at",
		def: "df",
		spa: "sa",
		spd: "sd",
		spe: "sp",
		at: "at",
		df: "df",
		sa: "sa",
		sd: "sd",
		sp: "sp"
	};
	for (var key in statsTable) {
		if (!Object.prototype.hasOwnProperty.call(statsTable, key)) continue;
		var mapped = statMap[key];
		if (!mapped) continue;
		var value = parseInt(statsTable[key], 10);
		if (Number.isNaN(value)) continue;
		legacy[mapped] = value;
	}
	return legacy;
}

function normalizeStatusLabel(status) {
	if (!status) return undefined;
	var value = status.trim();
	var normalized = value.toLowerCase();
	switch (normalized) {
	case "healthy":
	case "none":
		return "Healthy";
	case "poisoned":
	case "poison":
	case "psn":
		return "Poisoned";
	case "badly poisoned":
	case "toxic":
	case "tox":
		return "Badly Poisoned";
	case "burned":
	case "burn":
	case "brn":
		return "Burned";
	case "paralyzed":
	case "paralysis":
	case "par":
		return "Paralyzed";
	case "asleep":
	case "sleep":
	case "slp":
		return "Asleep";
	case "frozen":
	case "frz":
		return "Frozen";
	case "frostbite":
		return "Frostbite";
	default:
		return value;
	}
}

function cloneImportedSpecies(speciesData) {
	if (!speciesData || typeof speciesData !== "object") return speciesData;
	if (typeof deepCloneJsonValue === "function") {
		return deepCloneJsonValue(speciesData, {});
	}
	try {
		return JSON.parse(JSON.stringify(speciesData));
	} catch (err) {
		return $.extend ? $.extend(true, {}, speciesData) : speciesData;
	}
}

function getStats(currentPoke, rows, offset) {
	currentPoke.nature = "Serious";
	var currentEV;
	var currentIV;
	var currentAbility;
	var currentTeraType;
	var currentNature;
	currentPoke.level = 100;
	for (var x = offset; x < offset + 9; x++) {
		if (!rows[x] || !rows[x].trim()) {
			break;
		}
		var currentRow = rows[x].split(/[/:]/);
		var evs = {};
		var ivs = {};
		var ev;
		var j;

		switch (currentRow[0]) {
		case 'Level':
			currentPoke.level = parseInt(currentRow[1].trim());
			break;
		case 'PreDamage':
			currentPoke.PreDamage = parseInt(currentRow[1].trim());
			break;
		case 'PreStatus':
			currentPoke.PreStatus = normalizeStatusLabel(currentRow[1]);
			break;
		case 'EVs':
			for (j = 1; j < currentRow.length; j++) {
				currentEV = currentRow[j].trim().split(" ");
				currentEV[1] = statToLegacyStat(currentEV[1].toLowerCase());
				evs[currentEV[1]] = parseInt(currentEV[0]);
			}
			currentPoke.evs = evs;
			break;
		case 'IVs':
			for (j = 1; j < currentRow.length; j++) {
				currentIV = currentRow[j].trim().split(" ");
				currentIV[1] = statToLegacyStat(currentIV[1].toLowerCase());
				ivs[currentIV[1]] = parseInt(currentIV[0]);
			}
			currentPoke.ivs = ivs;
			break;

		}
		currentAbility = rows[x] ? rows[x].trim().split(":") : '';
		if (currentAbility[0] == "Ability") {
			currentPoke.ability = currentAbility[1].trim();
		}
		if (currentAbility[0] == "PreDamage") {
			currentPoke.PreDamage = parseInt(currentAbility[1].trim());
		}
		if (currentAbility[0] == "PreStatus") {
			currentPoke.PreStatus = normalizeStatusLabel(currentAbility[1]);
		}

		currentTeraType = rows[x] ? rows[x].trim().split(":") : '';
		if (currentTeraType[0] == "Tera Type") {
			currentPoke.teraType = currentTeraType[1].trim();
		}

		currentNature = rows[x] ? rows[x].trim().split(" ") : '';
		if (currentNature[1] == "Nature" && currentNature[2] != "Power") {
			currentPoke.nature = currentNature[0];
		}
	}
	return currentPoke;
}

function getItem(currentRow, j) {
	for (;j < currentRow.length; j++) {
		var item = currentRow[j].trim();
		if (calc.ITEMS[9].indexOf(item) != -1) {
			return item;
		}
	}
}

function getMoves(currentPoke, rows, offset) {
	var movesFound = false;
	var moves = [];
	for (var x = offset; x < offset + 12; x++) {
		if (rows[x]) {
			if (rows[x][0] == "-") {
				movesFound = true;
				var move = rows[x].substr(2, rows[x].length - 2).replace("[", "").replace("]", "").replace("  ", "");
				moves.push(move);
			} else {
				if (movesFound == true) {
					break;
				}
			}
		}
	}
	currentPoke.moves = moves;
	return currentPoke;
}

function addToDex(poke) {
	var dexObject = {};
	if ($("#randoms").prop("checked")) {
		if (GEN9RANDOMBATTLE[poke.name] == undefined) GEN9RANDOMBATTLE[poke.name] = {};
		if (GEN8RANDOMBATTLE[poke.name] == undefined) GEN8RANDOMBATTLE[poke.name] = {};
		if (GEN7RANDOMBATTLE[poke.name] == undefined) GEN7RANDOMBATTLE[poke.name] = {};
		if (GEN6RANDOMBATTLE[poke.name] == undefined) GEN6RANDOMBATTLE[poke.name] = {};
		if (GEN5RANDOMBATTLE[poke.name] == undefined) GEN5RANDOMBATTLE[poke.name] = {};
		if (GEN4RANDOMBATTLE[poke.name] == undefined) GEN4RANDOMBATTLE[poke.name] = {};
		if (GEN3RANDOMBATTLE[poke.name] == undefined) GEN3RANDOMBATTLE[poke.name] = {};
		if (GEN2RANDOMBATTLE[poke.name] == undefined) GEN2RANDOMBATTLE[poke.name] = {};
		if (GEN1RANDOMBATTLE[poke.name] == undefined) GEN1RANDOMBATTLE[poke.name] = {};
	} else {
		if (SETDEX_SV[poke.name] == undefined) SETDEX_SV[poke.name] = {};
		if (SETDEX_SS[poke.name] == undefined) SETDEX_SS[poke.name] = {};
		if (SETDEX_SM[poke.name] == undefined) SETDEX_SM[poke.name] = {};
		if (SETDEX_XY[poke.name] == undefined) SETDEX_XY[poke.name] = {};
		if (SETDEX_BW[poke.name] == undefined) SETDEX_BW[poke.name] = {};
		if (SETDEX_DPP[poke.name] == undefined) SETDEX_DPP[poke.name] = {};
		if (SETDEX_ADV[poke.name] == undefined) SETDEX_ADV[poke.name] = {};
		if (SETDEX_GSC[poke.name] == undefined) SETDEX_GSC[poke.name] = {};
		if (SETDEX_RBY[poke.name] == undefined) SETDEX_RBY[poke.name] = {};
	}
	if (poke.ability !== undefined) {
		dexObject.ability = poke.ability;
	}
	if (poke.teraType !== undefined) {
		dexObject.teraType = poke.teraType;
	}
	if (poke.PreStatus !== undefined) {
		dexObject.PreStatus = poke.PreStatus;
	}
	if (poke.PreDamage !== undefined && !Number.isNaN(poke.PreDamage)) {
		dexObject.PreDamage = poke.PreDamage;
	}
	dexObject.level = poke.level;
	dexObject.evs = toLegacyStatsTable(poke.evs);
	dexObject.ivs = toLegacyStatsTable(poke.ivs);
	dexObject.moves = normalizeSavedMoveList(poke.moves);
	dexObject.nature = poke.nature;
	dexObject.item = poke.item;
	dexObject.isCustomSet = poke.isCustomSet;
	var customsets = {};
	if (localStorage.customsets) {
		try {
			customsets = JSON.parse(localStorage.customsets) || {};
		} catch (err) {
			customsets = {};
		}
	}
	customsets = normalizeCustomSetStorage(customsets);
	if (!customsets[poke.name]) {
		customsets[poke.name] = {};
	}
	var storageSetName = resolveCustomSetStorageKey(customsets[poke.name], poke.nameProp);
	poke.nameProp = storageSetName;
	customsets[poke.name] = {};
	customsets[poke.name][storageSetName] = dexObject;
	if (poke.name === "Aegislash-Blade") {
		customsets["Aegislash-Shield"] = {};
		customsets["Aegislash-Shield"][storageSetName] = dexObject;
	}
	updateDex(customsets);
	if (typeof window.captureFragBackupSnapshot === "function") {
		window.captureFragBackupSnapshot("import-update", false);
	}
}

function updateDex(customsets) {
	customsets = normalizeCustomSetStorage(customsets);
	var dexTables = [
		typeof SETDEX_SV === "undefined" ? null : SETDEX_SV,
		typeof SETDEX_SS === "undefined" ? null : SETDEX_SS,
		typeof SETDEX_SM === "undefined" ? null : SETDEX_SM,
		typeof SETDEX_XY === "undefined" ? null : SETDEX_XY,
		typeof SETDEX_BW === "undefined" ? null : SETDEX_BW,
		typeof SETDEX_DPP === "undefined" ? null : SETDEX_DPP,
		typeof SETDEX_ADV === "undefined" ? null : SETDEX_ADV,
		typeof SETDEX_GSC === "undefined" ? null : SETDEX_GSC,
		typeof SETDEX_RBY === "undefined" ? null : SETDEX_RBY
	];
	for (var tableIndex = 0; tableIndex < dexTables.length; tableIndex++) {
		var dexTable = dexTables[tableIndex];
		if (!dexTable) continue;
		for (var dexPokemon in dexTable) {
			if (!Object.prototype.hasOwnProperty.call(dexTable, dexPokemon)) continue;
			var speciesSets = dexTable[dexPokemon];
			if (!speciesSets || typeof speciesSets !== "object") continue;
			for (var dexSetName in speciesSets) {
				if (!Object.prototype.hasOwnProperty.call(speciesSets, dexSetName)) continue;
				var dexSet = speciesSets[dexSetName];
				if (dexSet && dexSet.isCustomSet) {
					delete speciesSets[dexSetName];
				}
			}
			if (!Object.keys(speciesSets).length) {
				delete dexTable[dexPokemon];
			}
		}
	}
	for (var pokemon in customsets) {
		for (var moveset in customsets[pokemon]) {
			var savedSet = customsets[pokemon][moveset] || {};
			savedSet.moves = normalizeSavedMoveList(savedSet.moves);
			savedSet.isCustomSet = true;
			customsets[pokemon][moveset] = savedSet;
			if (!SETDEX_SV[pokemon]) SETDEX_SV[pokemon] = {};
			SETDEX_SV[pokemon][moveset] = savedSet;
			if (!SETDEX_SS[pokemon]) SETDEX_SS[pokemon] = {};
			SETDEX_SS[pokemon][moveset] = savedSet;
			if (!SETDEX_SM[pokemon]) SETDEX_SM[pokemon] = {};
			SETDEX_SM[pokemon][moveset] = savedSet;
			if (!SETDEX_XY[pokemon]) SETDEX_XY[pokemon] = {};
			SETDEX_XY[pokemon][moveset] = savedSet;
			if (!SETDEX_BW[pokemon]) SETDEX_BW[pokemon] = {};
			SETDEX_BW[pokemon][moveset] = savedSet;
			if (!SETDEX_DPP[pokemon]) SETDEX_DPP[pokemon] = {};
			SETDEX_DPP[pokemon][moveset] = savedSet;
			if (!SETDEX_ADV[pokemon]) SETDEX_ADV[pokemon] = {};
			SETDEX_ADV[pokemon][moveset] = savedSet;
			if (!SETDEX_GSC[pokemon]) SETDEX_GSC[pokemon] = {};
			SETDEX_GSC[pokemon][moveset] = savedSet;
			if (!SETDEX_RBY[pokemon]) SETDEX_RBY[pokemon] = {};
			SETDEX_RBY[pokemon][moveset] = savedSet;
		}
	}
	localStorage.customsets = JSON.stringify(customsets);
}

function addSets(pokes, name) {
	var rows = pokes.split("\n");
	var currentRow;
	var currentPoke;
	var addedpokes = 0;
	for (var i = 0; i < rows.length; i++) {
		currentRow = rows[i].split(/[()@]/);
		for (var j = 0; j < currentRow.length; j++) {
			currentRow[j] = checkExeptions(currentRow[j].trim());
			if (calc.SPECIES[9][currentRow[j].trim()] !== undefined) {
				currentPoke = cloneImportedSpecies(calc.SPECIES[9][currentRow[j].trim()]);
				currentPoke.name = currentRow[j].trim();
				currentPoke.item = getItem(currentRow, j + 1);
				if (j === 1 && currentRow[0].trim()) {
					currentPoke.nameProp = currentRow[0].trim();
				} else {
					currentPoke.nameProp = name;
				}
				currentPoke.isCustomSet = true;
				currentPoke.ability = getAbility(rows[i + 1].split(":"));
				currentPoke.teraType = getTeraType(rows[i + 1].split(":"));
				currentPoke = getStats(currentPoke, rows, i + 1);
				currentPoke = getMoves(currentPoke, rows, i);
				addToDex(currentPoke);
				addBoxed(currentPoke);
				addedpokes++;
				break;
			}
		}
	}
	if (addedpokes > 0) {
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else {
		alert("No sets imported, please check your syntax and try again");
	}
}

function checkExeptions(poke) {
	switch (poke) {
	case 'Aegislash':
		poke = "Aegislash-Blade";
		break;
	case 'Basculin-Blue-Striped':
		poke = "Basculin";
		break;
	case 'Gastrodon-East':
		poke = "Gastrodon";
		break;
	case 'Mimikyu-Busted-Totem':
		poke = "Mimikyu-Totem";
		break;
	case 'Mimikyu-Busted':
		poke = "Mimikyu";
		break;
	case 'Pikachu-Belle':
	case 'Pikachu-Cosplay':
	case 'Pikachu-Libre':
	case 'Pikachu-Original':
	case 'Pikachu-Partner':
	case 'Pikachu-PhD':
	case 'Pikachu-Pop-Star':
	case 'Pikachu-Rock-Star':
		poke = "Pikachu";
		break;
	case 'Vivillon-Fancy':
	case 'Vivillon-Pokeball':
		poke = "Vivillon";
		break;
	case 'Florges-White':
	case 'Florges-Blue':
	case 'Florges-Orange':
	case 'Florges-Yellow':
	case 'Florges-Red-Flower':
	case 'Florges-Yellow-Flower':
	case 'Florges-Orange-Flower':
	case 'Florges-Blue-Flower':
	case 'Florges-White-Flower':
		poke = "Florges";
		break;
	case 'Flabebe-Red-Flower':
	case 'Flabebe-Yellow-Flower':
	case 'Flabebe-Orange-Flower':
	case 'Flabebe-Blue-Flower':
	case 'Flabebe-White-Flower':
		poke = "Flabébé";
		break;
	case 'Floette-Red-Flower':
	case 'Floette-Yellow-Flower':
	case 'Floette-Orange-Flower':
	case 'Floette-Blue-Flower':
	case 'Floette-White-Flower':
		poke = "Floette";
		break;
	case 'Floette-Eternal-Flower':
		poke = "Floette-Eternal";
		break;
	}
	return poke;

}

$("#clearSets").click(function () {
	var yes = confirm("Do you really wish to delete all your mons?")
	if (!yes){
		return
	}
	if (typeof window.captureFragBackupSnapshot === "function") {
		window.captureFragBackupSnapshot("before-clear-imports", true);
	}
	localStorage.removeItem("customsets");
	$(allPokemon("#importedSetsOptions")).hide();
	loadDefaultLists();
	for (let zone of document.getElementsByClassName("dropzone")){
		zone.innerHTML="";
	}

});

$(allPokemon("#importedSets")).click(function () {
	var pokeID = $(this).parent().parent().prop("id");
	var showCustomSets = $(this).prop("checked");
	if (showCustomSets) {
		loadCustomList(pokeID);
	} else {
		loadDefaultLists();
	}
});

$(document).ready(function () {
	var customSets;
	placeBsBtn();
	if (localStorage.customsets) {
		customSets = JSON.parse(localStorage.customsets);
		updateDex(customSets);
		if (typeof restorePlayerRosterLayoutFromStorage === "function") {
			restorePlayerRosterLayoutFromStorage(customSets);
		}
		var restoredSelection = false;
		if (typeof restoreLastEncounterSelection === "function") {
			restoredSelection = !!restoreLastEncounterSelection();
		}
		if (!restoredSelection) {
			var activePlayerSet = typeof getSelectedSetIdForSide === "function"
				? getSelectedSetIdForSide("p1")
				: String($(".player").val() || "").trim();
			if (!activePlayerSet) {
				selectFirstMon();
			}
		}
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else if (!$(".set-selector").first().data("select2")) {
		loadDefaultLists();
	}
	//adjust the side buttons that collapse the data wished to be hidden
	setupSideCollapsers();
});
