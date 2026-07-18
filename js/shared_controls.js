if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement, fromIndex) { // eslint-disable-line no-extend-native
		var k;
		if (this == null) {
			throw new TypeError('"this" equals null or n is undefined');
		}
		var O = Object(this);
		var len = O.length >>> 0;
		if (len === 0) {
			return -1;
		}
		var n = +fromIndex || 0;
		if (Math.abs(n) === Infinity) {
			n = 0;
		}
		if (n >= len) {
			return -1;
		}
		k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
		while (k < len) {
			if (k in O && O[k] === searchElement) {
				return k;
			}
			k++;
		}
		return -1;
	};
}

function startsWith(string, target) {
	return (string || '').slice(0, target.length) === target;
}

var LEGACY_STATS_RBY = ["hp", "at", "df", "sl", "sp"];
var LEGACY_STATS_GSC = ["hp", "at", "df", "sa", "sd", "sp"];
var LEGACY_STATS = [[], LEGACY_STATS_RBY, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC];
var HIDDEN_POWER_REGEX = /Hidden Power (\w*)/;
var NATURE_EFFECTS = {
	Adamant: {plus: "at", minus: "sa"},
	Bashful: {plus: "sa", minus: "sa"},
	Bold: {plus: "df", minus: "at"},
	Brave: {plus: "at", minus: "sp"},
	Calm: {plus: "sd", minus: "at"},
	Careful: {plus: "sd", minus: "sa"},
	Docile: {plus: "df", minus: "df"},
	Gentle: {plus: "sd", minus: "df"},
	Hardy: {plus: "at", minus: "at"},
	Hasty: {plus: "sp", minus: "df"},
	Impish: {plus: "df", minus: "sa"},
	Jolly: {plus: "sp", minus: "sa"},
	Lax: {plus: "df", minus: "sd"},
	Lonely: {plus: "at", minus: "df"},
	Mild: {plus: "sa", minus: "df"},
	Modest: {plus: "sa", minus: "at"},
	Naive: {plus: "sp", minus: "sd"},
	Naughty: {plus: "at", minus: "sd"},
	Quiet: {plus: "sa", minus: "sp"},
	Quirky: {plus: "sd", minus: "sd"},
	Rash: {plus: "sa", minus: "sd"},
	Relaxed: {plus: "df", minus: "sp"},
	Sassy: {plus: "sd", minus: "sp"},
	Serious: {plus: "sp", minus: "sp"},
	Timid: {plus: "sp", minus: "at"}
};

var CALC_STATUS = {
	'Healthy': '',
	'Paralyzed': 'par',
	'Poisoned': 'psn',
	'Badly Poisoned': 'tox',
	'Burned': 'brn',
	'Asleep': 'slp',
	'Frozen': 'frz',
	'Frostbite': 'frb'
};

function legacyStatToStat(st) {
	switch (st) {
		case 'hp':
			return "hp";
		case 'at':
			return "atk";
		case 'df':
			return "def";
		case 'sa':
			return "spa";
		case 'sd':
			return "spd";
		case 'sp':
			return "spe";
		case 'sl':
			return "spc";
	}
}

// input field validation
var bounds = {
	"level": [0, 100],
	"base": [1, 255],
	"evs": [0, 252],
	"ivs": [0, 31],
	"dvs": [0, 15],
	"move-bp": [0, 65535]
};
for (var bounded in bounds) {
	attachValidation(bounded, bounds[bounded][0], bounds[bounded][1]);
}
function attachValidation(clazz, min, max) {
	$("." + clazz).keyup(function () {
		validate($(this), min, max);
	});
}
function validate(obj, min, max) {
	obj.val(Math.max(min, Math.min(max, ~~obj.val())));
}
function clampLevelValue(level) {
	return Math.max(bounds.level[0], Math.min(bounds.level[1], level));
}
function getLevelCap(sourceInput) {
	var levelCapInput = sourceInput && sourceInput.length ? sourceInput : $(".level-cap").first();
	if (!levelCapInput.length) return bounds.level[1];

	var levelCap = parseInt(levelCapInput.val(), 10);
	if (Number.isNaN(levelCap)) levelCap = bounds.level[1];
	levelCap = clampLevelValue(levelCap);
	$(".level-cap").val(levelCap);
	return levelCap;
}
function isZeroLevelFlag(levelFlag) {
	return levelFlag === 0 || (typeof levelFlag === "string" && levelFlag.trim() === "0");
}
function isRelativeLevelFlag(levelFlag) {
	if (isZeroLevelFlag(levelFlag)) return true;
	return typeof levelFlag === "string" && /^[+-]\d+$/.test(levelFlag.trim());
}
function resolveSetLevelFlag(levelFlag, fallbackLevel) {
	var resolvedLevel;
	if (isZeroLevelFlag(levelFlag)) {
		resolvedLevel = getLevelCap();
	} else if (typeof levelFlag === "number" && Number.isFinite(levelFlag)) {
		resolvedLevel = Math.round(levelFlag);
	} else if (isRelativeLevelFlag(levelFlag)) {
		resolvedLevel = getLevelCap() + parseInt(levelFlag, 10);
	} else {
		var parsedLevel = parseInt(levelFlag, 10);
		if (!Number.isNaN(parsedLevel)) {
			resolvedLevel = parsedLevel;
		} else {
			var parsedFallback = parseInt(fallbackLevel, 10);
			resolvedLevel = Number.isNaN(parsedFallback) ? getLevelCap() : parsedFallback;
		}
	}
	return clampLevelValue(resolvedLevel);
}
function refreshRelativeSetLevels() {
	$(".poke-info").each(function () {
		var poke = $(this);
		var levelFlag = poke.attr("data-level-flag");
		if (!isRelativeLevelFlag(levelFlag)) return;
		poke.find(".level").val(resolveSetLevelFlag(levelFlag, poke.find(".level").val()));
		calcHP(poke);
		calcStats(poke);
	});
}

$("input:radio[name='format']").change(function () {
	var gameType = $("input:radio[name='format']:checked").val();
	if (gameType === 'Singles') {
		$("input:checkbox[name='ruin']:checked").prop("checked", false);
	}
	$(".format-specific." + gameType.toLowerCase()).each(function () {
		if ($(this).hasClass("gen-specific") && !$(this).hasClass("g" + gen)) {
			return;
		}
		$(this).show();
	});
	$(".format-specific").not("." + gameType.toLowerCase()).hide();
	setDoubleIconVisibility(gameType === "Doubles");
});

// auto-calc stats and current HP on change
$(".level").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcHP(poke);
	calcStats(poke);
});
$(".level-cap").bind("input keyup change", function () {
	validate($(this), bounds.level[0], bounds.level[1]);
	getLevelCap($(this));
	refreshRelativeSetLevels();
});
$(".nature").bind("keyup change", function () {
	calcStats($(this).closest(".poke-info"));
});
$(".hp .base, .hp .evs, .hp .ivs").bind("keyup change", function () {
	calcHP($(this).closest(".poke-info"));
});
$(".at .base, .at .evs, .at .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'at');
});
$(".df .base, .df .evs, .df .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'df');
});
$(".sa .base, .sa .evs, .sa .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'sa');
});
$(".sd .base, .sd .evs, .sd .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'sd');
});
$(".sp .base, .sp .evs, .sp .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'sp');
});
$(".sl .base").keyup(function () {
	calcStat($(this).closest(".poke-info"), 'sl');
});
$(".at .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'at');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".df .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'df');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".sa .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'sa');
	poke.find(".sd .dvs").val($(this).val());
	calcStat(poke, 'sd');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".sp .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'sp');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".stat-changer").on("click", function (ev) {
	ev.preventDefault();
	var boostSelector = $(this).closest("tr").find(".boost");
	if (!boostSelector.length) return;
	var currentBoost = parseInt(boostSelector.val(), 10);
	if (Number.isNaN(currentBoost)) currentBoost = 0;
	var delta = $(this).text().trim() === "+" ? 1 : -1;
	var nextBoost = Math.max(-6, Math.min(6, currentBoost + delta));
	boostSelector.val(String(nextBoost)).change();
});
$(".sl .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'sl');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});

function getHPDVs(poke) {
	return (~~poke.find(".at .dvs").val() % 2) * 8 +
		(~~poke.find(".df .dvs").val() % 2) * 4 +
		(~~poke.find(".sp .dvs").val() % 2) * 2 +
		(~~poke.find(gen === 1 ? ".sl .dvs" : ".sa .dvs").val() % 2);
}

function calcStats(poke) {
	for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
		calcStat(poke, LEGACY_STATS[gen][i]);
	}
}

function calcCurrentHP(poke, max, percent, skipDraw) {
	var current = Math.round(Number(percent) * Number(max) / 100);
	poke.find(".current-hp").val(current);
	if (!skipDraw) drawHealthBar(poke, max, current);
	return current;
}
function calcPercentHP(poke, max, current, skipDraw) {
	var percent = Math.round(100 * Number(current) / Number(max));
	if (percent === 0 && current > 0) {
		percent = 1;
	} else if (percent === 100 & current < max) {
		percent = 99;
	}

	poke.find(".percent-hp").val(percent);
	if (!skipDraw) drawHealthBar(poke, max, current);
	return percent;
}
function applySetPreHp(poke, set) {
	if (!set || typeof set.prehp === "undefined" || set.prehp === null || set.prehp === "") return;
	var max = parseInt(poke.find(".max-hp").text(), 10);
	var prehp = parseInt(set.prehp, 10);
	if (Number.isNaN(max) || max <= 0 || Number.isNaN(prehp)) return;
	prehp = Math.max(0, Math.min(max, prehp));
	poke.find(".current-hp").val(prehp);
	calcPercentHP(poke, max, prehp);
}
function normalizeSetStatusValue(value) {
	if (typeof value === "undefined" || value === null) return "";
	var normalized = String(value).trim().toLowerCase();
	if (!normalized) return "";
	if (normalized === "healthy" || normalized === "none") return "Healthy";
	if (normalized === "burn" || normalized === "burned" || normalized === "brn") return "Burned";
	if (normalized === "poison" || normalized === "poisoned" || normalized === "psn") return "Poisoned";
	if (normalized === "badly poisoned" || normalized === "toxic" || normalized === "tox") return "Badly Poisoned";
	if (normalized === "paralyze" || normalized === "paralyzed" || normalized === "par") return "Paralyzed";
	if (normalized === "sleep" || normalized === "asleep" || normalized === "slp") return "Asleep";
	if (normalized === "freeze" || normalized === "frozen" || normalized === "frz") return "Frozen";
	if (normalized === "frostbite" || normalized === "frostbitten" || normalized === "frb") return "Frostbite";
	return "";
}
function applySetStatus(poke, set) {
	if (!set) return;
	var statusValue = normalizeSetStatusValue(set.status);
	if (!statusValue) return;
	poke.find(".status").val(statusValue);
	poke.find(".status").change();
	if (statusValue !== "Badly Poisoned") poke.find(".toxic-counter").val(0);
}
function drawHealthBar(poke, max, current) {
	var fillPercent = 100 * current / max;
	var fillColor = fillPercent > 50 ? "green" : fillPercent > 20 ? "yellow" : "red";

	var healthbar = poke.find(".hpbar");
	healthbar.addClass("hp-" + fillColor);
	var unwantedColors = ["green", "yellow", "red"];
	unwantedColors.splice(unwantedColors.indexOf(fillColor), 1);
	for (var i = 0; i < unwantedColors.length; i++) {
		healthbar.removeClass("hp-" + unwantedColors[i]);
	}
	healthbar.css("background", "linear-gradient(to right, " + fillColor + " " + fillPercent + "%, white 0%");
}
// TODO: these HP inputs should really be input type=number with min=0, step=1, constrained by max=maxHP or 100
$(".current-hp").keyup(function () {
	var max = $(this).parent().children(".max-hp").text();
	validate($(this), 0, max);
	var current = $(this).val();
	calcPercentHP($(this).parent(), max, current);
});
$(".percent-hp").keyup(function () {
	var max = $(this).parent().children(".max-hp").text();
	validate($(this), 0, 100);
	var percent = $(this).val();
	calcCurrentHP($(this).parent(), max, percent);
});

$(".ability").bind("keyup change", function () {
	var pokeInfo = $(this).closest(".poke-info");
	updatePokeMoveHitsFromAbilityItem(pokeInfo);

	var ability = pokeInfo.find(".ability").val();
	var isProtoQuark = ability === 'Quark Drive' || ability === 'Protosynthesis';
	var protoQuarkState = pokeInfo.find(".proto-quark-state");
	var abilityToggle = pokeInfo.find(".abilityToggle");

	var TOGGLE_ABILITIES = ['Flash Fire', 'Electromorphosis', 'Intimidate', 'Illuminate', 'Minus', 'Plus', 'Slow Start', 'Unburden', 'Stakeout', 'Teraform Zero'];

	if (isProtoQuark) {
		protoQuarkState.prop("hidden", false).show();
		abilityToggle.prop("hidden", true).hide().prop("checked", protoQuarkState.val() !== 'inactive');
	} else if (TOGGLE_ABILITIES.indexOf(ability) >= 0) {
		abilityToggle.prop("hidden", false).show();
		if (ability === "Unburden") {
			abilityToggle.prop("checked", false);
		}
		protoQuarkState.val("auto").prop("hidden", true).hide();
	} else {
		abilityToggle.prop("hidden", true).hide().prop("checked", false);
		protoQuarkState.val("auto").prop("hidden", true).hide();
	}

	if (ability === "Supreme Overlord") {
		pokeInfo.find(".alliesFainted").prop("hidden", false).show();
	} else {
		pokeInfo.find(".alliesFainted").val('0');
		pokeInfo.find(".alliesFainted").prop("hidden", true).hide();

	}
	updateAllMoveMetaDisplays();
});
$(".proto-quark-state").bind("keyup change", function () {
	var pokeInfo = $(this).closest(".poke-info");
	var ability = pokeInfo.find(".ability").val();
	if (ability === 'Quark Drive' || ability === 'Protosynthesis') {
		pokeInfo.find(".abilityToggle").prop("checked", $(this).val() !== 'inactive');
	}
});

$("#p1 .ability").bind("keyup change", function () {
	autosetWeather($(this).val(), 0);
	autosetTerrain($(this).val(), 0);
});

var lastManualWeather = "";
var lastAutoWeather = ["", ""];
function autosetWeather(ability, i) {
	var currentWeather = $("input:radio[name='weather']:checked").val();
	if (lastAutoWeather.indexOf(currentWeather) === -1) {
		lastManualWeather = currentWeather;
		lastAutoWeather[1 - i] = "";
	}
	switch (ability) {
		case "Drought":
		case "Orichalcum Pulse":
			lastAutoWeather[i] = "Sun";
			$("#sun").prop("checked", true);
			break;
		case "Drizzle":
			lastAutoWeather[i] = "Rain";
			$("#rain").prop("checked", true);
			break;
		case "Sand Stream":
			lastAutoWeather[i] = "Sand";
			$("#sand").prop("checked", true);
			break;
		case "Snow Warning":
			if (gen >= 9) {
				lastAutoWeather[i] = "Snow";
				$("#snow").prop("checked", true);
			} else {
				lastAutoWeather[i] = "Hail";
				$("#hail").prop("checked", true);
			}
			break;
		case "Desolate Land":
			lastAutoWeather[i] = "Harsh Sunshine";
			$("#harsh-sunshine").prop("checked", true);
			break;
		case "Primordial Sea":
			lastAutoWeather[i] = "Heavy Rain";
			$("#heavy-rain").prop("checked", true);
			break;
		case "Delta Stream":
			lastAutoWeather[i] = "Strong Winds";
			$("#strong-winds").prop("checked", true);
			break;
		default:
			break;
	}
	applyTrainerFieldLocksForCurrentTrainer();
	syncTrainerFieldLockButtonStyles();
}

var lastAutoTerrain = ["", ""];
function autosetTerrain(ability, i) {
	var currentTerrain = $("input:checkbox[name='terrain']:checked").val() || "No terrain";
	if (lastAutoTerrain.indexOf(currentTerrain) === -1) {
		lastAutoTerrain[1 - i] = "";
	}
	// terrain input uses checkbox instead of radio, need to uncheck all first
	$("input:checkbox[name='terrain']:checked").prop("checked", false);
	switch (ability) {
		case "Electric Surge":
		case "Hadron Engine":
			lastAutoTerrain[i] = "Electric";
			$("#electric").prop("checked", true);
			break;
		case "Grassy Surge":
			lastAutoTerrain[i] = "Grassy";
			$("#grassy").prop("checked", true);
			break;
		case "Misty Surge":
			lastAutoTerrain[i] = "Misty";
			$("#misty").prop("checked", true);
			break;
		case "Psychic Surge":
			lastAutoTerrain[i] = "Psychic";
			$("#psychic").prop("checked", true);
			break;
		default:
			lastAutoTerrain[i] = "";
			var newTerrain = lastAutoTerrain[1 - i];
			if ("No terrain" !== newTerrain) {
				$("input:checkbox[name='terrain'][value='" + newTerrain + "']").prop("checked", true);
			}
			break;
	}
	applyTrainerFieldLocksForCurrentTrainer();
	syncTrainerFieldLockButtonStyles();
}

$("#p1 .item").bind("keyup change", function () {
	autosetStatus("#p1", getEffectiveItemFromPokeInfo($(this).closest(".poke-info")));
});

var lastManualStatus = { "#p1": "Healthy" };
var lastAutoStatus = { "#p1": "Healthy" };
function isIgnoreItemToggleChecked(pokeInfo) {
	var info = pokeInfo && pokeInfo.jquery ? pokeInfo : $(pokeInfo);
	return !!(info && info.length && info.find(".ignore-item-toggle").is(":checked"));
}
function getEffectiveItemFromPokeInfo(pokeInfo) {
	var info = pokeInfo && pokeInfo.jquery ? pokeInfo : $(pokeInfo);
	if (!info || !info.length) return "";
	return isIgnoreItemToggleChecked(info) ? "" : (info.find(".item").val() || "");
}
function updatePokeMoveHitsFromAbilityItem(pokeInfo) {
	var info = pokeInfo && pokeInfo.jquery ? pokeInfo : $(pokeInfo);
	if (!info || !info.length) return;
	var abilityValue = info.find(".ability").val();
	var itemValue = getEffectiveItemFromPokeInfo(info);
	var moveHits = abilityValue === "Skill Link" ? 5 : itemValue === "Loaded Dice" ? 4 : 3;
	info.find(".move-hits").val(moveHits);
}
function updatePokeMetronomeVisibilityFromItem(pokeInfo) {
	var info = pokeInfo && pokeInfo.jquery ? pokeInfo : $(pokeInfo);
	if (!info || !info.length) return;
	var itemValue = getEffectiveItemFromPokeInfo(info);
	var metronomeControl = info.find(".metronome");
	if (itemValue === "Metronome") {
		metronomeControl.show();
	} else {
		metronomeControl.hide();
	}
}
function autosetStatus(p, item) {
	var currentStatus = $(p + " .status").val();
	if (item === "Flame Orb") {
		lastAutoStatus[p] = "Burned";
		$(p + " .status").val("Burned");
		$(p + " .status").change();
	} else if (item === "Toxic Orb") {
		lastAutoStatus[p] = "Badly Poisoned";
		$(p + " .status").val("Badly Poisoned");
		$(p + " .status").change();
	}
}

$(".status").bind("keyup change", function () {
	if ($(this).val() === 'Badly Poisoned') {
		$(this).parent().children(".toxic-counter").show();
	} else {
		$(this).parent().children(".toxic-counter").hide();
	}
});

var lockerMove = "";
var MOVE_INFO_LOOKUP = {};
var MOVE_INFO_LOADING = false;
var MOVE_INFO_LOADED = false;
var FOG_ACCURACY_MULTIPLIER = 0.6;
var HUSTLE_ACCURACY_MULTIPLIER = 0.8;
var BRIGHT_POWDER_ACCURACY_MULTIPLIER = 0.9;
var WEATHER_EVASION_ACCURACY_MULTIPLIER = 0.8;
var WIDE_LENS_ACCURACY_MULTIPLIER = 1.1;
var ZOOM_LENS_ACCURACY_MULTIPLIER = 1.2;
var COMPOUND_EYES_ACCURACY_MULTIPLIER = 1.3;
var moveMetaVisible = true;

function normalizeMoveInfoKey(moveName) {
	if (typeof calc !== "undefined" && calc && typeof calc.toID === "function") {
		return calc.toID(moveName);
	}
	return String(moveName || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseMoveInfoNumericValue(lineText) {
	if (!lineText) return null;
	var cleaned = String(lineText).split("//")[0];
	var ternaryIndex = cleaned.indexOf("?");
	if (ternaryIndex >= 0) {
		var ternaryValue = cleaned.slice(ternaryIndex + 1).match(/-?\d+/);
		if (ternaryValue) return +ternaryValue[0];
	}
	var equalsValue = cleaned.match(/=\s*(-?\d+)/);
	if (equalsValue) return +equalsValue[1];
	var anyValue = cleaned.match(/-?\d+/);
	return anyValue ? +anyValue[0] : null;
}

function parseMovesInfoHeader(rawText) {
	var lookup = {};
	if (!rawText) return lookup;
	var blockRegex = /^\s*\[MOVE_[^\]]+\]\s*=\s*\{([\s\S]*?)^\s*\},/gm;
	var blockMatch;
	while ((blockMatch = blockRegex.exec(rawText)) !== null) {
		var blockText = blockMatch[1];
		var nameMatch = blockText.match(/\.name\s*=\s*COMPOUND_STRING\(\s*"([^"]+)"\s*\)/);
		if (!nameMatch) continue;
		var moveName = nameMatch[1];
		var accuracy = null;
		var pp = null;
		var blockLines = blockText.split(/\r?\n/);
		for (var i = 0; i < blockLines.length; i++) {
			var line = blockLines[i];
			if (accuracy === null && line.indexOf(".accuracy") !== -1) {
				accuracy = parseMoveInfoNumericValue(line);
			}
			if (pp === null && line.indexOf(".pp") !== -1) {
				pp = parseMoveInfoNumericValue(line);
			}
			if (accuracy !== null && pp !== null) break;
		}
		lookup[normalizeMoveInfoKey(moveName)] = {accuracy: accuracy, pp: pp};
	}
	lookup[normalizeMoveInfoKey("(No Move)")] = {accuracy: 0, pp: 0};
	return lookup;
}

function applyMoveInfoLookup(lookup) {
	if (!lookup || !Object.keys(lookup).length) return false;
	MOVE_INFO_LOOKUP = lookup;
	MOVE_INFO_LOADED = true;
	return true;
}

function loadMoveInfoLookup() {
	if (MOVE_INFO_LOADED || MOVE_INFO_LOADING) return;
	if (applyMoveInfoLookup(window.MOVE_INFO_STATIC_LOOKUP)) {
		updateAllMoveMetaDisplays();
		return;
	}
	var moveInfoPaths = ["./src/moves_info.h", "./moves_info.h", "./dist/moves_info.h", "../src/moves_info.h", "../moves_info.h"];
	MOVE_INFO_LOADING = true;
	var applyMoveInfoText = function(rawText) {
		var parsed = parseMovesInfoHeader(rawText);
		applyMoveInfoLookup(parsed);
		MOVE_INFO_LOADING = false;
		updateAllMoveMetaDisplays();
	};
	var tryLoadMoveInfoPath = function(pathIndex) {
		if (pathIndex >= moveInfoPaths.length) {
			MOVE_INFO_LOADING = false;
			updateAllMoveMetaDisplays();
			return;
		}
		$.ajax({url: moveInfoPaths[pathIndex], dataType: "text", cache: false})
			.done(applyMoveInfoText)
			.fail(function () {
				tryLoadMoveInfoPath(pathIndex + 1);
			});
	};
	tryLoadMoveInfoPath(0);
}

function getSelectedWeatherForMoveMeta() {
	return gen === 2
		? $("input:radio[name='gscWeather']:checked").val()
		: $("input:radio[name='weather']:checked").val();
}

function getMoveInfoForDisplay(moveName) {
	var normalized = normalizeMoveInfoKey(moveName);
	var info = MOVE_INFO_LOOKUP[normalized];
	if (!info && HIDDEN_POWER_REGEX.test(moveName)) {
		info = MOVE_INFO_LOOKUP[normalizeMoveInfoKey("Hidden Power")];
	}
	return info || null;
}

function parseDisplayedSpeedValue(speedNode) {
	if (!speedNode || !speedNode.length) return NaN;
	var speedValue = parseInt($.trim(speedNode.first().text()), 10);
	return isFinite(speedValue) ? speedValue : NaN;
}

function doesZoomLensApply(attackerInfo, defenderInfo) {
	if (!attackerInfo || !attackerInfo.length || !defenderInfo || !defenderInfo.length) return false;
	var attackerSpeedNode = attackerInfo.find(".sp .totalMod").first();
	if (attackerSpeedNode.hasClass("speed-slower")) return true;
	if (attackerSpeedNode.hasClass("speed-faster") || attackerSpeedNode.hasClass("speed-tie")) return false;
	var attackerSpeed = parseDisplayedSpeedValue(attackerSpeedNode);
	var defenderSpeed = parseDisplayedSpeedValue(defenderInfo.find(".sp .totalMod").first());
	if (!isFinite(attackerSpeed) || !isFinite(defenderSpeed) || attackerSpeed === defenderSpeed) return false;
	var trickRoomActive = $("#trickroom").prop("checked") || $("#trickRoomR").prop("checked");
	return trickRoomActive ? attackerSpeed > defenderSpeed : attackerSpeed < defenderSpeed;
}

function getDisplayedMoveAccuracy(moveAccuracy, weatherValue, moveGroupObj, moveCategory) {
	if (typeof moveAccuracy !== "number" || moveAccuracy <= 0) return "--";
	var accuracyMultiplier = 1;
	if (weatherValue === "Fog") accuracyMultiplier *= FOG_ACCURACY_MULTIPLIER;
	var attackerInfo = moveGroupObj.closest(".poke-info");
	var attackerItem = getEffectiveItemFromPokeInfo(attackerInfo);
	var ability = attackerInfo.find(".ability").val();
	if (ability === "Hustle" && moveCategory === "Physical") accuracyMultiplier *= HUSTLE_ACCURACY_MULTIPLIER;
	if (ability === "Compound Eyes") accuracyMultiplier *= COMPOUND_EYES_ACCURACY_MULTIPLIER;
	if (attackerItem === "Wide Lens") accuracyMultiplier *= WIDE_LENS_ACCURACY_MULTIPLIER;
	var attackerId = attackerInfo.attr("id");
	var defenderInfo = attackerId === "p1"
		? $("#p2")
		: attackerId === "p2"
			? $("#p1")
			: $(".poke-info").not(attackerInfo).first();
	if (attackerItem === "Zoom Lens" && doesZoomLensApply(attackerInfo, defenderInfo)) {
		accuracyMultiplier *= ZOOM_LENS_ACCURACY_MULTIPLIER;
	}
	if (defenderInfo.length) {
		var defenderAbility = defenderInfo.find(".ability").val();
		if (getEffectiveItemFromPokeInfo(defenderInfo) === "Bright Powder") {
			accuracyMultiplier *= BRIGHT_POWDER_ACCURACY_MULTIPLIER;
		}
		if (weatherValue === "Sand" && defenderAbility === "Sand Veil") {
			accuracyMultiplier *= WEATHER_EVASION_ACCURACY_MULTIPLIER;
		}
		if ((weatherValue === "Snow" || weatherValue === "Hail") && defenderAbility === "Snow Cloak") {
			accuracyMultiplier *= WEATHER_EVASION_ACCURACY_MULTIPLIER;
		}
	}
	if (accuracyMultiplier !== 1) {
		return String(Math.max(1, Math.floor(moveAccuracy * accuracyMultiplier))) + "%";
	}
	return String(moveAccuracy) + "%";
}

function getDisplayedMovePP(basePP, moveGroupObj) {
	if (typeof basePP !== "number" || basePP < 0) return "--";
	var attackerInfo = moveGroupObj.closest(".poke-info");
	if (attackerInfo.length && attackerInfo.attr("id") === "p2") {
		return String(Math.floor(basePP * 8 / 5));
	}
	return String(basePP);
}

function ensureMoveMetaForGroup(moveGroupObj) {
	var moveMeta = moveGroupObj.children(".move-meta");
	if (moveMeta.length) return moveMeta.first();
	moveMeta = $('<span class="move-meta" title="Move PP and accuracy">PP -- | ACC --</span>');
	var moveZ = moveGroupObj.children(".move-z");
	if (moveZ.length) {
		moveZ.after(moveMeta);
	} else {
		moveGroupObj.append(moveMeta);
	}
	return moveMeta;
}

function applyMoveMetaVisibility() {
	$(".move-meta").toggle(!!moveMetaVisible);
	$(".move-crit-rate-display").toggle(!!moveMetaVisible);
}

function setMoveMetaVisibility(enabled) {
	moveMetaVisible = !!enabled;
	var toggle = $("#settings-move-meta");
	if (toggle.length) toggle.prop("checked", moveMetaVisible);
	applyMoveMetaVisibility();
}

function updateMoveMetaForGroup(moveGroupObj) {
	var moveMeta = ensureMoveMetaForGroup(moveGroupObj);
	if (!moveMetaVisible) {
		moveMeta.hide();
		return;
	}
	moveMeta.show();
	var moveName = moveGroupObj.children("select.move-selector").val() || "(No Move)";
	var weather = getSelectedWeatherForMoveMeta();
	var info = getMoveInfoForDisplay(moveName);
	var moveData = moves[moveName] || moves["(No Move)"] || {};
	var moveCategory = moveGroupObj.children(".move-cat").val() || moveData.category || "";
	var ppText = "--";
	var accText = "--";
	if (info) {
		if (typeof info.pp === "number" && info.pp >= 0) ppText = getDisplayedMovePP(info.pp, moveGroupObj);
		accText = getDisplayedMoveAccuracy(info.accuracy, weather, moveGroupObj, moveCategory);
	}
	moveMeta.text("PP " + ppText + " | ACC " + accText);
}

function updateAllMoveMetaDisplays() {
	$(".poke-info .move1, .poke-info .move2, .poke-info .move3, .poke-info .move4").each(function () {
		updateMoveMetaForGroup($(this));
	});
	applyMoveMetaVisibility();
}

// auto-update move details on select
$(".move-selector").change(function () {
	var moveName = $(this).val();
	var move = moves[moveName] || moves['(No Move)'];
	var moveGroupObj = $(this).parent();
	moveGroupObj.children(".move-bp").val(moveName === 'Present' ? 40 : move.bp);
	var m = moveName.match(HIDDEN_POWER_REGEX);
	if (m) {
		var pokeObj = $(this).closest(".poke-info");
		var pokemon = createPokemon(pokeObj);
		var actual = calc.Stats.getHiddenPower(GENERATION, pokemon.ivs);
		if (actual.type !== m[1]) {
			var hpIVs = calc.Stats.getHiddenPowerIVs(GENERATION, m[1]);
			if (hpIVs && gen < 7) {
				for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
					var legacyStat = LEGACY_STATS[gen][i];
					var stat = legacyStatToStat(legacyStat);
					pokeObj.find("." + legacyStat + " .ivs").val(hpIVs[stat] !== undefined ? hpIVs[stat] : 31);
					pokeObj.find("." + legacyStat + " .dvs").val(hpIVs[stat] !== undefined ? calc.Stats.IVToDV(hpIVs[stat]) : 15);
				}
				if (gen < 3) {
					var hpDV = calc.Stats.getHPDV({
						atk: pokeObj.find(".at .ivs").val(),
						def: pokeObj.find(".df .ivs").val(),
						spe: pokeObj.find(".sp .ivs").val(),
						spc: pokeObj.find(".sa .ivs").val()
					});
					pokeObj.find(".hp .ivs").val(calc.Stats.DVToIV(hpDV));
					pokeObj.find(".hp .dvs").val(hpDV);
				}
				pokeObj.change();
				moveGroupObj.children(".move-bp").val(gen >= 6 ? 60 : 70);
			}
		} else {
			moveGroupObj.children(".move-bp").val(actual.power);
		}
	} else if (gen >= 2 && gen <= 6 && HIDDEN_POWER_REGEX.test($(this).attr('data-prev'))) {
		// If this selector was previously Hidden Power but now isn't, reset all IVs/DVs to max.
		var pokeObj = $(this).closest(".poke-info");
		for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
			var legacyStat = LEGACY_STATS[gen][i];
			pokeObj.find("." + legacyStat + " .ivs").val(31);
			pokeObj.find("." + legacyStat + " .dvs").val(15);
		}
	}
	$(this).attr('data-prev', moveName);
	moveGroupObj.children(".move-type").val(move.type);
	moveGroupObj.children(".move-cat").val(move.category);
	moveGroupObj.children(".move-crit").prop("checked", move.willCrit === true);
	var linkedTopCritToggle = getTopCritToggleFromBattleToggle(moveGroupObj.children(".move-crit").get(0));
	if (linkedTopCritToggle) linkedTopCritToggle.checked = move.willCrit === true;

	var stat = move.category === 'Special' ? 'spa' : 'atk';
	var dropsStats =
		move.self && move.self.boosts && move.self.boosts[stat] && move.self.boosts[stat] < 0;
	if (Array.isArray(move.multihit)) {
		moveGroupObj.children(".stat-drops").hide();
		moveGroupObj.children(".move-hits").show();
		var pokemon = $(this).closest(".poke-info");
		var moveHits =
		pokemon.find(".ability").val() === 'Skill Link' ? 5 :
			getEffectiveItemFromPokeInfo(pokemon) === 'Loaded Dice' ? 4 : 3;
		moveGroupObj.children(".move-hits").val(moveHits);
	} else if (dropsStats) {
		moveGroupObj.children(".move-hits").hide();
		moveGroupObj.children(".stat-drops").show();
	} else {
		moveGroupObj.children(".move-hits").hide();
		moveGroupObj.children(".stat-drops").hide();
	}
	moveGroupObj.children(".move-z").prop("checked", false);
	updateMoveMetaForGroup(moveGroupObj);
});

$("input:radio[name='weather'], input:radio[name='gscWeather']").change(function () {
	updateAllMoveMetaDisplays();
});
$(".move-cat").change(function () {
	updateMoveMetaForGroup($(this).parent());
});

$(".item").change(function () {
	var pokeInfo = $(this).closest(".poke-info");
	var pokeId = String(pokeInfo.attr("id") || "");
	var itemName = getEffectiveItemFromPokeInfo(pokeInfo);
	updatePokeMetronomeVisibilityFromItem(pokeInfo);
	updatePokeMoveHitsFromAbilityItem(pokeInfo);
	if (pokeId === "p1" || pokeId === "p2") {
		autosetStatus("#" + pokeId, itemName);
	}
	updateAllMoveMetaDisplays();
});

$(".ignore-item-toggle").change(function () {
	var pokeInfo = $(this).closest(".poke-info");
	var pokeId = String(pokeInfo.attr("id") || "");
	updatePokeMetronomeVisibilityFromItem(pokeInfo);
	updatePokeMoveHitsFromAbilityItem(pokeInfo);
	if (pokeId === "p1" || pokeId === "p2") {
		autosetStatus("#" + pokeId, getEffectiveItemFromPokeInfo(pokeInfo));
	}
	var itemControl = pokeInfo.find(".item").get(0);
	if (itemControl) getTerrainEffects.call(itemControl);
	updateAllMoveMetaDisplays();
});

var ASTRALDEX_BASE_URL = "https://astral-dex.vercel.app/";
var ASTRALDEX_TOP_CHROME_PX = 52;
var APP_SETTINGS_STORAGE_KEY = "astralCalcSettings";
var FRAG_SHEET_STORAGE_KEY = "astralCalcFragSheet";
var NOTES_BOARD_STORAGE_KEY = "astralCalcNotesBoard";
var FAQ_ENTRIES = [
	// Add player-facing FAQ entries here:
	{
		question: "How do I use the frag sheet?",
		answer: "Open Frag Sheet from the top buttons. It tracks which of your Pokemon get kills, shows totals and current-fight frags, and updates when you add frags from the Pokemon sprites."
	},
	{
		question: "How do I add a frag?",
		answer: "Right click a Pokemon's sprite on your side, choose the target Pokemon from the Log Frag menu, then press Add Frag. You can also use Did This Mon Die? from that menu when you want to mark the selected enemy as dead."
	},
	{
		question: "How do I remove a frag?",
		answer: "Open Frag Sheet, use Fullscreen if you need more room, then open Edit kills on the Pokemon that has the wrong frag. Press -1 next to the target you want to remove."
	},
	{
		question: "How do I merge frags with an evolution line?",
		answer: "Drag the earlier evolution onto the later evolution in the same line. For example, drag Charmander onto Charmeleon or Charizard to move the earlier form's frags into the evolved form."
	},
	{
		question: "Why does Terrain keep disabling?",
		answer: "Trainer selection can auto sync terrain from the current enemy set. If you want terrain to stay fixed for that trainer fight, right click the terrain button to lock it."
	},
	{
		question: "What does selecting starter choices in the calc do?",
		answer: "The Starter setting tells the calc which starter you chose, so rival fights show the matching rival team and starter dependent sets for your route."
	}
];
var FRAG_SHEET_STATES_STORAGE_KEY = "astralCalcFragSheetStates";
var FRAG_SHEET_BACKUPS_STORAGE_KEY = "astralCalcFragSheetBackups";
var AE_LUA_FRAG_IMPORTED_EVENTS_STORAGE_KEY = "astralCalcAeLuaFragImportedEvents";
var AE_LUA_FRAG_IMPORT_INTERVAL_MS = 2500;
var AE_LUA_FRAG_LIVE_URL = "http://127.0.0.1:31124/update";
var AE_LUA_FRAG_ACK_URL = "http://127.0.0.1:31124/frag";
var AE_LUA_POKEMON_URL = "http://127.0.0.1:31124/pokemon";
var AE_LUA_POKEMON_SET_PREFIX = "ae_lua";
var AE_LUA_TEAM_BINDINGS_STORAGE_KEY = "astralCalcAeLuaTeamBindings";
var AE_LUA_FULL_ROSTER_INTERVAL_MS = 10000;
var AE_LUA_FULL_ROSTER_PAGE_SIZE = 20;
var TRAINER_FIELD_LOCKS_STORAGE_KEY = "astralCalcTrainerFieldLocks";
var FIELD_LOCK_GLOBAL_KEY = "global";
var LAST_ENCOUNTER_STORAGE_KEY = "astralCalcLastEncounter";
var PLAYER_ROSTER_LAYOUT_STORAGE_KEY = "astralCalcPlayerRosterLayout";
var CALC_SIDE_PANEL_MIN_WIDTH_PX = 360;
var CALC_SIDE_PANEL_MAX_WIDTH_VW = 96;
var CALC_SIDE_PANEL_MIN_MAIN_WIDTH_PX = 620;
var APP_UPDATE_CHECK_INTERVAL_MS = 120000;
var APP_UPDATE_INITIAL_CHECK_DELAY_MS = 12000;
var FRAG_SHEET_STATES_LIMIT = 40;
var FRAG_SHEET_BACKUPS_LIMIT = 90;
var FRAG_SHEET_BACKUP_COOLDOWN_MS = 12000;
var TRAINER_FIELD_LOCKABLE_IDS = {
	electric: true,
	grassy: true,
	misty: true,
	psychic: true,
	beads: true,
	tablets: true,
	sword: true,
	vessel: true,
	clear: true,
	sun: true,
	rain: true,
	sand: true,
	snow: true,
	hail: true,
	fog: true,
	"harsh-sunshine": true,
	"heavy-rain": true,
	"strong-winds": true,
	gscClear: true,
	gscSun: true,
	gscRain: true,
	gscSand: true,
	magicroom: true,
	trickroom: true,
	wonderroom: true,
	gravity: true,
	inverse: true
};
var TRAINER_FIELD_LOCK_EXCLUDED_IDS = {
	"singles-format": true,
	"doubles-format": true
};
var STARTER_CHOICES = ["chikorita", "tepig", "totodile"];
var RIVAL_STARTER_BY_CHOICE = {
	chikorita: "tepig",
	tepig: "totodile",
	totodile: "chikorita"
};
var appSettingsCache = null;
var fragSheetState = null;
var notesBoardState = null;
var fragContextSourceSet = "";
var fragContextSourceElement = null;
var fragSheetAutoObserver = null;
var fragSheetRefreshTimer = null;
var playerRosterSearchDebounceTimer = null;
var notesNoteInputDebounceTimers = {};
var appUpdateBaselineLastModifiedMs = 0;
var appUpdateBaselinePageSignature = "";
var appUpdateBaselineVersionToken = "";
var appUpdateCheckTimer = null;
var appUpdateNoticeShown = false;
var appUpdatePageUrl = "";
var appUpdateVersionUrl = "";
var fragLastAutoBackupAt = 0;
var trainerFieldLocksCache = null;
var trainerFieldLockActiveTrainerKey = "";
var isApplyingTrainerFieldLocks = false;
var fragsHistoryExpanded = false;
var aeLuaFragWatchedFileHandle = null;
var aeLuaFragWatchedFileTimer = null;
var aeLuaFragWatchedFileSignature = "";
var aeLuaFragLastPayload = null;
var aeLuaResolvedTrainerFight = null;
var aeLuaPokemonImportSignatures = {};
var aeLuaPokemonLastFullRosterAt = 0;
var aeLuaPokemonFullRosterPromise = null;
var aeLuaFragLiveTimer = null;
var aeLuaFragLiveConnected = false;
var FRAG_UNKNOWN_VICTIM_KEY = "__unknown__";
var deadOpposingSetMap = {};
var opposingContextSourceSet = "";
var CURRENT_TRAINER_POKS = [];
var isRestoringLastEncounterSelection = false;
var isBootstrappingLastEncounterSelection = true;
var calcSidePanelResizeState = null;
var calcSideResizeCaptureNode = null;
var PLAYER_ROSTER_SPRITE_SELECTOR = "#team-poke-list .trainer-pok.left-side, #box-poke-list .trainer-pok.left-side, #box-poke-list2 .trainer-pok.left-side, #trash-box .trainer-pok.left-side";
var PLAYER_ROSTER_SEARCH_DEBOUNCE_MS = 90;
var NOTES_NOTE_INPUT_DEBOUNCE_MS = 120;
var SPECIES_DISPLAY_NAME_ALIASES = {
	"Tauros-Paldea-Blaze": "Tauros-PB",
	"Tauros-Paldea-Aqua": "Tauros-PA"
};
var TYPE_COLOR_MAP = {
	normal: "#A8A77A",
	fire: "#EE8130",
	water: "#6390F0",
	electric: "#F7D02C",
	grass: "#7AC74C",
	ice: "#96D9D6",
	fighting: "#C22E28",
	poison: "#A33EA1",
	ground: "#E2BF65",
	flying: "#A98FF3",
	psychic: "#F95587",
	bug: "#A6B91A",
	rock: "#B6A136",
	ghost: "#735797",
	dragon: "#6F35FC",
	dark: "#705746",
	steel: "#B7B7CE",
	fairy: "#D685AD",
	stellar: "#e0c066"
};

var FRAG_PREVO_BY_SPECIES_ID = {
	"abomasnow": "snover",
	"accelgor": "shelmet",
	"aegislash": "doublade",
	"aggron": "lairon",
	"alakazam": "kadabra",
	"alcremie": "milcery",
	"altaria": "swablu",
	"ambipom": "aipom",
	"amoonguss": "foongus",
	"ampharos": "flaaffy",
	"annihilape": "primeape",
	"appletun": "applin",
	"araquanid": "dewpider",
	"arbok": "ekans",
	"arboliva": "dolliv",
	"arcanine": "growlithe",
	"arcaninehisui": "growlithehisui",
	"archeops": "archen",
	"arctibax": "frigibax",
	"argalis": "cupra",
	"arghonaut": "privatyke",
	"ariados": "spinarak",
	"armaldo": "anorith",
	"armarouge": "charcadet",
	"aromatisse": "spritzee",
	"astrolotl": "solotl",
	"aurorus": "amaura",
	"aurumoth": "argalis",
	"avalugg": "bergmite",
	"avalugghisui": "bergmite",
	"azumarill": "marill",
	"banette": "shuppet",
	"barbaracle": "binacle",
	"barraskewda": "arrokuda",
	"basculegion": "basculinwhitestriped",
	"basculegionf": "basculinwhitestriped",
	"bastiodon": "shieldon",
	"baxcalibur": "arctibax",
	"bayleef": "chikorita",
	"beartic": "cubchoo",
	"beautifly": "silcoon",
	"beedrill": "kakuna",
	"beheeyem": "elgyem",
	"bellibolt": "tadbulb",
	"bellossom": "gloom",
	"bewear": "stufful",
	"bibarel": "bidoof",
	"bisharp": "pawniard",
	"blastoise": "wartortle",
	"blaziken": "combusken",
	"blissey": "chansey",
	"boldore": "roggenrola",
	"boltund": "yamper",
	"braixen": "fennekin",
	"brambleghast": "bramblin",
	"braviary": "rufflet",
	"braviaryhisui": "rufflet",
	"breloom": "shroomish",
	"brionne": "popplio",
	"bronzong": "bronzor",
	"butterfree": "metapod",
	"cacturne": "cacnea",
	"caimanoe": "floatoy",
	"camerupt": "numel",
	"caribolt": "electrelk",
	"carkol": "rolycoly",
	"carracosta": "tirtouga",
	"cascoon": "wurmple",
	"cawmodore": "cawdet",
	"centiskorch": "sizzlipede",
	"ceruledge": "charcadet",
	"cetitan": "cetoddle",
	"chandelure": "lampent",
	"chansey": "happiny",
	"charizard": "charmeleon",
	"charjabug": "grubbin",
	"charmeleon": "charmander",
	"cherrim": "cherubi",
	"chesnaught": "quilladin",
	"chimecho": "chingling",
	"cinccino": "minccino",
	"cinderace": "raboot",
	"clawitzer": "clauncher",
	"claydol": "baltoy",
	"clefable": "clefairy",
	"clefairy": "cleffa",
	"clodsire": "wooperpaldea",
	"cloyster": "shellder",
	"coalossal": "carkol",
	"cofagrigus": "yamask",
	"colossoil": "dorsoil",
	"combusken": "torchic",
	"conkeldurr": "gurdurr",
	"copperajah": "cufant",
	"coribalis": "swirlpool",
	"corviknight": "corvisquire",
	"corvisquire": "rookidee",
	"cosmoem": "cosmog",
	"crabominable": "crabrawler",
	"cradily": "lileep",
	"crawdaunt": "corphish",
	"crobat": "golbat",
	"crocalor": "fuecoco",
	"croconaw": "totodile",
	"crustle": "dwebble",
	"cursola": "corsolagalar",
	"cyclohm": "duohm",
	"dachsbun": "fidough",
	"darmanitan": "darumaka",
	"darmanitangalar": "darumakagalar",
	"dartrix": "rowlet",
	"decidueye": "dartrix",
	"decidueyehisui": "dartrix",
	"delcatty": "skitty",
	"delphox": "braixen",
	"dewgong": "seel",
	"dewott": "oshawott",
	"diggersby": "bunnelby",
	"dodrio": "doduo",
	"dolliv": "smoliv",
	"donphan": "phanpy",
	"dottler": "blipbug",
	"doublade": "honedge",
	"dragalge": "skrelp",
	"dragapult": "drakloak",
	"dragonair": "dratini",
	"dragonite": "dragonair",
	"drakloak": "dreepy",
	"drapion": "skorupi",
	"drednaw": "chewtle",
	"drifblim": "drifloon",
	"drizzile": "sobble",
	"dubwool": "wooloo",
	"dudunsparce": "dunsparce",
	"dudunsparcethreesegment": "dunsparce",
	"dugtrio": "diglett",
	"dugtrioalola": "diglettalola",
	"duohm": "monohm",
	"duosion": "solosis",
	"dusclops": "duskull",
	"dusknoir": "dusclops",
	"dustox": "cascoon",
	"eelektrik": "tynamo",
	"eelektross": "eelektrik",
	"eldegoss": "gossifleur",
	"electabuzz": "elekid",
	"electivire": "electabuzz",
	"electrelk": "fawnifer",
	"electrode": "voltorb",
	"electrodehisui": "voltorbhisui",
	"emboar": "pignite",
	"empoleon": "prinplup",
	"equilibra": "justyke",
	"escavalier": "karrablast",
	"espathra": "flittle",
	"espeon": "eevee",
	"excadrill": "drilbur",
	"exeggutor": "exeggcute",
	"exeggutoralola": "exeggcute",
	"exploud": "loudred",
	"farigiraf": "girafarig",
	"fearow": "spearow",
	"feraligatr": "croconaw",
	"ferrothorn": "ferroseed",
	"fidgit": "breezi",
	"flaaffy": "mareep",
	"flapple": "applin",
	"flarelm": "embirch",
	"flareon": "eevee",
	"fletchinder": "fletchling",
	"floatzel": "buizel",
	"floette": "flabeu0301beu0301",
	"floragato": "sprigatito",
	"florges": "floette",
	"flygon": "vibrava",
	"forretress": "pineco",
	"fraxure": "axew",
	"frogadier": "froakie",
	"froslass": "snorunt",
	"frosmoth": "snom",
	"furret": "sentret",
	"gabite": "gible",
	"gallade": "kirlia",
	"galvantula": "joltik",
	"garbodor": "trubbish",
	"garchomp": "gabite",
	"gardevoir": "kirlia",
	"garganacl": "naclstack",
	"gastrodon": "shellos",
	"gengar": "haunter",
	"gholdengo": "gimmighoul",
	"gigalith": "boldore",
	"glaceon": "eevee",
	"glalie": "snorunt",
	"glimmora": "glimmet",
	"gliscor": "gligar",
	"gloom": "oddish",
	"gogoat": "skiddo",
	"golbat": "zubat",
	"golduck": "psyduck",
	"golem": "graveler",
	"golemalola": "graveleralola",
	"golisopod": "wimpod",
	"golurk": "golett",
	"goodra": "sliggoo",
	"goodrahisui": "sliggoohisui",
	"gorebyss": "clamperl",
	"gothitelle": "gothorita",
	"gothorita": "gothita",
	"gourgeist": "pumpkaboo",
	"gourgeistlarge": "pumpkaboolarge",
	"gourgeistsmall": "pumpkaboosmall",
	"gourgeistsuper": "pumpkaboosuper",
	"grafaiai": "shroodle",
	"granbull": "snubbull",
	"grapploct": "clobbopus",
	"graveler": "geodude",
	"graveleralola": "geodudealola",
	"greedent": "skwovet",
	"greninja": "frogadier",
	"grimmsnarl": "morgrem",
	"grotle": "turtwig",
	"grovyle": "treecko",
	"grumpig": "spoink",
	"gumshoos": "yungoos",
	"gurdurr": "timburr",
	"gyarados": "magikarp",
	"hakamoo": "jangmoo",
	"hariyama": "makuhita",
	"hatterene": "hattrem",
	"hattrem": "hatenna",
	"haunter": "gastly",
	"haxorus": "fraxure",
	"heliolisk": "helioptile",
	"herdier": "lillipup",
	"hippowdon": "hippopotas",
	"hitmonchan": "tyrogue",
	"hitmonlee": "tyrogue",
	"hitmontop": "tyrogue",
	"honchkrow": "murkrow",
	"houndoom": "houndour",
	"houndstone": "greavard",
	"huntail": "clamperl",
	"hydreigon": "zweilous",
	"hypno": "drowzee",
	"incineroar": "torracat",
	"infernape": "monferno",
	"inteleon": "drizzile",
	"ivysaur": "bulbasaur",
	"jellicent": "frillish",
	"jigglypuff": "igglybuff",
	"jolteon": "eevee",
	"jumbao": "mumbao",
	"jumpluff": "skiploom",
	"jynx": "smoochum",
	"kabutops": "kabuto",
	"kadabra": "abra",
	"kakuna": "weedle",
	"kerfluffle": "pluffle",
	"kilowattrel": "wattrel",
	"kingambit": "bisharp",
	"kingdra": "seadra",
	"kingler": "krabby",
	"kirlia": "ralts",
	"kitsunoh": "nohface",
	"klang": "klink",
	"kleavor": "scyther",
	"klinklang": "klang",
	"kommoo": "hakamoo",
	"kricketune": "kricketot",
	"krilowatt": "protowatt",
	"krokorok": "sandile",
	"krookodile": "krokorok",
	"lairon": "aron",
	"lampent": "litwick",
	"lanturn": "chinchou",
	"leafeon": "eevee",
	"leavanny": "swadloon",
	"ledian": "ledyba",
	"lickilicky": "lickitung",
	"liepard": "purrloin",
	"lilligant": "petilil",
	"lilliganthisui": "petilil",
	"linoone": "zigzagoon",
	"linoonegalar": "zigzagoongalar",
	"lokix": "nymble",
	"lombre": "lotad",
	"lopunny": "buneary",
	"loudred": "whismur",
	"lucario": "riolu",
	"ludicolo": "lombre",
	"lumineon": "finneon",
	"lunala": "cosmoem",
	"lurantis": "fomantis",
	"luxio": "shinx",
	"luxray": "luxio",
	"lycanroc": "rockruff",
	"lycanrocdusk": "rockruff",
	"lycanrocmidnight": "rockruff",
	"mabosstiff": "maschiff",
	"machamp": "machoke",
	"machoke": "machop",
	"magcargo": "slugma",
	"magmar": "magby",
	"magmortar": "magmar",
	"magneton": "magnemite",
	"magnezone": "magneton",
	"malaconda": "brattler",
	"malamar": "inkay",
	"mamoswine": "piloswine",
	"mandibuzz": "vullaby",
	"manectric": "electrike",
	"mantine": "mantyke",
	"marill": "azurill",
	"marowak": "cubone",
	"marowakalola": "cubone",
	"marshtomp": "mudkip",
	"masquerain": "surskit",
	"maushold": "tandemaus",
	"mausholdfour": "tandemaus",
	"medicham": "meditite",
	"meganium": "bayleef",
	"meowscarada": "floragato",
	"meowstic": "espurr",
	"meowsticf": "espurr",
	"metagross": "metang",
	"metang": "beldum",
	"metapod": "caterpie",
	"miasmaw": "miasmite",
	"mienshao": "mienfoo",
	"mightyena": "poochyena",
	"milotic": "feebas",
	"mismagius": "misdreavus",
	"monferno": "chimchar",
	"morgrem": "impidimp",
	"mothim": "burmy",
	"mrmime": "mimejr",
	"mrmimegalar": "mimejr",
	"mrrime": "mrmimegalar",
	"mudsdale": "mudbray",
	"muk": "grimer",
	"mukalola": "grimeralola",
	"musharna": "munna",
	"naclstack": "nacli",
	"naganadel": "poipole",
	"naviathan": "caimanoe",
	"necturna": "necturine",
	"nidoking": "nidorino",
	"nidoqueen": "nidorina",
	"nidorina": "nidoranf",
	"nidorino": "nidoranm",
	"ninetales": "vulpix",
	"ninetalesalola": "vulpixalola",
	"ninjask": "nincada",
	"noctowl": "hoothoot",
	"noivern": "noibat",
	"nuzleaf": "seedot",
	"obstagoon": "linoonegalar",
	"octillery": "remoraid",
	"oinkologne": "lechonk",
	"oinkolognef": "lechonk",
	"omastar": "omanyte",
	"orbeetle": "dottler",
	"overqwil": "qwilfishhisui",
	"palafin": "finizen",
	"palossand": "sandygast",
	"palpitoad": "tympole",
	"pangoro": "pancham",
	"parasect": "paras",
	"pawmo": "pawmi",
	"pawmot": "pawmo",
	"pelipper": "wingull",
	"perrserker": "meowthgalar",
	"persian": "meowth",
	"persianalola": "meowthalola",
	"pidgeot": "pidgeotto",
	"pidgeotto": "pidgey",
	"pignite": "tepig",
	"pikachu": "pichu",
	"piloswine": "swinub",
	"plasmanta": "snugglow",
	"politoed": "poliwhirl",
	"poliwhirl": "poliwag",
	"poliwrath": "poliwhirl",
	"polteageist": "sinistea",
	"polteageistantique": "sinisteaantique",
	"porygon2": "porygon",
	"porygonz": "porygon2",
	"primarina": "brionne",
	"primeape": "mankey",
	"prinplup": "piplup",
	"probopass": "nosepass",
	"pupitar": "larvitar",
	"purugly": "glameow",
	"pyroak": "flarelm",
	"pyroar": "litleo",
	"quagsire": "wooper",
	"quaquaval": "quaxwell",
	"quaxwell": "quaxly",
	"quilava": "cyndaquil",
	"quilladin": "chespin",
	"raboot": "scorbunny",
	"rabsca": "rellor",
	"raichu": "pikachu",
	"raichualola": "pikachu",
	"rampardos": "cranidos",
	"rapidash": "ponyta",
	"rapidashgalar": "ponytagalar",
	"raticate": "rattata",
	"raticatealola": "rattataalola",
	"reuniclus": "duosion",
	"revavroom": "varoom",
	"rhydon": "rhyhorn",
	"rhyperior": "rhydon",
	"ribombee": "cutiefly",
	"rillaboom": "thwackey",
	"roselia": "budew",
	"roserade": "roselia",
	"runerigus": "yamaskgalar",
	"saharaja": "saharascal",
	"salamence": "shelgon",
	"salazzle": "salandit",
	"samurott": "dewott",
	"samurotthisui": "dewott",
	"sandaconda": "silicobra",
	"sandslash": "sandshrew",
	"sandslashalola": "sandshrewalola",
	"sawsbuck": "deerling",
	"sceptile": "grovyle",
	"scizor": "scyther",
	"scolipede": "whirlipede",
	"scovillain": "capsakid",
	"scrafty": "scraggy",
	"seadra": "horsea",
	"seaking": "goldeen",
	"sealeo": "spheal",
	"seismitoad": "palpitoad",
	"serperior": "servine",
	"servine": "snivy",
	"sharpedo": "carvanha",
	"shedinja": "nincada",
	"shelgon": "bagon",
	"shiftry": "nuzleaf",
	"shiinotic": "morelull",
	"silcoon": "wurmple",
	"silvally": "typenull",
	"simipour": "panpour",
	"simisage": "pansage",
	"simisear": "pansear",
	"sirfetchu2019d": "farfetchu2019dgalar",
	"skeledirge": "crocalor",
	"skiploom": "hoppip",
	"skuntank": "stunky",
	"slaking": "vigoroth",
	"sliggoo": "goomy",
	"sliggoohisui": "goomy",
	"slowbro": "slowpoke",
	"slowbrogalar": "slowpokegalar",
	"slowking": "slowpoke",
	"slowkinggalar": "slowpokegalar",
	"slurpuff": "swirlix",
	"smoguana": "smogecko",
	"smokomodo": "smoguana",
	"snaelstrom": "coribalis",
	"sneasler": "sneaselhisui",
	"snorlax": "munchlax",
	"solgaleo": "cosmoem",
	"spewpa": "scatterbug",
	"spidops": "tarountula",
	"staraptor": "staravia",
	"staravia": "starly",
	"starmie": "staryu",
	"steelix": "onix",
	"steenee": "bounsweet",
	"stoutland": "herdier",
	"stratagem": "tactite",
	"sudowoodo": "bonsly",
	"sunflora": "sunkern",
	"swadloon": "sewaddle",
	"swalot": "gulpin",
	"swampert": "marshtomp",
	"swanna": "ducklett",
	"swellow": "taillow",
	"swoobat": "woobat",
	"syclant": "syclar",
	"sylveon": "eevee",
	"tactite": "rebble",
	"talonflame": "fletchinder",
	"tangrowth": "tangela",
	"tentacruel": "tentacool",
	"thievul": "nickit",
	"thwackey": "grookey",
	"tinkaton": "tinkatuff",
	"tinkatuff": "tinkatink",
	"toedscruel": "toedscool",
	"togekiss": "togetic",
	"togetic": "togepi",
	"tomohawk": "scratchet",
	"torracat": "litten",
	"torterra": "grotle",
	"toucannon": "trumbeak",
	"toxapex": "mareanie",
	"toxicroak": "croagunk",
	"toxtricity": "toxel",
	"toxtricitylowkey": "toxel",
	"tranquill": "pidove",
	"trevenant": "phantump",
	"trumbeak": "pikipek",
	"tsareena": "steenee",
	"typhlosion": "quilava",
	"typhlosionhisui": "quilava",
	"tyranitar": "pupitar",
	"tyrantrum": "tyrunt",
	"umbreon": "eevee",
	"unfezant": "tranquill",
	"ursaluna": "ursaring",
	"ursaring": "teddiursa",
	"urshifu": "kubfu",
	"urshifurapidstrike": "kubfu",
	"vanillish": "vanillite",
	"vanilluxe": "vanillish",
	"vaporeon": "eevee",
	"venomoth": "venonat",
	"venusaur": "ivysaur",
	"vespiquen": "combee",
	"vibrava": "trapinch",
	"victreebel": "weepinbell",
	"vigoroth": "slakoth",
	"vikavolt": "charjabug",
	"vileplume": "gloom",
	"vivillon": "spewpa",
	"vivillonfancy": "spewpa",
	"volcarona": "larvesta",
	"volkraken": "volkritter",
	"voodoom": "voodoll",
	"wailord": "wailmer",
	"walrein": "sealeo",
	"wartortle": "squirtle",
	"watchog": "patrat",
	"weavile": "sneasel",
	"weepinbell": "bellsprout",
	"weezing": "koffing",
	"weezinggalar": "koffing",
	"whimsicott": "cottonee",
	"whirlipede": "venipede",
	"whiscash": "barboach",
	"wigglytuff": "jigglypuff",
	"wobbuffet": "wynaut",
	"wormadam": "burmy",
	"wormadamsandy": "burmy",
	"wormadamtrash": "burmy",
	"wugtrio": "wiglett",
	"wyrdeer": "stantler",
	"xatu": "natu",
	"yanmega": "yanma",
	"zebstrika": "blitzle",
	"zoroark": "zorua",
	"zoroarkhisui": "zoruahisui",
	"zweilous": "deino"
};
var FRAG_EVOLUTION_SPECIES_ID_LOOKUP = {};
var FRAG_NEXT_EVO_SPECIES_IDS = {};
for (var fragEvoSpeciesId in FRAG_PREVO_BY_SPECIES_ID) {
	if (!Object.prototype.hasOwnProperty.call(FRAG_PREVO_BY_SPECIES_ID, fragEvoSpeciesId)) continue;
	var fragPrevoSpeciesId = FRAG_PREVO_BY_SPECIES_ID[fragEvoSpeciesId];
	FRAG_EVOLUTION_SPECIES_ID_LOOKUP[fragEvoSpeciesId] = true;
	FRAG_EVOLUTION_SPECIES_ID_LOOKUP[fragPrevoSpeciesId] = true;
	if (!FRAG_NEXT_EVO_SPECIES_IDS[fragPrevoSpeciesId]) FRAG_NEXT_EVO_SPECIES_IDS[fragPrevoSpeciesId] = [];
	FRAG_NEXT_EVO_SPECIES_IDS[fragPrevoSpeciesId].push(fragEvoSpeciesId);
}

function safeJsonParse(rawJson, fallbackValue) {
	if (!rawJson) return fallbackValue;
	try {
		return JSON.parse(rawJson);
	} catch (err) {
		return fallbackValue;
	}
}

function parseHttpDateToMs(rawDateValue) {
	if (!rawDateValue) return 0;
	var parsed = Date.parse(String(rawDateValue));
	return isFinite(parsed) ? parsed : 0;
}

function getAppUpdatePageUrl() {
	if (!window.location) return "";
	if (window.location.origin && window.location.pathname) {
		return String(window.location.origin) + String(window.location.pathname);
	}
	return String(window.location.href || "").split("#")[0].split("?")[0];
}

function getAppUpdateBaseDirUrl() {
	var pageUrl = getAppUpdatePageUrl();
	if (!pageUrl) return "";
	if (pageUrl.charAt(pageUrl.length - 1) === "/") return pageUrl;
	var slashIndex = pageUrl.lastIndexOf("/");
	if (slashIndex < 0) return pageUrl + "/";
	return pageUrl.slice(0, slashIndex + 1);
}

function getUpdateTextSignature(rawText) {
	var text = String(rawText || "");
	var hash = 5381;
	for (var i = 0; i < text.length; i++) {
		hash = (((hash << 5) + hash) ^ text.charCodeAt(i)) >>> 0;
	}
	return String(hash);
}

function stopAppUpdateChecker() {
	if (!appUpdateCheckTimer) return;
	window.clearInterval(appUpdateCheckTimer);
	appUpdateCheckTimer = null;
}

function notifyAppUpdateAvailable() {
	if (appUpdateNoticeShown) return;
	appUpdateNoticeShown = true;
	stopAppUpdateChecker();
	var shouldRefreshNow = window.confirm("There is an update available. Please refresh the page.\n\nPress OK to refresh now.");
	if (shouldRefreshNow && window.location && typeof window.location.reload === "function") {
		window.location.reload();
	}
}

function checkForAppUpdate() {
	if (appUpdateNoticeShown) return;
	if (!appUpdateVersionUrl && !appUpdatePageUrl) return;
	if (appUpdateVersionUrl) {
		var versionRequestUrl = appUpdateVersionUrl + (appUpdateVersionUrl.indexOf("?") >= 0 ? "&" : "?") + "_updateCheckTs=" + Date.now();
		$.ajax({url: versionRequestUrl, cache: false, dataType: "text"})
			.done(function (responseText) {
				var parsedToken = "";
				try {
					var versionPayload = JSON.parse(String(responseText || ""));
					if (versionPayload && typeof versionPayload === "object") {
						parsedToken = String(versionPayload.buildId || versionPayload.builtAt || "");
					}
				} catch (_err) {}
				if (!parsedToken) parsedToken = String(responseText || "").trim();
				if (!parsedToken) return;
				if (!appUpdateBaselineVersionToken) {
					appUpdateBaselineVersionToken = parsedToken;
					return;
				}
				if (parsedToken !== appUpdateBaselineVersionToken) {
					notifyAppUpdateAvailable();
				}
			});
		return;
	}
	var requestUrl = appUpdatePageUrl + (appUpdatePageUrl.indexOf("?") >= 0 ? "&" : "?") + "_updateCheckTs=" + Date.now();
	$.ajax({url: requestUrl, cache: false, dataType: "text"})
		.done(function (responseText, _textStatus, jqXHR) {
			if (!jqXHR || typeof jqXHR.getResponseHeader !== "function") return;
			var latestLastModifiedMs = parseHttpDateToMs(jqXHR.getResponseHeader("Last-Modified"));
			if (!appUpdateBaselineLastModifiedMs && latestLastModifiedMs) {
				appUpdateBaselineLastModifiedMs = latestLastModifiedMs;
			} else if (appUpdateBaselineLastModifiedMs && latestLastModifiedMs > appUpdateBaselineLastModifiedMs + 1000) {
				notifyAppUpdateAvailable();
				return;
			}
			var latestSignature = getUpdateTextSignature(responseText);
			if (!appUpdateBaselinePageSignature) {
				appUpdateBaselinePageSignature = latestSignature;
				return;
			}
			if (latestSignature !== appUpdateBaselinePageSignature) {
				notifyAppUpdateAvailable();
			}
		});
}

function startAppUpdateChecker() {
	stopAppUpdateChecker();
	appUpdateNoticeShown = false;
	if (!window.location || !/^https?:$/i.test(String(window.location.protocol || ""))) return;
	appUpdatePageUrl = getAppUpdatePageUrl();
	if (!appUpdatePageUrl) return;
	var baseDirUrl = getAppUpdateBaseDirUrl();
	appUpdateVersionUrl = baseDirUrl ? (baseDirUrl + "version.json") : "";
	appUpdateBaselineLastModifiedMs = parseHttpDateToMs(document.lastModified);
	appUpdateBaselinePageSignature = "";
	appUpdateBaselineVersionToken = "";
	window.setTimeout(checkForAppUpdate, APP_UPDATE_INITIAL_CHECK_DELAY_MS);
	appUpdateCheckTimer = window.setInterval(checkForAppUpdate, APP_UPDATE_CHECK_INTERVAL_MS);
}

function normalizeStarterChoice(rawChoice) {
	var normalizedChoice = String(rawChoice || "").trim().toLowerCase();
	if (STARTER_CHOICES.indexOf(normalizedChoice) >= 0) return normalizedChoice;
	return "totodile";
}

function normalizeLayoutChoice(rawChoice) {
	var normalizedChoice = String(rawChoice || "").trim().toLowerCase();
	return normalizedChoice === "simplified" ? "simplified" : "standard";
}

function getDefaultAppSettings() {
	return {
		starterChoice: "totodile",
		layoutMode: "standard",
		moreColour: true,
		moveColors: false,
		moveMeta: true,
		totalFragsOnBorder: false
	};
}

function getAppSettings(forceReload) {
	if (!forceReload && appSettingsCache) return appSettingsCache;
	var defaults = getDefaultAppSettings();
	var parsed = safeJsonParse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY), {});
	appSettingsCache = {
		starterChoice: normalizeStarterChoice(parsed.starterChoice || defaults.starterChoice),
		layoutMode: normalizeLayoutChoice(parsed.layoutMode || defaults.layoutMode),
		moreColour: typeof parsed.moreColour === "boolean" ? parsed.moreColour : defaults.moreColour,
		moveColors: typeof parsed.moveColors === "boolean" ? parsed.moveColors : defaults.moveColors,
		moveMeta: typeof parsed.moveMeta === "boolean" ? parsed.moveMeta : defaults.moveMeta,
		totalFragsOnBorder: typeof parsed.totalFragsOnBorder === "boolean" ? parsed.totalFragsOnBorder : defaults.totalFragsOnBorder
	};
	return appSettingsCache;
}

function saveAppSettings(nextSettings) {
	appSettingsCache = {
		starterChoice: normalizeStarterChoice(nextSettings.starterChoice),
		layoutMode: normalizeLayoutChoice(nextSettings.layoutMode),
		moreColour: !!nextSettings.moreColour,
		moveColors: !!nextSettings.moveColors,
		moveMeta: !!nextSettings.moveMeta,
		totalFragsOnBorder: !!nextSettings.totalFragsOnBorder
	};
	localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(appSettingsCache));
	return appSettingsCache;
}

function updateAppSettings(partial) {
	var current = getAppSettings();
	return saveAppSettings({
		starterChoice: partial && typeof partial.starterChoice !== "undefined" ? partial.starterChoice : current.starterChoice,
		layoutMode: partial && typeof partial.layoutMode !== "undefined" ? partial.layoutMode : current.layoutMode,
		moreColour: partial && typeof partial.moreColour !== "undefined" ? partial.moreColour : current.moreColour,
		moveColors: partial && typeof partial.moveColors !== "undefined" ? partial.moveColors : current.moveColors,
		moveMeta: partial && typeof partial.moveMeta !== "undefined" ? partial.moveMeta : current.moveMeta,
		totalFragsOnBorder: partial && typeof partial.totalFragsOnBorder !== "undefined" ? partial.totalFragsOnBorder : current.totalFragsOnBorder
	});
}

function normalizeStarterFlagToken(flagToken) {
	return String(flagToken || "").trim().toLowerCase().replace(/\s+/g, "").replace(/[-_]/g, "");
}

function getStarterTokensFromFlag(flagValue) {
	var rawFlag = String(flagValue || "").toLowerCase();
	var splitTokens = rawFlag.split(/[\s,|/]+/);
	var normalizedTokens = [];
	for (var i = 0; i < splitTokens.length; i++) {
		var normalized = normalizeStarterFlagToken(splitTokens[i]);
		if (normalized) normalizedTokens.push(normalized);
	}
	return normalizedTokens;
}

function getStarterFlagFromSetData(setData) {
	if (!setData) return "";
	var possibleKeys = [
		"starterFlag", "starterflag",
		"starterChoice", "starterchoice",
		"starter", "rivalStarter", "rivalstarter"
	];
	for (var i = 0; i < possibleKeys.length; i++) {
		var key = possibleKeys[i];
		if (typeof setData[key] !== "undefined" && setData[key] !== null && String(setData[key]).trim()) {
			return String(setData[key]);
		}
	}
	return "";
}

function matchesExplicitStarterBooleanFlags(setData, starterChoice) {
	if (!setData) return null;
	var normalizedChoice = normalizeStarterChoice(starterChoice);
	var flagMappings = [
		{key: "chosechikorita", starter: "chikorita"},
		{key: "chosetepig", starter: "tepig"},
		{key: "chosetotodile", starter: "totodile"}
	];
	var hasAnyStarterFlag = false;
	var isMatch = false;
	for (var i = 0; i < flagMappings.length; i++) {
		var mapping = flagMappings[i];
		if (typeof setData[mapping.key] === "undefined") continue;
		hasAnyStarterFlag = true;
		if (isTruthySetFlag(setData[mapping.key]) && normalizedChoice === mapping.starter) {
			isMatch = true;
		}
	}
	if (!hasAnyStarterFlag) return null;
	return isMatch;
}

function setMatchesStarterFlag(flagValue, starterChoice) {
	var normalizedChoice = normalizeStarterChoice(starterChoice);
	var rivalStarter = RIVAL_STARTER_BY_CHOICE[normalizedChoice];
	var tokens = getStarterTokensFromFlag(flagValue);
	if (!tokens.length) return true;

	for (var i = 0; i < tokens.length; i++) {
		var token = tokens[i];
		if (token === normalizedChoice || token === ("chose" + normalizedChoice) || token === ("choose" + normalizedChoice)) {
			return true;
		}
		if (token === rivalStarter || token === ("rival" + rivalStarter) || token === ("againstrival" + rivalStarter)) {
			return true;
		}
	}
	return false;
}

function doesSetMatchStarterChoice(pokemonName, setName, setData) {
	if (!setName || !setData || setData.isCustomSet) return true;
	var starterChoice = getAppSettings().starterChoice;
	var explicitBooleanMatch = matchesExplicitStarterBooleanFlags(setData, starterChoice);
	if (explicitBooleanMatch !== null) return explicitBooleanMatch;
	var rivalStarter = RIVAL_STARTER_BY_CHOICE[starterChoice];
	var explicitFlag = getStarterFlagFromSetData(setData);
	if (explicitFlag) return setMatchesStarterFlag(explicitFlag, starterChoice);

	if (!/rival/i.test(setName)) return true;
	var normalizedBattleText = (String(setName) + " " + String(pokemonName || "")).toLowerCase();
	var hasStarterName = normalizedBattleText.indexOf("chikorita") >= 0 ||
		normalizedBattleText.indexOf("tepig") >= 0 ||
		normalizedBattleText.indexOf("totodile") >= 0;
	if (!hasStarterName) return true;
	return normalizedBattleText.indexOf(rivalStarter) >= 0;
}

function isDarkThemeStylesEnabled() {
	var darkStyles = document.getElementById("dark-theme-styles");
	if (!darkStyles) return $("body").hasClass("dark-theme");
	return !darkStyles.disabled;
}

function parseSetId(setId) {
	var normalized = String(setId || "").trim();
	if (!normalized) return {species: "", label: ""};
	var splitIndex = normalized.indexOf(" (");
	if (splitIndex < 0) {
		return {
			species: normalized,
			label: normalized
		};
	}
	return {
		species: normalized.substring(0, splitIndex),
		label: normalized.substring(splitIndex + 2, normalized.lastIndexOf(")"))
	};
}

function getDisplaySpeciesName(speciesName) {
	return SPECIES_DISPLAY_NAME_ALIASES[String(speciesName || "").trim()] || speciesName;
}

function formatSetNameForDisplay(setId) {
	var parsedSet = parseSetId(setId);
	if (!parsedSet.species) return String(setId || "");
	var displaySpecies = getDisplaySpeciesName(parsedSet.species);
	return parsedSet.label ? (displaySpecies + " (" + parsedSet.label + ")") : displaySpecies;
}

function isDittoSetId(setId) {
	var normalizedSetId = String(setId || "").trim();
	if (!normalizedSetId) return false;

	var parsedSet = parseSetId(normalizedSetId);
	if (toDexPokemonId(parsedSet.species) === "ditto") return true;

	var matchedOption = getSetOptionById(normalizedSetId);
	if (matchedOption && toDexPokemonId(matchedOption.pokemon) === "ditto") return true;

	var trainerEntry = parseTrainerPartyEntry(normalizedSetId);
	return !!(trainerEntry && toDexPokemonId(trainerEntry.pokemonName) === "ditto");
}

function ensureDittoTransformButtonPlacement() {
	var placements = [
		{buttonSelector: "#transformL", containerSelector: "#p1 .i-f-hp"},
		{buttonSelector: "#transformR", containerSelector: "#p2 .i-f-o-hp"}
	];
	for (var i = 0; i < placements.length; i++) {
		var placement = placements[i];
		var button = $(placement.buttonSelector);
		var container = $(placement.containerSelector).first();
		if (!button.length || !container.length) continue;

		button.addClass("ditto-transform-btn");
		var slot = container.children(".ditto-transform-slot").first();
		if (!slot.length) {
			slot = $('<div class="ditto-transform-slot" title="If Ditto is selected, copy the opposing Pokemon to transform"></div>');
			slot.hide();
			container.append(slot);
		}
		if (button.parent()[0] !== slot[0]) {
			slot.append(button);
		}
	}
}

function syncDittoTransformButtons() {
	ensureDittoTransformButtonPlacement();
	var p1SetId = $("#p1 .set-selector").val();
	var p2SetId = $("#p2 .set-selector").val();
	var showLeft = isDittoSetId(p1SetId);
	var showRight = isDittoSetId(p2SetId);
	var transformL = $("#transformL");
	var transformR = $("#transformR");
	var transformRow = $("#transformRow");
	var transformLSlot = transformL.closest(".ditto-transform-slot");
	var transformRSlot = transformR.closest(".ditto-transform-slot");
	if (transformL.length) transformL.toggle(showLeft);
	if (transformLSlot.length) transformLSlot.toggle(showLeft);
	if (transformR.length) transformR.toggle(showRight);
	if (transformRSlot.length) transformRSlot.toggle(showRight);
	if (transformRow.length) transformRow.hide();
}

function getTopSpriteNodeForPokeInfo(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return null;
	var pokeId = String(pokeInfo.attr("id") || "");
	if (pokeId === "p1") return $("#p1mon").get(0);
	if (pokeId === "p2") return $("#p2mon").get(0);
	return null;
}

function getInlineSpriteNodeForPokeInfo(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return null;
	var pokeId = String(pokeInfo.attr("id") || "");
	if (pokeId === "p1") return $("#p1-inline-sprite").get(0);
	if (pokeId === "p2") return $("#p2-inline-sprite").get(0);
	return null;
}

function getSelectedFormeNameIfVisible(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return "";
	var formeSelect = pokeInfo.find(".forme");
	var formeContainer = formeSelect.parent();
	if (!(formeSelect.length && formeContainer.length && formeContainer.is(":visible"))) return "";
	return String(formeSelect.val() || "").trim();
}

function resolveInlineSpriteSpeciesForPokeInfo(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return "";
	var transformedSpecies = String(pokeInfo.attr("data-transform-species") || "").trim();
	if (transformedSpecies) return transformedSpecies;
	var formeSpecies = getSelectedFormeNameIfVisible(pokeInfo);
	if (formeSpecies) return formeSpecies;
	var setSpecies = parseSetId(pokeInfo.find(".set-selector").val()).species || "";
	return String(setSpecies || "").trim();
}

function syncInlinePokeSprite(pokeInfo) {
	var inlineSpriteNode = getInlineSpriteNodeForPokeInfo(pokeInfo);
	if (!inlineSpriteNode) return;
	var speciesName = resolveInlineSpriteSpeciesForPokeInfo(pokeInfo);
	if (!speciesName) return;
	setTrainerSpriteImage(inlineSpriteNode, speciesName);
	var formeSelect = pokeInfo.find(".forme");
	var formeContainer = formeSelect.parent();
	var hasFormes = !!(
		formeSelect.length &&
		formeContainer.length &&
		formeContainer.is(":visible") &&
		formeSelect.find("option").length > 1
	);
	inlineSpriteNode.title = hasFormes ? "Click to cycle forms" : "No alternate forms";
	inlineSpriteNode.style.cursor = hasFormes ? "pointer" : "default";
}

function getDisplayedSpeciesForTransform(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return "";
	var spriteNode = getTopSpriteNodeForPokeInfo(pokeInfo);
	var spriteSpecies = spriteNode ? String(spriteNode.getAttribute("data-species") || "").trim() : "";
	if (spriteSpecies && toDexPokemonId(spriteSpecies) !== "ditto") return spriteSpecies;
	var parsedSet = parseSetId(pokeInfo.find(".set-selector").val());
	return String(parsedSet.species || "").trim();
}

function copyMoveSlotForTransform(sourcePokeInfo, targetPokeInfo, slotNumber) {
	var sourceMove = sourcePokeInfo.find(".move" + slotNumber);
	var targetMove = targetPokeInfo.find(".move" + slotNumber);
	if (!sourceMove.length || !targetMove.length) return;

	var sourceMoveSelector = sourceMove.find("select.move-selector");
	var targetMoveSelector = targetMove.find("select.move-selector");
	setSelectValueIfValid(targetMoveSelector, sourceMoveSelector.val(), "(No Move)");
	targetMoveSelector.change();

	setSelectValueIfValid(targetMove.find(".move-type"), sourceMove.find(".move-type").val(), targetMove.find(".move-type").val());
	if (targetMove.find(".move-cat").length) {
		setSelectValueIfValid(targetMove.find(".move-cat"), sourceMove.find(".move-cat").val(), targetMove.find(".move-cat").val());
	}
	targetMove.find(".move-bp").val(sourceMove.find(".move-bp").val());
	targetMove.find(".move-crit").prop("checked", sourceMove.find(".move-crit").is(":checked"));
	targetMove.find(".move-z").prop("checked", sourceMove.find(".move-z").is(":checked"));
	targetMove.find(".move-hits").val(sourceMove.find(".move-hits").val());
	targetMove.find(".stat-drops").val(sourceMove.find(".stat-drops").val());
	targetMove.find(".metronome").val(sourceMove.find(".metronome").val());
	updateMoveMetaForGroup(targetMove);
}

function transformDittoFromOpposing(targetSideSelector, sourceSideSelector) {
	var targetPokeInfo = $(targetSideSelector);
	var sourcePokeInfo = $(sourceSideSelector);
	if (!targetPokeInfo.length || !sourcePokeInfo.length) return;
	var targetSetSelector = targetPokeInfo.find(".set-selector");
	if (!targetSetSelector.length || !isDittoSetId(targetSetSelector.val())) return;

	var preservedLevel = targetPokeInfo.find(".level").val();
	var preservedItem = targetPokeInfo.find(".item").val();
	var preservedIgnoreItem = targetPokeInfo.find(".ignore-item-toggle").is(":checked");
	var preservedCurrentHp = targetPokeInfo.find(".current-hp").val();
	var preservedStatus = targetPokeInfo.find(".status").val();
	var preservedToxicCounter = targetPokeInfo.find(".toxic-counter").val();

	var sourceType1 = sourcePokeInfo.find(".type1").val();
	var sourceType2 = sourcePokeInfo.find(".type2").val();
	if (targetPokeInfo.find(".type1 option[value='" + sourceType1 + "']").length) {
		targetPokeInfo.find(".type1").val(sourceType1);
	}
	if (!sourceType2 || targetPokeInfo.find(".type2 option[value='" + sourceType2 + "']").length) {
		targetPokeInfo.find(".type2").val(sourceType2 || "");
	}
	targetPokeInfo.find(".type1").change();
	targetPokeInfo.find(".type2").change();
	setSelectValueIfValid(targetPokeInfo.find(".nature"), sourcePokeInfo.find(".nature").val(), targetPokeInfo.find(".nature").val());
	setSelectValueIfValid(targetPokeInfo.find(".ability"), sourcePokeInfo.find(".ability").val(), targetPokeInfo.find(".ability").val());
	targetPokeInfo.find(".ability").change();
	targetPokeInfo.find(".abilityToggle").prop("checked", sourcePokeInfo.find(".abilityToggle").is(":checked"));
	targetPokeInfo.find(".proto-quark-state").val(sourcePokeInfo.find(".proto-quark-state").val() || "auto");
	targetPokeInfo.find(".alliesFainted").val(sourcePokeInfo.find(".alliesFainted").val() || "0");

	for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
		var legacyStat = LEGACY_STATS[gen][i];
		targetPokeInfo.find("." + legacyStat + " .base").val(sourcePokeInfo.find("." + legacyStat + " .base").val());
		targetPokeInfo.find("." + legacyStat + " .ivs").val(sourcePokeInfo.find("." + legacyStat + " .ivs").val());
		targetPokeInfo.find("." + legacyStat + " .evs").val(sourcePokeInfo.find("." + legacyStat + " .evs").val());
		targetPokeInfo.find("." + legacyStat + " .dvs").val(sourcePokeInfo.find("." + legacyStat + " .dvs").val());
		targetPokeInfo.find("." + legacyStat + " .boost").val(sourcePokeInfo.find("." + legacyStat + " .boost").val());
	}

	for (var slot = 1; slot <= 4; slot++) {
		copyMoveSlotForTransform(sourcePokeInfo, targetPokeInfo, slot);
	}

	targetPokeInfo.find(".level").val(preservedLevel);
	targetPokeInfo.find(".item").val(preservedItem);
	targetPokeInfo.find(".ignore-item-toggle").prop("checked", preservedIgnoreItem);
	targetPokeInfo.find(".item").change();
	targetPokeInfo.find(".ignore-item-toggle").change();
	targetPokeInfo.find(".status").val(preservedStatus).change();
	if (preservedStatus === "Badly Poisoned") {
		targetPokeInfo.find(".toxic-counter").val(preservedToxicCounter);
	} else {
		targetPokeInfo.find(".toxic-counter").val(0);
	}

	calcStats(targetPokeInfo);
	calcHP(targetPokeInfo);
	var maxHp = parseInt(targetPokeInfo.find(".max-hp").text(), 10);
	var restoredCurrentHp = parseInt(preservedCurrentHp, 10);
	if (!Number.isNaN(maxHp) && maxHp > 0 && !Number.isNaN(restoredCurrentHp)) {
		restoredCurrentHp = Math.max(0, Math.min(maxHp, restoredCurrentHp));
		targetPokeInfo.find(".current-hp").val(restoredCurrentHp);
		calcPercentHP(targetPokeInfo.find(".hp"), maxHp, restoredCurrentHp);
	}

	var transformedSpecies = getDisplayedSpeciesForTransform(sourcePokeInfo);
	var targetSpriteNode = getTopSpriteNodeForPokeInfo(targetPokeInfo);
	if (targetSpriteNode && transformedSpecies) {
		targetPokeInfo.attr("data-transform-species", transformedSpecies);
		setTrainerSpriteImage(targetSpriteNode, transformedSpecies);
	}
	syncInlinePokeSprite(targetPokeInfo);
	if (typeof performCalculations === "function") performCalculations();
	syncDittoTransformButtons();
}

function getFragSpriteUrl(speciesName) {
	return getInitialTrainerSpriteUrlByName(speciesName);
}

function normalizeSplitNumber(rawSplit) {
	var split = parseInt(rawSplit, 10);
	if (Number.isNaN(split)) return 1;
	return Math.max(1, Math.min(9, split));
}

function escapeHtml(rawValue) {
	return String(rawValue || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function toDexPokemonId(pokemonName) {
	var normalizedName = (pokemonName || "").trim();
	if (!normalizedName) return "";
	if (typeof calc !== "undefined" && calc && typeof calc.toID === "function") {
		return calc.toID(normalizedName);
	}
	return normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

var SPECIES_NAME_ALIASES = {
	"Flabebe-Red-Flower": "Flabébé",
	"Floette-Red-Flower": "Floette",
	"Florges-Red-Flower": "Florges",
	"Flabebe-Yellow-Flower": "Flabébé",
	"Flabebe-Orange-Flower": "Flabébé",
	"Flabebe-Blue-Flower": "Flabébé",
	"Flabebe-White-Flower": "Flabébé",
	"Floette-Yellow-Flower": "Floette",
	"Floette-Orange-Flower": "Floette",
	"Floette-Blue-Flower": "Floette",
	"Floette-White-Flower": "Floette",
	"Floette-Eternal-Flower": "Floette-Eternal",
	"Florges-Yellow-Flower": "Florges",
	"Florges-Orange-Flower": "Florges",
	"Florges-Blue-Flower": "Florges",
	"Florges-White-Flower": "Florges",
};

function resolveSetSpeciesNameForDexLookup(pokemonName) {
	var normalizedName = String(pokemonName || "").trim();
	if (!normalizedName) return "";
	if (SPECIES_NAME_ALIASES[normalizedName]) return SPECIES_NAME_ALIASES[normalizedName];
	if (pokedex[normalizedName]) return normalizedName;
	var dashIndex = normalizedName.indexOf("-");
	if (dashIndex > 0) {
		var baseName = normalizedName.substring(0, dashIndex);
		if (SPECIES_NAME_ALIASES[baseName]) return SPECIES_NAME_ALIASES[baseName];
		if (pokedex[baseName]) return baseName;
	}
	return normalizedName;
}

function resolveEvolutionLookupSpeciesId(speciesName) {
	var rawSpecies = String(speciesName || "").trim();
	if (!rawSpecies) return "";
	var resolvedSpecies = resolveSetSpeciesNameForDexLookup(rawSpecies);
	var candidateNames = [rawSpecies, resolvedSpecies];
	if (pokedex && resolvedSpecies && pokedex[resolvedSpecies] && pokedex[resolvedSpecies].baseSpecies) {
		candidateNames.push(String(pokedex[resolvedSpecies].baseSpecies));
	}
	var rawDashIndex = rawSpecies.indexOf("-");
	if (rawDashIndex > 0) {
		candidateNames.push(rawSpecies.substring(0, rawDashIndex));
	}
	for (var i = 0; i < candidateNames.length; i++) {
		var candidateId = toDexPokemonId(candidateNames[i]);
		if (!candidateId) continue;
		if (FRAG_EVOLUTION_SPECIES_ID_LOOKUP[candidateId]) return candidateId;
	}
	return toDexPokemonId(resolvedSpecies || rawSpecies);
}

function isPreEvolutionOfSpecies(sourceSpecies, targetSpecies) {
	var sourceId = resolveEvolutionLookupSpeciesId(sourceSpecies);
	var targetId = resolveEvolutionLookupSpeciesId(targetSpecies);
	if (!sourceId || !targetId || sourceId === targetId) return false;
	var currentId = targetId;
	for (var depth = 0; depth < 12; depth++) {
		var prevoId = FRAG_PREVO_BY_SPECIES_ID[currentId];
		if (!prevoId || prevoId === currentId) break;
		if (prevoId === sourceId) return true;
		currentId = prevoId;
	}
	return false;
}

function shouldMergeFragsByEvolutionDrop(sourceSetId, targetSetId) {
	if (!sourceSetId || !targetSetId || sourceSetId === targetSetId) return false;
	var sourceSpecies = parseSetId(sourceSetId).species;
	var targetSpecies = parseSetId(targetSetId).species;
	if (!sourceSpecies || !targetSpecies) return false;
	return isPreEvolutionOfSpecies(sourceSpecies, targetSpecies);
}

function astralDexUrl(pokemonName) {
	var pokemonId = toDexPokemonId(pokemonName);
	if (!pokemonId) return ASTRALDEX_BASE_URL;
	return ASTRALDEX_BASE_URL + "pokemon/" + encodeURIComponent(pokemonId);
}

function getSelectedPokemonNameForAnalysis(linkElement) {
	var link = $(linkElement);
	var pokeInfo = link.closest(".poke-info");
	var fullSetName = pokeInfo.find(".set-selector").val() || "";
	if (fullSetName.indexOf(" (") > 0) {
		return fullSetName.substring(0, fullSetName.indexOf(" ("));
	}
	if (fullSetName) return fullSetName;
	return link.attr("data-pokemon-name") || "";
}

function applyAstralDexPanelTheme(panel) {
	var isDarkTheme = isDarkThemeStylesEnabled();
	var header = panel.querySelector(".astraldex-side-header");
	var closeButton = panel.querySelector(".astraldex-side-close");
	if (!header || !closeButton) return;

	if (isDarkTheme) {
		panel.style.background = "#101318";
		panel.style.borderLeft = "1px solid #323a45";
		header.style.background = "#181d24";
		header.style.borderBottom = "1px solid #323a45";
		header.style.color = "#dce6f8";
		closeButton.style.background = "#2d3239";
		closeButton.style.border = "1px solid #4a5563";
		closeButton.style.color = "#f4f7ff";
	} else {
		panel.style.background = "#ffffff";
		panel.style.borderLeft = "1px solid #b3b3b3";
		header.style.background = "#f2f4f7";
		header.style.borderBottom = "1px solid #b3b3b3";
		header.style.color = "#20252b";
		closeButton.style.background = "#ffffff";
		closeButton.style.border = "1px solid #9aa3ad";
		closeButton.style.color = "#20252b";
	}
}

function ensureAstralDexSidePanel() {
	var panel = document.getElementById("astraldex-side-panel");
	if (panel) return panel;

	panel = document.createElement("aside");
	panel.id = "astraldex-side-panel";
	panel.className = "calc-side-panel calc-side-panel-astraldex";
	panel.setAttribute("aria-hidden", "true");
	panel.hidden = true;
	panel.innerHTML = '<div class="calc-side-resize-handle" aria-hidden="true"></div><div class="calc-side-header astraldex-side-header"><strong class="astraldex-side-title">AstralDex</strong><button type="button" class="btn calc-side-btn astraldex-side-close">Close</button></div><div class="calc-side-body astraldex-side-body" style="position:relative;overflow:hidden;flex:1 1 auto;padding:0;"><iframe class="astraldex-side-frame" title="AstralDex" src="' + ASTRALDEX_BASE_URL + '" style="position:absolute;top:0;left:0;width:100%;height:calc(100% + ' + ASTRALDEX_TOP_CHROME_PX + 'px);transform:translateY(-' + ASTRALDEX_TOP_CHROME_PX + 'px);border:0;"></iframe></div>';
	document.body.appendChild(panel);
	applyAstralDexPanelTheme(panel);

	panel.querySelector(".astraldex-side-close").onclick = closeAstralDexSidePanel;
	return panel;
}

function closeAstralDexSidePanel() {
	closeCalcSidePanel("astraldex-side-panel");
}

function openAstralDexSidePanel(url, pokemonName) {
	var panel = ensureAstralDexSidePanel();
	applyAstralDexPanelTheme(panel);
	panel.querySelector(".astraldex-side-frame").src = url || astralDexUrl(pokemonName);
	panel.querySelector(".astraldex-side-title").textContent = pokemonName ? ("AstralDex: " + pokemonName) : "AstralDex";
	openCalcSidePanel("astraldex-side-panel");
}

function bindAstralDexLinks() {
	$(".analysis").text("Open In Pokedex").attr("rel", "noopener noreferrer");
	$(document).off("click.astraldex", ".analysis").on("click.astraldex", ".analysis", function (ev) {
		ev.preventDefault();
		var link = $(this);
		var pokemonName = getSelectedPokemonNameForAnalysis(this);
		var url = astralDexUrl(pokemonName);
		link.attr("href", url).attr("data-pokemon-name", pokemonName);
		openAstralDexSidePanel(url, pokemonName);
	});
	$(document).off("keydown.astraldex").on("keydown.astraldex", function (ev) {
		if (ev.key === "Escape" || ev.keyCode === 27) closeAstralDexSidePanel();
	});
}

function getCurrentFightLabel() {
	var trainerLabel = String(window.CURRENT_TRAINER || "").trim();
	if (trainerLabel) return trainerLabel;
	var opposingSet = $(".opposing").val() || "";
	if (!opposingSet) return "Unknown Fight";
	var start = opposingSet.indexOf("(");
	var end = opposingSet.lastIndexOf(")");
	if (start < 0 || end <= start) return opposingSet;
	return opposingSet.substring(start + 1, end);
}

function getTrainerIndexFromSetData(setData) {
	if (!setData || typeof setData.index === "undefined" || setData.index === null) return 0;
	var parsed = parseInt(setData.index, 10);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function getCurrentFightIndex() {
	var opposingSet = $(".opposing").val();
	if (opposingSet) {
		var selectedEntry = parseTrainerPartyEntry(opposingSet);
		var selectedIndex = getTrainerIndexFromSetData(selectedEntry.setData);
		if (selectedIndex > 0) return selectedIndex;
	}
	if (CURRENT_TRAINER_POKS && CURRENT_TRAINER_POKS.length) {
		for (var i = 0; i < CURRENT_TRAINER_POKS.length; i++) {
			var entry = parseTrainerPartyEntry(CURRENT_TRAINER_POKS[i]);
			var index = getTrainerIndexFromSetData(entry.setData);
			if (index > 0) return index;
		}
	}
	return 0;
}

function getFragSplitRules() {
	var rules = window.FRAG_SPLIT_RULES;
	if (!rules || !Array.isArray(rules.boundaries)) return [];
	return rules.boundaries;
}

function getTrainerIndexForLabel(trainerLabel) {
	var normalizedTrainerLabel = String(trainerLabel || "").trim();
	if (!normalizedTrainerLabel) return 0;
	var activeSetdex = gen === 9 && typeof SETDEX_SV !== "undefined" ? SETDEX_SV : setdex;
	if (!activeSetdex) return 0;
	var highestIndex = 0;
	for (var speciesName in activeSetdex) {
		if (!Object.prototype.hasOwnProperty.call(activeSetdex, speciesName)) continue;
		var speciesSets = activeSetdex[speciesName];
		if (!speciesSets || !Object.prototype.hasOwnProperty.call(speciesSets, normalizedTrainerLabel)) continue;
		var setData = speciesSets[normalizedTrainerLabel];
		var trainerIndex = getTrainerIndexFromSetData(setData);
		if (trainerIndex > highestIndex) highestIndex = trainerIndex;
	}
	return highestIndex;
}

function resolveFragSplitBoundaryIndex(boundaryRule) {
	if (!boundaryRule) return 0;
	var boundaryIndex = parseInt(boundaryRule.endIndex, 10);
	if (!Number.isNaN(boundaryIndex) && boundaryIndex > 0) return boundaryIndex;
	var labels = boundaryRule.endTrainers;
	if (typeof labels === "string") labels = [labels];
	if (!Array.isArray(labels)) return 0;
	var highestIndex = 0;
	for (var i = 0; i < labels.length; i++) {
		var trainerIndex = getTrainerIndexForLabel(labels[i]);
		if (trainerIndex > highestIndex) highestIndex = trainerIndex;
	}
	return highestIndex;
}

function getSplitFromRulesByIndex(currentIndex) {
	if (!currentIndex || currentIndex <= 0) return 0;
	var rules = getFragSplitRules();
	if (!rules.length) return 0;
	var boundaries = [];
	var highestSplit = 1;
	for (var i = 0; i < rules.length; i++) {
		var boundaryRule = rules[i] || {};
		var splitNumber = normalizeSplitNumber(boundaryRule.split);
		var boundaryIndex = resolveFragSplitBoundaryIndex(boundaryRule);
		if (boundaryIndex <= 0) continue;
		boundaries.push({split: splitNumber, endIndex: boundaryIndex});
		if (splitNumber > highestSplit) highestSplit = splitNumber;
	}
	if (!boundaries.length) return 0;
	boundaries.sort(function (a, b) {
		if (a.endIndex !== b.endIndex) return a.endIndex - b.endIndex;
		return a.split - b.split;
	});
	for (var b = 0; b < boundaries.length; b++) {
		if (currentIndex <= boundaries[b].endIndex) return boundaries[b].split;
	}
	return Math.min(9, highestSplit + 1);
}

function getCurrentSplitNumber(fightLabel) {
	if (window.CURRENT_SPLIT) {
		return normalizeSplitNumber(window.CURRENT_SPLIT);
	}
	var configuredSplit = getSplitFromRulesByIndex(getCurrentFightIndex());
	if (configuredSplit) return configuredSplit;
	var fightText = String(fightLabel || getCurrentFightLabel() || "");
	var splitMatch = fightText.match(/split\s*([1-9])/i);
	if (splitMatch && splitMatch[1]) {
		return normalizeSplitNumber(splitMatch[1]);
	}
	return 1;
}

function normalizeFragFightLabelForMatch(fightLabel) {
	var normalized = String(fightLabel || "").trim();
	if (!normalized) return "";
	normalized = normalized.replace(/\s*\(split\s*[1-9]\)\s*$/i, "");
	return normalized.toLowerCase();
}

function getSplitNumberForFragFightLabel(fightLabel) {
	var fightText = String(fightLabel || "").trim();
	var splitMatch = fightText.match(/split\s*([1-9])/i);
	if (splitMatch && splitMatch[1]) {
		return normalizeSplitNumber(splitMatch[1]);
	}
	var trainerIndex = getTrainerIndexForLabel(fightText);
	var configuredSplit = getSplitFromRulesByIndex(trainerIndex);
	if (configuredSplit) return configuredSplit;
	return getCurrentSplitNumber(fightText);
}

function normalizeFragVictimKey(rawVictimKey) {
	var normalized = String(rawVictimKey || "").trim();
	return normalized ? normalized : FRAG_UNKNOWN_VICTIM_KEY;
}

function normalizeFragVictimBucket(rawBucket) {
	var bucket = {};
	if (!rawBucket || typeof rawBucket !== "object") return bucket;
	for (var victimKey in rawBucket) {
		if (!Object.prototype.hasOwnProperty.call(rawBucket, victimKey)) continue;
		var victimCount = parseInt(rawBucket[victimKey], 10);
		if (Number.isNaN(victimCount) || victimCount <= 0) continue;
		var normalizedVictimKey = normalizeFragVictimKey(victimKey);
		bucket[normalizedVictimKey] = (bucket[normalizedVictimKey] || 0) + victimCount;
	}
	return bucket;
}

function getFragVictimBucketTotal(bucket) {
	if (!bucket || typeof bucket !== "object") return 0;
	var total = 0;
	for (var victimKey in bucket) {
		if (!Object.prototype.hasOwnProperty.call(bucket, victimKey)) continue;
		var victimCount = parseInt(bucket[victimKey], 10);
		if (!Number.isNaN(victimCount) && victimCount > 0) total += victimCount;
	}
	return total;
}

function normalizeFragFightVictims(rawFightVictims, fights) {
	var fightVictims = {};
	if (rawFightVictims && typeof rawFightVictims === "object") {
		for (var fightName in rawFightVictims) {
			if (!Object.prototype.hasOwnProperty.call(rawFightVictims, fightName)) continue;
			var normalizedFightName = String(fightName || "");
			if (!normalizedFightName) continue;
			var normalizedBucket = normalizeFragVictimBucket(rawFightVictims[fightName]);
			if (!Object.keys(normalizedBucket).length) continue;
			if (!fightVictims[normalizedFightName]) fightVictims[normalizedFightName] = {};
			for (var victimKey in normalizedBucket) {
				if (!Object.prototype.hasOwnProperty.call(normalizedBucket, victimKey)) continue;
				fightVictims[normalizedFightName][victimKey] = (fightVictims[normalizedFightName][victimKey] || 0) + normalizedBucket[victimKey];
			}
		}
	}
	for (var knownFight in fightVictims) {
		if (!Object.prototype.hasOwnProperty.call(fightVictims, knownFight)) continue;
		var fightVictimTotal = getFragVictimBucketTotal(fightVictims[knownFight]);
		var fightCount = parseInt(fights[knownFight], 10);
		if (Number.isNaN(fightCount) || fightCount < fightVictimTotal) {
			fights[knownFight] = fightVictimTotal;
		}
	}
	for (var fightKey in fights) {
		if (!Object.prototype.hasOwnProperty.call(fights, fightKey)) continue;
		var currentFightCount = parseInt(fights[fightKey], 10);
		if (Number.isNaN(currentFightCount) || currentFightCount <= 0) continue;
		if (!fightVictims[fightKey]) fightVictims[fightKey] = {};
		var currentFightVictimTotal = getFragVictimBucketTotal(fightVictims[fightKey]);
		if (currentFightVictimTotal < currentFightCount) {
			fightVictims[fightKey][FRAG_UNKNOWN_VICTIM_KEY] = (fightVictims[fightKey][FRAG_UNKNOWN_VICTIM_KEY] || 0) + (currentFightCount - currentFightVictimTotal);
		}
	}
	return fightVictims;
}

function normalizeFragSplitVictims(rawSplitVictims, splits) {
	var splitVictims = {};
	if (rawSplitVictims && typeof rawSplitVictims === "object") {
		for (var splitKey in rawSplitVictims) {
			if (!Object.prototype.hasOwnProperty.call(rawSplitVictims, splitKey)) continue;
			var normalizedSplit = String(normalizeSplitNumber(splitKey));
			var normalizedBucket = normalizeFragVictimBucket(rawSplitVictims[splitKey]);
			if (!Object.keys(normalizedBucket).length) continue;
			if (!splitVictims[normalizedSplit]) splitVictims[normalizedSplit] = {};
			for (var victimKey in normalizedBucket) {
				if (!Object.prototype.hasOwnProperty.call(normalizedBucket, victimKey)) continue;
				splitVictims[normalizedSplit][victimKey] = (splitVictims[normalizedSplit][victimKey] || 0) + normalizedBucket[victimKey];
			}
		}
	}
	for (var knownSplit in splitVictims) {
		if (!Object.prototype.hasOwnProperty.call(splitVictims, knownSplit)) continue;
		var splitVictimTotal = getFragVictimBucketTotal(splitVictims[knownSplit]);
		var splitCount = parseInt(splits[knownSplit], 10);
		if (Number.isNaN(splitCount) || splitCount < splitVictimTotal) {
			splits[knownSplit] = splitVictimTotal;
		}
	}
	for (var splitNumber = 1; splitNumber <= 9; splitNumber++) {
		var splitId = String(splitNumber);
		var currentSplitCount = parseInt(splits[splitId], 10);
		if (Number.isNaN(currentSplitCount) || currentSplitCount <= 0) continue;
		if (!splitVictims[splitId]) splitVictims[splitId] = {};
		var currentSplitVictimTotal = getFragVictimBucketTotal(splitVictims[splitId]);
		if (currentSplitVictimTotal < currentSplitCount) {
			splitVictims[splitId][FRAG_UNKNOWN_VICTIM_KEY] = (splitVictims[splitId][FRAG_UNKNOWN_VICTIM_KEY] || 0) + (currentSplitCount - currentSplitVictimTotal);
		}
	}
	return splitVictims;
}

function getFragVictimDisplayName(victimKey) {
	var normalizedVictimKey = normalizeFragVictimKey(victimKey);
	if (normalizedVictimKey === FRAG_UNKNOWN_VICTIM_KEY) return "Unknown";
	var parsedVictim = parseSetId(normalizedVictimKey);
	return parsedVictim.species || normalizedVictimKey;
}

function getFragVictimBucketForEntry(entry, bucketType, bucketKey, createIfMissing) {
	if (!entry || !bucketType) return null;
	var normalizedBucketKey = String(bucketKey || "");
	if (!normalizedBucketKey) return null;
	if (!entry[bucketType] || typeof entry[bucketType] !== "object") {
		if (!createIfMissing) return null;
		entry[bucketType] = {};
	}
	if (!entry[bucketType][normalizedBucketKey] || typeof entry[bucketType][normalizedBucketKey] !== "object") {
		if (!createIfMissing) return null;
		entry[bucketType][normalizedBucketKey] = {};
	}
	return entry[bucketType][normalizedBucketKey];
}

function incrementFragVictimBucketCount(entry, bucketType, bucketKey, victimKey, amount) {
	var incrementBy = parseInt(amount, 10);
	if (Number.isNaN(incrementBy) || incrementBy <= 0) return;
	var bucket = getFragVictimBucketForEntry(entry, bucketType, bucketKey, true);
	if (!bucket) return;
	var normalizedVictimKey = normalizeFragVictimKey(victimKey);
	bucket[normalizedVictimKey] = (bucket[normalizedVictimKey] || 0) + incrementBy;
}

function decrementFragVictimBucketCount(entry, bucketType, bucketKey, victimKey, amount) {
	var decrementBy = parseInt(amount, 10);
	if (Number.isNaN(decrementBy) || decrementBy <= 0) return 0;
	var bucket = getFragVictimBucketForEntry(entry, bucketType, bucketKey, false);
	if (!bucket) return 0;
	var normalizedVictimKey = normalizeFragVictimKey(victimKey);
	var currentCount = parseInt(bucket[normalizedVictimKey], 10);
	if (Number.isNaN(currentCount) || currentCount <= 0) return 0;
	var removed = Math.min(currentCount, decrementBy);
	var nextCount = currentCount - removed;
	if (nextCount <= 0) delete bucket[normalizedVictimKey];
	else bucket[normalizedVictimKey] = nextCount;
	if (!Object.keys(bucket).length && entry[bucketType] && typeof entry[bucketType] === "object") {
		delete entry[bucketType][String(bucketKey)];
	}
	return removed;
}

function pickFragVictimKeyForRemoval(entry, fightKey, splitKey) {
	var fightBucket = getFragVictimBucketForEntry(entry, "fightVictims", fightKey, false);
	if (fightBucket) {
		for (var fightVictimKey in fightBucket) {
			if (!Object.prototype.hasOwnProperty.call(fightBucket, fightVictimKey)) continue;
			var fightCount = parseInt(fightBucket[fightVictimKey], 10);
			if (!Number.isNaN(fightCount) && fightCount > 0) return fightVictimKey;
		}
	}
	var splitBucket = getFragVictimBucketForEntry(entry, "splitVictims", splitKey, false);
	if (!splitBucket) return FRAG_UNKNOWN_VICTIM_KEY;
	for (var splitVictimKey in splitBucket) {
		if (!Object.prototype.hasOwnProperty.call(splitBucket, splitVictimKey)) continue;
		var splitCount = parseInt(splitBucket[splitVictimKey], 10);
		if (!Number.isNaN(splitCount) && splitCount > 0) return splitVictimKey;
	}
	return FRAG_UNKNOWN_VICTIM_KEY;
}

function decrementFragVictimBucketByAny(entry, bucketType, bucketKey, amount) {
	var remaining = parseInt(amount, 10);
	if (Number.isNaN(remaining) || remaining <= 0) return 0;
	var removedTotal = 0;
	var bucket = getFragVictimBucketForEntry(entry, bucketType, bucketKey, false);
	if (!bucket) return 0;
	for (var victimKey in bucket) {
		if (!Object.prototype.hasOwnProperty.call(bucket, victimKey)) continue;
		if (remaining <= 0) break;
		var removed = decrementFragVictimBucketCount(entry, bucketType, bucketKey, victimKey, remaining);
		if (removed > 0) {
			removedTotal += removed;
			remaining -= removed;
		}
	}
	return removedTotal;
}

function renderFragSplitVictimDropdown(entry, splitKey) {
	var splitBucket = getFragVictimBucketForEntry(entry, "splitVictims", splitKey, false);
	if (!splitBucket) return "";
	var victimRowsBySpecies = {};
	for (var victimKey in splitBucket) {
		if (!Object.prototype.hasOwnProperty.call(splitBucket, victimKey)) continue;
		var victimCount = parseInt(splitBucket[victimKey], 10);
		if (Number.isNaN(victimCount) || victimCount <= 0) continue;
		var victimSpecies = getFragVictimDisplayName(victimKey);
		victimRowsBySpecies[victimSpecies] = (victimRowsBySpecies[victimSpecies] || 0) + victimCount;
	}
	var victimRows = [];
	var victimTotal = 0;
	for (var victimSpeciesName in victimRowsBySpecies) {
		if (!Object.prototype.hasOwnProperty.call(victimRowsBySpecies, victimSpeciesName)) continue;
		var speciesCount = victimRowsBySpecies[victimSpeciesName];
		if (!speciesCount || speciesCount <= 0) continue;
		victimRows.push({name: victimSpeciesName, count: speciesCount});
		victimTotal += speciesCount;
	}
	if (!victimRows.length || victimTotal <= 0) return "";
	victimRows.sort(function (a, b) {
		if (b.count !== a.count) return b.count - a.count;
		return a.name.localeCompare(b.name);
	});
	var listHtml = "";
	for (var i = 0; i < victimRows.length; i++) {
		listHtml += "<li class=\"frags-split-item\"><span class=\"frags-split-item-name\">" +
			escapeHtml(victimRows[i].name) +
			"</span><span class=\"frags-split-item-count\">x" + victimRows[i].count + "</span></li>";
	}
	return "<details class=\"frags-split-drop\">" +
		"<summary>Targets (" + victimTotal + ")</summary>" +
		"<ul class=\"frags-split-list\">" + listHtml + "</ul>" +
		"</details>";
}

function normalizeFragEntry(setId, rawEntry) {
	var entry = rawEntry || {};
	var parsedSet = parseSetId(setId);
	var fights = {};
	if (entry.fights) {
		for (var fightName in entry.fights) {
			if (!Object.prototype.hasOwnProperty.call(entry.fights, fightName)) continue;
			var killCount = parseInt(entry.fights[fightName], 10);
			if (!Number.isNaN(killCount) && killCount > 0) fights[fightName] = killCount;
		}
	}
	var fightSum = 0;
	for (var fightKey in fights) {
		if (Object.prototype.hasOwnProperty.call(fights, fightKey)) fightSum += fights[fightKey];
	}
	var splits = {};
	if (entry.splits) {
		for (var splitKey in entry.splits) {
			if (!Object.prototype.hasOwnProperty.call(entry.splits, splitKey)) continue;
			var normalizedSplit = String(normalizeSplitNumber(splitKey));
			var splitCount = parseInt(entry.splits[splitKey], 10);
			if (Number.isNaN(splitCount) || splitCount <= 0) continue;
			splits[normalizedSplit] = (splits[normalizedSplit] || 0) + splitCount;
		}
	}
	var splitSum = 0;
	for (var s = 1; s <= 9; s++) {
		splitSum += (splits[String(s)] || 0);
	}
	var totalKills = parseInt(entry.totalKills, 10);
	var floorTotal = Math.max(fightSum, splitSum);
	if (Number.isNaN(totalKills) || totalKills < floorTotal) totalKills = floorTotal;
	if (!splitSum && totalKills > 0) {
		splits["1"] = totalKills;
	}
	if (splitSum && splitSum < totalKills) {
		splits["1"] = (splits["1"] || 0) + (totalKills - splitSum);
	}
	var fightVictims = normalizeFragFightVictims(entry.fightVictims, fights);
	var splitVictims = normalizeFragSplitVictims(entry.splitVictims, splits);
	var normalizedFightSum = 0;
	for (var normalizedFightKey in fights) {
		if (!Object.prototype.hasOwnProperty.call(fights, normalizedFightKey)) continue;
		normalizedFightSum += fights[normalizedFightKey];
	}
	var normalizedSplitSum = 0;
	for (var normalizedSplitNumber = 1; normalizedSplitNumber <= 9; normalizedSplitNumber++) {
		normalizedSplitSum += (splits[String(normalizedSplitNumber)] || 0);
	}
	totalKills = Math.max(totalKills, normalizedFightSum, normalizedSplitSum);
	if (normalizedSplitSum < totalKills) {
		var splitTopoff = totalKills - normalizedSplitSum;
		splits["1"] = (splits["1"] || 0) + splitTopoff;
		if (!splitVictims["1"]) splitVictims["1"] = {};
		splitVictims["1"][FRAG_UNKNOWN_VICTIM_KEY] = (splitVictims["1"][FRAG_UNKNOWN_VICTIM_KEY] || 0) + splitTopoff;
	}
	var isDead = false;
	if (typeof entry.isDead === "boolean") {
		isDead = entry.isDead;
	} else if (typeof entry.isDead !== "undefined") {
		isDead = !!entry.isDead;
	}
	var deathFight = entry.deathFight ? String(entry.deathFight) : "";
	if (!isDead) deathFight = "";
	return {
		setId: setId,
		species: parsedSet.species,
		label: parsedSet.label,
		totalKills: totalKills,
		fights: fights,
		splits: splits,
		fightVictims: fightVictims,
		splitVictims: splitVictims,
		lastVictim: entry.lastVictim ? String(entry.lastVictim) : "",
		isDead: isDead,
		deathFight: deathFight
	};
}

function normalizeFragEntryMap(rawEntries) {
	var normalizedEntries = {};
	if (!rawEntries || typeof rawEntries !== "object") return normalizedEntries;
	for (var setId in rawEntries) {
		if (!Object.prototype.hasOwnProperty.call(rawEntries, setId)) continue;
		normalizedEntries[setId] = normalizeFragEntry(setId, rawEntries[setId]);
	}
	return normalizedEntries;
}

function normalizeAeLuaImportedEventStorage(rawEvents) {
	var normalizedEvents = {};
	if (!rawEvents || typeof rawEvents !== "object" || Array.isArray(rawEvents)) return normalizedEvents;
	for (var eventId in rawEvents) {
		if (!Object.prototype.hasOwnProperty.call(rawEvents, eventId)) continue;
		var record = rawEvents[eventId];
		normalizedEvents[eventId] = record && typeof record === "object"
			? Object.assign({}, record)
			: {importedAt: String(record || "")};
	}
	return normalizedEvents;
}

function normalizeFragSheetStorage(rawState) {
	var normalizedState = rawState && typeof rawState === "object" ? rawState : {};
	var fragState = {
		entries: normalizeFragEntryMap(normalizedState.entries),
		archivedEntries: normalizeFragEntryMap(normalizedState.archivedEntries),
		aeLuaImportedEvents: normalizeAeLuaImportedEventStorage(normalizedState.aeLuaImportedEvents)
	};
	for (var activeSetId in fragState.entries) {
		if (!Object.prototype.hasOwnProperty.call(fragState.entries, activeSetId)) continue;
		if (Object.prototype.hasOwnProperty.call(fragState.archivedEntries, activeSetId)) {
			// A previously created zero-value active placeholder must not erase an
			// older exact-ID record which still contains the real frag history.
			// Exact IDs represent the same logical Calc entry, so retain the copy
			// with the larger normalized total before removing the duplicate.
			var activeEntry = fragState.entries[activeSetId];
			var archivedEntry = fragState.archivedEntries[activeSetId];
			if ((parseInt(archivedEntry.totalKills, 10) || 0) >
				(parseInt(activeEntry.totalKills, 10) || 0)) {
				fragState.entries[activeSetId] = archivedEntry;
			}
			delete fragState.archivedEntries[activeSetId];
		}
	}
	return fragState;
}

function getFragSheetStateEntryMap(state, mapKey) {
	if (!state || typeof state !== "object") return {};
	if (!state[mapKey] || typeof state[mapKey] !== "object") {
		state[mapKey] = {};
	}
	return state[mapKey];
}

function getFragSheetState() {
	if (fragSheetState) return fragSheetState;
	var parsed = safeJsonParse(localStorage.getItem(FRAG_SHEET_STORAGE_KEY), {});
	fragSheetState = normalizeFragSheetStorage(parsed);
	return fragSheetState;
}

function saveFragSheetState() {
	fragSheetState = normalizeFragSheetStorage(getFragSheetState());
	var legacyImportedEvents = normalizeAeLuaImportedEventStorage(
		safeJsonParse(localStorage.getItem(AE_LUA_FRAG_IMPORTED_EVENTS_STORAGE_KEY), {})
	);
	fragSheetState.aeLuaImportedEvents = Object.assign({}, legacyImportedEvents,
		normalizeAeLuaImportedEventStorage(fragSheetState.aeLuaImportedEvents));
	localStorage.setItem(FRAG_SHEET_STORAGE_KEY, JSON.stringify(fragSheetState));
	// Keep the compatibility ledger byte-for-byte aligned with the authoritative
	// event map embedded in the Frag Sheet state. This also makes set-ID
	// migrations atomic from the next browser read onward.
	localStorage.setItem(AE_LUA_FRAG_IMPORTED_EVENTS_STORAGE_KEY,
		JSON.stringify(fragSheetState.aeLuaImportedEvents || {}));
	captureFragBackupSnapshot("frag-update", false);
}

function deepCloneJsonValue(value, fallbackValue) {
	try {
		return JSON.parse(JSON.stringify(value));
	} catch (err) {
		return fallbackValue;
	}
}

function collectRosterSetIdsFromContainer(containerId) {
	var ids = [];
	var container = document.getElementById(containerId);
	if (!container) return ids;
	$(container).find(".trainer-pok.left-side").each(function () {
		var setId = String($(this).attr("data-id") || "").trim();
		if (setId) ids.push(setId);
	});
	return ids;
}

function collectPlayerRosterLayout() {
	return {
		team: collectRosterSetIdsFromContainer("team-poke-list"),
		box: collectRosterSetIdsFromContainer("box-poke-list"),
		box2: collectRosterSetIdsFromContainer("box-poke-list2"),
		trash: collectRosterSetIdsFromContainer("trash-box")
	};
}

function normalizeRosterLayout(rawLayout) {
	var layout = rawLayout || {};
	var normalized = {
		team: [],
		box: [],
		box2: [],
		trash: []
	};
	var keys = ["team", "box", "box2", "trash"];
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var source = Array.isArray(layout[key]) ? layout[key] : [];
		for (var j = 0; j < source.length; j++) {
			var setId = String(source[j] || "").trim();
			if (!setId) continue;
			normalized[key].push(setId);
		}
	}
	return normalized;
}

function getStoredPlayerRosterLayout() {
	var rawLayout = localStorage.getItem(PLAYER_ROSTER_LAYOUT_STORAGE_KEY);
	if (rawLayout === null) return null;
	return normalizeRosterLayout(safeJsonParse(rawLayout, {}));
}

function saveStoredPlayerRosterLayout(layout) {
	localStorage.setItem(PLAYER_ROSTER_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeRosterLayout(layout)));
}

function saveCurrentPlayerRosterLayout() {
	saveStoredPlayerRosterLayout(collectPlayerRosterLayout());
}

function hasRosterLayoutEntries(layout) {
	var normalizedLayout = normalizeRosterLayout(layout);
	return !!(
		normalizedLayout.team.length ||
		normalizedLayout.box.length ||
		normalizedLayout.box2.length ||
		normalizedLayout.trash.length
	);
}

function buildRosterLayoutFromCustomsets(customsets) {
	var layout = normalizeRosterLayout({});
	var seenSetIds = {};
	if (!customsets || typeof customsets !== "object") return layout;
	for (var speciesName in customsets) {
		if (!Object.prototype.hasOwnProperty.call(customsets, speciesName)) continue;
		var speciesSets = customsets[speciesName];
		if (!speciesSets || typeof speciesSets !== "object") continue;
		for (var setName in speciesSets) {
			if (!Object.prototype.hasOwnProperty.call(speciesSets, setName)) continue;
			var normalizedSpecies = String(speciesName || "").trim();
			var normalizedSetName = String(setName || "").trim();
			if (!normalizedSpecies || !normalizedSetName) continue;
			var setId = normalizedSpecies + " (" + normalizedSetName + ")";
			if (seenSetIds[setId]) continue;
			seenSetIds[setId] = true;
			layout.box.push(setId);
		}
	}
	return layout;
}

function filterRosterLayoutToAvailableSets(layout) {
	var normalizedLayout = normalizeRosterLayout(layout);
	function isAvailableSetId(setId) {
		if (typeof getSetOptionById === "function" && getSetOptionById(setId)) return true;
		var parsed = parseSetId(setId);
		return !!(parsed.species && parsed.label && typeof setdex !== "undefined" &&
			setdex[parsed.species] && setdex[parsed.species][parsed.label]);
	}
	var filteredLayout = {
		team: [],
		box: [],
		box2: [],
		trash: []
	};
	var zoneKeys = ["team", "box", "box2", "trash"];
	for (var i = 0; i < zoneKeys.length; i++) {
		var zoneKey = zoneKeys[i];
		for (var j = 0; j < normalizedLayout[zoneKey].length; j++) {
			var setId = normalizedLayout[zoneKey][j];
			if (!setId || !isAvailableSetId(setId)) continue;
			filteredLayout[zoneKey].push(setId);
		}
	}
	return filteredLayout;
}

function restorePlayerRosterLayoutFromStorage(customsets) {
	var storedLayout = getStoredPlayerRosterLayout();
	var nextLayout = storedLayout !== null
		? storedLayout
		: buildRosterLayoutFromCustomsets(customsets);
	nextLayout = filterRosterLayoutToAvailableSets(nextLayout);
	applyPlayerRosterLayout(nextLayout);
	saveStoredPlayerRosterLayout(nextLayout);
	applyPlayerRosterSearchFilter();
	return hasRosterLayoutEntries(nextLayout);
}

window.restorePlayerRosterLayoutFromStorage = restorePlayerRosterLayoutFromStorage;

function buildRosterSpriteNodeId(setId) {
	var parsed = parseSetId(setId);
	var rawBase = String(parsed.species || "") + String(parsed.label || "");
	var base = rawBase.replace(/[^a-zA-Z0-9_-]+/g, "") || "customset";
	var nodeId = base;
	var suffix = 1;
	while (document.getElementById(nodeId)) {
		nodeId = base + "-" + suffix;
		suffix += 1;
	}
	return nodeId;
}

function createRosterSpriteFromSetId(setId) {
	var parsed = parseSetId(setId);
	if (!parsed.species) return null;
	var sprite = document.createElement("img");
	sprite.id = buildRosterSpriteNodeId(setId);
	sprite.className = "trainer-pok left-side";
	sprite.loading = "lazy";
	sprite.decoding = "async";
	setTrainerSpriteImage(sprite, parsed.species);
	sprite.dataset.id = setId;
	sprite.addEventListener("dragstart", dragstart_handler);
	return sprite;
}

function applyPlayerRosterLayout(layout) {
	var normalizedLayout = normalizeRosterLayout(layout);
	var containerMap = {
		team: document.getElementById("team-poke-list"),
		box: document.getElementById("box-poke-list"),
		box2: document.getElementById("box-poke-list2"),
		trash: document.getElementById("trash-box")
	};
	for (var zoneKey in containerMap) {
		if (!Object.prototype.hasOwnProperty.call(containerMap, zoneKey)) continue;
		if (containerMap[zoneKey]) containerMap[zoneKey].innerHTML = "";
	}
	for (var listKey in normalizedLayout) {
		if (!Object.prototype.hasOwnProperty.call(normalizedLayout, listKey)) continue;
		var targetContainer = containerMap[listKey];
		if (!targetContainer) continue;
		for (var i = 0; i < normalizedLayout[listKey].length; i++) {
			var setId = normalizedLayout[listKey][i];
			var spriteNode = createRosterSpriteFromSetId(setId);
			if (!spriteNode) continue;
			targetContainer.appendChild(spriteNode);
			applyPrimaryIconSheetIfNeeded(spriteNode, parseSetId(setId).species);
		}
	}
	saveStoredPlayerRosterLayout(normalizedLayout);
}

function normalizeFragSnapshotPayload(rawPayload) {
	var payload = rawPayload || {};
	var normalizedFragSheet = normalizeFragSheetStorage(
		payload.fragSheet && typeof payload.fragSheet === "object"
			? deepCloneJsonValue(payload.fragSheet, {entries: {}, archivedEntries: {}})
			: {entries: {}, archivedEntries: {}}
	);
	var normalizedCustomsets = payload.customsets && typeof payload.customsets === "object"
		? deepCloneJsonValue(payload.customsets, {})
		: {};
	var normalizedRoster = normalizeRosterLayout(payload.roster);
	return {
		fragSheet: normalizedFragSheet,
		customsets: normalizedCustomsets,
		roster: normalizedRoster
	};
}

function createFragSnapshotPayload() {
	var fragSheetSnapshot = normalizeFragSheetStorage(
		safeJsonParse(localStorage.getItem(FRAG_SHEET_STORAGE_KEY), {entries: {}, archivedEntries: {}})
	);
	var customsetsSnapshot = safeJsonParse(localStorage.getItem("customsets"), {});
	if (!customsetsSnapshot || typeof customsetsSnapshot !== "object") customsetsSnapshot = {};
	return normalizeFragSnapshotPayload({
		fragSheet: fragSheetSnapshot,
		customsets: customsetsSnapshot,
		roster: collectPlayerRosterLayout()
	});
}

function getFragTotalKillsFromSnapshotPayload(payload) {
	var normalized = normalizeFragSnapshotPayload(payload);
	var entryMaps = [
		normalized.fragSheet.entries || {},
		normalized.fragSheet.archivedEntries || {}
	];
	var total = 0;
	for (var mapIndex = 0; mapIndex < entryMaps.length; mapIndex++) {
		var entries = entryMaps[mapIndex];
		for (var setId in entries) {
			if (!Object.prototype.hasOwnProperty.call(entries, setId)) continue;
			var killCount = parseInt(entries[setId] && entries[setId].totalKills, 10);
			if (!Number.isNaN(killCount) && killCount > 0) total += killCount;
		}
	}
	return total;
}

function formatFragSnapshotDateLabel(rawDate) {
	var parsedDate = new Date(rawDate || Date.now());
	if (Number.isNaN(parsedDate.getTime())) return "Unknown Time";
	return parsedDate.toLocaleString();
}

function buildFragSnapshotDefaultName(prefix) {
	var labelPrefix = String(prefix || "Snapshot").trim() || "Snapshot";
	return labelPrefix + " " + formatFragSnapshotDateLabel(Date.now());
}

function getStoredFragSheetStates() {
	var parsed = safeJsonParse(localStorage.getItem(FRAG_SHEET_STATES_STORAGE_KEY), []);
	return Array.isArray(parsed) ? parsed : [];
}

function saveStoredFragSheetStates(states) {
	localStorage.setItem(FRAG_SHEET_STATES_STORAGE_KEY, JSON.stringify(Array.isArray(states) ? states : []));
}

function getStoredFragSheetBackups() {
	var parsed = safeJsonParse(localStorage.getItem(FRAG_SHEET_BACKUPS_STORAGE_KEY), []);
	return Array.isArray(parsed) ? parsed : [];
}

function saveStoredFragSheetBackups(backups) {
	var pendingBackups = Array.isArray(backups) ? backups.slice() : [];
	while (pendingBackups.length) {
		try {
			localStorage.setItem(FRAG_SHEET_BACKUPS_STORAGE_KEY, JSON.stringify(pendingBackups));
			return true;
		} catch (err) {
			// Backups include custom sets and can exceed the browser's per-site
			// quota. Prefer dropping the oldest backup to breaking the action
			// which triggered this best-effort safety snapshot.
			pendingBackups.pop();
		}
	}
	try {
		localStorage.removeItem(FRAG_SHEET_BACKUPS_STORAGE_KEY);
	} catch (err) {}
	if (window.console && typeof window.console.warn === "function") {
		window.console.warn("[AstralCalc] Frag backup skipped because browser storage is full.");
	}
	return false;
}

function createFragSnapshotRecord(snapshotName, sourceLabel) {
	var normalizedName = String(snapshotName || "").trim() || buildFragSnapshotDefaultName("Snapshot");
	var payload = createFragSnapshotPayload();
	return {
		id: String(sourceLabel || "snapshot") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
		name: normalizedName,
		source: String(sourceLabel || "snapshot"),
		savedAt: new Date().toISOString(),
		totalKills: getFragTotalKillsFromSnapshotPayload(payload),
		payload: payload
	};
}

function saveNamedFragSheetState(snapshotName) {
	var states = getStoredFragSheetStates();
	var record = createFragSnapshotRecord(snapshotName || buildFragSnapshotDefaultName("State"), "state");
	states.unshift(record);
	if (states.length > FRAG_SHEET_STATES_LIMIT) states.length = FRAG_SHEET_STATES_LIMIT;
	saveStoredFragSheetStates(states);
	return record;
}

function captureFragBackupSnapshot(reason, forceCapture) {
	var now = Date.now();
	if (!forceCapture && now - fragLastAutoBackupAt < FRAG_SHEET_BACKUP_COOLDOWN_MS) return null;
	fragLastAutoBackupAt = now;
	var backups = getStoredFragSheetBackups();
	var backupName = buildFragSnapshotDefaultName("Backup");
	var sourceName = reason ? "backup:" + String(reason) : "backup:auto";
	var record = createFragSnapshotRecord(backupName, sourceName);
	backups.unshift(record);
	if (backups.length > FRAG_SHEET_BACKUPS_LIMIT) backups.length = FRAG_SHEET_BACKUPS_LIMIT;
	saveStoredFragSheetBackups(backups);
	if (typeof refreshFragHistoryControls === "function") refreshFragHistoryControls();
	return record;
}

function restoreFragSnapshotPayload(payload) {
	var normalizedPayload = normalizeFragSnapshotPayload(payload);
	var customsets = normalizedPayload.customsets;
	localStorage.setItem("customsets", JSON.stringify(customsets));
	if (typeof updateDex === "function") {
		updateDex(customsets);
	}
	if (Object.keys(customsets).length) {
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else {
		$(allPokemon("#importedSetsOptions")).hide();
	}
	applyPlayerRosterLayout(normalizedPayload.roster);
	localStorage.setItem(FRAG_SHEET_STORAGE_KEY, JSON.stringify(normalizedPayload.fragSheet));
	fragSheetState = null;
	syncFragRoster();
	renderFragSheet();
	applyPlayerRosterSearchFilter();
	if (typeof performCalculations === "function") performCalculations();
	return true;
}

function restoreFragStateById(stateId) {
	var targetId = String(stateId || "").trim();
	if (!targetId) return false;
	var states = getStoredFragSheetStates();
	for (var i = 0; i < states.length; i++) {
		if (String(states[i].id) !== targetId) continue;
		return restoreFragSnapshotPayload(states[i].payload);
	}
	return false;
}

function restoreFragBackupById(backupId) {
	var targetId = String(backupId || "").trim();
	if (!targetId) return false;
	var backups = getStoredFragSheetBackups();
	for (var i = 0; i < backups.length; i++) {
		if (String(backups[i].id) !== targetId) continue;
		return restoreFragSnapshotPayload(backups[i].payload);
	}
	return false;
}

function deleteFragStateById(stateId) {
	var targetId = String(stateId || "").trim();
	if (!targetId) return false;
	var states = getStoredFragSheetStates();
	var filtered = states.filter(function (stateRecord) {
		return String(stateRecord.id) !== targetId;
	});
	if (filtered.length === states.length) return false;
	saveStoredFragSheetStates(filtered);
	return true;
}

function saveManualFragBackup() {
	return captureFragBackupSnapshot("manual", true);
}

window.captureFragBackupSnapshot = captureFragBackupSnapshot;

function ensureFragEntryForSet(setId) {
	if (!setId) return null;
	var state = getFragSheetState();
	var activeEntries = getFragSheetStateEntryMap(state, "entries");
	if (!activeEntries[setId]) {
		var archivedEntries = getFragSheetStateEntryMap(state, "archivedEntries");
		if (archivedEntries[setId]) {
			activeEntries[setId] = normalizeFragEntry(setId, archivedEntries[setId]);
			delete archivedEntries[setId];
		} else {
			activeEntries[setId] = normalizeFragEntry(setId, {});
		}
	}
	return activeEntries[setId];
}

function getFragTotalForSet(setId) {
	var normalizedSetId = String(setId || "");
	if (!normalizedSetId) return 0;
	var state = getFragSheetState();
	var entry = getFragSheetStateEntryMap(state, "entries")[normalizedSetId] ||
		getFragSheetStateEntryMap(state, "archivedEntries")[normalizedSetId];
	if (!entry) return 0;
	var totalKills = parseInt(entry.totalKills, 10);
	if (Number.isNaN(totalKills) || totalKills < 0) return 0;
	return totalKills;
}

function mergeFragCountMap(targetMap, sourceMap) {
	if (!sourceMap || typeof sourceMap !== "object") return;
	for (var mapKey in sourceMap) {
		if (!Object.prototype.hasOwnProperty.call(sourceMap, mapKey)) continue;
		var count = parseInt(sourceMap[mapKey], 10);
		if (Number.isNaN(count) || count <= 0) continue;
		targetMap[mapKey] = (targetMap[mapKey] || 0) + count;
	}
}

function mergeFragVictimBuckets(targetBuckets, sourceBuckets) {
	if (!sourceBuckets || typeof sourceBuckets !== "object") return;
	for (var bucketKey in sourceBuckets) {
		if (!Object.prototype.hasOwnProperty.call(sourceBuckets, bucketKey)) continue;
		if (!targetBuckets[bucketKey] || typeof targetBuckets[bucketKey] !== "object") {
			targetBuckets[bucketKey] = {};
		}
		var sourceBucket = sourceBuckets[bucketKey];
		if (!sourceBucket || typeof sourceBucket !== "object") continue;
		for (var victimKey in sourceBucket) {
			if (!Object.prototype.hasOwnProperty.call(sourceBucket, victimKey)) continue;
			var victimCount = parseInt(sourceBucket[victimKey], 10);
			if (Number.isNaN(victimCount) || victimCount <= 0) continue;
			targetBuckets[bucketKey][victimKey] = (targetBuckets[bucketKey][victimKey] || 0) + victimCount;
		}
	}
}

function mergeFragEntrySetIdsInState(state, sourceSetId, targetSetId) {
	if (!state || !sourceSetId || !targetSetId || sourceSetId === targetSetId) return false;
	var activeEntries = getFragSheetStateEntryMap(state, "entries");
	var archivedEntries = getFragSheetStateEntryMap(state, "archivedEntries");
	var sourceEntry = activeEntries[sourceSetId] || archivedEntries[sourceSetId];
	if (!sourceEntry) return false;
	var targetEntry = normalizeFragEntry(targetSetId,
		activeEntries[targetSetId] || archivedEntries[targetSetId] || {});
	sourceEntry = normalizeFragEntry(sourceSetId, sourceEntry);

	var sourceTotal = parseInt(sourceEntry.totalKills, 10);
	if (!Number.isNaN(sourceTotal) && sourceTotal > 0) {
		var targetTotal = parseInt(targetEntry.totalKills, 10);
		if (Number.isNaN(targetTotal) || targetTotal < 0) targetTotal = 0;
		targetEntry.totalKills = targetTotal + sourceTotal;
	}

	mergeFragCountMap(targetEntry.fights, sourceEntry.fights);
	mergeFragCountMap(targetEntry.splits, sourceEntry.splits);
	mergeFragVictimBuckets(targetEntry.fightVictims, sourceEntry.fightVictims);
	mergeFragVictimBuckets(targetEntry.splitVictims, sourceEntry.splitVictims);

	if (!targetEntry.lastVictim && sourceEntry.lastVictim) {
		targetEntry.lastVictim = String(sourceEntry.lastVictim);
	}
	if (!targetEntry.isDead && sourceEntry.isDead) {
		targetEntry.isDead = true;
		targetEntry.deathFight = String(sourceEntry.deathFight || targetEntry.deathFight || "");
	}

	activeEntries[targetSetId] = normalizeFragEntry(targetSetId, targetEntry);
	delete activeEntries[sourceSetId];
	delete archivedEntries[sourceSetId];
	delete archivedEntries[targetSetId];

	// Keep the persisted ae_lua event ledger aligned with the canonical player
	// set ID. Event IDs stay unchanged, so this is metadata migration only and
	// cannot replay or duplicate a recorded frag.
	// Older builds kept this ledger in a separate localStorage key. Pull those
	// records into the authoritative state before rewriting IDs so a subsequent
	// save cannot copy legacy-only metadata back under the stale set ID.
	var legacyImportedEvents = {};
	try {
		legacyImportedEvents = normalizeAeLuaImportedEventStorage(
			safeJsonParse(localStorage.getItem(AE_LUA_FRAG_IMPORTED_EVENTS_STORAGE_KEY), {})
		);
	} catch (err) {
		legacyImportedEvents = {};
	}
	var importedEvents = Object.assign({}, legacyImportedEvents,
		normalizeAeLuaImportedEventStorage(state.aeLuaImportedEvents));
	for (var eventId in importedEvents) {
		if (!Object.prototype.hasOwnProperty.call(importedEvents, eventId)) continue;
		var importRecord = importedEvents[eventId];
		if (!importRecord || typeof importRecord !== "object") continue;
		if (String(importRecord.killerSetId || "") === sourceSetId) {
			importRecord.killerSetId = targetSetId;
		}
		if (importRecord.type === "death" && String(importRecord.victimSetId || "") === sourceSetId) {
			importRecord.victimSetId = targetSetId;
		}
	}
	state.aeLuaImportedEvents = importedEvents;
	return true;
}

function mergeFragEntriesFromEvolutionDrop(sourceSetId, targetSetId) {
	var state = getFragSheetState();
	if (!mergeFragEntrySetIdsInState(state, sourceSetId, targetSetId)) return false;
	saveFragSheetState();
	return true;
}

function getTrainerPokSpriteElement(node) {
	if (!node || node.nodeType !== 1) return null;
	if (node.classList.contains("trainer-pok") && node.classList.contains("left-side")) return node;
	var descendantSprite = node.querySelector(".trainer-pok.left-side");
	if (descendantSprite) return descendantSprite;
	var current = node.parentElement;
	while (current) {
		if (current.classList &&
			current.classList.contains("trainer-pok") &&
			current.classList.contains("left-side")) {
			return current;
		}
		current = current.parentElement;
	}
	return null;
}

function getTrainerPokRootNode(node) {
	if (!node || node.nodeType !== 1) return null;
	if (node.classList.contains("trainer-pok-slot")) return node;
	var current = node.parentElement;
	while (current) {
		if (current.classList && current.classList.contains("trainer-pok-slot")) return current;
		current = current.parentElement;
	}
	return node;
}

function getTrainerPokContainerElement(node) {
	var rootNode = getTrainerPokRootNode(node);
	if (!rootNode) return null;
	var current = rootNode;
	while (current) {
		if (current.id === "team-poke-list" ||
			current.id === "box-poke-list" ||
			current.id === "box-poke-list2" ||
			current.id === "trash-box") {
			return current;
		}
		current = current.parentElement;
	}
	return null;
}

function ensureTrainerPokSlot(spriteElement) {
	if (!spriteElement || !spriteElement.classList || !spriteElement.classList.contains("trainer-pok")) return null;
	if (!spriteElement.classList.contains("left-side")) return null;
	var existingSlot = $(spriteElement).parent(".trainer-pok-slot").get(0);
	if (existingSlot) return existingSlot;
	if (!spriteElement.parentNode) return null;
	var slot = document.createElement("div");
	slot.className = "trainer-pok-slot";
	spriteElement.parentNode.insertBefore(slot, spriteElement);
	slot.appendChild(spriteElement);
	var badge = document.createElement("span");
	badge.className = "trainer-pok-frag-total";
	badge.textContent = "0";
	slot.appendChild(badge);
	return slot;
}

function hideTrainerFragBorderTotals() {
	$(".trainer-pok-slot").removeClass("show-frag-total");
	$(".trainer-pok-frag-total").each(function () {
		this.style.display = "none";
		this.className = "trainer-pok-frag-total";
	});
}

function updateTrainerFragBorderTotals() {
	var showTotalFrags = !!getAppSettings().totalFragsOnBorder;
	var playerSprites = $(".trainer-pok.left-side");
	if (!playerSprites.length) return hideTrainerFragBorderTotals();
	if (!showTotalFrags) {
		return hideTrainerFragBorderTotals();
	}
	// This function is also called directly by settings and drag/drop paths.
	// Reconcile persisted records first rather than depending on the Frag Sheet
	// panel itself having rendered beforehand.
	syncFragRoster();
	var spriteRows = [];
	playerSprites.each(function () {
		var spriteElement = this;
		var slot = ensureTrainerPokSlot(spriteElement);
		if (!slot) return;
		var fragTotal = getFragTotalForSet($(spriteElement).attr("data-id"));
		spriteRows.push({
			slot: slot,
			fragTotal: fragTotal
		});
	});
	var rankedTotals = spriteRows
		.map(function (row) { return row.fragTotal; })
		.filter(function (fragTotal) { return fragTotal > 0; })
		.sort(function (a, b) { return b - a; });
	var uniqueRankedTotals = [];
	for (var i = 0; i < rankedTotals.length; i++) {
		if (uniqueRankedTotals.indexOf(rankedTotals[i]) !== -1) continue;
		uniqueRankedTotals.push(rankedTotals[i]);
		if (uniqueRankedTotals.length >= 3) break;
	}
	var rankClassByTotal = {};
	if (uniqueRankedTotals.length > 0) rankClassByTotal[uniqueRankedTotals[0]] = "frag-rank-gold";
	if (uniqueRankedTotals.length > 1) rankClassByTotal[uniqueRankedTotals[1]] = "frag-rank-silver";
	if (uniqueRankedTotals.length > 2) rankClassByTotal[uniqueRankedTotals[2]] = "frag-rank-bronze";
	for (i = 0; i < spriteRows.length; i++) {
		var row = spriteRows[i];
		var slot = row.slot;
		var badge = slot.querySelector(".trainer-pok-frag-total");
		if (!badge) {
			badge = document.createElement("span");
			badge.className = "trainer-pok-frag-total";
			slot.appendChild(badge);
		}
		badge.className = "trainer-pok-frag-total";
		var rankClass = rankClassByTotal[row.fragTotal];
		if (rankClass) badge.classList.add(rankClass);
		badge.textContent = String(row.fragTotal);
		badge.style.display = "";
		slot.classList.add("show-frag-total");
	}
}

function collectPlayerRosterSetIds() {
	var rosterSetIds = [];
	var seenSetIds = {};
	var rosterSprites = document.querySelectorAll(PLAYER_ROSTER_SPRITE_SELECTOR);
	for (var i = 0; i < rosterSprites.length; i++) {
		var setId = String(rosterSprites[i].getAttribute("data-id") || "").trim();
		if (!setId || seenSetIds[setId]) continue;
		seenSetIds[setId] = true;
		rosterSetIds.push(setId);
	}
	return rosterSetIds;
}

function buildPlayerRosterSearchText(setId) {
	var parsedSet = parseSetId(setId);
	var speciesName = String(parsedSet.species || "").trim();
	var setName = String(parsedSet.label || "").trim();
	var searchParts = [setId, parsedSet.species, parsedSet.label];
	var setData = speciesName && setName && setdex && setdex[speciesName]
		? setdex[speciesName][setName]
		: null;
	if (setData && typeof setData === "object") {
		if (typeof setData.ability === "string") searchParts.push(setData.ability);
		if (Array.isArray(setData.abilities)) searchParts = searchParts.concat(setData.abilities);
		if (Array.isArray(setData.moves)) searchParts = searchParts.concat(setData.moves);
	}
	return searchParts.join(" ").toLowerCase();
}

function toPlayerRosterSearchToken(value) {
	return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getPlayerRosterSearchPayloadBySetId(setId, cacheMap) {
	if (cacheMap && cacheMap[setId]) return cacheMap[setId];
	var searchText = buildPlayerRosterSearchText(setId);
	var normalizedSearchText = toPlayerRosterSearchToken(searchText);
	var payload = {
		searchText: searchText,
		normalizedSearchText: normalizedSearchText
	};
	if (cacheMap) cacheMap[setId] = payload;
	return payload;
}

function applyPlayerRosterSearchFilter() {
	var searchInput = document.getElementById("search");
	var query = String(searchInput && typeof searchInput.value !== "undefined" ? searchInput.value : "")
		.trim()
		.toLowerCase();
	var queryTerms = query.split(/\s+/).filter(Boolean);
	var normalizedTerms = queryTerms.map(toPlayerRosterSearchToken);
	var setSearchCache = {};
	var rosterSprites = document.querySelectorAll(PLAYER_ROSTER_SPRITE_SELECTOR);
	for (var i = 0; i < rosterSprites.length; i++) {
		var sprite = rosterSprites[i];
		var rootNode = getTrainerPokRootNode(sprite);
		if (!rootNode) rootNode = sprite;
		var setId = String(sprite.getAttribute("data-id") || "");
		var cachedSearchPayload = getPlayerRosterSearchPayloadBySetId(setId, setSearchCache);
		var searchText = cachedSearchPayload.searchText;
		var normalizedSearchText = cachedSearchPayload.normalizedSearchText;
		var isMatch = !query ||
			searchText.indexOf(query) >= 0 ||
			queryTerms.every(function (term, index) {
				return searchText.indexOf(term) >= 0 ||
					(normalizedTerms[index] && normalizedSearchText.indexOf(normalizedTerms[index]) >= 0);
			});
		var nextDisplay = isMatch ? "" : "none";
		if (rootNode.style.display !== nextDisplay) rootNode.style.display = nextDisplay;
	}
}

function bindPlayerRosterSearchInput() {
	var searchInput = document.getElementById("search");
	if (!searchInput) return;
	$(searchInput)
		.off("input.searchfilter keyup.searchfilter change.searchfilter blur.searchfilter")
		.on("input.searchfilter keyup.searchfilter", function () {
			if (playerRosterSearchDebounceTimer) window.clearTimeout(playerRosterSearchDebounceTimer);
			playerRosterSearchDebounceTimer = window.setTimeout(function () {
				playerRosterSearchDebounceTimer = null;
				applyPlayerRosterSearchFilter();
			}, PLAYER_ROSTER_SEARCH_DEBOUNCE_MS);
		})
		.on("change.searchfilter blur.searchfilter", function () {
			if (playerRosterSearchDebounceTimer) {
				window.clearTimeout(playerRosterSearchDebounceTimer);
				playerRosterSearchDebounceTimer = null;
			}
			applyPlayerRosterSearchFilter();
		});
}

function getFragRosterSpeciesFamily(setId) {
	var speciesName = parseSetId(setId).species;
	if (typeof aeLuaTrainerNormalizeSpecies === "function") {
		return aeLuaTrainerNormalizeSpecies(speciesName);
	}
	return normalizeAeLuaFragSpecies(speciesName);
}

function fragEntryHasSavedState(entry) {
	if (!entry || typeof entry !== "object") return false;
	var totalKills = parseInt(entry.totalKills, 10);
	return (!Number.isNaN(totalKills) && totalKills > 0) || !!entry.isDead;
}

function reconcileFragEntriesWithRoster(state, rosterSetIds) {
	if (!state || !Array.isArray(rosterSetIds) || !rosterSetIds.length) return false;
	var activeEntries = getFragSheetStateEntryMap(state, "entries");
	var archivedEntries = getFragSheetStateEntryMap(state, "archivedEntries");
	var rosterLookup = {};
	var rosterByFamily = {};
	var teamBindings = typeof getAeLuaTeamBindings === "function"
		? getAeLuaTeamBindings()
		: {version: 1, bySetId: {}};
	var didChangeBindings = false;
	for (var rosterIndex = 0; rosterIndex < rosterSetIds.length; rosterIndex++) {
		var rosterSetId = rosterSetIds[rosterIndex];
		rosterLookup[rosterSetId] = true;
		var rosterFamily = getFragRosterSpeciesFamily(rosterSetId);
		if (!rosterByFamily[rosterFamily]) rosterByFamily[rosterFamily] = [];
		rosterByFamily[rosterFamily].push(rosterSetId);
	}

	function collectCandidates(targetSetId) {
		var targetFamily = getFragRosterSpeciesFamily(targetSetId);
		var candidates = [];
		var seen = {};
		function appendMap(entryMap) {
			for (var sourceSetId in entryMap) {
				if (!Object.prototype.hasOwnProperty.call(entryMap, sourceSetId) ||
					sourceSetId === targetSetId || rosterLookup[sourceSetId] || seen[sourceSetId]) continue;
				var sourceEntry = entryMap[sourceSetId];
				if (!fragEntryHasSavedState(sourceEntry) ||
					getFragRosterSpeciesFamily(sourceSetId) !== targetFamily) continue;
				seen[sourceSetId] = true;
				candidates.push(sourceSetId);
			}
		}
		appendMap(activeEntries);
		appendMap(archivedEntries);
		return candidates;
	}

	function bindingsAllowMigration(sourceSetId, targetSetId) {
		var sourceBinding = teamBindings.bySetId && teamBindings.bySetId[sourceSetId];
		var targetBinding = teamBindings.bySetId && teamBindings.bySetId[targetSetId];
		if (sourceBinding && targetBinding &&
			typeof aeLuaPokemonIdentitiesMatch === "function" &&
			!aeLuaPokemonIdentitiesMatch(getAeLuaPokemonIdentity(sourceBinding),
				getAeLuaPokemonIdentity(targetBinding))) {
			return false;
		}
		if (!sourceBinding || typeof aeLuaPokemonIdentitiesMatch !== "function") return true;
		for (var boundRosterIndex = 0; boundRosterIndex < rosterSetIds.length; boundRosterIndex++) {
			var boundRosterSetId = rosterSetIds[boundRosterIndex];
			if (boundRosterSetId === targetSetId) continue;
			var otherBinding = teamBindings.bySetId[boundRosterSetId];
			if (otherBinding && aeLuaPokemonIdentitiesMatch(getAeLuaPokemonIdentity(sourceBinding),
				getAeLuaPokemonIdentity(otherBinding))) {
				return false;
			}
		}
		return true;
	}

	function findIdentityMatchedCandidate(targetSetId, candidates) {
		if (!teamBindings.bySetId || typeof aeLuaPokemonIdentitiesMatch !== "function" ||
			typeof getAeLuaPokemonIdentity !== "function") return "";
		var targetIdentity = getAeLuaPokemonIdentity(teamBindings.bySetId[targetSetId]);
		if (!targetIdentity) return "";
		var matchingSources = candidates.filter(function (sourceSetId) {
			return aeLuaPokemonIdentitiesMatch(
				getAeLuaPokemonIdentity(teamBindings.bySetId[sourceSetId]), targetIdentity);
		});
		if (matchingSources.length !== 1) return "";

		// A personality/OT identity must point to exactly one current roster row.
		// This lets duplicate species reconcile safely while refusing malformed or
		// ambiguous binding data.
		var matchingRosterCount = rosterSetIds.filter(function (boundRosterSetId) {
			return aeLuaPokemonIdentitiesMatch(
				getAeLuaPokemonIdentity(teamBindings.bySetId[boundRosterSetId]), targetIdentity);
		}).length;
		return matchingRosterCount === 1 ? matchingSources[0] : "";
	}

	var didChange = false;
	for (rosterIndex = 0; rosterIndex < rosterSetIds.length; rosterIndex++) {
		rosterSetId = rosterSetIds[rosterIndex];
		var targetEntry = activeEntries[rosterSetId] || archivedEntries[rosterSetId];
		var targetHasKills = !!(targetEntry && (parseInt(targetEntry.totalKills, 10) || 0) > 0);
		var candidates = collectCandidates(rosterSetId);
		if (!candidates.length) continue;

		var sourceSetId = findIdentityMatchedCandidate(rosterSetId, candidates);
		var identityProven = !!sourceSetId;
		// A non-empty current record is merged only when identity metadata proves
		// both set IDs refer to the same individual. This safely repairs split
		// history without combining two copies of the same species.
		if (targetHasKills && !identityProven) continue;
		var targetLabel = normalizeAeLuaFragText(parseSetId(rosterSetId).label);
		var matchingLabels = targetLabel ? candidates.filter(function (sourceSetId) {
			return normalizeAeLuaFragText(parseSetId(sourceSetId).label) === targetLabel;
		}) : [];
		if (!sourceSetId && matchingLabels.length === 1) sourceSetId = matchingLabels[0];
		var family = getFragRosterSpeciesFamily(rosterSetId);
		if (!sourceSetId && matchingLabels.length === 0 &&
			(rosterByFamily[family] || []).length === 1 && candidates.length === 1) {
			sourceSetId = candidates[0];
		}
		// Never guess between multiple copies of the same species. Exact label or
		// one-roster/one-history is required for an automatic legacy migration.
		if (!sourceSetId || !bindingsAllowMigration(sourceSetId, rosterSetId)) continue;
		if (mergeFragEntrySetIdsInState(state, sourceSetId, rosterSetId)) {
			var sourceBinding = teamBindings.bySetId && teamBindings.bySetId[sourceSetId];
			if (sourceBinding) {
				if (!teamBindings.bySetId[rosterSetId]) {
					teamBindings.bySetId[rosterSetId] = sourceBinding;
				}
				delete teamBindings.bySetId[sourceSetId];
				didChangeBindings = true;
			}
			didChange = true;
		}
	}
	if (didChangeBindings && typeof saveAeLuaTeamBindings === "function") {
		saveAeLuaTeamBindings(teamBindings);
	}
	return didChange;
}

function syncFragRoster(options) {
	var syncOptions = options || {};
	var pruneMissing = !!syncOptions.pruneMissing;
	var allowEmptyPrune = !!syncOptions.allowEmptyPrune;
	var rosterSetIds = collectPlayerRosterSetIds();
	var state = getFragSheetState();
	var activeEntries = getFragSheetStateEntryMap(state, "entries");
	var archivedEntries = getFragSheetStateEntryMap(state, "archivedEntries");
	var didChange = false;
	for (var i = 0; i < rosterSetIds.length; i++) {
		var rosterSetId = rosterSetIds[i];
		if (archivedEntries[rosterSetId]) {
			activeEntries[rosterSetId] = normalizeFragEntry(rosterSetId, archivedEntries[rosterSetId]);
			delete archivedEntries[rosterSetId];
			didChange = true;
			continue;
		}
		if (!activeEntries[rosterSetId]) {
			activeEntries[rosterSetId] = normalizeFragEntry(rosterSetId, {});
			didChange = true;
		}
	}
	if (reconcileFragEntriesWithRoster(state, rosterSetIds)) didChange = true;
	if (pruneMissing && !allowEmptyPrune && !rosterSetIds.length) {
		pruneMissing = false;
	}
	if (pruneMissing) {
		for (var setId in activeEntries) {
			if (!Object.prototype.hasOwnProperty.call(activeEntries, setId)) continue;
			if (rosterSetIds.indexOf(setId) !== -1) continue;
			archivedEntries[setId] = normalizeFragEntry(setId, activeEntries[setId]);
			delete activeEntries[setId];
			didChange = true;
		}
	}
	if (didChange) saveFragSheetState();
}

function scheduleFragSheetRefresh() {
	if (fragSheetRefreshTimer) return;
	fragSheetRefreshTimer = window.setTimeout(function () {
		fragSheetRefreshTimer = null;
		saveCurrentPlayerRosterLayout();
		syncFragRoster({pruneMissing: true});
		renderFragSheet();
		refreshNotesPanelIfOpen();
	}, 40);
}

function setupFragSheetAutoRefresh() {
	if (fragSheetAutoObserver || typeof MutationObserver === "undefined") return;
	var watchNodes = [
		document.getElementById("team-poke-list"),
		document.getElementById("box-poke-list"),
		document.getElementById("box-poke-list2"),
		document.getElementById("trash-box")
	];
	fragSheetAutoObserver = new MutationObserver(function () {
		scheduleFragSheetRefresh();
	});
	for (var i = 0; i < watchNodes.length; i++) {
		if (!watchNodes[i]) continue;
		fragSheetAutoObserver.observe(watchNodes[i], {childList: true});
	}
}

function addFragKill(killerSetId, victimSetId, fightLabel) {
	var entry = ensureFragEntryForSet(killerSetId);
	if (!entry) return false;
	var fight = String(fightLabel || getCurrentFightLabel() || "Unknown Fight");
	var split = String(getCurrentSplitNumber(fight));
	var victimKey = normalizeFragVictimKey(victimSetId);
	entry.totalKills += 1;
	entry.fights[fight] = (entry.fights[fight] || 0) + 1;
	entry.splits[split] = (entry.splits[split] || 0) + 1;
	incrementFragVictimBucketCount(entry, "fightVictims", fight, victimKey, 1);
	incrementFragVictimBucketCount(entry, "splitVictims", split, victimKey, 1);
	entry.lastVictim = getFragVictimDisplayName(victimKey);
	saveFragSheetState();
	renderFragSheet();
	return true;
}

function getAeLuaFragImportedEventMap() {
	var legacyEvents = normalizeAeLuaImportedEventStorage(
		safeJsonParse(localStorage.getItem(AE_LUA_FRAG_IMPORTED_EVENTS_STORAGE_KEY), {})
	);
	return Object.assign({}, legacyEvents,
		normalizeAeLuaImportedEventStorage(getFragSheetState().aeLuaImportedEvents));
}

function saveAeLuaFragImportedEventMap(eventMap) {
	var normalizedEvents = normalizeAeLuaImportedEventStorage(eventMap);
	getFragSheetState().aeLuaImportedEvents = normalizedEvents;
	localStorage.setItem(AE_LUA_FRAG_IMPORTED_EVENTS_STORAGE_KEY, JSON.stringify(normalizedEvents));
	saveFragSheetState();
}

function normalizeAeLuaFragText(value) {
	return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeAeLuaFragSpecies(value) {
	return normalizeAeLuaFragText(value).replace(/\s+/g, "");
}

function getAeLuaFragMonSpecies(mon) {
	return mon && mon.species ? String(mon.species) : "";
}

function addAeLuaFragSetId(setIds, seenSetIds, setId) {
	var normalizedSetId = String(setId || "").trim();
	if (!normalizedSetId || seenSetIds[normalizedSetId]) return;
	seenSetIds[normalizedSetId] = true;
	setIds.push(normalizedSetId);
}

function normalizeAeLuaPokemonIdentityPart(value) {
	if (typeof value === "undefined" || value === null || value === "") return "";
	var parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return "";
	return String(Math.floor(parsed));
}

function getAeLuaPokemonIdentity(mon) {
	var personality = normalizeAeLuaPokemonIdentityPart(mon && mon.personality);
	if (personality === "") return null;
	return {
		personality: personality,
		otId: normalizeAeLuaPokemonIdentityPart(mon && mon.otId),
		key: personality + ":" + normalizeAeLuaPokemonIdentityPart(mon && mon.otId)
	};
}

function aeLuaPokemonIdentitiesMatch(left, right) {
	if (!left || !right || left.personality !== right.personality) return false;
	if (left.otId && left.otId !== "0" && right.otId && right.otId !== "0") {
		return left.otId === right.otId;
	}
	return true;
}

function normalizeAeLuaTeamBindings(rawBindings) {
	var source = rawBindings && typeof rawBindings === "object" && !Array.isArray(rawBindings)
		? (rawBindings.bySetId && typeof rawBindings.bySetId === "object" ? rawBindings.bySetId : rawBindings)
		: {};
	var bySetId = {};
	for (var setId in source) {
		if (!Object.prototype.hasOwnProperty.call(source, setId) || setId === "version") continue;
		var rawBinding = source[setId];
		var identity = getAeLuaPokemonIdentity(rawBinding);
		if (!identity) continue;
		bySetId[String(setId)] = {
			personality: identity.personality,
			otId: identity.otId,
			species: String(rawBinding.species || ""),
			nickname: String(rawBinding.nickname || "")
		};
	}
	return {version: 1, bySetId: bySetId};
}

function getAeLuaTeamBindings() {
	return normalizeAeLuaTeamBindings(
		safeJsonParse(localStorage.getItem(AE_LUA_TEAM_BINDINGS_STORAGE_KEY), {})
	);
}

function saveAeLuaTeamBindings(bindings) {
	var normalized = normalizeAeLuaTeamBindings(bindings);
	localStorage.setItem(AE_LUA_TEAM_BINDINGS_STORAGE_KEY, JSON.stringify(normalized));
	return normalized;
}

function setAeLuaTeamBinding(bindings, setId, mon) {
	var identity = getAeLuaPokemonIdentity(mon);
	var normalizedSetId = String(setId || "").trim();
	if (!identity || !normalizedSetId) return false;
	var normalizedBindings = normalizeAeLuaTeamBindings(bindings);
	bindings.version = normalizedBindings.version;
	bindings.bySetId = normalizedBindings.bySetId;
	for (var existingSetId in bindings.bySetId) {
		if (!Object.prototype.hasOwnProperty.call(bindings.bySetId, existingSetId)) continue;
		if (existingSetId === normalizedSetId) continue;
		if (aeLuaPokemonIdentitiesMatch(getAeLuaPokemonIdentity(bindings.bySetId[existingSetId]), identity)) {
			delete bindings.bySetId[existingSetId];
		}
	}
	bindings.bySetId[normalizedSetId] = {
		personality: identity.personality,
		otId: identity.otId,
		species: normalizeAeLuaPokemonSpeciesName(mon),
		nickname: String(mon && mon.nickname || "")
	};
	return true;
}

function findAeLuaBoundTeamSetId(mon, teamSetIds, bindings) {
	var identity = getAeLuaPokemonIdentity(mon);
	if (!identity) return "";
	var sourceBindings = normalizeAeLuaTeamBindings(bindings).bySetId;
	for (var i = 0; i < teamSetIds.length; i++) {
		var setId = teamSetIds[i];
		if (aeLuaPokemonIdentitiesMatch(getAeLuaPokemonIdentity(sourceBindings[setId]), identity)) {
			return setId;
		}
	}
	return "";
}

function getAeLuaFragPlayerSetIds() {
	var setIds = [];
	var seenSetIds = {};
	var layout = collectPlayerRosterLayout();
	var teamSetIds = layout.team || [];
	for (var setIndex = 0; setIndex < teamSetIds.length; setIndex++) {
		addAeLuaFragSetId(setIds, seenSetIds, teamSetIds[setIndex]);
	}
	return setIds;
}

function getAeLuaFragSetNickname(setId) {
	var option = typeof getSetOptionById === "function" ? getSetOptionById(setId) : null;
	if (option && option.nickname) return option.nickname;
	return parseSetId(setId).label || "";
}

function findAeLuaFragKillerSetId(event) {
	var killer = event && event.killer ? event.killer : {};
	var playerSetIds = getAeLuaFragPlayerSetIds();
	var boundSetId = findAeLuaBoundTeamSetId(killer, playerSetIds, getAeLuaTeamBindings());
	if (boundSetId) return boundSetId;
	var killerSpecies = aeLuaTrainerNormalizeSpecies(getAeLuaFragMonSpecies(event && event.killer));
	if (!killerSpecies) return "";
	var killerNickname = normalizeAeLuaFragText(event && event.killer ? event.killer.nickname : "");
	var candidates = [];
	for (var i = 0; i < playerSetIds.length; i++) {
		var setId = playerSetIds[i];
		if (aeLuaTrainerNormalizeSpecies(parseSetId(setId).species) !== killerSpecies) continue;
		candidates.push(setId);
	}
	if (!candidates.length) return "";
	if (killerNickname) {
		for (var nickIndex = 0; nickIndex < candidates.length; nickIndex++) {
			if (normalizeAeLuaFragText(getAeLuaFragSetNickname(candidates[nickIndex])) === killerNickname) {
				return candidates[nickIndex];
			}
		}
	}
	return candidates.length === 1 ? candidates[0] : "";
}

function findAeLuaFragPlayerSetIdForMon(mon) {
	var playerSetIds = getAeLuaFragPlayerSetIds();
	var boundSetId = findAeLuaBoundTeamSetId(mon, playerSetIds, getAeLuaTeamBindings());
	if (boundSetId) return boundSetId;
	var monSpecies = aeLuaTrainerNormalizeSpecies(getAeLuaFragMonSpecies(mon));
	if (!monSpecies) return "";
	var monNickname = normalizeAeLuaFragText(mon && mon.nickname);
	var candidates = [];
	for (var i = 0; i < playerSetIds.length; i++) {
		var setId = playerSetIds[i];
		if (aeLuaTrainerNormalizeSpecies(parseSetId(setId).species) !== monSpecies) continue;
		candidates.push(setId);
	}
	if (!candidates.length) return "";
	if (monNickname) {
		for (var nickIndex = 0; nickIndex < candidates.length; nickIndex++) {
			if (normalizeAeLuaFragText(getAeLuaFragSetNickname(candidates[nickIndex])) === monNickname) {
				return candidates[nickIndex];
			}
		}
	}
	return candidates.length === 1 ? candidates[0] : "";
}

/*
 * AstralCalc dynamic trainer/fight resolution helpers.
 *
 * This block does not create a second trainer
 * database: every registry rebuild is derived from the SETDEX_SV object which
 * the calculator already loaded from js/data/sets/gen9.js. The lightweight
 * fingerprint also means a runtime mutation/addition to SETDEX_SV invalidates
 * the cache automatically.
 *
 * Expected existing AstralCalc helpers are used when available, but fallbacks
 * are included so this block can be tested in isolation:
 *   normalizeAeLuaFragText, normalizeAeLuaFragSpecies,
 *   parseTrainerSetName, getTrainerIndexFromSetData,
 *   getSetDoubleGroupId, getSetDoubleSide.
 */

var aeLuaTrainerRegistryCache = null;
var aeLuaTrainerRegistryFingerprint = "";
var AE_LUA_TRAINER_SPECIES_ALIASES = {
	aegislashblade: "aegislash",
	aegislashshield: "aegislash",
	castformnormal: "castform",
	castformsunny: "castform",
	castformrainy: "castform",
	castformsnowy: "castform",
	cramorantgulping: "cramorant",
	cramorantgorging: "cramorant",
	darmanitanstandardmode: "darmanitan",
	darmanitanzen: "darmanitan",
	darmanitanzenmode: "darmanitan",
	darmanitangalarstandardmode: "darmanitangalar",
	darmanitangalarzenmode: "darmanitangalar",
	eeveestarter: "eevee",
	eiscueiceface: "eiscue",
	eiscuenoiceface: "eiscue",
	florgeswhiteflower: "florgeswhite",
	florgesblueflower: "florges",
	florgesorangeflower: "florges",
	florgesredflower: "florges",
	florgesyellowflower: "florges",
	furfroulareinetrim: "furfroulareine",
	indeedeefemale: "indeedeef",
	mausholdfamilyoffour: "mausholdfour",
	mausholdfamilyofthree: "mausholdthree",
	mimikyudisguised: "mimikyu",
	mimikyubusted: "mimikyu",
	morpekofullbelly: "morpeko",
	morpekohangry: "morpeko",
	palafinzero: "palafin",
	palafinhero: "palafin",
	pikachupartnercap: "pikachupartner",
	pikachualolacap: "pikachualola",
	pikachuhoenncap: "pikachuhoenn",
	pikachukaloscap: "pikachukalos",
	pikachuoriginalcap: "pikachuoriginal",
	pikachusinnohcap: "pikachusinnoh",
	pikachuunovacap: "pikachuunova",
	pikachuworldcap: "pikachuworld",
	polteageistphony: "polteageist",
	polteageistantique: "polteageist",
	sinisteaphony: "sinistea",
	sinisteaantique: "sinistea",
	terapagosnormal: "terapagos",
	terapagosterastal: "terapagos",
	terapagosstellar: "terapagos",
	toxtricitylowkey: "toxtricity",
	unownc2: "unownc",
	urshifusinglestrikestyle: "urshifu",
	wishiwashischool: "wishiwashi",
	xerneasneutral: "xerneas",
	xerneasactive: "xerneas"
};

function aeLuaTrainerNormalizeText(value) {
	if (typeof normalizeAeLuaFragText === "function") {
		return normalizeAeLuaFragText(value);
	}
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function aeLuaTrainerNormalizeSpecies(value) {
	var speciesName = String(value || "").trim();
	var speciesId = typeof normalizeAeLuaFragSpecies === "function"
		? normalizeAeLuaFragSpecies(speciesName)
		: aeLuaTrainerNormalizeText(speciesName).replace(/\s+/g, "");
	// Trainer parties store the pre-transformation species. Calculator sets use
	// the battle form for Megas/Primals, so compare both through the base form.
	speciesId = speciesId.replace(/mega(?:x|y|z)?$/, "").replace(/primal$/, "");
	if (speciesId.indexOf("minior") === 0) speciesId = "minior";
	return AE_LUA_TRAINER_SPECIES_ALIASES[speciesId] || speciesId;
}

function aeLuaTrainerNormalizeItem(value) {
	var itemId = aeLuaTrainerNormalizeText(value).replace(/\s+/g, "");
	return itemId === "none" || itemId === "noitem" ? "" : itemId;
}

function aeLuaTrainerInteger(value, fallbackValue) {
	var parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallbackValue : parsed;
}

function aeLuaTrainerIndexFromSet(setData, fallbackValue) {
	if (typeof getTrainerIndexFromSetData === "function") {
		var helperIndex = getTrainerIndexFromSetData(setData);
		if (helperIndex > 0) return helperIndex;
	}
	if (!setData || typeof setData.index === "undefined" || setData.index === null) {
		return fallbackValue || 0;
	}
	return aeLuaTrainerInteger(setData.index, fallbackValue || 0);
}

function aeLuaTrainerDoubleGroup(setData) {
	if (typeof getSetDoubleGroupId === "function") {
		return String(getSetDoubleGroupId(setData) || "").trim();
	}
	if (!setData) return "";
	var rawGroup = setData.setdoubleGroup;
	if (typeof rawGroup === "undefined") rawGroup = setData.setdoublegroup;
	if (typeof rawGroup === "undefined") rawGroup = setData.setdoubleId;
	if (typeof rawGroup === "undefined") rawGroup = setData.setdoubleid;
	return rawGroup === null || typeof rawGroup === "undefined"
		? ""
		: String(rawGroup).trim();
}

function aeLuaTrainerDoubleSide(setData) {
	if (typeof getSetDoubleSide === "function") {
		return getSetDoubleSide(setData) || 0;
	}
	if (!setData) return 0;
	var rawSide = setData.setdoubleSide;
	if (typeof rawSide === "undefined") rawSide = setData.setdoubleside;
	var normalizedSide = String(rawSide === null || typeof rawSide === "undefined" ? "" : rawSide)
		.trim()
		.toLowerCase();
	if (normalizedSide === "1" || normalizedSide === "top" || normalizedSide === "primary") return 1;
	if (normalizedSide === "2" || normalizedSide === "bottom" || normalizedSide === "secondary") return 2;
	return 0;
}

function aeLuaTrainerParseLabel(label) {
	if (typeof parseTrainerSetName === "function") return parseTrainerSetName(label);
	var normalizedLabel = String(label || "").trim();
	var separatorIndex = normalizedLabel.indexOf("|");
	if (separatorIndex < 0) {
		return {trainerName: normalizedLabel, battleKey: normalizedLabel};
	}
	var trainerName = normalizedLabel.substring(0, separatorIndex).trim();
	var battleKey = normalizedLabel.substring(separatorIndex + 1).trim();
	return {
		trainerName: trainerName || normalizedLabel,
		battleKey: battleKey || normalizedLabel
	};
}

function aeLuaTrainerMakeSourceEntry(speciesName, trainerLabel, setData, sourceOrder, fallbackIndex) {
	var labelParts = aeLuaTrainerParseLabel(trainerLabel);
	var sortIndex = aeLuaTrainerIndexFromSet(setData, fallbackIndex || 0);
	return {
		pokemonName: String(speciesName || "").trim(),
		speciesId: aeLuaTrainerNormalizeSpecies(speciesName),
		trainerLabel: String(trainerLabel || "").trim(),
		normalizedTrainerLabel: aeLuaTrainerNormalizeText(trainerLabel),
		trainerName: labelParts.trainerName,
		trainerBattleKey: labelParts.battleKey,
		setData: setData || {},
		sortIndex: sortIndex,
		sourceOrder: sourceOrder,
		level: aeLuaTrainerInteger(setData && setData.level, 0),
		itemId: aeLuaTrainerNormalizeItem(setData && setData.item),
		groupId: aeLuaTrainerDoubleGroup(setData),
		explicitSide: aeLuaTrainerDoubleSide(setData),
		fullSetName: String(speciesName || "").trim() + " (" + String(trainerLabel || "").trim() + ")"
	};
}

function aeLuaTrainerParseNameEntry(entryText, sourceOrder) {
	var rawEntry = String(entryText || "");
	var closeBracket = rawEntry.indexOf("]");
	var indexText = closeBracket >= 0 ? rawEntry.substring(1, closeBracket) : "0";
	var fullSetName = closeBracket >= 0 ? rawEntry.substring(closeBracket + 1) : rawEntry;
	var openLabel = fullSetName.indexOf(" (");
	var closeLabel = fullSetName.lastIndexOf(")");
	if (openLabel < 0 || closeLabel <= openLabel) return null;
	var speciesName = fullSetName.substring(0, openLabel);
	var trainerLabel = fullSetName.substring(openLabel + 2, closeLabel);
	var activeSetdex = typeof SETDEX_SV !== "undefined" && SETDEX_SV
		? SETDEX_SV
		: (typeof setdex !== "undefined" ? setdex : null);
	var setData = activeSetdex && activeSetdex[speciesName]
		? activeSetdex[speciesName][trainerLabel]
		: null;
	if (!setData) setData = {index: indexText};
	return aeLuaTrainerMakeSourceEntry(
		speciesName,
		trainerLabel,
		setData,
		sourceOrder,
		aeLuaTrainerInteger(indexText, 0)
	);
}

function collectAeLuaTrainerRegistrySourceEntries() {
	var entries = [];
	var sourceOrder = 0;
	if (typeof SETDEX_SV !== "undefined" && SETDEX_SV && typeof SETDEX_SV === "object") {
		for (var speciesName in SETDEX_SV) {
			if (!Object.prototype.hasOwnProperty.call(SETDEX_SV, speciesName)) continue;
			var speciesSets = SETDEX_SV[speciesName];
			if (!speciesSets || typeof speciesSets !== "object") continue;
			for (var trainerLabel in speciesSets) {
				if (!Object.prototype.hasOwnProperty.call(speciesSets, trainerLabel)) continue;
				var setData = speciesSets[trainerLabel];
				if (!setData || typeof setData !== "object") continue;
				entries.push(aeLuaTrainerMakeSourceEntry(
					speciesName,
					trainerLabel,
					setData,
					sourceOrder,
					0
				));
				sourceOrder += 1;
			}
		}
		return entries;
	}

	// Compatibility fallback for a build which exposes only get_trainer_names
	// or its already-materialized TR_NAMES array.
	var trainerNames = [];
	if (typeof get_trainer_names === "function") {
		try {
			trainerNames = get_trainer_names() || [];
		} catch (err) {}
	}
	if (!trainerNames.length && typeof TR_NAMES !== "undefined" && Array.isArray(TR_NAMES)) {
		trainerNames = TR_NAMES;
	}
	for (var entryIndex = 0; entryIndex < trainerNames.length; entryIndex++) {
		var parsedEntry = aeLuaTrainerParseNameEntry(trainerNames[entryIndex], sourceOrder);
		if (!parsedEntry) continue;
		entries.push(parsedEntry);
		sourceOrder += 1;
	}
	return entries;
}

function getAeLuaTrainerRegistrySourceFingerprint(entries) {
	var parts = [String(entries.length)];
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		parts.push([
			entry.speciesId,
			entry.normalizedTrainerLabel,
			entry.sortIndex,
			entry.level,
			entry.itemId,
			aeLuaTrainerNormalizeText(entry.groupId),
			entry.explicitSide
		].join("~"));
	}
	return parts.join("|");
}

function aeLuaTrainerCompareEntries(left, right) {
	var leftHasIndex = left.sortIndex > 0;
	var rightHasIndex = right.sortIndex > 0;
	if (leftHasIndex !== rightHasIndex) return leftHasIndex ? -1 : 1;
	if (left.sortIndex !== right.sortIndex) return left.sortIndex - right.sortIndex;
	return left.sourceOrder - right.sourceOrder;
}

function aeLuaTrainerAddUnique(array, value) {
	if (array.indexOf(value) === -1) array.push(value);
}

function aeLuaTrainerAssignFightSides(fight) {
	var primary = [];
	var secondary = [];
	var unassigned = [];
	var hasExplicitSide = false;
	for (var i = 0; i < fight.entries.length; i++) {
		var entry = fight.entries[i];
		if (entry.explicitSide === 1) {
			primary.push(entry);
			hasExplicitSide = true;
		} else if (entry.explicitSide === 2) {
			secondary.push(entry);
			hasExplicitSide = true;
		} else {
			unassigned.push(entry);
		}
	}

	if (hasExplicitSide) {
		// This is the same compatibility policy used by splitSetDoubleEntries:
		// retain explicit metadata and balance any legacy unassigned entries.
		for (var unassignedIndex = 0; unassignedIndex < unassigned.length; unassignedIndex++) {
			if (primary.length <= secondary.length) primary.push(unassigned[unassignedIndex]);
			else secondary.push(unassigned[unassignedIndex]);
		}
	} else if (fight.groupId && fight.labels.length > 1) {
		// Legacy paired-trainer groups without setdoubleSide metadata are split
		// by trainer label. Their first-index ordering makes this deterministic.
		var entriesByLabel = {};
		var labelOrder = [];
		for (var groupEntryIndex = 0; groupEntryIndex < unassigned.length; groupEntryIndex++) {
			var groupEntry = unassigned[groupEntryIndex];
			var labelKey = groupEntry.normalizedTrainerLabel;
			if (!entriesByLabel[labelKey]) {
				entriesByLabel[labelKey] = [];
				labelOrder.push(labelKey);
			}
			entriesByLabel[labelKey].push(groupEntry);
		}
		if (labelOrder.length > 1) {
			primary = entriesByLabel[labelOrder[0]].slice();
			for (var labelIndex = 1; labelIndex < labelOrder.length; labelIndex++) {
				secondary = secondary.concat(entriesByLabel[labelOrder[labelIndex]]);
			}
		} else {
			primary = unassigned.slice();
		}
	} else {
		// An ordinary singles or one-trainer doubles party is one trainer side.
		primary = unassigned.slice();
	}

	primary.sort(aeLuaTrainerCompareEntries);
	secondary.sort(aeLuaTrainerCompareEntries);
	for (var primarySlot = 0; primarySlot < primary.length; primarySlot++) {
		primary[primarySlot].trainerSide = 1;
		primary[primarySlot].trainerPartyIndex = primarySlot;
	}
	for (var secondarySlot = 0; secondarySlot < secondary.length; secondarySlot++) {
		secondary[secondarySlot].trainerSide = 2;
		secondary[secondarySlot].trainerPartyIndex = secondarySlot;
	}
	fight.sides = {1: primary, 2: secondary};
	fight.partyEntries = primary.concat(secondary);
}

function aeLuaTrainerBuildFightSignature(fight, includeLevels) {
	var signatureRows = [];
	for (var side = 1; side <= 2; side++) {
		var sideEntries = fight.sides[side] || [];
		for (var slot = 0; slot < sideEntries.length; slot++) {
			var entry = sideEntries[slot];
			signatureRows.push([
				side,
				slot,
				entry.speciesId,
				includeLevels ? entry.level : "*"
			].join(":"));
		}
	}
	return signatureRows.join("|");
}

function buildAeLuaTrainerFightRegistry(sourceEntries) {
	var entries = Array.isArray(sourceEntries)
		? sourceEntries
		: collectAeLuaTrainerRegistrySourceEntries();
	var fightsByKey = {};
	var fights = [];
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		var normalizedGroup = aeLuaTrainerNormalizeText(entry.groupId);
		var fightKey = normalizedGroup
			? "group:" + normalizedGroup
			: "label:" + entry.normalizedTrainerLabel;
		var fight = fightsByKey[fightKey];
		if (!fight) {
			fight = {
				key: fightKey,
				groupId: entry.groupId || "",
				labels: [],
				normalizedLabels: [],
				entries: [],
				indexValues: [],
				anchorIndex: 0,
				maxIndex: 0,
				canonicalLabel: "",
				sides: {1: [], 2: []},
				partyEntries: []
			};
			fightsByKey[fightKey] = fight;
			fights.push(fight);
		}
		fight.entries.push(entry);
		aeLuaTrainerAddUnique(fight.labels, entry.trainerLabel);
		aeLuaTrainerAddUnique(fight.normalizedLabels, entry.normalizedTrainerLabel);
		if (entry.sortIndex > 0) aeLuaTrainerAddUnique(fight.indexValues, entry.sortIndex);
	}

	var byLabel = {};
	var byIndex = {};
	var bySignature = {};
	for (var fightIndex = 0; fightIndex < fights.length; fightIndex++) {
		var currentFight = fights[fightIndex];
		currentFight.entries.sort(aeLuaTrainerCompareEntries);
		currentFight.indexValues.sort(function (left, right) { return left - right; });
		currentFight.anchorIndex = currentFight.indexValues.length ? currentFight.indexValues[0] : 0;
		currentFight.maxIndex = currentFight.indexValues.length
			? currentFight.indexValues[currentFight.indexValues.length - 1]
			: 0;
		currentFight.canonicalLabel = currentFight.entries.length
			? currentFight.entries[0].trainerLabel
			: (currentFight.labels[0] || "Unknown Fight");
		aeLuaTrainerAssignFightSides(currentFight);
		currentFight.signature = aeLuaTrainerBuildFightSignature(currentFight, true);
		currentFight.speciesSignature = aeLuaTrainerBuildFightSignature(currentFight, false);

		for (var labelIndex = 0; labelIndex < currentFight.normalizedLabels.length; labelIndex++) {
			var normalizedLabel = currentFight.normalizedLabels[labelIndex];
			if (!byLabel[normalizedLabel]) byLabel[normalizedLabel] = [];
			byLabel[normalizedLabel].push(currentFight);
		}
		for (var indexIndex = 0; indexIndex < currentFight.indexValues.length; indexIndex++) {
			var numericIndex = String(currentFight.indexValues[indexIndex]);
			if (!byIndex[numericIndex]) byIndex[numericIndex] = [];
			byIndex[numericIndex].push(currentFight);
		}
		if (!bySignature[currentFight.signature]) bySignature[currentFight.signature] = [];
		bySignature[currentFight.signature].push(currentFight);
	}

	return {
		fights: fights,
		byKey: fightsByKey,
		byLabel: byLabel,
		byIndex: byIndex,
		bySignature: bySignature,
		sourceEntryCount: entries.length
	};
}

function getAeLuaTrainerFightRegistry() {
	var sourceEntries = collectAeLuaTrainerRegistrySourceEntries();
	var fingerprint = getAeLuaTrainerRegistrySourceFingerprint(sourceEntries);
	if (!aeLuaTrainerRegistryCache || fingerprint !== aeLuaTrainerRegistryFingerprint) {
		aeLuaTrainerRegistryCache = buildAeLuaTrainerFightRegistry(sourceEntries);
		aeLuaTrainerRegistryFingerprint = fingerprint;
	}
	return aeLuaTrainerRegistryCache;
}

function invalidateAeLuaTrainerFightRegistry() {
	aeLuaTrainerRegistryCache = null;
	aeLuaTrainerRegistryFingerprint = "";
}

function normalizeAeLuaLiveTrainerParty(rawParty) {
	var normalized = [];
	var party = Array.isArray(rawParty) ? rawParty : [];
	for (var i = 0; i < party.length; i++) {
		var mon = party[i];
		if (!mon || typeof mon !== "object") continue;
		var speciesId = aeLuaTrainerNormalizeSpecies(mon.species || mon.name);
		if (!speciesId) continue;
		var side = aeLuaTrainerInteger(mon.trainerSide, 1);
		if (side !== 2) side = 1;
		var globalPartyIndex = aeLuaTrainerInteger(mon.partyIndex, i);
		var trainerPartyIndex = aeLuaTrainerInteger(mon.trainerPartyIndex, NaN);
		if (Number.isNaN(trainerPartyIndex)) {
			trainerPartyIndex = side === 2 && globalPartyIndex >= 3
				? globalPartyIndex - 3
				: globalPartyIndex;
		}
		normalized.push({
			trainerSide: side,
			trainerPartyIndex: trainerPartyIndex,
			partyIndex: globalPartyIndex,
			species: String(mon.species || mon.name || ""),
			speciesId: speciesId,
			level: aeLuaTrainerInteger(mon.level, 0),
			itemId: aeLuaTrainerNormalizeItem(mon.item),
			raw: mon
		});
	}
	normalized.sort(function (left, right) {
		if (left.trainerSide !== right.trainerSide) return left.trainerSide - right.trainerSide;
		if (left.trainerPartyIndex !== right.trainerPartyIndex) {
			return left.trainerPartyIndex - right.trainerPartyIndex;
		}
		return left.partyIndex - right.partyIndex;
	});
	return normalized;
}

function scoreAeLuaLivePartyAgainstFight(fight, rawLiveParty) {
	if (!fight) return null;
	var liveParty = Array.isArray(rawLiveParty) && rawLiveParty.length && rawLiveParty[0].speciesId
		? rawLiveParty
		: normalizeAeLuaLiveTrainerParty(rawLiveParty);
	if (!liveParty.length || liveParty.length !== fight.partyEntries.length) return null;

	var expectedRows = fight.partyEntries.slice().sort(function (left, right) {
		if (left.trainerSide !== right.trainerSide) return left.trainerSide - right.trainerSide;
		return left.trainerPartyIndex - right.trainerPartyIndex;
	});
	var levelMatches = 0;
	var levelWildcards = 0;
	var itemMatches = 0;
	for (var i = 0; i < expectedRows.length; i++) {
		var expected = expectedRows[i];
		var actual = liveParty[i];
		if (expected.trainerSide !== actual.trainerSide ||
			expected.trainerPartyIndex !== actual.trainerPartyIndex ||
			expected.speciesId !== actual.speciesId) {
			return null;
		}
		// Non-positive set levels are treated as dynamic/wildcard levels. A zero
		// live level is likewise unknown rather than a mismatch.
		if (expected.level > 0 && actual.level > 0) {
			if (expected.level !== actual.level) return null;
			levelMatches += 1;
		} else {
			levelWildcards += 1;
		}
		if (expected.itemId && actual.itemId) {
			if (expected.itemId !== actual.itemId) return null;
			itemMatches += 1;
		}
	}
	return {
		fight: fight,
		score: 100000 + levelMatches * 100 + itemMatches * 10 - levelWildcards,
		levelMatches: levelMatches,
		levelWildcards: levelWildcards,
		itemMatches: itemMatches
	};
}

function findAeLuaTrainerFightsByLiveParty(rawLiveParty, registry) {
	var activeRegistry = registry || getAeLuaTrainerFightRegistry();
	var normalizedParty = normalizeAeLuaLiveTrainerParty(rawLiveParty);
	if (!normalizedParty.length) return [];
	var matches = [];
	for (var i = 0; i < activeRegistry.fights.length; i++) {
		var scored = scoreAeLuaLivePartyAgainstFight(activeRegistry.fights[i], normalizedParty);
		if (scored) matches.push(scored);
	}
	matches.sort(function (left, right) {
		if (left.score !== right.score) return right.score - left.score;
		return left.fight.anchorIndex - right.fight.anchorIndex;
	});
	return matches;
}

function aeLuaTrainerFightArrayIntersection(left, right) {
	if (!left.length || !right.length) return [];
	var rightKeys = {};
	for (var i = 0; i < right.length; i++) rightKeys[right[i].key] = true;
	return left.filter(function (fight) { return !!rightKeys[fight.key]; });
}

function aeLuaTrainerResolutionResult(fight, trainerLabelHint, matchType, details) {
	var normalizedHint = aeLuaTrainerNormalizeText(trainerLabelHint);
	var resolvedLabel = fight.canonicalLabel;
	for (var i = 0; i < fight.labels.length; i++) {
		if (aeLuaTrainerNormalizeText(fight.labels[i]) === normalizedHint) {
			resolvedLabel = fight.labels[i];
			break;
		}
	}
	return {
		ok: true,
		ambiguous: false,
		matchType: matchType,
		fight: fight,
		fightKey: fight.key,
		fightLabel: resolvedLabel,
		fightIndex: fight.anchorIndex,
		partyEntries: fight.partyEntries,
		details: details || {}
	};
}

function aeLuaTrainerUnresolvedResult(reason, candidates, details) {
	return {
		ok: false,
		ambiguous: reason === "ambiguous",
		matchType: "unresolved",
		reason: reason,
		fight: null,
		fightKey: "",
		fightLabel: "",
		fightIndex: 0,
		partyEntries: [],
		candidates: (candidates || []).map(function (fight) {
			return {
				fightKey: fight.key,
				fightLabel: fight.canonicalLabel,
				fightIndex: fight.anchorIndex
			};
		}),
		details: details || {}
	};
}

/*
 * Resolution order:
 *   1. A unique live trainer-party signature identifies the live fight.
 *      If a label hint agrees, it is retained as the display label.
 *   2. Without a usable live signature, an exact full trainer label wins.
 *   3. Numeric set index is a final fallback and is accepted only when it is
 *      unambiguous (or narrows an already exact-label candidate).
 *
 * This deliberately prevents shared rival indexes from selecting the first
 * starter variant merely because of SETDEX_SV object iteration order.
 */
function resolveAeLuaTrainerFight(options) {
	var resolveOptions = options || {};
	var registry = resolveOptions.registry || getAeLuaTrainerFightRegistry();
	var labelHint = String(resolveOptions.trainerLabel || resolveOptions.fightLabel || "").trim();
	var normalizedLabel = aeLuaTrainerNormalizeText(labelHint);
	var numericIndex = aeLuaTrainerInteger(
		resolveOptions.fightIndex || resolveOptions.trainerIndex || 0,
		0
	);
	var labelMatches = normalizedLabel && registry.byLabel[normalizedLabel]
		? registry.byLabel[normalizedLabel].slice()
		: [];
	var indexMatches = numericIndex > 0 && registry.byIndex[String(numericIndex)]
		? registry.byIndex[String(numericIndex)].slice()
		: [];
	var liveMatches = findAeLuaTrainerFightsByLiveParty(
		resolveOptions.trainerParty || resolveOptions.liveParty || [],
		registry
	);
	var bestLiveScore = liveMatches.length ? liveMatches[0].score : 0;
	var bestLiveFights = liveMatches
		.filter(function (match) { return match.score === bestLiveScore; })
		.map(function (match) { return match.fight; });

	if (bestLiveFights.length) {
		var liveLabelMatches = aeLuaTrainerFightArrayIntersection(bestLiveFights, labelMatches);
		if (liveLabelMatches.length === 1) {
			return aeLuaTrainerResolutionResult(liveLabelMatches[0], labelHint, "live-party+label", {
				liveMatchCount: bestLiveFights.length
			});
		}
		if (bestLiveFights.length === 1) {
			return aeLuaTrainerResolutionResult(bestLiveFights[0], labelHint, "live-party", {
				labelMismatch: !!labelMatches.length && !liveLabelMatches.length
			});
		}
		var liveIndexMatches = aeLuaTrainerFightArrayIntersection(bestLiveFights, indexMatches);
		if (liveIndexMatches.length === 1) {
			return aeLuaTrainerResolutionResult(liveIndexMatches[0], labelHint, "live-party+index", {
				liveMatchCount: bestLiveFights.length
			});
		}
		return aeLuaTrainerUnresolvedResult("ambiguous", bestLiveFights, {
			source: "live-party"
		});
	}

	// The exact label is intentionally tested before the numeric index. An
	// exact label can safely disambiguate indexes shared by rival variants.
	if (labelMatches.length === 1) {
		return aeLuaTrainerResolutionResult(labelMatches[0], labelHint, "label", {
			indexMismatch: !!indexMatches.length && indexMatches[0].key !== labelMatches[0].key
		});
	}
	if (labelMatches.length > 1) {
		var labelIndexMatches = aeLuaTrainerFightArrayIntersection(labelMatches, indexMatches);
		if (labelIndexMatches.length === 1) {
			return aeLuaTrainerResolutionResult(labelIndexMatches[0], labelHint, "label+index", {});
		}
		return aeLuaTrainerUnresolvedResult("ambiguous", labelMatches, {source: "label"});
	}
	if (indexMatches.length === 1) {
		return aeLuaTrainerResolutionResult(indexMatches[0], labelHint, "index", {});
	}
	if (indexMatches.length > 1) {
		return aeLuaTrainerUnresolvedResult("ambiguous", indexMatches, {source: "index"});
	}
	return aeLuaTrainerUnresolvedResult("not-found", [], {});
}

function getAeLuaResolvedFightEntries(resolution, trainerSide) {
	if (!resolution || !resolution.ok || !resolution.fight) return [];
	var side = aeLuaTrainerInteger(trainerSide, 0);
	if (side === 1 || side === 2) return (resolution.fight.sides[side] || []).slice();
	return resolution.fight.partyEntries.slice();
}

function getAeLuaTrainerPartyFromLastPayload() {
	return aeLuaFragLastPayload && aeLuaFragLastPayload.pokemon
		&& Array.isArray(aeLuaFragLastPayload.pokemon.trainerParty)
		? aeLuaFragLastPayload.pokemon.trainerParty
		: [];
}

function resolveAeLuaTrainerFightForEvent(event) {
	var payloadBattleSerial = aeLuaFragLastPayload && aeLuaFragLastPayload.battle
		? parseInt(aeLuaFragLastPayload.battle.battleSerial, 10) || 0
		: 0;
	var eventBattleSerial = parseInt(event && event.battleSerial, 10) || 0;
	var sameLiveBattle = !eventBattleSerial || eventBattleSerial === payloadBattleSerial;
	var resolution = resolveAeLuaTrainerFight({
		trainerParty: sameLiveBattle ? getAeLuaTrainerPartyFromLastPayload() : [],
		trainerLabel: event && event.trainerLabel,
		fightIndex: event && event.fightIndex
	});
	if (!resolution.ok && sameLiveBattle && aeLuaResolvedTrainerFight &&
		aeLuaResolvedTrainerFight.ok && (!eventBattleSerial ||
			eventBattleSerial === aeLuaResolvedTrainerFight.battleSerial)) {
		resolution = aeLuaResolvedTrainerFight;
	}
	return resolution;
}

function getAeLuaIndexedFightEntries(event) {
	var resolution = resolveAeLuaTrainerFightForEvent(event);
	return resolution.ok ? resolution.fight.entries.slice() : [];
}

function aeLuaFragVictimMatchesEntry(entry, victim) {
	if (!entry || !victim) return false;
	var entrySpecies = aeLuaTrainerNormalizeSpecies(entry.pokemonName);
	var battleSpecies = aeLuaTrainerNormalizeSpecies(victim.species);
	var partySpecies = aeLuaTrainerNormalizeSpecies(victim.partySpecies);
	if (battleSpecies && entrySpecies !== battleSpecies &&
		(!partySpecies || entrySpecies !== partySpecies)) {
		return false;
	}
	var eventLevel = parseInt(victim.level, 10) || 0;
	var entryLevel = parseInt(entry.level || (entry.setData && entry.setData.level), 10) || 0;
	return !eventLevel || !entryLevel || eventLevel === entryLevel;
}

function aeLuaFragVictimMatchFromEntry(entry) {
	return {
		setId: entry.fullSetName,
		fightLabel: entry.trainerLabel,
		partyIndex: entry.trainerPartyIndex,
		level: entry.level || (entry.setData && parseInt(entry.setData.level, 10)) || 0
	};
}

function findAeLuaFragVictimMatch(event) {
	var victim = event && event.victim ? event.victim : {};
	var resolution = resolveAeLuaTrainerFightForEvent(event);
	if (!resolution.ok || !resolution.fight) return null;
	var trainerSide = parseInt(event && event.trainerSide, 10);
	if (trainerSide !== 2) trainerSide = 1;
	var sideEntries = getAeLuaResolvedFightEntries(resolution, trainerSide);
	var trainerPartyIndex = parseInt(victim.trainerPartyIndex, 10);
	if (Number.isNaN(trainerPartyIndex)) {
		var globalPartyIndex = parseInt(victim.partyIndex, 10);
		if (!Number.isNaN(globalPartyIndex)) {
			trainerPartyIndex = trainerSide === 2 && globalPartyIndex >= 3
				? globalPartyIndex - 3
				: globalPartyIndex;
		}
	}
	if (!Number.isNaN(trainerPartyIndex)) {
		var slotEntry = sideEntries[trainerPartyIndex];
		if (slotEntry && slotEntry.fullSetName && aeLuaFragVictimMatchesEntry(slotEntry, victim)) {
			return aeLuaFragVictimMatchFromEntry(slotEntry);
		}
		// A supplied party slot is a unique identifier. Never silently redirect
		// it to another copy of the same species if the slot data disagrees.
		return null;
	}
	var matches = sideEntries.filter(function (entry) {
		return entry && entry.fullSetName && aeLuaFragVictimMatchesEntry(entry, victim);
	});
	return matches.length === 1 ? aeLuaFragVictimMatchFromEntry(matches[0]) : null;
}

function getAeLuaFragEventId(event, index) {
	var rawId = event && event.id ? String(event.id) : "";
	if (rawId) return rawId;
	return [event && event.battleKey, event && event.frame, event && event.trainerSymbol, event && event.victim && event.victim.partyIndex, index].join(":");
}

function getAeLuaFragTextSignature(fileName, fileText) {
	var text = String(fileText || "");
	var hash = 2166136261;
	for (var i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return [fileName || "", text.length, (hash >>> 0).toString(16)].join(":");
}

function importAeLuaFragEventsFromPayload(exportPayload, sourceLabel) {
	var payload = exportPayload && typeof exportPayload === "object" ? exportPayload : {};
	aeLuaFragLastPayload = payload;
	var events = Array.isArray(payload.events)
		? payload.events
		: (Array.isArray(payload) ? payload : []);
	var deaths = Array.isArray(payload.deaths) ? payload.deaths : [];
	if (!events.length && !deaths.length) return 0;
	var importedEvents = getAeLuaFragImportedEventMap();
	var importedCount = 0;
	for (var i = 0; i < events.length; i++) {
		var event = events[i] || {};
		var eventId = getAeLuaFragEventId(event, i);
		if (!eventId || importedEvents[eventId]) continue;
		var killerSetId = findAeLuaFragKillerSetId(event);
		var victimMatch = findAeLuaFragVictimMatch(event);
		if (!killerSetId || !victimMatch) {
			if (window.console && typeof window.console.warn === "function") {
				window.console.warn("[AstralCalc] ae_lua frag event could not be resolved", {
					eventId: eventId,
					killerResolved: !!killerSetId,
					victimResolved: !!victimMatch,
					event: event
				});
			}
			continue;
		}
		var importRecord = {
			importedAt: new Date().toISOString(),
			killerSetId: killerSetId,
			victimSetId: victimMatch.setId,
			fightLabel: victimMatch.fightLabel,
			source: sourceLabel || "auto"
		};
		// Store the event ID in the same frag-sheet payload before addFragKill's
		// save. A refresh can therefore never replay a persisted +1 frag merely
		// because the older separate event-ledger write had not happened yet.
		getFragSheetState().aeLuaImportedEvents[eventId] = importRecord;
		if (!addFragKill(killerSetId, victimMatch.setId, victimMatch.fightLabel)) {
			delete getFragSheetState().aeLuaImportedEvents[eventId];
			continue;
		}
		importedEvents[eventId] = importRecord;
		importedCount += 1;
	}
	for (var deathIndex = 0; deathIndex < deaths.length; deathIndex++) {
		var deathEvent = deaths[deathIndex] || {};
		var deathEventId = "death:" + getAeLuaFragEventId(deathEvent, deathIndex);
		if (!deathEventId || importedEvents[deathEventId]) continue;
		var deadSetId = findAeLuaFragPlayerSetIdForMon(deathEvent.victim);
		if (!deadSetId) continue;
		var deathFightLabel = String(deathEvent.trainerLabel || deathEvent.trainerName || getCurrentFightLabel() || "Unknown Fight");
		setFragSetDeadState(deadSetId, true, deathFightLabel);
		importedEvents[deathEventId] = {
			importedAt: new Date().toISOString(),
			type: "death",
			victimSetId: deadSetId,
			fightLabel: deathFightLabel,
			source: sourceLabel || "auto"
		};
		importedCount += 1;
	}
	if (importedCount) {
		saveAeLuaFragImportedEventMap(importedEvents);
		if (window.console && typeof window.console.info === "function") {
			window.console.info("[AstralCalc] imported " + importedCount + " ae_lua update" + (importedCount === 1 ? "" : "s"));
		}
	}
	return importedCount;
}

function suppressAeLuaFragEventsForRemoval(killerSetId, fightLabel, victimKey, maxCount) {
	var normalizedSetId = String(killerSetId || "").trim();
	var normalizedFight = String(fightLabel || "").trim();
	if (!normalizedSetId || !normalizedFight || !aeLuaFragLastPayload) return 0;
	var events = Array.isArray(aeLuaFragLastPayload.events) ? aeLuaFragLastPayload.events : [];
	if (!events.length) return 0;
	var normalizedVictimKey = normalizeFragVictimKey(victimKey);
	var remaining = Math.max(1, parseInt(maxCount, 10) || 1);
	var importedEvents = getAeLuaFragImportedEventMap();
	var suppressedCount = 0;
	for (var i = events.length - 1; i >= 0 && remaining > 0; i--) {
		var event = events[i] || {};
		var eventId = getAeLuaFragEventId(event, i);
		if (!eventId) continue;
		var existingRecord = importedEvents[eventId];
		if (existingRecord && existingRecord.removedAt) continue;
		if (findAeLuaFragKillerSetId(event) !== normalizedSetId) continue;
		var victimMatch = findAeLuaFragVictimMatch(event);
		if (!victimMatch) continue;
		if (String(victimMatch.fightLabel || "").trim() !== normalizedFight) continue;
		if (normalizedVictimKey !== FRAG_UNKNOWN_VICTIM_KEY && normalizeFragVictimKey(victimMatch.setId) !== normalizedVictimKey) continue;
		importedEvents[eventId] = Object.assign({}, existingRecord || {}, {
			importedAt: existingRecord && existingRecord.importedAt ? existingRecord.importedAt : new Date().toISOString(),
			removedAt: new Date().toISOString(),
			killerSetId: normalizedSetId,
			victimSetId: victimMatch.setId,
			fightLabel: normalizedFight,
			source: existingRecord && existingRecord.source ? existingRecord.source : "manual-remove"
		});
		suppressedCount += 1;
		remaining -= 1;
	}
	if (suppressedCount) saveAeLuaFragImportedEventMap(importedEvents);
	return suppressedCount;
}

function importAeLuaFragEvents() {
	var exportPayload = window.AE_LUA_FRAG_EXPORT && typeof window.AE_LUA_FRAG_EXPORT === "object" ? window.AE_LUA_FRAG_EXPORT : {};
	if (!Array.isArray(exportPayload.events) && Array.isArray(window.AE_LUA_FRAG_EVENTS)) {
		exportPayload = {events: window.AE_LUA_FRAG_EVENTS};
	}
	return importAeLuaFragEventsFromPayload(exportPayload, "auto");
}

function parseAeLuaFragExportText(text) {
	var rawText = String(text || "").trim();
	if (!rawText) return {events: []};
	if (rawText.charAt(0) === "{" || rawText.charAt(0) === "[") {
		return JSON.parse(extractAeLuaFragJsonText(rawText, 0));
	}
	var luaJsonText = extractAeLuaFragLuaJsonText(rawText);
	if (luaJsonText) {
		return JSON.parse(luaJsonText);
	}
	var markerPattern = /(?:window\.)?AE_LUA_FRAG_EXPORT\s*=/g;
	var markerMatch = null;
	while ((markerMatch = markerPattern.exec(rawText))) {
		var jsonStart = markerPattern.lastIndex;
		while (jsonStart < rawText.length && /\s/.test(rawText.charAt(jsonStart))) jsonStart += 1;
		var openingChar = rawText.charAt(jsonStart);
		if (openingChar !== "{" && openingChar !== "[") continue;
		return JSON.parse(extractAeLuaFragJsonText(rawText, jsonStart));
	}
	if (isAeLuaFragSourceText(rawText)) {
		throw new Error("That ae_lua.lua does not have a live export block yet. Load this same ae_lua.lua in the emulator once, then import it again.");
	}
	throw new Error("Could not find an AE_LUA_FRAG_EXPORT JSON payload in that file.");
}

function setAeLuaFragLiveUi(isConnected) {
	aeLuaFragLiveConnected = !!isConnected;
	var buttons = document.querySelectorAll(".ae-lua-frag-import-button");
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].textContent = isConnected ? "ae_lua connected" : "Connect ae_lua";
		buttons[i].title = isConnected
			? "Live frag updates are arriving from mGBA"
			: "Start ae_lua.lua in mGBA, then connect";
	}
}

function resolveAeLuaTrainerFightFromPayload(payload) {
	var battle = payload && payload.battle ? payload.battle : {};
	var trainerParty = payload && payload.pokemon && Array.isArray(payload.pokemon.trainerParty)
		? payload.pokemon.trainerParty
		: [];
	var normalizedParty = normalizeAeLuaLiveTrainerParty(trainerParty);
	var resolution = resolveAeLuaTrainerFight({
		trainerParty: trainerParty,
		trainerLabel: battle.trainerLabel,
		fightIndex: battle.fightIndex
	});
	if (battle.active && (!normalizedParty.length || !resolution.ok ||
		String(resolution.matchType || "").indexOf("live-party") !== 0)) {
		return aeLuaTrainerUnresolvedResult("not-found", [], {source: "live-battle-party"});
	}
	if (resolution.ok) resolution.battleSerial = parseInt(battle.battleSerial, 10) || 0;
	return resolution;
}

function getAeLuaResolvedVictimEntry(resolution, event) {
	if (!resolution || !resolution.ok || !event || !event.victim) return null;
	var trainerSide = parseInt(event.trainerSide, 10);
	if (trainerSide !== 2) trainerSide = 1;
	var partyIndex = parseInt(event.victim.trainerPartyIndex, 10);
	if (Number.isNaN(partyIndex)) {
		partyIndex = parseInt(event.victim.partyIndex, 10);
		if (trainerSide === 2 && partyIndex >= 3) partyIndex -= 3;
	}
	if (Number.isNaN(partyIndex)) return null;
	return getAeLuaResolvedFightEntries(resolution, trainerSide)[partyIndex] || null;
}

function applyAeLuaTrainerFightToPayload(payload, resolution) {
	if (!payload || !resolution || !resolution.ok) return payload;
	if (!payload.battle || typeof payload.battle !== "object") payload.battle = {};
	payload.battle.fightIndex = resolution.fightIndex;
	payload.battle.trainerLabel = resolution.fightLabel;
	var events = Array.isArray(payload.events) ? payload.events : [];
	for (var i = 0; i < events.length; i++) {
		var event = events[i];
		var eventBattleSerial = parseInt(event && event.battleSerial, 10) || 0;
		if (eventBattleSerial && resolution.battleSerial &&
			eventBattleSerial !== resolution.battleSerial) continue;
		var victimEntry = getAeLuaResolvedVictimEntry(resolution, event);
		event.fightIndex = resolution.fightIndex;
		event.trainerLabel = victimEntry ? victimEntry.trainerLabel : resolution.fightLabel;
		event.trainerName = victimEntry
			? victimEntry.trainerName
			: aeLuaTrainerParseLabel(resolution.fightLabel).trainerName;
	}
	return payload;
}

function fetchAeLuaFullRosterPage(offset, collectedPokemon) {
	var pageOffset = Math.max(0, parseInt(offset, 10) || 0);
	var pokemon = Array.isArray(collectedPokemon) ? collectedPokemon : [];
	var pageUrl = AE_LUA_POKEMON_URL + "?offset=" + encodeURIComponent(pageOffset) +
		"&limit=" + encodeURIComponent(AE_LUA_FULL_ROSTER_PAGE_SIZE);
	return fetch(pageUrl, {cache: "no-store"}).then(function (response) {
		if (!response.ok) throw new Error("HTTP " + response.status + " while reading save Pokemon");
		return response.json();
	}).then(function (payload) {
		var storagePage = payload && payload.pokemon && Array.isArray(payload.pokemon.storage)
			? payload.pokemon.storage
			: null;
		var page = payload && payload.page;
		if (!storagePage || !page || typeof page !== "object") {
			throw new Error("ae_lua returned an invalid Pokemon page");
		}
		for (var index = 0; index < storagePage.length; index++) pokemon.push(storagePage[index]);
		if (page.done === true) return pokemon;
		var nextOffset = parseInt(page.nextOffset, 10);
		if (Number.isNaN(nextOffset) || nextOffset <= pageOffset) {
			throw new Error("ae_lua Pokemon pagination did not advance");
		}
		return fetchAeLuaFullRosterPage(nextOffset, pokemon);
	});
}

function refreshAeLuaFullRoster() {
	if (aeLuaPokemonFullRosterPromise) return aeLuaPokemonFullRosterPromise;
	var scanPromise = fetchAeLuaFullRosterPage(0, []).then(function (storagePokemon) {
		var importedCount = importAeLuaPokemonFromPayload({pokemon: {storage: storagePokemon}});
		aeLuaPokemonLastFullRosterAt = Date.now();
		if (window.console && typeof window.console.info === "function") {
			window.console.info("[AstralCalc] save scan complete: " + storagePokemon.length +
				" PC Pokemon found, " + importedCount + " imported/updated");
		}
		return importedCount;
	});
	aeLuaPokemonFullRosterPromise = scanPromise.then(function (importedCount) {
		aeLuaPokemonFullRosterPromise = null;
		return importedCount;
	}, function (error) {
		aeLuaPokemonFullRosterPromise = null;
		if (window.console && typeof window.console.warn === "function") {
			window.console.warn("[AstralCalc] full-save Pokemon scan failed; it will retry", error);
		}
		return 0;
	});
	return aeLuaPokemonFullRosterPromise;
}

function pollAeLuaFragLiveLink(showError) {
	var requestFullRoster = !aeLuaPokemonLastFullRosterAt ||
		Date.now() - aeLuaPokemonLastFullRosterAt >= AE_LUA_FULL_ROSTER_INTERVAL_MS;
	var knownFight = aeLuaResolvedTrainerFight && aeLuaResolvedTrainerFight.ok
		? aeLuaResolvedTrainerFight
		: null;
	var trainerLabel = knownFight ? knownFight.fightLabel : "";
	var fightIndex = knownFight ? knownFight.fightIndex : 0;
	var battleSerial = knownFight ? knownFight.battleSerial : 0;
	var liveUrl = AE_LUA_FRAG_LIVE_URL + "?trainer=" + encodeURIComponent(trainerLabel) +
		"&fightIndex=" + encodeURIComponent(fightIndex || 0) +
		"&battleSerial=" + encodeURIComponent(battleSerial || 0);
	return fetch(liveUrl, {cache: "no-store"}).then(function (response) {
		if (!response.ok) throw new Error("HTTP " + response.status);
		return response.json();
	}).then(function (payload) {
		setAeLuaFragLiveUi(true);
		var resolution = resolveAeLuaTrainerFightFromPayload(payload);
		if (payload && payload.battle && payload.battle.active) {
			aeLuaResolvedTrainerFight = resolution.ok ? resolution : null;
		} else if (resolution.ok) {
			aeLuaResolvedTrainerFight = resolution;
		}
		if (aeLuaResolvedTrainerFight && aeLuaResolvedTrainerFight.ok) {
			applyAeLuaTrainerFightToPayload(payload, aeLuaResolvedTrainerFight);
		}
		try {
			importAeLuaPokemonFromPayload(payload);
		} catch (pokemonImportError) {
			if (window.console && typeof window.console.warn === "function") {
				window.console.warn("[AstralCalc] ae_lua roster import failed; continuing with frag import", pokemonImportError);
			}
		}
		if (requestFullRoster) refreshAeLuaFullRoster();
		try {
			if (aeLuaResolvedTrainerFight && aeLuaResolvedTrainerFight.ok) {
				importAeLuaFragEventsFromPayload(payload, "live");
			} else if (Array.isArray(payload.events) && payload.events.length &&
				window.console && typeof window.console.warn === "function") {
				window.console.warn("[AstralCalc] live trainer fight could not be resolved; frag left pending", resolution);
			}
		} catch (fragImportError) {
			if (window.console && typeof window.console.error === "function") {
				window.console.error("[AstralCalc] ae_lua frag import failed", fragImportError);
			}
			throw fragImportError;
		}
		var importedEvents = getAeLuaFragImportedEventMap();
		(Array.isArray(payload.events) ? payload.events : []).forEach(function (event, index) {
			var eventId = getAeLuaFragEventId(event, index);
			var imported = importedEvents[eventId];
			if (!imported) return;
			var victimEntry = parseTrainerPartyEntry(imported.victimSetId || "");
			fetch(AE_LUA_FRAG_ACK_URL, {
				method: "POST",
				cache: "no-store",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					eventId: eventId,
					playerPokemon: getAeLuaFragMonSpecies(event.killer),
					trainerName: victimEntry.trainerName || event.trainerName || "Trainer",
					trainerPokemon: victimEntry.pokemonName || getAeLuaFragMonSpecies(event.victim)
				})
			}).catch(function (ackError) {
				if (window.console && typeof window.console.warn === "function") {
					window.console.warn("[AstralCalc] could not acknowledge ae_lua frag " + eventId, ackError);
				}
			});
		});
		return true;
	}).catch(function (error) {
		setAeLuaFragLiveUi(false);
		if (window.console && typeof window.console.warn === "function") {
			window.console.warn("[AstralCalc] ae_lua live connection failed", error);
		}
		if (showError) alert("Could not connect to ae_lua. Start the script in mGBA with Astral Emerald loaded, then try again.");
		return false;
	});
}

function startAeLuaFragLiveLink(showError) {
	if (aeLuaFragLiveTimer) window.clearInterval(aeLuaFragLiveTimer);
	if (showError) aeLuaPokemonLastFullRosterAt = 0;
	pollAeLuaFragLiveLink(!!showError);
	aeLuaFragLiveTimer = window.setInterval(function () {
		pollAeLuaFragLiveLink(false);
	}, AE_LUA_FRAG_IMPORT_INTERVAL_MS);
}

function isAeLuaPokemonSetName(setName) {
	return String(setName || "").trim().toLowerCase().indexOf(AE_LUA_POKEMON_SET_PREFIX) === 0;
}

function isAeLuaPokemonSetId(setId) {
	return isAeLuaPokemonSetName(parseSetId(setId).label);
}

function getAeLuaPokemonPayloadList(payload) {
	var pokemonPayload = payload && payload.pokemon;
	var pokemon = [];
	function appendList(list, location) {
		if (!Array.isArray(list)) return;
		for (var i = 0; i < list.length; i++) {
			var mon = list[i];
			if (!mon || typeof mon !== "object") continue;
			var nextMon = Object.assign({}, mon);
			if (!nextMon.location) nextMon.location = location;
			pokemon.push(nextMon);
		}
	}
	if (Array.isArray(pokemonPayload)) {
		appendList(pokemonPayload, "storage");
	} else if (pokemonPayload && typeof pokemonPayload === "object") {
		appendList(pokemonPayload.party, "party");
		appendList(pokemonPayload.storage || pokemonPayload.box || pokemonPayload.pc, "storage");
	}
	return pokemon;
}

var aeLuaPokemonSpeciesKeyCache = {};

function getAeLuaLoadedSpeciesMaps() {
	var speciesMaps = [];
	function appendSpeciesMap(speciesMap) {
		if (!speciesMap || typeof speciesMap !== "object" || Array.isArray(speciesMap)) return;
		if (speciesMaps.indexOf(speciesMap) === -1) speciesMaps.push(speciesMap);
	}
	if (typeof pokedex !== "undefined") appendSpeciesMap(pokedex);
	if (typeof calc !== "undefined" && calc && calc.SPECIES) {
		appendSpeciesMap(calc.SPECIES[9]);
		if (typeof gen !== "undefined") appendSpeciesMap(calc.SPECIES[gen]);
	}
	if (typeof setdex !== "undefined") appendSpeciesMap(setdex);
	if (typeof SETDEX_SV !== "undefined") appendSpeciesMap(SETDEX_SV);
	return speciesMaps;
}

function isAeLuaLoadedSpeciesKey(speciesName, speciesMaps) {
	var candidate = String(speciesName || "").trim();
	if (!candidate) return false;
	var maps = speciesMaps || getAeLuaLoadedSpeciesMaps();
	for (var mapIndex = 0; mapIndex < maps.length; mapIndex++) {
		if (Object.prototype.hasOwnProperty.call(maps[mapIndex], candidate)) return true;
	}
	return false;
}

function findAeLuaLoadedSpeciesKey(speciesName) {
	var rawSpecies = String(speciesName || "").trim();
	if (!rawSpecies) return "";
	var speciesMaps = getAeLuaLoadedSpeciesMaps();
	// Preserve a form whenever AstralCalc already knows its exact key. The
	// legacy Showdown importer intentionally collapses several forms and is not
	// safe for identity-bound live Team updates.
	if (isAeLuaLoadedSpeciesKey(rawSpecies, speciesMaps)) return rawSpecies;
	var cachedSpecies = aeLuaPokemonSpeciesKeyCache[rawSpecies];
	if (cachedSpecies && isAeLuaLoadedSpeciesKey(cachedSpecies, speciesMaps)) return cachedSpecies;

	var normalizedSpecies = aeLuaTrainerNormalizeSpecies(rawSpecies);
	var matches = [];
	var seenMatches = {};
	for (var mapIndex = 0; mapIndex < speciesMaps.length; mapIndex++) {
		var speciesMap = speciesMaps[mapIndex];
		for (var candidate in speciesMap) {
			if (!Object.prototype.hasOwnProperty.call(speciesMap, candidate) || seenMatches[candidate]) continue;
			if (aeLuaTrainerNormalizeSpecies(candidate) !== normalizedSpecies) continue;
			seenMatches[candidate] = true;
			matches.push(candidate);
		}
	}
	if (matches.length === 1) {
		aeLuaPokemonSpeciesKeyCache[rawSpecies] = matches[0];
		return matches[0];
	}

	// Keep the old importer as a final compatibility fallback, but only when
	// its collapsed result is an actual loaded Calc species and the live form
	// could not be resolved uniquely above.
	if (typeof checkExeptions === "function") {
		var legacySpecies = String(checkExeptions(rawSpecies) || "").trim();
		if (legacySpecies && isAeLuaLoadedSpeciesKey(legacySpecies, speciesMaps)) {
			aeLuaPokemonSpeciesKeyCache[rawSpecies] = legacySpecies;
			return legacySpecies;
		}
	}
	return rawSpecies;
}

function normalizeAeLuaPokemonSpeciesName(mon) {
	return findAeLuaLoadedSpeciesKey(mon && (mon.species || mon.name));
}

function getAeLuaPokemonSpeciesNameForTeamSet(mon, setId) {
	var resolvedSpecies = normalizeAeLuaPokemonSpeciesName(mon);
	var existingSpecies = parseSetId(setId).species;
	var rawSpecies = String(mon && (mon.species || mon.name) || "").trim();
	// Battle/form aliases (Aegislash stances, Castform weather, cap Pikachu,
	// etc.) are the same persistent Pokémon, not evolutions. Keep the exact
	// species key already chosen for this Calc Team entry when both names are
	// equivalent; a real evolution has a different normalized species ID.
	if (existingSpecies && rawSpecies &&
		aeLuaTrainerNormalizeSpecies(existingSpecies) === aeLuaTrainerNormalizeSpecies(rawSpecies)) {
		return existingSpecies;
	}
	if (existingSpecies && resolvedSpecies &&
		aeLuaTrainerNormalizeSpecies(existingSpecies) === aeLuaTrainerNormalizeSpecies(resolvedSpecies)) {
		return existingSpecies;
	}
	return resolvedSpecies;
}

function normalizeAeLuaPokemonSetName(mon, fallbackIndex) {
	var setName = String(mon && mon.setName || "").trim();
	if (!setName) {
		var location = String(mon && mon.location || "").trim().toLowerCase() === "party" ? "Party" : "Box";
		var slotNumber = parseInt(mon && mon.slotIndex, 10);
		if (Number.isNaN(slotNumber)) slotNumber = fallbackIndex || 0;
		setName = AE_LUA_POKEMON_SET_PREFIX + " " + location + " " + (slotNumber + 1);
	}
	if (!isAeLuaPokemonSetName(setName)) setName = AE_LUA_POKEMON_SET_PREFIX + " " + setName;
	return setName;
}

function normalizeAeLuaPokemonMoves(moves) {
	var normalized = [];
	var moveList = Array.isArray(moves) ? moves : [];
	for (var i = 0; i < 4; i++) {
		var moveName = String(moveList[i] || "").trim();
		normalized.push(moveName || "(No Move)");
	}
	return normalized;
}

function aeLuaPokemonNumber(value, fallbackValue) {
	var parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallbackValue : parsed;
}

function aeLuaPokemonStatsToLegacy(statsTable) {
	var legacy = {};
	if (!statsTable || typeof statsTable !== "object") return legacy;
	var statMap = {
		hp: "hp",
		atk: "at",
		attack: "at",
		at: "at",
		def: "df",
		defense: "df",
		df: "df",
		spa: "sa",
		spAttack: "sa",
		sa: "sa",
		spd: "sd",
		spDefense: "sd",
		sd: "sd",
		spe: "sp",
		speed: "sp",
		sp: "sp"
	};
	for (var key in statsTable) {
		if (!Object.prototype.hasOwnProperty.call(statsTable, key)) continue;
		var mappedKey = statMap[key];
		if (!mappedKey) continue;
		var statValue = parseInt(statsTable[key], 10);
		if (!Number.isNaN(statValue)) legacy[mappedKey] = statValue;
	}
	return legacy;
}

function buildAeLuaPokemonSet(mon, existingSetData) {
	var setData = existingSetData && typeof existingSetData === "object"
		? Object.assign({}, existingSetData)
		: {};
	if (mon && typeof mon.level !== "undefined" && mon.level !== null) {
		var level = aeLuaPokemonNumber(mon.level, 1);
		setData.level = Math.max(1, Math.min(100, level));
	}
	if (mon && mon.evs && typeof mon.evs === "object") {
		var evs = aeLuaPokemonStatsToLegacy(mon.evs);
		if (Object.keys(evs).length) setData.evs = evs;
	}
	if (mon && mon.ivs && typeof mon.ivs === "object") {
		var ivs = aeLuaPokemonStatsToLegacy(mon.ivs);
		if (Object.keys(ivs).length) setData.ivs = ivs;
	}
	if (mon && Array.isArray(mon.moves)) setData.moves = normalizeAeLuaPokemonMoves(mon.moves);
	if (mon && Object.prototype.hasOwnProperty.call(mon, "nature")) {
		setData.nature = String(mon.nature || "").trim();
	}
	if (mon && Object.prototype.hasOwnProperty.call(mon, "item")) {
		setData.item = String(mon.item || "").trim();
	}
	if (mon && Object.prototype.hasOwnProperty.call(mon, "ability")) {
		var ability = String(mon.ability || "").trim();
		if (ability) setData.ability = ability;
	}
	if (mon && Object.prototype.hasOwnProperty.call(mon, "nickname")) {
		var nickname = String(mon.nickname || "").trim();
		if (nickname) setData.nickname = nickname;
		else delete setData.nickname;
	}
	var identity = getAeLuaPokemonIdentity(mon);
	if (identity) {
		// Persist the portable Pokémon identity with the custom set so a saved
		// Calc roster can be rebound after a refresh without using its game box
		// position as identity.
		setData.aeLuaPersonality = identity.personality;
		setData.aeLuaOtId = identity.otId;
	}
	setData.isCustomSet = true;
	return setData;
}

function getAeLuaPokemonPayloadSignature(pokemon) {
	return JSON.stringify((pokemon || []).map(function (mon) {
		return {
			location: mon.location || "",
			slotIndex: aeLuaPokemonNumber(mon.slotIndex, 0),
			species: normalizeAeLuaPokemonSpeciesName(mon),
			setName: normalizeAeLuaPokemonSetName(mon, 0),
			level: aeLuaPokemonNumber(mon.level, 1),
			ability: String(mon.ability || ""),
			item: String(mon.item || ""),
			nature: String(mon.nature || ""),
			moves: normalizeAeLuaPokemonMoves(mon.moves),
			ivs: aeLuaPokemonStatsToLegacy(mon.ivs),
			evs: aeLuaPokemonStatsToLegacy(mon.evs),
			personality: mon.personality || 0,
			otId: mon.otId || 0
		};
	}));
}

function getAeLuaPokemonPayloadSignatureScope(payload) {
	var pokemonPayload = payload && payload.pokemon;
	if (Array.isArray(pokemonPayload)) return "legacy";
	if (!pokemonPayload || typeof pokemonPayload !== "object") return "none";
	var hasParty = Array.isArray(pokemonPayload.party);
	var hasStorage = Array.isArray(pokemonPayload.storage) ||
		Array.isArray(pokemonPayload.box) || Array.isArray(pokemonPayload.pc);
	if (hasParty && hasStorage) return "combined";
	if (hasStorage) return "storage";
	if (hasParty) return "party";
	return "other";
}

function getAeLuaExistingPokemonSetData(setId, customsets) {
	var parsedSet = parseSetId(setId);
	var customSet = customsets && customsets[parsedSet.species]
		? customsets[parsedSet.species][parsedSet.label]
		: null;
	if (customSet && typeof customSet === "object") return customSet;
	var dexSet = setdex && setdex[parsedSet.species]
		? setdex[parsedSet.species][parsedSet.label]
		: null;
	return dexSet && typeof dexSet === "object" ? dexSet : {};
}

function getAeLuaTeamSetNicknameForBinding(setId) {
	var option = typeof getSetOptionById === "function" ? getSetOptionById(setId) : null;
	return normalizeAeLuaFragText(option && option.nickname ? option.nickname : "");
}

function findAeLuaLivePokemonIndexForBinding(binding, pokemon, usedPokemonIndexes) {
	var bindingIdentity = getAeLuaPokemonIdentity(binding);
	if (!bindingIdentity) return -1;
	for (var i = 0; i < pokemon.length; i++) {
		if (usedPokemonIndexes[i]) continue;
		if (aeLuaPokemonIdentitiesMatch(bindingIdentity, getAeLuaPokemonIdentity(pokemon[i]))) return i;
	}
	return -1;
}

function findAeLuaLivePokemonIndexForUnboundSet(setId, teamIndex, pokemon, usedPokemonIndexes) {
	var setSpecies = aeLuaTrainerNormalizeSpecies(parseSetId(setId).species);
	if (!setSpecies) return -1;
	var setNickname = getAeLuaTeamSetNicknameForBinding(setId);
	var speciesMatches = [];
	var nicknameMatches = [];
	for (var i = 0; i < pokemon.length; i++) {
		if (usedPokemonIndexes[i] || !getAeLuaPokemonIdentity(pokemon[i])) continue;
		if (aeLuaTrainerNormalizeSpecies(normalizeAeLuaPokemonSpeciesName(pokemon[i])) !== setSpecies) continue;
		speciesMatches.push(i);
		if (setNickname && normalizeAeLuaFragText(pokemon[i].nickname) === setNickname) {
			nicknameMatches.push(i);
		}
	}
	if (nicknameMatches.length === 1) return nicknameMatches[0];
	if (speciesMatches.length === 1) return speciesMatches[0];
	// Duplicate species need a one-time association before personality + OT ID
	// can take over. Use party position only when that Calc Team position has
	// the same species; subsequent switches and boxing use the persisted binding.
	var partySlotMatches = speciesMatches.filter(function (pokemonIndex) {
		var mon = pokemon[pokemonIndex];
		return String(mon.location || "party").toLowerCase() === "party" &&
			parseInt(mon.slotIndex, 10) === teamIndex;
	});
	return partySlotMatches.length === 1 ? partySlotMatches[0] : -1;
}

function getAeLuaUniqueEvolvedSetId(oldSetId, newSpecies, customsets, layout) {
	var oldParsed = parseSetId(oldSetId);
	if (oldParsed.species === newSpecies) return oldSetId;
	var baseLabel = oldParsed.label || (AE_LUA_POKEMON_SET_PREFIX + " Team");
	var occupiedSetIds = {};
	var zoneNames = ["team", "box", "box2", "trash"];
	for (var zoneIndex = 0; zoneIndex < zoneNames.length; zoneIndex++) {
		var zoneSetIds = layout[zoneNames[zoneIndex]] || [];
		for (var setIndex = 0; setIndex < zoneSetIds.length; setIndex++) {
			if (zoneSetIds[setIndex] !== oldSetId) occupiedSetIds[zoneSetIds[setIndex]] = true;
		}
	}
	var label = baseLabel;
	var suffix = 2;
	var setId = newSpecies + " (" + label + ")";
	while (occupiedSetIds[setId] || (customsets[newSpecies] && customsets[newSpecies][label])) {
		label = baseLabel + " " + suffix;
		suffix += 1;
		setId = newSpecies + " (" + label + ")";
	}
	return setId;
}

function removeAeLuaEvolvedSourceCustomSet(customsets, oldSetId, layout) {
	var preservedZones = ["box", "box2", "trash"];
	for (var zoneIndex = 0; zoneIndex < preservedZones.length; zoneIndex++) {
		var zoneSetIds = layout[preservedZones[zoneIndex]] || [];
		if (zoneSetIds.indexOf(oldSetId) !== -1) return;
	}
	var parsedSet = parseSetId(oldSetId);
	var speciesSets = customsets[parsedSet.species];
	if (!speciesSets || !Object.prototype.hasOwnProperty.call(speciesSets, parsedSet.label)) return;
	delete speciesSets[parsedSet.label];
	if (!Object.keys(speciesSets).length) delete customsets[parsedSet.species];
}

function applyAeLuaTeamSetRename(oldSetId, newSetId) {
	var teamContainer = document.getElementById("team-poke-list");
	if (!teamContainer) return false;
	var sprites = teamContainer.querySelectorAll(".trainer-pok.left-side");
	for (var i = 0; i < sprites.length; i++) {
		if (String(sprites[i].getAttribute("data-id") || "") !== oldSetId) continue;
		sprites[i].setAttribute("data-id", newSetId);
		var speciesName = parseSetId(newSetId).species;
		setTrainerSpriteImage(sprites[i], speciesName);
		applyPrimaryIconSheetIfNeeded(sprites[i], speciesName);
		return true;
	}
	return false;
}

function getAeLuaRosterSetLookup(layout) {
	var lookup = {};
	var zoneNames = ["team", "box", "box2", "trash"];
	for (var zoneIndex = 0; zoneIndex < zoneNames.length; zoneIndex++) {
		var setIds = layout[zoneNames[zoneIndex]] || [];
		for (var setIndex = 0; setIndex < setIds.length; setIndex++) {
			lookup[setIds[setIndex]] = true;
		}
	}
	return lookup;
}

function getAeLuaBoundSetIdForPokemon(mon, bindings) {
	var identity = getAeLuaPokemonIdentity(mon);
	var sourceBindings = bindings && bindings.bySetId ? bindings.bySetId : {};
	if (!identity) return "";
	var matches = [];
	for (var setId in sourceBindings) {
		if (!Object.prototype.hasOwnProperty.call(sourceBindings, setId)) continue;
		if (aeLuaPokemonIdentitiesMatch(getAeLuaPokemonIdentity(sourceBindings[setId]), identity)) {
			matches.push(setId);
		}
	}
	return matches.length === 1 ? matches[0] : "";
}

function getAeLuaCustomSetIdentity(setId, customsets) {
	var parsedSet = parseSetId(setId);
	var setData = customsets && customsets[parsedSet.species]
		? customsets[parsedSet.species][parsedSet.label]
		: null;
	if (!setData || typeof setData !== "object") return null;
	return getAeLuaPokemonIdentity({
		personality: setData.aeLuaPersonality,
		otId: setData.aeLuaOtId
	});
}

function hasAeLuaCustomSet(setId, customsets) {
	var parsedSet = parseSetId(setId);
	return !!(customsets && customsets[parsedSet.species] &&
		Object.prototype.hasOwnProperty.call(customsets[parsedSet.species], parsedSet.label));
}

function getAeLuaDiscoveredSetId(mon, pokemonIndex, speciesName, customsets, layoutLookup, bindings) {
	var identity = getAeLuaPokemonIdentity(mon);
	var baseLabel = normalizeAeLuaPokemonSetName(mon, pokemonIndex);
	var label = baseLabel;
	var suffix = 2;
	while (true) {
		var setId = speciesName + " (" + label + ")";
		var isOccupied = !!layoutLookup[setId] || hasAeLuaCustomSet(setId, customsets);
		if (!isOccupied) return {setId: setId, isExisting: false};
		var boundIdentity = getAeLuaPokemonIdentity(bindings.bySetId && bindings.bySetId[setId]);
		var storedIdentity = getAeLuaCustomSetIdentity(setId, customsets);
		if (identity && ((boundIdentity && aeLuaPokemonIdentitiesMatch(boundIdentity, identity)) ||
			(storedIdentity && aeLuaPokemonIdentitiesMatch(storedIdentity, identity)))) {
			return {setId: setId, isExisting: true};
		}
		label = baseLabel + " " + suffix;
		suffix += 1;
	}
}

function appendAeLuaDiscoveredSetIdsToBox(setIds) {
	var targetContainer = document.getElementById("box-poke-list");
	if (!targetContainer || !Array.isArray(setIds) || !setIds.length) return 0;
	var appendedCount = 0;
	for (var setIndex = 0; setIndex < setIds.length; setIndex++) {
		var setId = setIds[setIndex];
		var existingSprite = $(PLAYER_ROSTER_SPRITE_SELECTOR).filter(function () {
			return String($(this).attr("data-id") || "") === setId;
		}).get(0);
		if (existingSprite) continue;
		var spriteNode = createRosterSpriteFromSetId(setId);
		if (!spriteNode) continue;
		targetContainer.appendChild(spriteNode);
		applyPrimaryIconSheetIfNeeded(spriteNode, parseSetId(setId).species);
		appendedCount += 1;
	}
	if (appendedCount) saveCurrentPlayerRosterLayout();
	return appendedCount;
}

function importAeLuaPokemonFromPayload(payload) {
	var pokemon = getAeLuaPokemonPayloadList(payload);
	var hasPokemonPayload = !!(payload && Object.prototype.hasOwnProperty.call(payload, "pokemon"));
	if (!hasPokemonPayload) return 0;
	var currentLayout = normalizeRosterLayout(collectPlayerRosterLayout());
	var signature = getAeLuaPokemonPayloadSignature(pokemon) + "|" + JSON.stringify(currentLayout.team);
	var signatureScope = getAeLuaPokemonPayloadSignatureScope(payload);
	if (signature === aeLuaPokemonImportSignatures[signatureScope]) return 0;

	var customsets = safeJsonParse(localStorage.getItem("customsets"), {});
	if (!customsets || typeof customsets !== "object" || Array.isArray(customsets)) customsets = {};
	var bindings = getAeLuaTeamBindings();
	var teamSetIds = currentLayout.team.slice();
	var usedPokemonIndexes = {};
	var matchedPokemonIndexes = [];
	var renameRecords = [];
	var updatedSetIds = {};
	var discoveredBoxSetIds = [];
	var didChangeCustomsets = false;
	var didChangeBindings = false;

	for (var teamIndex = 0; teamIndex < teamSetIds.length; teamIndex++) {
		var boundPokemonIndex = findAeLuaLivePokemonIndexForBinding(
			bindings.bySetId[teamSetIds[teamIndex]],
			pokemon,
			usedPokemonIndexes
		);
		if (boundPokemonIndex < 0) continue;
		matchedPokemonIndexes[teamIndex] = boundPokemonIndex;
		usedPokemonIndexes[boundPokemonIndex] = true;
	}
	for (teamIndex = 0; teamIndex < teamSetIds.length; teamIndex++) {
		if (typeof matchedPokemonIndexes[teamIndex] !== "undefined") continue;
		if (bindings.bySetId[teamSetIds[teamIndex]]) continue;
		var unboundPokemonIndex = findAeLuaLivePokemonIndexForUnboundSet(
			teamSetIds[teamIndex],
			teamIndex,
			pokemon,
			usedPokemonIndexes
		);
		if (unboundPokemonIndex < 0) continue;
		matchedPokemonIndexes[teamIndex] = unboundPokemonIndex;
		usedPokemonIndexes[unboundPokemonIndex] = true;
	}

	var importedCount = 0;
	for (teamIndex = 0; teamIndex < teamSetIds.length; teamIndex++) {
		var matchedPokemonIndex = matchedPokemonIndexes[teamIndex];
		if (typeof matchedPokemonIndex === "undefined") continue;
		var mon = pokemon[matchedPokemonIndex];
		var speciesName = getAeLuaPokemonSpeciesNameForTeamSet(mon, teamSetIds[teamIndex]);
		if (!speciesName) continue;
		var oldSetId = teamSetIds[teamIndex];
		var existingSetData = getAeLuaExistingPokemonSetData(oldSetId, customsets);
		var setId = getAeLuaUniqueEvolvedSetId(oldSetId, speciesName, customsets, currentLayout);
		var setName = parseSetId(setId).label;
		if (setId !== oldSetId) removeAeLuaEvolvedSourceCustomSet(customsets, oldSetId, currentLayout);
		if (!customsets[speciesName] || typeof customsets[speciesName] !== "object") customsets[speciesName] = {};
		customsets[speciesName][setName] = buildAeLuaPokemonSet(mon, existingSetData);
		didChangeCustomsets = true;
		if (speciesName === "Aegislash-Blade") {
			if (!customsets["Aegislash-Shield"] || typeof customsets["Aegislash-Shield"] !== "object") customsets["Aegislash-Shield"] = {};
			customsets["Aegislash-Shield"][setName] = customsets[speciesName][setName];
		}
		if (setId !== oldSetId) {
			renameRecords.push({oldSetId: oldSetId, newSetId: setId});
			teamSetIds[teamIndex] = setId;
			currentLayout.team[teamIndex] = setId;
		}
		if (setAeLuaTeamBinding(bindings, setId, mon)) didChangeBindings = true;
		updatedSetIds[setId] = true;
		importedCount += 1;
	}

	// The full-save snapshot is discovery-only outside Calc's Team. Every
	// previously unseen identity is appended to the Calc Box once, but an
	// existing Team/Box/Trash location is never changed to mirror the game.
	var layoutLookup = getAeLuaRosterSetLookup(currentLayout);
	for (var pokemonIndex = 0; pokemonIndex < pokemon.length; pokemonIndex++) {
		mon = pokemon[pokemonIndex];
		var identity = getAeLuaPokemonIdentity(mon);
		if (!identity) continue;
		var boundSetId = getAeLuaBoundSetIdForPokemon(mon, bindings);
		if (boundSetId && layoutLookup[boundSetId]) continue;
		if (boundSetId && hasAeLuaCustomSet(boundSetId, customsets)) {
			currentLayout.box.push(boundSetId);
			layoutLookup[boundSetId] = true;
			discoveredBoxSetIds.push(boundSetId);
			importedCount += 1;
			continue;
		}
		if (boundSetId && bindings.bySetId) {
			delete bindings.bySetId[boundSetId];
			didChangeBindings = true;
		}

		speciesName = normalizeAeLuaPokemonSpeciesName(mon);
		if (!speciesName) continue;
		var discovery = getAeLuaDiscoveredSetId(mon, pokemonIndex, speciesName,
			customsets, layoutLookup, bindings);
		setId = discovery.setId;
		if (discovery.isExisting) {
			if (!layoutLookup[setId]) {
				currentLayout.box.push(setId);
				layoutLookup[setId] = true;
				discoveredBoxSetIds.push(setId);
				importedCount += 1;
			}
			if (setAeLuaTeamBinding(bindings, setId, mon)) didChangeBindings = true;
			continue;
		}

		setName = parseSetId(setId).label;
		if (!customsets[speciesName] || typeof customsets[speciesName] !== "object") {
			customsets[speciesName] = {};
		}
		customsets[speciesName][setName] = buildAeLuaPokemonSet(mon, {});
		if (speciesName === "Aegislash-Blade") {
			if (!customsets["Aegislash-Shield"] || typeof customsets["Aegislash-Shield"] !== "object") {
				customsets["Aegislash-Shield"] = {};
			}
			customsets["Aegislash-Shield"][setName] = customsets[speciesName][setName];
		}
		currentLayout.box.push(setId);
		layoutLookup[setId] = true;
		discoveredBoxSetIds.push(setId);
		if (setAeLuaTeamBinding(bindings, setId, mon)) didChangeBindings = true;
		didChangeCustomsets = true;
		importedCount += 1;
	}

	if (!importedCount) {
		if (didChangeBindings) saveAeLuaTeamBindings(bindings);
		aeLuaPokemonImportSignatures[signatureScope] = signature;
		return 0;
	}

	if (didChangeCustomsets) {
		if (typeof updateDex === "function") {
			updateDex(customsets);
		} else {
			localStorage.setItem("customsets", JSON.stringify(customsets));
		}
	}

	var selectedPlayerSetId = getSelectedSetIdForSide("p1");
	for (var renameIndex = 0; renameIndex < renameRecords.length; renameIndex++) {
		var renameRecord = renameRecords[renameIndex];
		applyAeLuaTeamSetRename(renameRecord.oldSetId, renameRecord.newSetId);
		mergeFragEntriesFromEvolutionDrop(renameRecord.oldSetId, renameRecord.newSetId);
		if (selectedPlayerSetId === renameRecord.oldSetId) selectedPlayerSetId = renameRecord.newSetId;
	}
	appendAeLuaDiscoveredSetIdsToBox(discoveredBoxSetIds);
	if (renameRecords.length) saveCurrentPlayerRosterLayout();
	if (didChangeBindings) bindings = saveAeLuaTeamBindings(bindings);
	aeLuaPokemonImportSignatures[signatureScope] = signature;
	applyPlayerRosterSearchFilter();
	syncFragRoster();
	if (selectedPlayerSetId && updatedSetIds[selectedPlayerSetId]) {
		topPokemonIcon(selectedPlayerSetId, $("#p1mon")[0]);
		$(".player").val(selectedPlayerSetId).change();
		$(".player .select2-chosen").text(formatSetNameForDisplay(selectedPlayerSetId));
	} else if (typeof performCalculations === "function") {
		performCalculations();
	}
	if (renameRecords.length || discoveredBoxSetIds.length) renderFragSheet();
	if (typeof allPokemon === "function" && typeof $ === "function") {
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	}
	return importedCount;
}

function isAeLuaFragSourceText(text) {
	return /aeFragConfig|aeFragState|AE_LUA_SELF_EXPORT_START/.test(String(text || ""));
}

function extractAeLuaFragJsonText(rawText, jsonStart) {
	var stack = [];
	var inString = false;
	var isEscaped = false;
	for (var i = jsonStart; i < rawText.length; i++) {
		var currentChar = rawText.charAt(i);
		if (inString) {
			if (isEscaped) {
				isEscaped = false;
			} else if (currentChar === "\\") {
				isEscaped = true;
			} else if (currentChar === "\"") {
				inString = false;
			}
			continue;
		}
		if (currentChar === "\"") {
			inString = true;
		} else if (currentChar === "{" || currentChar === "[") {
			stack.push(currentChar === "{" ? "}" : "]");
		} else if (currentChar === "}" || currentChar === "]") {
			if (!stack.length || stack[stack.length - 1] !== currentChar) {
				throw new Error("Could not parse the AE_LUA_FRAG_EXPORT JSON payload.");
			}
			stack.pop();
			if (!stack.length) return rawText.substring(jsonStart, i + 1);
		}
	}
	throw new Error("Could not find the end of the AE_LUA_FRAG_EXPORT JSON payload.");
}

function extractAeLuaFragLuaJsonText(rawText) {
	var markerPattern = /AE_LUA_FRAG_EXPORT_JSON\s*=\s*\[(=*)\[/g;
	var markerMatch = null;
	while ((markerMatch = markerPattern.exec(rawText))) {
		var closeMarker = "]" + markerMatch[1] + "]";
		var jsonStart = markerPattern.lastIndex;
		var jsonEnd = rawText.indexOf(closeMarker, jsonStart);
		if (jsonEnd === -1) continue;
		return rawText.substring(jsonStart, jsonEnd);
	}
	return "";
}

function createAeLuaFragImportButton(id) {
	var importButton = document.createElement("button");
	importButton.type = "button";
	importButton.id = id;
	importButton.className = "btn calc-side-btn ae-lua-frag-import-button";
	importButton.textContent = "Connect ae_lua";
	return importButton;
}

function ensureAeLuaFragFileInput() {
	var fileInput = document.getElementById("frags-import-ae-lua-file");
	if (fileInput) return fileInput;
	fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.id = "frags-import-ae-lua-file";
	fileInput.accept = ".lua";
	fileInput.hidden = true;
	(document.body || document.documentElement).appendChild(fileInput);
	return fileInput;
}

function ensureAeLuaFragImportControls() {
	ensureAeLuaFragFileInput();
	var toolbar = document.querySelector("#frags-side-panel .frags-toolbar");
	if (toolbar && !document.getElementById("frags-import-ae-lua")) {
		toolbar.appendChild(createAeLuaFragImportButton("frags-import-ae-lua"));
	}
	var importPanels = document.querySelectorAll(".poke-import");
	for (var i = 0; i < importPanels.length; i++) {
		var panel = importPanels[i];
		if (panel.querySelector(".ae-lua-frag-import-button")) continue;
		var panelButton = createAeLuaFragImportButton("main-import-ae-lua-" + i);
		var wrapper = panel.querySelector(".dataTables_wrapper");
		if (wrapper && wrapper.nextSibling) {
			panel.insertBefore(panelButton, wrapper.nextSibling);
		} else {
			panel.appendChild(panelButton);
		}
	}
}

function setAeLuaFragWatchUi(isWatching) {
	var buttons = document.querySelectorAll(".ae-lua-frag-import-button");
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].textContent = isWatching ? "Imported! ae_lua" : "Import ae_lua";
		buttons[i].title = isWatching
			? "ae_lua.lua successfully imported"
			: "Select ae_lua.lua";
	}
}

function importAeLuaFragFileText(fileName, fileText, options) {
	options = options || {};
	var payload = parseAeLuaFragExportText(fileText || "");
	if (payload && payload.uninitialized) {
		throw new Error("This ae_lua.lua has not been initialized for your save yet. Load it in mGBA first, then import the same file again.");
	}
	var sourcePrefix = options.sourcePrefix || "upload:";
	var pokemonCount = importAeLuaPokemonFromPayload(payload);
	var importedCount = importAeLuaFragEventsFromPayload(payload, sourcePrefix + fileName);
	renderFragSheet();
	if (!options.silent) {
		var suffix = options.watching
			? " Watching ae_lua.lua for updates while this page stays open."
			: (options.oneTime ? " This browser only allowed a one-time import, so it cannot auto-update this file." : "");
		var importParts = [];
		if (importedCount) importParts.push(importedCount + " frag update" + (importedCount === 1 ? "" : "s"));
		if (pokemonCount) importParts.push(pokemonCount + " Pokemon");
		alert("Imported " + (importParts.length ? importParts.join(" and ") : "0 ae_lua updates") + "." + suffix);
	}
	return importedCount + pokemonCount;
}

function stopAeLuaFragWatchedFileImport() {
	if (aeLuaFragWatchedFileTimer) {
		window.clearInterval(aeLuaFragWatchedFileTimer);
		aeLuaFragWatchedFileTimer = null;
	}
	aeLuaFragWatchedFileHandle = null;
	aeLuaFragWatchedFileSignature = "";
	aeLuaPokemonImportSignatures = {};
	setAeLuaFragWatchUi(false);
}

function importAeLuaFragWatchedFile(isInitial) {
	var handle = aeLuaFragWatchedFileHandle;
	if (!handle || typeof handle.getFile !== "function") return;
	handle.getFile().then(function (file) {
		if (!file) return null;
		return file.text().then(function (fileText) {
			var signature = getAeLuaFragTextSignature(file.name, fileText);
			if (!isInitial && signature === aeLuaFragWatchedFileSignature) return;
			aeLuaFragWatchedFileSignature = signature;
			importAeLuaFragFileText(file.name, fileText, {
				sourcePrefix: "watch:",
				silent: !isInitial,
				watching: isInitial
			});
		});
	}).catch(function (err) {
		if (isInitial) {
			alert("Could not import ae_lua: " + (err && err.message ? err.message : err));
		}
	});
}

function startAeLuaFragWatchedFileImport(handle) {
	stopAeLuaFragWatchedFileImport();
	aeLuaFragWatchedFileHandle = handle;
	setAeLuaFragWatchUi(true);
	importAeLuaFragWatchedFile(true);
	aeLuaFragWatchedFileTimer = window.setInterval(function () {
		importAeLuaFragWatchedFile(false);
	}, AE_LUA_FRAG_IMPORT_INTERVAL_MS);
}

function openAeLuaFragNativeFilePicker() {
	if (typeof window.showOpenFilePicker !== "function") return false;
	window.showOpenFilePicker({
		multiple: false,
		types: [{
			description: "ae_lua.lua",
			accept: {"text/plain": [".lua"]}
		}]
	}).then(function (handles) {
		var handle = handles && handles[0];
		if (!handle || typeof handle.getFile !== "function") return;
		return handle.getFile().then(function (file) {
			if (!file || !/\.lua$/i.test(file.name || "")) throw new Error("Please select ae_lua.lua.");
			startAeLuaFragLiveLink(true);
		});
	}).catch(function (err) {
		if (err && err.name === "AbortError") return;
		alert("Could not import ae_lua: " + (err && err.message ? err.message : err));
	});
	return true;
}

function bindAeLuaFragImportControls() {
	ensureAeLuaFragImportControls();
	$(document).off("click.aeluafragimport", ".ae-lua-frag-import-button").on("click.aeluafragimport", ".ae-lua-frag-import-button", function () {
		if (aeLuaFragLiveConnected) return;
		startAeLuaFragLiveLink(true);
	});
	$(document).off("change.aeluafragimport", "#frags-import-ae-lua-file").on("change.aeluafragimport", "#frags-import-ae-lua-file", function () {
		var file = this.files && this.files[0];
		if (!file) return;
		var reader = new FileReader();
		reader.onload = function () {
			startAeLuaFragLiveLink(true);
		};
		reader.onerror = function () {
			alert("Could not read ae_lua.lua.");
		};
		reader.readAsText(file);
		this.value = "";
	});
}

function removeFragKill(killerSetId, preferredFight) {
	var entry = ensureFragEntryForSet(killerSetId);
	if (!entry || entry.totalKills <= 0) return;

	var targetFight = String(preferredFight || getCurrentFightLabel() || "");
	if (!entry.fights[targetFight]) {
		targetFight = "";
		for (var fightName in entry.fights) {
			if (!Object.prototype.hasOwnProperty.call(entry.fights, fightName)) continue;
			if (entry.fights[fightName] > 0) {
				targetFight = fightName;
				break;
			}
		}
	}
	if (!targetFight) return;
	var split = String(getSplitNumberForFragFightLabel(targetFight));
	var victimKey = pickFragVictimKeyForRemoval(entry, targetFight, split);
	entry.fights[targetFight] -= 1;
	if (entry.fights[targetFight] <= 0) delete entry.fights[targetFight];
	if (entry.splits[split]) {
		entry.splits[split] -= 1;
		if (entry.splits[split] <= 0) delete entry.splits[split];
	}
	var removedFromFightVictims = decrementFragVictimBucketCount(entry, "fightVictims", targetFight, victimKey, 1);
	if (!removedFromFightVictims) {
		decrementFragVictimBucketByAny(entry, "fightVictims", targetFight, 1);
	}
	var removedFromSplitVictims = decrementFragVictimBucketCount(entry, "splitVictims", split, victimKey, 1);
	if (!removedFromSplitVictims) {
		decrementFragVictimBucketByAny(entry, "splitVictims", split, 1);
	}
	entry.totalKills = Math.max(0, entry.totalKills - 1);
	suppressAeLuaFragEventsForRemoval(killerSetId, targetFight, victimKey, 1);
	saveFragSheetState();
	renderFragSheet();
}

function removeSpecificFragKill(killerSetId, fightLabel, victimKey) {
	var normalizedSetId = String(killerSetId || "").trim();
	var normalizedFight = String(fightLabel || "").trim();
	if (!normalizedSetId || !normalizedFight) return false;
	var state = getFragSheetState();
	var activeEntries = getFragSheetStateEntryMap(state, "entries");
	var entry = activeEntries[normalizedSetId];
	if (!entry) return false;
	var fightCount = parseInt(entry.fights[normalizedFight], 10);
	if (Number.isNaN(fightCount) || fightCount <= 0) return false;

	var split = String(getSplitNumberForFragFightLabel(normalizedFight));
	var normalizedVictimKey = normalizeFragVictimKey(victimKey);
	entry.fights[normalizedFight] = fightCount - 1;
	if (entry.fights[normalizedFight] <= 0) delete entry.fights[normalizedFight];
	if (entry.splits[split]) {
		entry.splits[split] = Math.max(0, entry.splits[split] - 1);
		if (entry.splits[split] <= 0) delete entry.splits[split];
	}
	var removedFromFightVictims = decrementFragVictimBucketCount(entry, "fightVictims", normalizedFight, normalizedVictimKey, 1);
	if (!removedFromFightVictims && normalizedVictimKey !== FRAG_UNKNOWN_VICTIM_KEY) {
		removedFromFightVictims = decrementFragVictimBucketCount(entry, "fightVictims", normalizedFight, FRAG_UNKNOWN_VICTIM_KEY, 1);
	}
	if (!removedFromFightVictims) {
		decrementFragVictimBucketByAny(entry, "fightVictims", normalizedFight, 1);
	}
	var removedFromSplitVictims = decrementFragVictimBucketCount(entry, "splitVictims", split, normalizedVictimKey, 1);
	if (!removedFromSplitVictims && normalizedVictimKey !== FRAG_UNKNOWN_VICTIM_KEY) {
		removedFromSplitVictims = decrementFragVictimBucketCount(entry, "splitVictims", split, FRAG_UNKNOWN_VICTIM_KEY, 1);
	}
	if (!removedFromSplitVictims) {
		decrementFragVictimBucketByAny(entry, "splitVictims", split, 1);
	}
	entry.totalKills = Math.max(0, entry.totalKills - 1);
	if (entry.totalKills <= 0) entry.lastVictim = "";
	suppressAeLuaFragEventsForRemoval(normalizedSetId, normalizedFight, normalizedVictimKey, 1);
	saveFragSheetState();
	renderFragSheet();
	return true;
}

function clearFragsForCurrentFight() {
	var fight = getCurrentFightLabel();
	var normalizedFight = normalizeFragFightLabelForMatch(fight);
	var currentFightIndex = getCurrentFightIndex();
	var fightIndexCache = {};
	var state = getFragSheetState();
	var hadKills = false;
	for (var setId in state.entries) {
		if (!Object.prototype.hasOwnProperty.call(state.entries, setId)) continue;
		var entry = state.entries[setId];
		if (!entry || !entry.fights || typeof entry.fights !== "object") continue;
		var fightsToClear = [];
		for (var fightName in entry.fights) {
			if (!Object.prototype.hasOwnProperty.call(entry.fights, fightName)) continue;
			var fightCount = parseInt(entry.fights[fightName], 10);
			if (Number.isNaN(fightCount) || fightCount <= 0) continue;
			if (normalizeFragFightLabelForMatch(fightName) === normalizedFight) {
				fightsToClear.push(fightName);
				continue;
			}
			if (currentFightIndex > 0) {
				if (!Object.prototype.hasOwnProperty.call(fightIndexCache, fightName)) {
					fightIndexCache[fightName] = getTrainerIndexForLabel(fightName);
				}
				if (fightIndexCache[fightName] === currentFightIndex) {
					fightsToClear.push(fightName);
				}
			}
		}
		if (!fightsToClear.length) continue;
		var removedForEntry = 0;
		for (var i = 0; i < fightsToClear.length; i++) {
			var fightKey = fightsToClear[i];
			var removed = parseInt(entry.fights[fightKey], 10);
			if (Number.isNaN(removed) || removed <= 0) continue;
			var split = String(getSplitNumberForFragFightLabel(fightKey));
			var fightVictimBucket = getFragVictimBucketForEntry(entry, "fightVictims", fightKey, false);
			var suppressedVictimCounts = 0;
			if (fightVictimBucket) {
				for (var suppressVictimKey in fightVictimBucket) {
					if (!Object.prototype.hasOwnProperty.call(fightVictimBucket, suppressVictimKey)) continue;
					var suppressVictimCount = parseInt(fightVictimBucket[suppressVictimKey], 10);
					if (Number.isNaN(suppressVictimCount) || suppressVictimCount <= 0) continue;
					suppressedVictimCounts += suppressVictimCount;
					suppressAeLuaFragEventsForRemoval(setId, fightKey, suppressVictimKey, suppressVictimCount);
				}
			}
			if (suppressedVictimCounts < removed) {
				suppressAeLuaFragEventsForRemoval(setId, fightKey, FRAG_UNKNOWN_VICTIM_KEY, removed - suppressedVictimCounts);
			}
			delete entry.fights[fightKey];
			if (entry.fightVictims && Object.prototype.hasOwnProperty.call(entry.fightVictims, fightKey)) {
				delete entry.fightVictims[fightKey];
			}
			if (entry.splits[split]) {
				entry.splits[split] = Math.max(0, entry.splits[split] - removed);
				if (entry.splits[split] <= 0) delete entry.splits[split];
			}
			var removedVictimCounts = 0;
			if (fightVictimBucket) {
				for (var victimKey in fightVictimBucket) {
					if (!Object.prototype.hasOwnProperty.call(fightVictimBucket, victimKey)) continue;
					var victimCount = parseInt(fightVictimBucket[victimKey], 10);
					if (Number.isNaN(victimCount) || victimCount <= 0) continue;
					removedVictimCounts += victimCount;
					decrementFragVictimBucketCount(entry, "splitVictims", split, victimKey, victimCount);
				}
			}
			if (removedVictimCounts < removed) {
				var unknownRemoved = decrementFragVictimBucketCount(entry, "splitVictims", split, FRAG_UNKNOWN_VICTIM_KEY, removed - removedVictimCounts);
				if (unknownRemoved < (removed - removedVictimCounts)) {
					decrementFragVictimBucketByAny(entry, "splitVictims", split, (removed - removedVictimCounts) - unknownRemoved);
				}
			}
			removedForEntry += removed;
		}
		if (removedForEntry > 0) {
			entry.totalKills = Math.max(0, entry.totalKills - removedForEntry);
			hadKills = true;
		}
	}
	if (hadKills) saveFragSheetState();
	renderFragSheet();
}

function clearAllFrags() {
	var state = getFragSheetState();
	state.entries = {};
	state.archivedEntries = {};
	saveFragSheetState();
	syncFragRoster({pruneMissing: true});
	renderFragSheet();
	applyPlayerRosterSearchFilter();
}

function getSortedFragEntries() {
	var state = getFragSheetState();
	var entries = [];
	for (var setId in state.entries) {
		if (!Object.prototype.hasOwnProperty.call(state.entries, setId)) continue;
		entries.push(state.entries[setId]);
	}
	entries.sort(function (a, b) {
		if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
		if (a.species !== b.species) return a.species.localeCompare(b.species);
		return a.setId.localeCompare(b.setId);
	});
	return entries;
}

function getFragSplitTotals(entries) {
	var totals = {overall: 0, splits: {}};
	for (var s = 1; s <= 9; s++) {
		totals.splits[String(s)] = 0;
	}
	for (var i = 0; i < entries.length; i++) {
		var totalKills = parseInt(entries[i].totalKills, 10);
		if (!Number.isNaN(totalKills) && totalKills > 0) totals.overall += totalKills;
		for (var splitNumber = 1; splitNumber <= 9; splitNumber++) {
			var splitKey = String(splitNumber);
			var splitKills = parseInt(entries[i].splits[splitKey], 10);
			if (!Number.isNaN(splitKills) && splitKills > 0) totals.splits[splitKey] += splitKills;
		}
	}
	return totals;
}

function toFragPercent(value, total) {
	if (!total || total <= 0) return 0;
	var numericValue = parseInt(value, 10);
	if (Number.isNaN(numericValue) || numericValue <= 0) return 0;
	return (numericValue / total) * 100;
}

function formatFragPercentValue(rawPercent) {
	var bounded = Math.max(0, Math.min(100, rawPercent || 0));
	var rounded = Math.round(bounded * 10) / 10;
	if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
	return rounded.toFixed(1);
}

function renderFragPercentBar(rawPercent, isDead) {
	var bounded = Math.max(0, Math.min(100, rawPercent || 0));
	var formatted = formatFragPercentValue(bounded);
	var deadClass = isDead ? " is-dead" : "";
	return "<div class=\"frags-percent-cell" + deadClass + "\">" +
		"<div class=\"frags-percent-track\"><div class=\"frags-percent-fill\" style=\"width:" + bounded.toFixed(2) + "%\"></div></div>" +
		"<span class=\"frags-percent-label\">" + formatted + "%</span>" +
		"</div>";
}

function getFragVictimEditorLabel(victimKey) {
	var normalizedVictimKey = normalizeFragVictimKey(victimKey);
	if (normalizedVictimKey === FRAG_UNKNOWN_VICTIM_KEY) return "Unknown";
	return formatSetNameForDisplay(normalizedVictimKey);
}

function getFragVictimEditorRows(entry, currentFight) {
	var rows = [];
	if (!entry || !entry.fights || typeof entry.fights !== "object") return rows;
	var normalizedCurrentFight = normalizeFragFightLabelForMatch(currentFight);
	for (var fightName in entry.fights) {
		if (!Object.prototype.hasOwnProperty.call(entry.fights, fightName)) continue;
		var fightCount = parseInt(entry.fights[fightName], 10);
		if (Number.isNaN(fightCount) || fightCount <= 0) continue;
		var fightBucket = getFragVictimBucketForEntry(entry, "fightVictims", fightName, false);
		var victimRows = [];
		var victimTotal = 0;
		if (fightBucket) {
			for (var fightVictimKey in fightBucket) {
				if (!Object.prototype.hasOwnProperty.call(fightBucket, fightVictimKey)) continue;
				var victimCount = parseInt(fightBucket[fightVictimKey], 10);
				if (Number.isNaN(victimCount) || victimCount <= 0) continue;
				victimRows.push({
					key: fightVictimKey,
					name: getFragVictimEditorLabel(fightVictimKey),
					count: victimCount
				});
				victimTotal += victimCount;
			}
		}
		if (victimTotal < fightCount) {
			victimRows.push({
				key: FRAG_UNKNOWN_VICTIM_KEY,
				name: "Unknown",
				count: fightCount - victimTotal
			});
		}
		victimRows.sort(function (a, b) {
			if (b.count !== a.count) return b.count - a.count;
			return a.name.localeCompare(b.name);
		});
		rows.push({
			fight: fightName,
			split: String(getSplitNumberForFragFightLabel(fightName)),
			isCurrentFight: normalizeFragFightLabelForMatch(fightName) === normalizedCurrentFight,
			victims: victimRows
		});
	}
	rows.sort(function (a, b) {
		if (a.isCurrentFight !== b.isCurrentFight) return a.isCurrentFight ? -1 : 1;
		var aIndex = getTrainerIndexForLabel(a.fight);
		var bIndex = getTrainerIndexForLabel(b.fight);
		if (aIndex && bIndex && aIndex !== bIndex) return aIndex - bIndex;
		if (aIndex && !bIndex) return -1;
		if (!aIndex && bIndex) return 1;
		return a.fight.localeCompare(b.fight);
	});
	return rows;
}

function renderFragVictimEditor(entry, currentFight) {
	var fightRows = getFragVictimEditorRows(entry, currentFight);
	if (!fightRows.length) return "";
	var rowsHtml = "";
	for (var i = 0; i < fightRows.length; i++) {
		var fightRow = fightRows[i];
		var victimsHtml = "";
		for (var j = 0; j < fightRow.victims.length; j++) {
			var victimRow = fightRow.victims[j];
			victimsHtml += "<li class=\"frags-edit-victim-item\">" +
				"<span class=\"frags-edit-victim-name\">" + escapeHtml(victimRow.name) + "</span>" +
				"<span class=\"frags-edit-victim-count\">x" + victimRow.count + "</span>" +
				"<button type=\"button\" class=\"btn frags-edit-remove\" data-frag-set=\"" + escapeHtml(entry.setId) + "\" data-frag-fight=\"" + escapeHtml(fightRow.fight) + "\" data-frag-victim=\"" + escapeHtml(victimRow.key) + "\" title=\"Remove one recorded kill from this target\">-1</button>" +
				"</li>";
		}
		rowsHtml += "<div class=\"frags-edit-fight\">" +
			"<div class=\"frags-edit-fight-head\">" +
			"<span class=\"frags-edit-fight-name\">" + escapeHtml(fightRow.fight) + "</span>" +
			(fightRow.isCurrentFight ? "<span class=\"frags-edit-current-tag\">Current</span>" : "") +
			"</div>" +
			"<div class=\"frags-edit-fight-meta\">Split " + escapeHtml(fightRow.split) + "</div>" +
			"<ul class=\"frags-edit-victim-list\">" + victimsHtml + "</ul>" +
			"</div>";
	}
	return "<details class=\"frags-edit-drop\">" +
		"<summary>Edit kills</summary>" +
		"<div class=\"frags-edit-body\">" + rowsHtml + "</div>" +
		"</details>";
}

function isPlayerSetInTrash(setId) {
	var targetSetId = String(setId || "");
	if (!targetSetId) return false;
	var isDead = false;
	$("#trash-box .trainer-pok.left-side").each(function () {
		if ($(this).attr("data-id") === targetSetId) {
			isDead = true;
			return false;
		}
	});
	return isDead;
}

function getFragDeathInfo(entry) {
	if (!entry) return {isDead: false, deathFight: ""};
	var markedDead = !!entry.isDead;
	var inTrash = isPlayerSetInTrash(entry.setId);
	var isDead = markedDead || inTrash;
	var deathFight = entry.deathFight ? String(entry.deathFight) : "";
	return {
		isDead: isDead,
		deathFight: deathFight
	};
}

function setFragSetDeadState(setId, shouldBeDead, fightLabel) {
	var entry = ensureFragEntryForSet(setId);
	if (!entry) return;
	entry.isDead = !!shouldBeDead;
	entry.deathFight = entry.isDead ? String(fightLabel || getCurrentFightLabel() || "Unknown Fight") : "";
	saveFragSheetState();
	renderFragSheet();
}

function formatFragSnapshotOptionLabel(record, fallbackPrefix) {
	var snapshotRecord = record || {};
	var snapshotName = String(snapshotRecord.name || "").trim() || String(fallbackPrefix || "Snapshot");
	var savedAtLabel = formatFragSnapshotDateLabel(snapshotRecord.savedAt);
	var totalKills = parseInt(snapshotRecord.totalKills, 10);
	if (Number.isNaN(totalKills) || totalKills < 0) {
		totalKills = getFragTotalKillsFromSnapshotPayload(snapshotRecord.payload);
	}
	return snapshotName + " - " + savedAtLabel + " (" + totalKills + " kills)";
}

function setFragHistoryExpanded(isExpanded) {
	fragsHistoryExpanded = !!isExpanded;
	var controls = document.getElementById("frags-history-controls");
	if (!controls) return;
	var historyBody = document.getElementById("frags-history-body");
	var toggleBtn = document.getElementById("frags-history-toggle");
	if (historyBody) historyBody.hidden = !fragsHistoryExpanded;
	if (toggleBtn) toggleBtn.textContent = fragsHistoryExpanded ? "Hide Save States and Backups \u25b4" : "Show Save States and Backups \u25be";
}

function showFragHistoryInfoDialog() {
	alert(
		"Save States let you create named snapshots of your current frags, imports, and boxes.\n\n" +
		"Auto Backups are rolling safety snapshots (plus \"Save Backup Now\" for a manual one).\n\n" +
		"Restoring a state/backup replaces your current frags/imports/boxes, so it can recover accidental clears or bad imports."
	);
}

function ensureFragHistoryControls() {
	var existingControls = document.getElementById("frags-history-controls");
	if (existingControls) return existingControls;
	var fragsPanel = document.getElementById("frags-side-panel");
	if (!fragsPanel) return null;
	var sideBody = fragsPanel.querySelector(".calc-side-body");
	if (!sideBody) return null;
	var controls = document.createElement("div");
	controls.id = "frags-history-controls";
	controls.className = "frags-history-controls";
	controls.hidden = true;
	controls.innerHTML = "" +
		"<div class=\"frags-history-header\">" +
		"<button type=\"button\" id=\"frags-history-toggle\" class=\"btn calc-side-btn frags-history-toggle\">Show Save States and Backups \u25be</button>" +
		"<button type=\"button\" id=\"frags-history-info\" class=\"btn calc-side-btn frags-history-info\">Info</button>" +
		"</div>" +
		"<div id=\"frags-history-body\" class=\"frags-history-body\" hidden>" +
		"<div class=\"frags-history-group\">" +
		"<label for=\"frags-state-name\">Save State Name</label>" +
		"<input id=\"frags-state-name\" class=\"frags-history-input\" type=\"text\" placeholder=\"e.g. Gym Split 2\" />" +
		"<div class=\"frags-history-actions\">" +
		"<button type=\"button\" id=\"frags-state-save\" class=\"btn calc-side-btn\">Save State</button>" +
		"<button type=\"button\" id=\"frags-state-delete\" class=\"btn calc-side-btn\">Delete State</button>" +
		"</div>" +
		"<select id=\"frags-state-list\" class=\"frags-history-select\"></select>" +
		"<button type=\"button\" id=\"frags-state-restore\" class=\"btn calc-side-btn\">Restore State</button>" +
		"</div>" +
		"<div class=\"frags-history-group\">" +
		"<label for=\"frags-backup-list\">Auto Backups</label>" +
		"<div class=\"frags-history-actions\">" +
		"<button type=\"button\" id=\"frags-backup-save\" class=\"btn calc-side-btn\">Save Backup Now</button>" +
		"</div>" +
		"<select id=\"frags-backup-list\" class=\"frags-history-select\"></select>" +
		"<button type=\"button\" id=\"frags-backup-restore\" class=\"btn calc-side-btn\">Restore Backup</button>" +
		"</div>" +
		"</div>";
	var tableWrap = document.getElementById("frags-table-wrap");
	if (tableWrap && tableWrap.parentNode === sideBody) {
		sideBody.insertBefore(controls, tableWrap);
	} else {
		sideBody.appendChild(controls);
	}
	setFragHistoryExpanded(fragsHistoryExpanded);
	return controls;
}

function refreshFragHistoryControls() {
	var controls = ensureFragHistoryControls();
	if (!controls) return;
	var states = getStoredFragSheetStates();
	var backups = getStoredFragSheetBackups();
	var stateSelect = document.getElementById("frags-state-list");
	var backupSelect = document.getElementById("frags-backup-list");
	if (stateSelect) {
		var stateOptions = ["<option value=\"\">Select saved state...</option>"];
		for (var i = 0; i < states.length; i++) {
			var stateRecord = states[i];
			stateOptions.push("<option value=\"" + escapeHtml(stateRecord.id) + "\">" + escapeHtml(formatFragSnapshotOptionLabel(stateRecord, "State")) + "</option>");
		}
		stateSelect.innerHTML = stateOptions.join("");
	}
	if (backupSelect) {
		var backupOptions = ["<option value=\"\">Select backup...</option>"];
		for (var j = 0; j < backups.length; j++) {
			var backupRecord = backups[j];
			backupOptions.push("<option value=\"" + escapeHtml(backupRecord.id) + "\">" + escapeHtml(formatFragSnapshotOptionLabel(backupRecord, "Backup")) + "</option>");
		}
		backupSelect.innerHTML = backupOptions.join("");
	}
}

function setFragHistoryControlsVisibility(isVisible) {
	var controls = ensureFragHistoryControls();
	if (!controls) return;
	controls.hidden = !isVisible;
	if (isVisible) refreshFragHistoryControls();
}

function renderFragSheet() {
	syncFragRoster();
	updateTrainerFragBorderTotals();
	var container = document.getElementById("frags-table-wrap");
	var summaryText = document.getElementById("frags-summary-text");
	var currentFightLabelNode = document.getElementById("frags-current-fight-label");
	if (!container || !summaryText || !currentFightLabelNode) return;
	var fragsPanel = document.getElementById("frags-side-panel");
	var showAllSplits = !!(fragsPanel && fragsPanel.classList.contains("fullscreen"));
	setFragHistoryControlsVisibility(showAllSplits);

	var currentFight = getCurrentFightLabel();
	var activeSplit = getCurrentSplitNumber(currentFight);
	currentFightLabelNode.textContent = "Fight: " + currentFight + " (Split " + activeSplit + ")";
	var entries = getSortedFragEntries();
	if (!entries.length) {
		summaryText.textContent = "Import sets or add sprites to start tracking frags.";
		container.innerHTML = "";
		return;
	}

	var leader = entries[0];
	if (leader.totalKills > 0) {
		summaryText.textContent = leader.species + " is leading with " + leader.totalKills + " total kills.";
	} else {
		summaryText.textContent = "No kills tracked yet. Right-click a player sprite to add frags.";
	}

	var totals = getFragSplitTotals(entries);
	var rowsHtml = "";
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		var fightKills = entry.fights[currentFight] || 0;
		var titleText = entry.setId === entry.species ? entry.species : entry.setId;
		var deathInfo = getFragDeathInfo(entry);
		var isDead = deathInfo.isDead;
		var deathFight = deathInfo.deathFight;
		var placementClass = i === 0 ? " frags-rank-1" : (i === 1 ? " frags-rank-2" : (i === 2 ? " frags-rank-3" : ""));
		var lifeClass = isDead ? " frags-is-dead" : "";
		var splitPercentColumns = "";
		if (showAllSplits) {
			for (var splitNumber = 1; splitNumber <= 9; splitNumber++) {
				var splitKey = String(splitNumber);
				var splitPercent = toFragPercent(entry.splits[splitKey] || 0, totals.splits[splitKey] || 0);
				var splitVictimDropdown = renderFragSplitVictimDropdown(entry, splitKey);
				splitPercentColumns += "<td class=\"frag-percent-col frag-split-detail-col\">" + renderFragPercentBar(splitPercent, isDead) + splitVictimDropdown + "</td>";
			}
		}
		var overallPercent = toFragPercent(entry.totalKills, totals.overall);
		var victimEditorHtml = showAllSplits ? renderFragVictimEditor(entry, currentFight) : "";
		rowsHtml += "<tr class=\"frags-row" + placementClass + lifeClass + "\">" +
			"<td class=\"frag-num\">" + (i + 1) + "</td>" +
			"<td title=\"" + escapeHtml(titleText) + "\" class=\"frags-mon-cell\">" +
			"<div class=\"frags-mon-content\">" +
			"<img class=\"frags-mon-sprite\" src=\"" + escapeHtml(getFragSpriteUrl(entry.species)) + "\" data-species=\"" + escapeHtml(entry.species) + "\"" + getPrimaryIconSheetLoadAttr(entry.species) + " onerror=\"applyIconSheetFallbackImage(this, this.getAttribute('data-species'))\" alt=\"\">" +
			"<span>" + escapeHtml(entry.species) + "</span></div></td>" +
			"<td class=\"frag-life-cell\"><span class=\"frags-life-badge " + (isDead ? "frags-life-dead" : "frags-life-alive") + "\">" + (isDead ? "Dead" : "Alive") + "</span>" +
			(deathFight ? "<div class=\"frags-death-fight\" title=\"Died on " + escapeHtml(deathFight) + "\">" + escapeHtml(deathFight) + "</div>" : "") +
			"</td>" +
			"<td class=\"frag-num\">" + entry.totalKills + "</td>" +
			"<td class=\"frag-percent-col\">" + renderFragPercentBar(overallPercent, isDead) + "</td>" +
			splitPercentColumns +
			"<td class=\"frag-num\">" + fightKills + "</td>" +
			"<td><div class=\"frags-actions-cell\"><div class=\"frags-actions\">" +
			"<button type=\"button\" class=\"btn frags-action-btn frags-inc\" data-frag-set=\"" + escapeHtml(entry.setId) + "\">+1</button>" +
			"<button type=\"button\" class=\"btn frags-action-btn frags-dec\" data-frag-set=\"" + escapeHtml(entry.setId) + "\">-1</button>" +
			"</div>" + victimEditorHtml + "</div></td>" +
			"</tr>";
	}
	var splitHeaders = "";
	if (showAllSplits) {
		for (var hs = 1; hs <= 9; hs++) {
			splitHeaders += "<th class=\"frag-percent-head\">S" + hs + " %</th>";
		}
	}
	container.innerHTML = "<table class=\"frags-table\">" +
		"<thead><tr><th>#</th><th>Pokemon</th><th>Status</th><th>Total</th><th class=\"frag-percent-head\">Overall %</th>" + splitHeaders + "<th>This Fight</th><th>Actions</th></tr></thead>" +
		"<tbody>" + rowsHtml + "</tbody>" +
		"</table>";
}

function setCalcSideDockedWidth(widthPx) {
	var roundedWidth = Math.max(0, Math.round(widthPx || 0));
	document.documentElement.style.setProperty("--calc-side-panel-open-width", roundedWidth + "px");
	document.body.classList.toggle("calc-side-panel-docked", roundedWidth > 0);
}

function updateCalcLayoutForSidePanel() {
	var panel = document.querySelector(".calc-side-panel.open:not(.fullscreen):not(#frags-side-panel)");
	if (!panel) {
		setCalcSideDockedWidth(0);
		return;
	}
	var panelWidth = Math.round(panel.getBoundingClientRect().width || 0);
	if (window.innerWidth < 1100 || !panelWidth || (window.innerWidth - panelWidth) < CALC_SIDE_PANEL_MIN_MAIN_WIDTH_PX) {
		setCalcSideDockedWidth(0);
		return;
	}
	setCalcSideDockedWidth(panelWidth);
}

function syncCalcSidePanelFullscreenButtonLabel(panelId, isFullscreen) {
	if (panelId === "frags-side-panel") {
		$("#frags-panel-fullscreen").text(isFullscreen ? "Exit Fullscreen" : "Fullscreen");
	} else if (panelId === "notes-side-panel") {
		$("#notes-panel-fullscreen").text(isFullscreen ? "Exit Fullscreen" : "Fullscreen");
	}
}

function setCalcSidePanelFullscreen(panelOrId, shouldBeFullscreen) {
	var panel = typeof panelOrId === "string" ? document.getElementById(panelOrId) : panelOrId;
	if (!panel) return false;
	var nextFullscreen = typeof shouldBeFullscreen === "boolean"
		? shouldBeFullscreen
		: !panel.classList.contains("fullscreen");
	if (nextFullscreen) {
		var currentWidth = String(panel.style.width || "").trim();
		if (currentWidth) {
			panel.setAttribute("data-docked-width", currentWidth);
		}
		panel.style.removeProperty("width");
		panel.classList.add("fullscreen");
	} else {
		panel.classList.remove("fullscreen");
		var dockedWidth = String(panel.getAttribute("data-docked-width") || "").trim();
		if (dockedWidth) {
			panel.style.width = dockedWidth;
		} else {
			panel.style.removeProperty("width");
		}
		panel.removeAttribute("data-docked-width");
	}
	syncCalcSidePanelFullscreenButtonLabel(panel.id, nextFullscreen);
	if (panel.id === "frags-side-panel") {
		renderFragSheet();
	} else if (panel.id === "notes-side-panel") {
		renderNotesPanel();
	}
	updateCalcSideBackdrop();
	updateCalcLayoutForSidePanel();
	return nextFullscreen;
}

function updateCalcSideBackdrop() {
	var backdrop = document.getElementById("calc-side-backdrop");
	if (!backdrop) return;
	var hasOpenPanel = $(".calc-side-panel.open").length > 0;
	var showBackdrop = hasOpenPanel && window.innerWidth < 1100;
	backdrop.hidden = !showBackdrop;
	backdrop.classList.toggle("open", showBackdrop);
}

function closeCalcSidePanel(panelId) {
	var panel = document.getElementById(panelId);
	if (!panel) return;
	var wasOpen = panel.classList.contains("open");
	setCalcSidePanelFullscreen(panel, false);
	panel.classList.remove("open");
	panel.setAttribute("aria-hidden", "true");
	panel.hidden = true;
	if (calcSidePanelResizeState && calcSidePanelResizeState.panelId === panelId) {
		endCalcSidePanelResize();
	}
	if (wasOpen) {
		updateCalcSideBackdrop();
		updateCalcLayoutForSidePanel();
	}
}

function closeCalcSidePanels(exceptPanelId) {
	$(".calc-side-panel.open").each(function () {
		if (exceptPanelId && this.id === exceptPanelId) return;
		closeCalcSidePanel(this.id);
	});
}

function openCalcSidePanel(panelId) {
	var panel = document.getElementById(panelId);
	if (!panel) return;
	closeCalcSidePanels(panelId);
	panel.hidden = false;
	panel.classList.add("open");
	panel.setAttribute("aria-hidden", "false");
	updateCalcSideBackdrop();
	updateCalcLayoutForSidePanel();
}

function clampCalcSidePanelWidth(widthPx) {
	var maxWidth = Math.floor((window.innerWidth * CALC_SIDE_PANEL_MAX_WIDTH_VW) / 100);
	if (maxWidth < CALC_SIDE_PANEL_MIN_WIDTH_PX) maxWidth = CALC_SIDE_PANEL_MIN_WIDTH_PX;
	return Math.max(CALC_SIDE_PANEL_MIN_WIDTH_PX, Math.min(maxWidth, Math.round(widthPx)));
}

function ensureCalcSideResizeCaptureNode() {
	if (calcSideResizeCaptureNode && document.body.contains(calcSideResizeCaptureNode)) return calcSideResizeCaptureNode;
	var captureNode = document.getElementById("calc-side-resize-capture");
	if (!captureNode) {
		captureNode = document.createElement("div");
		captureNode.id = "calc-side-resize-capture";
		captureNode.className = "calc-side-resize-capture";
		captureNode.hidden = true;
		document.body.appendChild(captureNode);
	}
	calcSideResizeCaptureNode = captureNode;
	return captureNode;
}

function beginCalcSidePanelResize(panel, startClientX) {
	if (!panel || panel.classList.contains("fullscreen")) return;
	var captureNode = ensureCalcSideResizeCaptureNode();
	calcSidePanelResizeState = {
		panelId: panel.id,
		startClientX: startClientX,
		startWidth: panel.getBoundingClientRect().width || CALC_SIDE_PANEL_MIN_WIDTH_PX
	};
	if (captureNode) captureNode.hidden = false;
	document.body.classList.add("calc-side-resizing");
}

function continueCalcSidePanelResize(nextClientX, buttonsMask) {
	if (!calcSidePanelResizeState) return;
	if (typeof buttonsMask === "number" && buttonsMask === 0) {
		endCalcSidePanelResize();
		return;
	}
	var panel = document.getElementById(calcSidePanelResizeState.panelId);
	if (!panel) {
		endCalcSidePanelResize();
		return;
	}
	var delta = calcSidePanelResizeState.startClientX - nextClientX;
	var nextWidth = clampCalcSidePanelWidth(calcSidePanelResizeState.startWidth + delta);
	panel.style.width = nextWidth + "px";
	updateCalcLayoutForSidePanel();
}

function endCalcSidePanelResize() {
	if (!calcSidePanelResizeState) return;
	calcSidePanelResizeState = null;
	if (calcSideResizeCaptureNode) calcSideResizeCaptureNode.hidden = true;
	document.body.classList.remove("calc-side-resizing");
}

function getFaqEntries() {
	var sourceEntries = Array.isArray(FAQ_ENTRIES) ? FAQ_ENTRIES : [];
	var entries = [];
	for (var i = 0; i < sourceEntries.length; i++) {
		var rawEntry = sourceEntries[i] || {};
		var question = String(rawEntry.question || "").trim();
		var answer = String(rawEntry.answer || "").trim();
		if (!question || !answer) continue;
		entries.push({
			question: question,
			answer: answer
		});
	}
	return entries;
}

function renderFaqPanel() {
	var listNode = document.getElementById("faq-list");
	if (!listNode) return;
	var entries = getFaqEntries();
	if (!entries.length) {
		listNode.innerHTML = "<p class=\"faq-empty\">No FAQ entries yet.</p>";
		return;
	}
	var html = "";
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		html += "<article class=\"faq-entry\">" +
			"<details>" +
			"<summary>" + escapeHtml(entry.question) + "</summary>" +
			"<p class=\"faq-answer\">" + escapeHtml(entry.answer).replace(/\n/g, "<br>") + "</p>" +
			"</details>" +
			"</article>";
	}
	listNode.innerHTML = html;
}

function openFragsPanel() {
	openCalcSidePanel("frags-side-panel");
	renderFragSheet();
}

function openSettingsPanel() {
	openCalcSidePanel("settings-side-panel");
	syncSettingsPanelUi();
}

function openFaqPanel() {
	openCalcSidePanel("faq-side-panel");
	renderFaqPanel();
}

function createDefaultNotesTurn() {
	return {
		left1: "",
		left2: "",
		right1: "",
		right2: "",
		note: ""
	};
}

function normalizeNotesTurn(rawTurn) {
	var turn = rawTurn && typeof rawTurn === "object" ? rawTurn : {};
	return {
		left1: String(turn.left1 || "").trim(),
		left2: String(turn.left2 || "").trim(),
		right1: String(turn.right1 || "").trim(),
		right2: String(turn.right2 || "").trim(),
		note: String(turn.note || "")
	};
}

function normalizeNotesBoardState(rawState) {
	var state = rawState && typeof rawState === "object" ? rawState : {};
	var normalized = {
		format: state.format === "doubles" ? "doubles" : "singles",
		turns: []
	};
	var rawTurns = Array.isArray(state.turns) ? state.turns : [];
	for (var i = 0; i < rawTurns.length; i++) {
		normalized.turns.push(normalizeNotesTurn(rawTurns[i]));
	}
	if (!normalized.turns.length) normalized.turns.push(createDefaultNotesTurn());
	return normalized;
}

function getNotesBoardState(forceReload) {
	if (!forceReload && notesBoardState) return notesBoardState;
	var parsed = safeJsonParse(localStorage.getItem(NOTES_BOARD_STORAGE_KEY), {});
	notesBoardState = normalizeNotesBoardState(parsed);
	return notesBoardState;
}

function saveNotesBoardState() {
	localStorage.setItem(NOTES_BOARD_STORAGE_KEY, JSON.stringify(getNotesBoardState()));
}

function ensureNotesSetOption(options, setId) {
	var normalizedSet = String(setId || "").trim();
	if (!normalizedSet) return;
	if (options.indexOf(normalizedSet) >= 0) return;
	options.push(normalizedSet);
}

function getNotesPlayerSetOptions() {
	var options = collectPlayerRosterSetIds();
	var activePlayerSet = $(".player").val();
	ensureNotesSetOption(options, activePlayerSet);
	if (options.length) return options;
	var customsets = safeJsonParse(localStorage.getItem("customsets"), {});
	for (var speciesName in customsets) {
		if (!Object.prototype.hasOwnProperty.call(customsets, speciesName)) continue;
		var speciesSets = customsets[speciesName];
		if (!speciesSets || typeof speciesSets !== "object") continue;
		for (var setLabel in speciesSets) {
			if (!Object.prototype.hasOwnProperty.call(speciesSets, setLabel)) continue;
			ensureNotesSetOption(options, speciesName + " (" + setLabel + ")");
		}
	}
	return options;
}

function getNotesOpposingSetOptions() {
	var options = collectOpposingTargetSetIds();
	var activeOpposingSet = $(".opposing").val();
	ensureNotesSetOption(options, activeOpposingSet);
	return options;
}

function renderNotesSetOptionsHtml(options, selectedSetId, emptyLabel) {
	var normalizedOptions = Array.isArray(options) ? options.slice() : [];
	ensureNotesSetOption(normalizedOptions, selectedSetId);
	var selected = String(selectedSetId || "").trim();
	var html = "<option value=\"\">" + escapeHtml(emptyLabel || "Select Pokemon") + "</option>";
	for (var i = 0; i < normalizedOptions.length; i++) {
		var setId = normalizedOptions[i];
		var selectedAttr = setId === selected ? " selected" : "";
		html += "<option value=\"" + escapeHtml(setId) + "\"" + selectedAttr + ">" + escapeHtml(formatSetNameForDisplay(setId)) + "</option>";
	}
	return html;
}

function getNotesMonSlotHtml(turnIndex, fieldKey, selectedSetId, options, emptyLabel) {
	var selected = String(selectedSetId || "").trim();
	var speciesName = parseSetId(selected).species || "";
	var spriteSrc = speciesName
		? escapeHtml(getInitialTrainerSpriteUrlByName(speciesName))
		: POKEMON_ICON_FALLBACK_DATA_URL;
	var spriteClass = "notes-mon-sprite" + (speciesName ? "" : " notes-mon-sprite-empty");
	var spriteOnLoad = speciesName ? getPrimaryIconSheetLoadAttr(speciesName) : "";
	var spriteOnError = speciesName ? " onerror=\"applyIconSheetFallbackImage(this, this.getAttribute('data-species'))\"" : "";
	return "<div class=\"notes-mon-slot\">" +
		"<select class=\"notes-set-select\" data-turn-index=\"" + turnIndex + "\" data-notes-field=\"" + escapeHtml(fieldKey) + "\">" +
		renderNotesSetOptionsHtml(options, selected, emptyLabel) +
		"</select>" +
		"<img class=\"" + spriteClass + "\" src=\"" + spriteSrc + "\" data-species=\"" + escapeHtml(speciesName) + "\" alt=\"\" loading=\"lazy\" decoding=\"async\"" + spriteOnLoad + spriteOnError + ">" +
		"</div>";
}

function getNotesTurnHtml(turnIndex, turnData, formatMode, playerOptions, opposingOptions) {
	var isDoubles = formatMode === "doubles";
	var playerSlotsHtml = getNotesMonSlotHtml(turnIndex, "left1", turnData.left1, playerOptions, "Player");
	if (isDoubles) playerSlotsHtml += getNotesMonSlotHtml(turnIndex, "left2", turnData.left2, playerOptions, "Player 2");
	var opposingSlotsHtml = getNotesMonSlotHtml(turnIndex, "right1", turnData.right1, opposingOptions, "Opponent");
	if (isDoubles) opposingSlotsHtml += getNotesMonSlotHtml(turnIndex, "right2", turnData.right2, opposingOptions, "Opponent 2");
	var removeBtn = "";
	if (getNotesBoardState().turns.length > 1) {
		removeBtn = "<button type=\"button\" class=\"btn notes-turn-remove\" data-turn-index=\"" + turnIndex + "\">Remove</button>";
	}
	return "<section class=\"notes-turn-card\" data-turn-index=\"" + turnIndex + "\">" +
		"<div class=\"notes-turn-head\"><strong class=\"notes-turn-label\">T" + (turnIndex + 1) + "</strong>" + removeBtn + "</div>" +
		"<div class=\"notes-turn-grid" + (isDoubles ? " is-doubles" : "") + "\">" +
		"<div class=\"notes-side-cell\"><div class=\"notes-side-title\">P</div><div class=\"notes-side-slots\">" + playerSlotsHtml + "</div></div>" +
		"<div class=\"notes-note-cell\"><textarea class=\"notes-note-input\" data-turn-index=\"" + turnIndex + "\">" + escapeHtml(turnData.note || "") + "</textarea></div>" +
		"<div class=\"notes-side-cell\"><div class=\"notes-side-title\">P2</div><div class=\"notes-side-slots\">" + opposingSlotsHtml + "</div></div>" +
		"</div>" +
		"</section>";
}

function renderNotesPanel() {
	var notesPanel = document.getElementById("notes-side-panel");
	var turnsWrap = document.getElementById("notes-turns-wrap");
	var fightLabelNode = document.getElementById("notes-current-fight-label");
	if (!notesPanel || !turnsWrap || !fightLabelNode) return;

	var notesState = getNotesBoardState();
	if (!Array.isArray(notesState.turns) || !notesState.turns.length) {
		notesState.turns = [createDefaultNotesTurn()];
		saveNotesBoardState();
	}

	fightLabelNode.textContent = "Fight: " + getCurrentFightLabel();
	$(".notes-format-btn").removeClass("is-active");
	$(".notes-format-btn[data-notes-format='" + notesState.format + "']").addClass("is-active");

	var playerOptions = getNotesPlayerSetOptions();
	var opposingOptions = getNotesOpposingSetOptions();
	var turnsHtmlParts = [];
	for (var i = 0; i < notesState.turns.length; i++) {
		turnsHtmlParts.push(getNotesTurnHtml(i, notesState.turns[i], notesState.format, playerOptions, opposingOptions));
	}
	turnsWrap.innerHTML = turnsHtmlParts.join("");
}

function openNotesPanel() {
	openCalcSidePanel("notes-side-panel");
	renderNotesPanel();
}

function isNotesPanelOpen() {
	var panel = document.getElementById("notes-side-panel");
	return !!(panel && panel.classList.contains("open"));
}

function refreshNotesPanelIfOpen() {
	if (isNotesPanelOpen()) renderNotesPanel();
}

function setNotesFormat(formatMode) {
	var notesState = getNotesBoardState();
	var normalizedMode = formatMode === "doubles" ? "doubles" : "singles";
	if (notesState.format !== normalizedMode) {
		notesState.format = normalizedMode;
		saveNotesBoardState();
	}
	renderNotesPanel();
}

function addNotesTurn() {
	var notesState = getNotesBoardState();
	notesState.turns.push(createDefaultNotesTurn());
	saveNotesBoardState();
	renderNotesPanel();
}

function removeNotesTurnAt(turnIndex) {
	var notesState = getNotesBoardState();
	var index = parseInt(turnIndex, 10);
	if (Number.isNaN(index) || index < 0 || index >= notesState.turns.length) return;
	notesState.turns.splice(index, 1);
	if (!notesState.turns.length) notesState.turns.push(createDefaultNotesTurn());
	saveNotesBoardState();
	renderNotesPanel();
}

function updateNotesTurnField(turnIndex, fieldKey, fieldValue) {
	var notesState = getNotesBoardState();
	var index = parseInt(turnIndex, 10);
	if (Number.isNaN(index) || index < 0 || index >= notesState.turns.length) return;
	var allowedFields = {left1: true, left2: true, right1: true, right2: true, note: true};
	if (!allowedFields[fieldKey]) return;
	notesState.turns[index][fieldKey] = fieldKey === "note" ? String(fieldValue || "") : String(fieldValue || "").trim();
	saveNotesBoardState();
}

function scheduleNotesTurnNoteUpdate(turnIndex, noteValue) {
	var key = String(turnIndex || "");
	if (notesNoteInputDebounceTimers[key]) window.clearTimeout(notesNoteInputDebounceTimers[key]);
	notesNoteInputDebounceTimers[key] = window.setTimeout(function () {
		delete notesNoteInputDebounceTimers[key];
		updateNotesTurnField(turnIndex, "note", noteValue);
	}, NOTES_NOTE_INPUT_DEBOUNCE_MS);
}

function flushScheduledNotesTurnNoteUpdate(turnIndex, noteValue) {
	var key = String(turnIndex || "");
	if (notesNoteInputDebounceTimers[key]) {
		window.clearTimeout(notesNoteInputDebounceTimers[key]);
		delete notesNoteInputDebounceTimers[key];
	}
	updateNotesTurnField(turnIndex, "note", noteValue);
}

function canScrollForWheelDelta(containerElement, deltaY) {
	if (!containerElement || !deltaY) return false;
	var maxScrollTop = containerElement.scrollHeight - containerElement.clientHeight;
	if (maxScrollTop <= 0) return false;
	var scrollTop = containerElement.scrollTop;
	if (deltaY < 0) return scrollTop > 0;
	if (deltaY > 0) return scrollTop < maxScrollTop - 1;
	return false;
}

function hasScrollableWheelPathWithin(containerBoundary, startNode, deltaY) {
	var currentNode = startNode && startNode.nodeType === 1 ? startNode : (startNode ? startNode.parentElement : null);
	while (currentNode) {
		var overflowY = window.getComputedStyle(currentNode).overflowY;
		var allowsScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
		if (allowsScroll && canScrollForWheelDelta(currentNode, deltaY)) return true;
		if (currentNode === containerBoundary) break;
		currentNode = currentNode.parentElement;
	}
	return false;
}

function bindFragsPanelScrollContainment() {
	$("#frags-side-panel .calc-side-body").off("wheel.fragspanel").on("wheel.fragspanel", function (ev) {
		var rawEvent = ev.originalEvent || ev;
		var deltaY = Number(rawEvent && rawEvent.deltaY ? rawEvent.deltaY : 0);
		if (!deltaY) return;
		if (hasScrollableWheelPathWithin(this, ev.target, deltaY)) return;
		ev.preventDefault();
		ev.stopPropagation();
	});
}

function ensureOpposingContextMenu() {
	if (document.getElementById("opp-context-menu")) return;
	var menu = document.createElement("div");
	menu.id = "opp-context-menu";
	menu.className = "frag-context-menu";
	menu.hidden = true;
	menu.innerHTML = "" +
		"<div id=\"opp-context-title\" class=\"frag-context-title\">Opponent Action</div>" +
		"<button type=\"button\" id=\"opp-context-mark-dead\" class=\"btn frag-context-btn\">Mark as Dead</button>" +
		"<button type=\"button\" id=\"opp-context-cancel\" class=\"btn frag-context-btn\">Cancel</button>";
	document.body.appendChild(menu);
}

function isOpposingSetMarkedDead(setId) {
	return !!deadOpposingSetMap[String(setId || "")];
}

function applyOpposingDeadMarks() {
	$(".trainer-pok.right-side").each(function () {
		var setId = $(this).attr("data-id") || "";
		$(this).toggleClass("trainer-pok-dead", isOpposingSetMarkedDead(setId));
	});
}

function setOpposingSetDeadMark(setId, isDead) {
	var key = String(setId || "");
	if (!key) return;
	var wasDead = !!deadOpposingSetMap[key];
	if (isDead) deadOpposingSetMap[key] = true;
	else delete deadOpposingSetMap[key];
	applyOpposingDeadMarks();
	if (wasDead !== !!isDead && typeof performCalculations === "function") performCalculations();
}

function clearOpposingDeadMarks() {
	deadOpposingSetMap = {};
	applyOpposingDeadMarks();
}

function closeOpposingContextMenu() {
	var menu = document.getElementById("opp-context-menu");
	if (!menu) return;
	menu.hidden = true;
	opposingContextSourceSet = "";
}

function openOpposingContextMenu(ev, sourceSetId) {
	var menu = document.getElementById("opp-context-menu");
	if (!menu || !sourceSetId) return;
	ev.preventDefault();
	closeFragContextMenu();
	opposingContextSourceSet = String(sourceSetId);
	var sourceSpecies = parseSetId(opposingContextSourceSet).species || "Pokemon 2";
	$("#opp-context-title").text(sourceSpecies + " (Pokemon 2)");
	$("#opp-context-mark-dead").text(isOpposingSetMarkedDead(opposingContextSourceSet) ? "Unmark Dead" : "Mark as Dead");
	menu.hidden = false;
	var left = ev.clientX + 8;
	var top = ev.clientY + 8;
	var maxLeft = window.innerWidth - menu.offsetWidth - 10;
	var maxTop = window.innerHeight - menu.offsetHeight - 10;
	menu.style.left = Math.max(8, Math.min(left, maxLeft)) + "px";
	menu.style.top = Math.max(8, Math.min(top, maxTop)) + "px";
}

function collectOpposingTargetSetIds() {
	var opposingSetIds = [];
	$(".trainer-pok.right-side").each(function () {
		var setId = $(this).attr("data-id");
		if (!setId) return;
		if (opposingSetIds.indexOf(setId) < 0) opposingSetIds.push(setId);
	});
	var activeOpposingSet = $(".opposing").val();
	if (activeOpposingSet && opposingSetIds.indexOf(activeOpposingSet) < 0) {
		opposingSetIds.unshift(activeOpposingSet);
	}
	return opposingSetIds;
}

function updateFragContextTitle() {
	var sourceSpecies = parseSetId(fragContextSourceSet).species || "Pokemon";
	var selectedTargetSet = $("#frag-context-target").val() || "";
	var targetSpecies = parseSetId(selectedTargetSet).species || "Pokemon";
	$("#frag-context-title").text("Did " + sourceSpecies + " kill " + targetSpecies + "?");
}

function populateFragContextTargets() {
	var targetSelect = $("#frag-context-target");
	var targetSetIds = collectOpposingTargetSetIds();
	var activeOpposingSet = $(".opposing").val() || "";
	var previousTargetSet = targetSelect.val() || "";
	targetSelect.empty();
	if (!targetSetIds.length) {
		targetSelect.append("<option value=\"\">No Pokemon 2 target found</option>");
		targetSelect.prop("disabled", true);
	} else {
		targetSelect.prop("disabled", false);
		for (var i = 0; i < targetSetIds.length; i++) {
			var parsedTarget = parseSetId(targetSetIds[i]);
			targetSelect.append("<option value=\"" + escapeHtml(targetSetIds[i]) + "\">" + escapeHtml(parsedTarget.species) + "</option>");
		}
		var selectedTargetSet = "";
		if (activeOpposingSet && targetSetIds.indexOf(activeOpposingSet) >= 0) {
			selectedTargetSet = activeOpposingSet;
		} else if (previousTargetSet && targetSetIds.indexOf(previousTargetSet) >= 0) {
			selectedTargetSet = previousTargetSet;
		} else {
			selectedTargetSet = targetSetIds[0];
		}
		targetSelect.val(selectedTargetSet);
	}
	updateFragContextTitle();
}

function closeFragContextMenu() {
	var contextMenu = document.getElementById("frag-context-menu");
	if (!contextMenu) return;
	contextMenu.hidden = true;
	fragContextSourceSet = "";
	fragContextSourceElement = null;
}

function openFragContextMenu(ev, sourceSetId, sourceElement) {
	var contextMenu = document.getElementById("frag-context-menu");
	if (!contextMenu || !sourceSetId) return;
	ev.preventDefault();
	closeOpposingContextMenu();
	fragContextSourceSet = sourceSetId;
	fragContextSourceElement = sourceElement || ev.currentTarget || null;
	populateFragContextTargets();
	updateFragContextSwapButtons();
	updateFragContextDeathButton();
	contextMenu.hidden = false;
	var left = ev.clientX + 8;
	var top = ev.clientY + 8;
	var maxLeft = window.innerWidth - contextMenu.offsetWidth - 10;
	var maxTop = window.innerHeight - contextMenu.offsetHeight - 10;
	contextMenu.style.left = Math.max(8, Math.min(left, maxLeft)) + "px";
	contextMenu.style.top = Math.max(8, Math.min(top, maxTop)) + "px";
}

function findFragContextSourceElement(setId, sourceElement) {
	var spriteElement = sourceElement && sourceElement.nodeType === 1 ? sourceElement : null;
	if (!spriteElement || !spriteElement.parentNode) {
		spriteElement = $(".trainer-pok.left-side").filter(function () {
			return $(this).attr("data-id") === setId;
		}).get(0);
	}
	return spriteElement || null;
}

function updateFragContextSwapButtons() {
	var sourceElement = findFragContextSourceElement(fragContextSourceSet, fragContextSourceElement);
	var sourceContainer = getTrainerPokContainerElement(sourceElement);
	var sourceParentId = sourceContainer ? sourceContainer.id : "";
	$("#frag-context-swap-team1").prop("hidden", sourceParentId === "team-poke-list");
	$("#frag-context-swap-team2").prop("hidden", sourceParentId === "box-poke-list2");
	$("#frag-context-swap-trash").prop("hidden", sourceParentId === "trash-box");
}

function updateFragContextDeathButton() {
	var button = $("#frag-context-mark-dead");
	if (!button.length || !fragContextSourceSet) return;
	var entry = ensureFragEntryForSet(fragContextSourceSet);
	var deathInfo = getFragDeathInfo(entry);
	if (deathInfo.isDead) {
		button.text("Undo Death");
	} else {
		button.text("Did This Mon Die?");
	}
}

function hotSwapSetToPlayerContainer(setId, sourceElement, containerId) {
	if (!setId) return;
	var targetContainer = document.getElementById(containerId);
	if (!targetContainer) {
		alert("Target section not found.");
		return;
	}
	var spriteElement = findFragContextSourceElement(setId, sourceElement);
	if (!spriteElement) {
		alert("Could not locate the selected sprite.");
		return;
	}
	var moveNode = getTrainerPokRootNode(spriteElement);
	if (!moveNode) return;
	targetContainer.appendChild(moveNode);
	if (containerId !== "trash-box") {
		topPokemonIcon(setId, $("#p1mon")[0]);
		$(".player").val(setId);
		$(".player").change();
		$(".player .select2-chosen").text(formatSetNameForDisplay(setId));
	}
	saveCurrentPlayerRosterLayout();
	syncFragRoster({pruneMissing: true});
	renderFragSheet();
}

function isSetOptionAvailable(setId) {
	return !!getSetOptionById(setId);
}

function getTrainerSetOptionsByLabel(trainerLabel, options) {
	var normalizedTrainerLabel = String(trainerLabel || "").trim();
	if (!normalizedTrainerLabel) return [];
	var sourceOptions = Array.isArray(options) ? options : getSetOptions();
	var matches = [];
	for (var i = 0; i < sourceOptions.length; i++) {
		var option = sourceOptions[i];
		if (!option || !option.id || !option.set || option.set === "Blank Set") continue;
		var parsedEntry = parseTrainerPartyEntry(option.id);
		if (parsedEntry.trainerLabel === normalizedTrainerLabel) {
			matches.push(option);
		}
	}
	matches.sort(function (leftOption, rightOption) {
		var leftEntry = parseTrainerPartyEntry(leftOption.id);
		var rightEntry = parseTrainerPartyEntry(rightOption.id);
		var leftIndex = getTrainerIndexFromSetData(leftEntry.setData) || leftEntry.sortIndex || 0;
		var rightIndex = getTrainerIndexFromSetData(rightEntry.setData) || rightEntry.sortIndex || 0;
		if (leftIndex !== rightIndex) return leftIndex - rightIndex;
		return String(leftOption.id).localeCompare(String(rightOption.id));
	});
	return matches;
}

function selectTrainerFightByLabel(trainerLabel, preferredSetId) {
	var trainerOptions = getTrainerSetOptionsByLabel(trainerLabel);
	if (!trainerOptions.length) return false;
	var normalizedPreferredSetId = String(preferredSetId || "").trim();
	var targetSetId = normalizedPreferredSetId && getSetOptionById(normalizedPreferredSetId, trainerOptions)
		? normalizedPreferredSetId
		: trainerOptions[0].id;
	return setSelectedSetIdForSide("p2", targetSetId);
}

function getSetOptionById(setId, options) {
	var normalizedSetId = String(setId || "").trim();
	if (!normalizedSetId) return null;
	var sourceOptions = Array.isArray(options) ? options : getSetOptions();
	for (var i = 0; i < sourceOptions.length; i++) {
		if (sourceOptions[i] && sourceOptions[i].id === normalizedSetId) return sourceOptions[i];
	}
	return null;
}

function getCustomSetOptionById(setId, options) {
	var normalizedSetId = String(setId || "").trim();
	if (!normalizedSetId) return null;
	var sourceOptions = Array.isArray(options) ? options : getSetOptions();
	for (var i = 0; i < sourceOptions.length; i++) {
		var option = sourceOptions[i];
		if (!option || option.id !== normalizedSetId) continue;
		if (option.isCustom && option.set) return option;
	}
	return null;
}

function getSelectedSetIdForSide(sideId) {
	var selector = $("#" + sideId + " .set-selector").first();
	if (!selector.length) return "";
	return String(selector.val() || "").trim();
}

function isSetIdKnownInSetdex(setId) {
	var parsedSet = parseSetId(setId);
	var speciesName = String(parsedSet.species || "").trim();
	var setName = String(parsedSet.label || "").trim();
	if (!speciesName || !setName || !setdex || !setdex[speciesName]) return false;
	return Object.prototype.hasOwnProperty.call(setdex[speciesName], setName);
}

function setSelectedSetIdForSide(sideId, setId) {
	var normalizedSetId = String(setId || "").trim();
	if (!normalizedSetId) return false;
	if (!isSetOptionAvailable(normalizedSetId)) {
		if (window.console && typeof window.console.debug === "function") {
			window.console.debug("[AstralCalc] setSelectedSetIdForSide skipped unavailable set", {
				sideId: sideId,
				setId: normalizedSetId
			});
		}
		return false;
	}
	var selector = $("#" + sideId + " .set-selector").first();
	if (!selector.length) return false;
	function syncSetSelectorDisplayText() {
		var select2Container = selector.next(".select2-container");
		if (!select2Container.length) {
			select2Container = selector.siblings(".select2-container").first();
		}
		select2Container.find(".select2-chosen").first().text(formatSetNameForDisplay(normalizedSetId));
	}
	var currentSetId = String(selector.val() || "").trim();
	if (currentSetId === normalizedSetId) {
		syncSetSelectorDisplayText();
		return true;
	}
	selector.val(normalizedSetId).change();
	var appliedSetId = String(selector.val() || "").trim();
	if (appliedSetId === normalizedSetId) {
		syncSetSelectorDisplayText();
	}
	return appliedSetId === normalizedSetId;
}

function getStoredLastEncounterSelection() {
	var parsed = safeJsonParse(localStorage.getItem(LAST_ENCOUNTER_STORAGE_KEY), {});
	return parsed && typeof parsed === "object" ? parsed : {};
}

function saveLastEncounterSelection() {
	if (isRestoringLastEncounterSelection || isBootstrappingLastEncounterSelection) return;
	var playerSetId = getSelectedSetIdForSide("p1");
	var opposingSetId = getSelectedSetIdForSide("p2");
	if (!playerSetId && !opposingSetId) return;

	var payload = {
		playerSet: playerSetId,
		opposingSet: opposingSetId
	};
	if (opposingSetId) {
		var opposingEntry = parseTrainerPartyEntry(opposingSetId);
		if (opposingEntry && opposingEntry.trainerLabel) {
			payload.trainerLabel = opposingEntry.trainerLabel;
		}
		if (opposingEntry) {
			var trainerIndex = getTrainerIndexFromSetData(opposingEntry.setData);
			var trainerBounds = getCurrentTrainerIndexBounds();
			if (trainerBounds && trainerBounds.min > 0) {
				trainerIndex = trainerBounds.min;
			}
			if (!Number.isNaN(trainerIndex) && trainerIndex > 0) {
				payload.trainerIndex = trainerIndex;
				localStorage.setItem("lasttimetrainer", String(trainerIndex));
			}
		}
	}
	localStorage.setItem(LAST_ENCOUNTER_STORAGE_KEY, JSON.stringify(payload));
	if (window.console && typeof window.console.debug === "function") {
		window.console.debug("[AstralCalc] saveLastEncounterSelection " + JSON.stringify(payload));
	}
}

function restoreLastEncounterSelection() {
	isRestoringLastEncounterSelection = true;
	var savedSelection = getStoredLastEncounterSelection();
	var restoredOpposing = false;
	var restoredPlayer = false;
	if (window.console && typeof window.console.debug === "function") {
		window.console.debug("[AstralCalc] restoreLastEncounterSelection:start " + JSON.stringify(savedSelection));
	}

	try {
		var savedOpposingTrainerLabel = savedSelection.opposingSet
			? parseTrainerPartyEntry(savedSelection.opposingSet).trainerLabel
			: "";
		if (savedSelection.opposingSet) {
			restoredOpposing = setSelectedSetIdForSide("p2", savedSelection.opposingSet);
			if (!restoredOpposing) {
				var currentOpposingSetId = getSelectedSetIdForSide("p2");
				var currentOpposingTrainerLabel = currentOpposingSetId
					? parseTrainerPartyEntry(currentOpposingSetId).trainerLabel
					: "";
				if (currentOpposingSetId === savedSelection.opposingSet ||
					(savedOpposingTrainerLabel && currentOpposingTrainerLabel === savedOpposingTrainerLabel)) {
					restoredOpposing = true;
				}
			}
		}

		if (!restoredOpposing && savedSelection.trainerLabel) {
			restoredOpposing = selectTrainerFightByLabel(savedSelection.trainerLabel, savedSelection.opposingSet);
		}

		if (!restoredOpposing) {
			var trainerIndexRaw = savedSelection.trainerIndex;
			if (typeof trainerIndexRaw === "undefined" || trainerIndexRaw === null || trainerIndexRaw === "") {
				trainerIndexRaw = localStorage.getItem("lasttimetrainer");
			}
			var trainerIndex = parseInt(trainerIndexRaw, 10);
			if (!Number.isNaN(trainerIndex) && trainerIndex > 0) {
				selectTrainer(trainerIndex);
				restoredOpposing = true;
			}
		}

		if (savedSelection.playerSet) {
			restoredPlayer = setSelectedSetIdForSide("p1", savedSelection.playerSet);
		}
		if (window.console && typeof window.console.debug === "function") {
			window.console.debug("[AstralCalc] restoreLastEncounterSelection:result " + JSON.stringify({
				savedSelection: savedSelection,
				restoredOpposing: restoredOpposing,
				restoredPlayer: restoredPlayer,
				currentOpposing: getSelectedSetIdForSide("p2"),
				currentPlayer: getSelectedSetIdForSide("p1")
			}));
		}
		return restoredOpposing || (!savedSelection.opposingSet && restoredPlayer);
	} finally {
		isRestoringLastEncounterSelection = false;
	}
}

function refreshSetSelectorsForStarterChoice() {
	var playerSet = $(".player").val();
	var opposingSet = $(".opposing").val();
	loadDefaultLists();
	var firstValidSet = getFirstValidSetOption();

	if (playerSet && isSetOptionAvailable(playerSet)) {
		$(".player").val(playerSet).change();
		$(".player .select2-chosen").text(formatSetNameForDisplay(playerSet));
	} else if (firstValidSet) {
		$(".player").val(firstValidSet.id).change();
		$(".player .select2-chosen").text(formatSetNameForDisplay(firstValidSet.id));
	}

	if (opposingSet && isSetOptionAvailable(opposingSet)) {
		$(".opposing").val(opposingSet).change();
		$(".opposing .select2-chosen").text(formatSetNameForDisplay(opposingSet));
	} else if (firstValidSet) {
		$(".opposing").val(firstValidSet.id).change();
		$(".opposing .select2-chosen").text(formatSetNameForDisplay(firstValidSet.id));
	}
}

function refreshBattleLayoutForCurrentSelection() {
	var selectedOpposing = $(".opposing").val();
	if (!selectedOpposing) return;
	CURRENT_TRAINER_POKS = get_trainer_poks(selectedOpposing);
	syncBattleFormatForSelection(selectedOpposing, CURRENT_TRAINER_POKS);
	renderOpposingTrainerParties(selectedOpposing);
	syncWeatherForSelection(selectedOpposing, CURRENT_TRAINER_POKS);
	syncTerrainForSelection(selectedOpposing, CURRENT_TRAINER_POKS);
	renderFragSheet();
}

function normalizeTypeKey(rawType) {
	return String(rawType || "")
		.trim()
		.toLowerCase()
		.replace(/[()]/g, "")
		.replace(/\s+/g, "");
}

function getReadableTextColor(backgroundHex) {
	return "#101622";
}

function applySingleTypeSelectColour(selectElement, enabled) {
	var selectNode = selectElement && selectElement.jquery ? selectElement : $(selectElement);
	if (!selectNode || !selectNode.length) return;
	if (!enabled) {
		selectNode.removeClass("more-colour-type-select");
		selectNode.css({
			backgroundColor: "",
			borderColor: "",
			color: ""
		});
		return;
	}
	var typeKey = normalizeTypeKey(selectNode.val());
	var typeColour = TYPE_COLOR_MAP[typeKey];
	if (!typeColour) {
		selectNode.removeClass("more-colour-type-select");
		selectNode.css({
			backgroundColor: "",
			borderColor: "",
			color: ""
		});
		return;
	}
	selectNode.addClass("more-colour-type-select");
	selectNode.css({
		backgroundColor: typeColour,
		borderColor: typeColour,
		color: "#101622"
	});
}

function applyMoreColourSetting(enabled) {
	var typeSelects = $("#p1 .type1, #p1 .type2, #p1 .teraType, #p2 .type1, #p2 .type2, #p2 .teraType");
	typeSelects.each(function () {
		applySingleTypeSelectColour(this, enabled);
	});
}

function refreshThemeChoiceButtons() {
	var isDark = typeof window.isDarkThemeEnabled === "function" ? window.isDarkThemeEnabled() : isDarkThemeStylesEnabled();
	$("#settings-theme-dark").toggleClass("is-active", isDark);
	$("#settings-theme-light").toggleClass("is-active", !isDark);
}

function syncSettingsPanelUi() {
	var settings = getAppSettings();
	$(".settings-choice-btn[data-starter-choice]").removeClass("is-active");
	$(".settings-choice-btn[data-starter-choice='" + settings.starterChoice + "']").addClass("is-active");
	$(".settings-choice-btn[data-layout-choice]").removeClass("is-active");
	$(".settings-choice-btn[data-layout-choice='" + settings.layoutMode + "']").addClass("is-active");
	$("#settings-more-colour").prop("checked", !!settings.moreColour);
	$("#settings-move-colors").prop("checked", !!settings.moveColors);
	$("#settings-move-meta").prop("checked", !!settings.moveMeta);
	$("#settings-total-frags-on-border").prop("checked", !!settings.totalFragsOnBorder);
	setMoveMetaVisibility(!!settings.moveMeta);
	applyMoreColourSetting(!!settings.moreColour);
	updateTrainerFragBorderTotals();
	refreshThemeChoiceButtons();
	if (typeof applyLayoutMode === "function") {
		applyLayoutMode(settings.layoutMode);
	} else {
		$("body").toggleClass("layout-simplified", settings.layoutMode === "simplified");
	}
}

function bindCalcToolEvents() {
	ensureOpposingContextMenu();
	ensureFragHistoryControls();
	bindFragsPanelScrollContainment();
	syncTrainerFieldLockButtonStyles();

	$("#open-pokedex-panel").off("click").on("click", function () {
		var selectedSet = $(".player").val() || "";
		var selectedSpecies = parseSetId(selectedSet).species;
		openAstralDexSidePanel(astralDexUrl(selectedSpecies), selectedSpecies);
	});

	$("#open-frags-panel").off("click").on("click", function () {
		openFragsPanel();
	});

	$("#open-faq-panel").off("click").on("click", function () {
		openFaqPanel();
	});

	$("#open-notes-panel").off("click").on("click", function () {
		openNotesPanel();
	});

	$("#open-settings-panel").off("click").on("click", function () {
		openSettingsPanel();
	});

	$("#frags-panel-close").off("click").on("click", function () {
		closeCalcSidePanel("frags-side-panel");
	});

	$("#settings-panel-close").off("click").on("click", function () {
		closeCalcSidePanel("settings-side-panel");
	});

	$("#faq-panel-close").off("click").on("click", function () {
		closeCalcSidePanel("faq-side-panel");
	});

	$("#notes-panel-close").off("click").on("click", function () {
		closeCalcSidePanel("notes-side-panel");
	});

	$("#frags-panel-fullscreen").off("click").on("click", function () {
		var fragsPanel = document.getElementById("frags-side-panel");
		if (!fragsPanel) return;
		setCalcSidePanelFullscreen(fragsPanel);
	});

	$("#notes-panel-fullscreen").off("click").on("click", function () {
		var notesPanel = document.getElementById("notes-side-panel");
		if (!notesPanel) return;
		setCalcSidePanelFullscreen(notesPanel);
	});

	$(document).off("click.notesformat", ".notes-format-btn").on("click.notesformat", ".notes-format-btn", function () {
		setNotesFormat($(this).attr("data-notes-format"));
	});

	$("#notes-add-turn").off("click").on("click", function () {
		addNotesTurn();
	});

	$(document).off("click.notesremove", ".notes-turn-remove").on("click.notesremove", ".notes-turn-remove", function () {
		removeNotesTurnAt($(this).attr("data-turn-index"));
	});

	$(document).off("change.notesset", ".notes-set-select").on("change.notesset", ".notes-set-select", function () {
		var turnIndex = $(this).attr("data-turn-index");
		var fieldKey = $(this).attr("data-notes-field");
		var selectedSet = $(this).val() || "";
		var speciesName = parseSetId(selectedSet).species || "";
		updateNotesTurnField(turnIndex, fieldKey, selectedSet);
		var spriteNode = $(this).siblings(".notes-mon-sprite").get(0);
		if (!spriteNode) return;
		if (!speciesName) {
			setTrainerSpriteImage(spriteNode, "");
			spriteNode.src = POKEMON_ICON_FALLBACK_DATA_URL;
			spriteNode.classList.add("notes-mon-sprite-empty");
			return;
		}
		spriteNode.classList.remove("notes-mon-sprite-empty");
		setTrainerSpriteImage(spriteNode, speciesName);
	});

	$(document).off("input.notesnote", ".notes-note-input").on("input.notesnote", ".notes-note-input", function () {
		scheduleNotesTurnNoteUpdate($(this).attr("data-turn-index"), this.value);
	});

	$(document).off("change.notesnote blur.notesnote", ".notes-note-input").on("change.notesnote blur.notesnote", ".notes-note-input", function () {
		flushScheduledNotesTurnNoteUpdate($(this).attr("data-turn-index"), this.value);
	});

	$(document).off("mousedown.calcsideresize", ".calc-side-resize-handle").on("mousedown.calcsideresize", ".calc-side-resize-handle", function (ev) {
		if (ev.which && ev.which !== 1) return;
		var panel = $(this).closest(".calc-side-panel").get(0);
		if (!panel || panel.hidden || panel.classList.contains("fullscreen")) return;
		beginCalcSidePanelResize(panel, ev.clientX);
		ev.preventDefault();
	});

	$(document).off("mousemove.calcsideresizecapture", "#calc-side-resize-capture").on("mousemove.calcsideresizecapture", "#calc-side-resize-capture", function (ev) {
		continueCalcSidePanelResize(ev.clientX, ev.buttons);
	});

	$(document).off("mouseup.calcsideresizecapture", "#calc-side-resize-capture").on("mouseup.calcsideresizecapture", "#calc-side-resize-capture", function () {
		endCalcSidePanelResize();
	});

	$(document).off("mousemove.calcsideresize").on("mousemove.calcsideresize", function (ev) {
		continueCalcSidePanelResize(ev.clientX, ev.buttons);
	});

	$(document).off("mouseup.calcsideresize").on("mouseup.calcsideresize", function () {
		endCalcSidePanelResize();
	});

	$(document).off("mouseleave.calcsideresize").on("mouseleave.calcsideresize", function () {
		endCalcSidePanelResize();
	});

	$(window).off("resize.calcpanels").on("resize.calcpanels", function () {
		updateCalcSideBackdrop();
		updateCalcLayoutForSidePanel();
	});

	$(window).off("blur.calcsideresize").on("blur.calcsideresize", function () {
		endCalcSidePanelResize();
	});

	updateCalcSideBackdrop();
	updateCalcLayoutForSidePanel();

	$("#calc-side-backdrop").off("click").on("click", function () {
		closeCalcSidePanels();
		closeFragContextMenu();
		closeOpposingContextMenu();
	});

	$(document).off("click.fragcontext").on("click.fragcontext", function (ev) {
		if ($(ev.target).closest("#frag-context-menu, #opp-context-menu").length) return;
		closeFragContextMenu();
		closeOpposingContextMenu();
	});

	$(document).off("contextmenu.trainerfieldlocks", ".field-info label.btn[for]").on("contextmenu.trainerfieldlocks", ".field-info label.btn[for]", function (ev) {
		handleTrainerFieldButtonContextMenu(ev, this);
	});
	$(document).off("change.trainerfieldlocks", ".field-info input.calc-trigger").on("change.trainerfieldlocks", ".field-info input.calc-trigger", handleTrainerFieldInputChangeForLocks);

	$(document).off("change.fragopposing", ".opposing").on("change.fragopposing", ".opposing", function () {
		renderFragSheet();
		if (!$("#frag-context-menu").prop("hidden")) populateFragContextTargets();
		refreshNotesPanelIfOpen();
	});

	$(document).off("change.notesactivesets", ".player, .opposing").on("change.notesactivesets", ".player, .opposing", function () {
		refreshNotesPanelIfOpen();
	});

	$("#frag-context-target").off("change").on("change", updateFragContextTitle);

	$("#frag-context-add").off("click").on("click", function () {
		if (!fragContextSourceSet) return;
		var selectedTargetSet = $("#frag-context-target").val();
		addFragKill(fragContextSourceSet, selectedTargetSet, getCurrentFightLabel());
		closeFragContextMenu();
	});

	$("#frag-context-mark-dead").off("click").on("click", function () {
		if (!fragContextSourceSet) return;
		var entry = ensureFragEntryForSet(fragContextSourceSet);
		var deathInfo = getFragDeathInfo(entry);
		setFragSetDeadState(fragContextSourceSet, !deathInfo.isDead, getCurrentFightLabel());
		closeFragContextMenu();
	});

	$("#frag-context-swap-team1").off("click").on("click", function () {
		if (!fragContextSourceSet) return;
		hotSwapSetToPlayerContainer(fragContextSourceSet, fragContextSourceElement, "team-poke-list");
		closeFragContextMenu();
	});

	$("#frag-context-swap-team2").off("click").on("click", function () {
		if (!fragContextSourceSet) return;
		hotSwapSetToPlayerContainer(fragContextSourceSet, fragContextSourceElement, "box-poke-list2");
		closeFragContextMenu();
	});

	$("#frag-context-swap-trash").off("click").on("click", function () {
		if (!fragContextSourceSet) return;
		hotSwapSetToPlayerContainer(fragContextSourceSet, fragContextSourceElement, "trash-box");
		closeFragContextMenu();
	});

	$("#frag-context-cancel").off("click").on("click", function () {
		closeFragContextMenu();
	});

	$("#opp-context-mark-dead").off("click").on("click", function () {
		if (!opposingContextSourceSet) return;
		var nextState = !isOpposingSetMarkedDead(opposingContextSourceSet);
		setOpposingSetDeadMark(opposingContextSourceSet, nextState);
		closeOpposingContextMenu();
	});

	$("#opp-context-cancel").off("click").on("click", function () {
		closeOpposingContextMenu();
	});

	$(document).off("click.fragsactions", ".frags-inc").on("click.fragsactions", ".frags-inc", function () {
		addFragKill($(this).attr("data-frag-set"), "", getCurrentFightLabel());
	});

	$(document).off("click.fragsactionsdec", ".frags-dec").on("click.fragsactionsdec", ".frags-dec", function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		removeFragKill($(this).attr("data-frag-set"), getCurrentFightLabel());
	});

	$(document).off("click.fragsremovevictim", ".frags-edit-remove").on("click.fragsremovevictim", ".frags-edit-remove", function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		removeSpecificFragKill(
			$(this).attr("data-frag-set"),
			$(this).attr("data-frag-fight"),
			$(this).attr("data-frag-victim")
		);
	});

	$("#frags-clear-fight").off("click").on("click", function () {
		if (!confirm("Clear all frags for the current fight?")) return;
		clearFragsForCurrentFight();
	});

	$("#frags-history-toggle").off("click").on("click", function () {
		setFragHistoryExpanded(!fragsHistoryExpanded);
	});

	$("#frags-history-info").off("click").on("click", function () {
		showFragHistoryInfoDialog();
	});

	$("#frags-state-save").off("click").on("click", function () {
		var stateNameInput = document.getElementById("frags-state-name");
		var requestedName = stateNameInput ? stateNameInput.value : "";
		var savedState = saveNamedFragSheetState(requestedName);
		if (stateNameInput) stateNameInput.value = "";
		refreshFragHistoryControls();
		alert("Saved state: " + savedState.name);
	});

	$("#frags-state-restore").off("click").on("click", function () {
		var selectedStateId = $("#frags-state-list").val();
		if (!selectedStateId) {
			alert("Select a saved state first.");
			return;
		}
		if (!confirm("Restore this saved state? This will replace current frags/imports/boxes.")) return;
		captureFragBackupSnapshot("before-state-restore", true);
		if (!restoreFragStateById(selectedStateId)) {
			alert("Could not restore the selected saved state.");
			return;
		}
		refreshFragHistoryControls();
	});

	$("#frags-state-delete").off("click").on("click", function () {
		var selectedStateId = $("#frags-state-list").val();
		if (!selectedStateId) {
			alert("Select a saved state first.");
			return;
		}
		if (!confirm("Delete this saved state?")) return;
		if (!deleteFragStateById(selectedStateId)) {
			alert("Could not delete the selected saved state.");
			return;
		}
		refreshFragHistoryControls();
	});

	$("#frags-backup-save").off("click").on("click", function () {
		saveManualFragBackup();
		refreshFragHistoryControls();
		alert("Backup saved.");
	});

	$("#frags-backup-restore").off("click").on("click", function () {
		var selectedBackupId = $("#frags-backup-list").val();
		if (!selectedBackupId) {
			alert("Select a backup first.");
			return;
		}
		if (!confirm("Restore this backup? This will replace current frags/imports/boxes.")) return;
		captureFragBackupSnapshot("before-backup-restore", true);
		if (!restoreFragBackupById(selectedBackupId)) {
			alert("Could not restore the selected backup.");
			return;
		}
		refreshFragHistoryControls();
	});

	$(document).off("click.settingsstarter", ".settings-choice-btn[data-starter-choice]").on("click.settingsstarter", ".settings-choice-btn[data-starter-choice]", function () {
		var starterChoice = $(this).attr("data-starter-choice");
		updateAppSettings({starterChoice: starterChoice});
		syncSettingsPanelUi();
		refreshSetSelectorsForStarterChoice();
	});

	$(document).off("click.settingslayout", ".settings-choice-btn[data-layout-choice]").on("click.settingslayout", ".settings-choice-btn[data-layout-choice]", function () {
		var layoutChoice = $(this).attr("data-layout-choice");
		updateAppSettings({layoutMode: layoutChoice});
		syncSettingsPanelUi();
		if (typeof performCalculations === "function") performCalculations();
	});

	$("#settings-more-colour").off("change").on("change", function () {
		var enabled = $(this).is(":checked");
		updateAppSettings({moreColour: enabled});
		applyMoreColourSetting(enabled);
		if (typeof performCalculations === "function") performCalculations();
	});

	$("#settings-move-colors").off("change").on("change", function () {
		var enabled = $(this).is(":checked");
		updateAppSettings({moveColors: enabled});
		if (typeof performCalculations === "function") performCalculations();
	});
	$("#settings-move-meta").off("change").on("change", function () {
		var enabled = $(this).is(":checked");
		updateAppSettings({moveMeta: enabled});
		setMoveMetaVisibility(enabled);
		updateAllMoveMetaDisplays();
		if (typeof performCalculations === "function") performCalculations();
	});

	$("#settings-total-frags-on-border").off("change").on("change", function () {
		var enabled = $(this).is(":checked");
		updateAppSettings({totalFragsOnBorder: enabled});
		updateTrainerFragBorderTotals();
	});

	$(document).off("change.morecolourtypes input.morecolourtypes", "#p1 .type1, #p1 .type2, #p1 .teraType, #p2 .type1, #p2 .type2, #p2 .teraType")
		.on("change.morecolourtypes input.morecolourtypes", "#p1 .type1, #p1 .type2, #p1 .teraType, #p2 .type1, #p2 .type2, #p2 .teraType", function () {
			applySingleTypeSelectColour(this, !!getAppSettings().moreColour);
		});

	$(document).off("change.morecoloursets", ".set-selector").on("change.morecoloursets", ".set-selector", function () {
		if (!getAppSettings().moreColour) return;
		window.setTimeout(function () {
			applyMoreColourSetting(true);
		}, 0);
	});

	$("#settings-theme-dark").off("click").on("click", function () {
		if (typeof window.setThemeMode === "function") {
			window.setThemeMode(true);
		} else {
			var darkStyles = document.getElementById("dark-theme-styles");
			if (darkStyles) darkStyles.disabled = false;
			localStorage.setItem("darkTheme", "true");
		}
		refreshThemeChoiceButtons();
	});

	$("#settings-theme-light").off("click").on("click", function () {
		if (typeof window.setThemeMode === "function") {
			window.setThemeMode(false);
		} else {
			var darkStyles = document.getElementById("dark-theme-styles");
			if (darkStyles) darkStyles.disabled = true;
			localStorage.setItem("darkTheme", "false");
		}
		refreshThemeChoiceButtons();
	});

	$(document).off("calc-theme-change.settings").on("calc-theme-change.settings", function () {
		refreshThemeChoiceButtons();
		var dexPanel = document.getElementById("astraldex-side-panel");
		if (dexPanel) applyAstralDexPanelTheme(dexPanel);
	});

	$(document).off("keydown.calcpanels").on("keydown.calcpanels", function (ev) {
		if (ev.key !== "Escape" && ev.keyCode !== 27) return;
		closeFragContextMenu();
		closeOpposingContextMenu();
		closeCalcSidePanels();
	});
}

function bindFieldSideControlsToggle() {
	$("#toggle-field-side-controls").off("click").on("click", function () {
		var controlsWrap = $("#field-side-controls-wrap");
		if (!controlsWrap.length) return;
		var willHide = !controlsWrap.prop("hidden");
		controlsWrap.prop("hidden", willHide);
		$(this).text(willHide ? "Show More" : "Show Less");
	});
}

function sortmons(a, b) {
	var aEntry = parseTrainerPartyEntry(String(a || ""));
	var bEntry = parseTrainerPartyEntry(String(b || ""));
	var aIndex = getTrainerIndexFromSetData(aEntry.setData);
	var bIndex = getTrainerIndexFromSetData(bEntry.setData);
	if (aIndex <= 0) aIndex = aEntry.sortIndex || 0;
	if (bIndex <= 0) bIndex = bEntry.sortIndex || 0;
	return aIndex - bIndex;
}

function normalizeTrainerSpriteName(pokemonName) {
	var spriteName = pokemonName;
	if (spriteName === "Zygarde-10%") spriteName = "Zygarde-10%25";
	if (spriteName === "Tauros-Paldea-Water") spriteName = "Tauros-Paldea-Aqua";
	if (spriteName === "Tauros-Paldea-Fire") spriteName = "Tauros-Paldea-Blaze";
	if (spriteName === "Tauros-Paldea") spriteName = "Tauros-Paldea-Combat";
	if (spriteName === "Wooper-Paldea") spriteName = "WooperPaldea";
	if (spriteName === "Pumpkaboo-Super") spriteName = "Pumpkaboo";
	if (spriteName === "Mime Jr.") spriteName = "Mime%20Jr";
	if (spriteName === "Unown-C2") spriteName = "Unown-C";
	return spriteName;
}

function getAlternateTrainerSpriteName(pokemonName) {
	var spriteName = normalizeTrainerSpriteName(pokemonName);
	if (!spriteName) return "";
	var megaMarkerIndex = spriteName.indexOf("-Mega");
	if (megaMarkerIndex < 0) return "";
	var prefix = spriteName.substring(0, megaMarkerIndex);
	var suffix = spriteName.substring(megaMarkerIndex + 5).replace(/-/g, "");
	var alternateName = prefix + "Mega" + suffix;
	return alternateName !== spriteName ? alternateName : "";
}

function getTrainerSpriteBaseFallbackSpecies(pokemonName) {
	var resolvedName = String(pokemonName || "").trim();
	if (!resolvedName) return "";
	if (typeof pokedex !== "undefined" && pokedex && pokedex[resolvedName] && pokedex[resolvedName].baseSpecies) {
		return String(pokedex[resolvedName].baseSpecies || "").trim();
	}
	var megaMarkerIndex = resolvedName.indexOf("-Mega");
	if (megaMarkerIndex > 0) {
		return resolvedName.substring(0, megaMarkerIndex);
	}
	return "";
}

function shouldUseExpandedIconFallback(imgNode) {
	if (!imgNode || !imgNode.classList) return false;
	return imgNode.classList.contains("poke-inline-sprite") ||
		imgNode.classList.contains("simplified-side-form-sprite");
}

function shouldTryShowdownSpriteFallback(imgNode) {
	if (!imgNode) return false;
	if (imgNode.id === "p1mon" || imgNode.id === "p2mon") return true;
	if (!imgNode.classList) return false;
	return imgNode.classList.contains("poke-inline-sprite") ||
		imgNode.classList.contains("simplified-side-form-sprite");
}

var DEFAULT_TRAINER_SPRITE_REPO_URL = "https://raw.githubusercontent.com/May8th1995/sprites/master/";
var CUSTOM_TRAINER_SPRITE_REPO_URL = "https://raw.githubusercontent.com/RWXOLIVE/sprites/master/";
var POKEMON_ICON_SHEET_URL = "https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png";
var POKEMON_ICON_WIDTH = 40;
var POKEMON_ICON_HEIGHT = 30;
var POKEMON_ICON_SHEET_COLUMNS = 12;
var POKEMON_ICON_FALLBACK_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAALSURBVBhXY2AAAgAABQABqtXIUQAAAABJRU5ErkJggg==";
var pokemonIconSheetRowsCache = 0;

function shouldUseCustomTrainerSpriteRepo(pokemonName) {
	return false;
}

function getTrainerSpriteRepoBaseUrlByName(pokemonName) {
	return shouldUseCustomTrainerSpriteRepo(pokemonName)
		? CUSTOM_TRAINER_SPRITE_REPO_URL
		: DEFAULT_TRAINER_SPRITE_REPO_URL;
}

function getTrainerSpriteUrlByName(pokemonName) {
	var normalizedName = pokemonName === "Aegislash-Shield" ? "Aegislash" : pokemonName;
	var spriteName = normalizeTrainerSpriteName(normalizedName);
	return getTrainerSpriteRepoBaseUrlByName(normalizedName) + spriteName + ".png";
}

function getAlternateTrainerSpriteUrlByName(pokemonName) {
	var alternateName = getAlternateTrainerSpriteName(pokemonName);
	return alternateName
		? (getTrainerSpriteRepoBaseUrlByName(pokemonName) + alternateName + ".png")
		: "";
}

function buildTrainerSpriteExtraUrls(pokemonName) {
	var resolvedName = String(pokemonName || "").trim();
	if (!resolvedName) return [];
	var urls = [];
	var primaryUrl = getTrainerSpriteUrlByName(resolvedName);
	function pushUrl(url) {
		if (!url || url === primaryUrl || urls.indexOf(url) !== -1) return;
		urls.push(url);
	}
	pushUrl(getAlternateTrainerSpriteUrlByName(resolvedName));
	var megaMatch = resolvedName.match(/^(.*)-Mega(?:-(.*))?$/);
	if (megaMatch) {
		var megaBase = megaMatch[1];
		var megaSuffix = megaMatch[2] ? String(megaMatch[2]).trim() : "";
		var noHyphenSuffix = megaSuffix ? megaSuffix : "";
		var spacedSuffix = megaSuffix ? " " + megaSuffix : "";
		var underscoredSuffix = megaSuffix ? "_" + megaSuffix : "";
		var repoBaseUrl = getTrainerSpriteRepoBaseUrlByName(resolvedName);
		pushUrl(repoBaseUrl + (megaBase + "-Mega" + noHyphenSuffix).replace(/ /g, "%20") + ".png");
		pushUrl(repoBaseUrl + (megaBase + "_Mega" + underscoredSuffix).replace(/ /g, "%20") + ".png");
		pushUrl(repoBaseUrl + (megaBase + " Mega" + spacedSuffix).replace(/ /g, "%20") + ".png");
	}
	return urls;
}

function consumeNextTrainerSpriteExtraUrl(node) {
	if (!node) return "";
	var serializedUrls = String(node.getAttribute("data-sprite-extra-urls") || "");
	if (!serializedUrls) return "";
	var urls = serializedUrls.split("\n").filter(Boolean);
	if (!urls.length) return "";
	var nextUrl = urls.shift();
	node.setAttribute("data-sprite-extra-urls", urls.join("\n"));
	return nextUrl;
}

function normalizeShowdownSpriteName(pokemonName) {
	var spriteName = String(pokemonName || "").trim();
	if (!spriteName) return "";
	if (spriteName === "Aegislash-Shield") spriteName = "Aegislash";
	if (spriteName === "Zygarde-10%") spriteName = "Zygarde-10";
	if (spriteName === "Tauros-Paldea-Water") spriteName = "Tauros-Paldea-Aqua";
	if (spriteName === "Tauros-Paldea-Fire") spriteName = "Tauros-Paldea-Blaze";
	if (spriteName === "Tauros-Paldea") spriteName = "Tauros-Paldea-Combat";
	if (spriteName === "Wooper-Paldea") spriteName = "Wooper-Paldea";
	if (spriteName === "Mime Jr.") spriteName = "Mime Jr";
	if (spriteName === "Mr. Mime") spriteName = "Mr Mime";
	if (spriteName === "Type: Null") spriteName = "Type Null";
	if (spriteName === "Nidoran♀") spriteName = "Nidoran-F";
	if (spriteName === "Nidoran♂") spriteName = "Nidoran-M";
	return spriteName
		.toLowerCase()
		.replace(/[’']/g, "")
		.replace(/[%:.]/g, "")
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]+/g, "");
}

function getShowdownTrainerSpriteUrlByName(pokemonName) {
	var spriteName = normalizeShowdownSpriteName(pokemonName);
	return spriteName
		? ("https://play.pokemonshowdown.com/sprites/gen5/" + spriteName + ".png")
		: "";
}

function getIconSheetIndexForSpecies(speciesName) {
	var iconIndexTable = typeof BattlePokemonIconIndexes === "undefined" ? null : BattlePokemonIconIndexes;
	if (!iconIndexTable) return null;
	var speciesId = toDexPokemonId(speciesName);
	if (!speciesId) return null;
	var num = iconIndexTable[speciesId];
	return (num === undefined || num === null) ? null : num;
}

function getIconSheetPositionForSpecies(speciesName) {
	var iconIndex = getIconSheetIndexForSpecies(speciesName);
	if (iconIndex === null) return null;
	return {
		row: Math.floor(iconIndex / POKEMON_ICON_SHEET_COLUMNS),
		col: iconIndex % POKEMON_ICON_SHEET_COLUMNS
	};
}

function shouldPreferIconFallbackForSpecies(speciesName) {
	var resolvedSpecies = String(speciesName || "").trim();
	if (!resolvedSpecies) return false;
	if (resolvedSpecies.indexOf("-Mega") === -1) return false;
	return !!getIconSheetPositionForSpecies(resolvedSpecies);
}

function shouldUseIconSheetAsPrimarySpriteSource(speciesName) {
	return shouldPreferIconFallbackForSpecies(speciesName);
}

function getInitialTrainerSpriteUrlByName(pokemonName) {
	return shouldUseIconSheetAsPrimarySpriteSource(pokemonName)
		? POKEMON_ICON_FALLBACK_DATA_URL
		: getTrainerSpriteUrlByName(pokemonName);
}

function getPrimaryIconSheetLoadAttr(speciesName) {
	return shouldUseIconSheetAsPrimarySpriteSource(speciesName)
		? " onload=\"applyIconSheetFallbackImage(this, this.getAttribute('data-species'))\""
		: "";
}

function isTrainerRosterSpriteNode(imgNode) {
	if (!imgNode || !imgNode.classList) return false;
	return imgNode.classList.contains("trainer-pok");
}

function getIconSheetFallbackSpecies(speciesName, imgNode) {
	var resolvedSpecies = String(speciesName || "").trim();
	if (!resolvedSpecies) return "";
	return resolvedSpecies;
}

function shouldUseBackgroundSheetFallback(imgNode) {
	if (!imgNode) return false;
	if (imgNode.id === "p1mon" || imgNode.id === "p2mon") return true;
	return shouldUseExpandedIconFallback(imgNode);
}

function getPokemonIconSheetBackgroundImageValue(imgNode) {
	var targetNode = imgNode || document.documentElement;
	var computedStyle = typeof window !== "undefined" && window.getComputedStyle
		? window.getComputedStyle(targetNode)
		: null;
	var backgroundImage = computedStyle ? String(computedStyle.getPropertyValue("--pokemon-icon-sheet") || "").trim() : "";
	return backgroundImage || ("url('" + POKEMON_ICON_SHEET_URL + "')");
}

function getPokemonIconSheetMetrics() {
	var rows = pokemonIconSheetRowsCache;
	if (!rows) {
		var iconIndexTable = typeof BattlePokemonIconIndexes === "undefined" ? null : BattlePokemonIconIndexes;
		var maxIndex = 0;
		if (iconIndexTable) {
			for (var speciesId in iconIndexTable) {
				if (!Object.prototype.hasOwnProperty.call(iconIndexTable, speciesId)) continue;
				var num = iconIndexTable[speciesId];
				if (typeof num !== "number") continue;
				if (num > maxIndex) maxIndex = num;
			}
		}
		rows = Math.floor(maxIndex / POKEMON_ICON_SHEET_COLUMNS) + 1;
		pokemonIconSheetRowsCache = rows;
	}
	return {
		columns: POKEMON_ICON_SHEET_COLUMNS,
		rows: Math.max(rows, 1)
	};
}

function getIconSheetRenderBox(imgNode, useExpandedFallback) {
	var nodeWidth = POKEMON_ICON_WIDTH;
	var nodeHeight = POKEMON_ICON_HEIGHT;
	if (useExpandedFallback && imgNode) {
		var computedStyle = typeof window !== "undefined" && window.getComputedStyle
			? window.getComputedStyle(imgNode)
			: null;
		var computedWidth = computedStyle ? parseFloat(computedStyle.width) : 0;
		var computedHeight = computedStyle ? parseFloat(computedStyle.height) : 0;
		nodeWidth = imgNode.clientWidth || imgNode.offsetWidth || computedWidth || nodeWidth;
		nodeHeight = imgNode.clientHeight || imgNode.offsetHeight || computedHeight || nodeHeight;
	}
	var scale = useExpandedFallback
		? Math.max(1, Math.min(nodeWidth / POKEMON_ICON_WIDTH, nodeHeight / POKEMON_ICON_HEIGHT))
		: 1;
	var cellWidth = POKEMON_ICON_WIDTH * scale;
	var cellHeight = POKEMON_ICON_HEIGHT * scale;
	return {
		nodeWidth: nodeWidth,
		nodeHeight: nodeHeight,
		cellWidth: cellWidth,
		cellHeight: cellHeight,
		offsetX: (nodeWidth - cellWidth) / 2,
		offsetY: (nodeHeight - cellHeight) / 2
	};
}

function applyIconSheetFallbackImage(imgNode, speciesName) {
	if (!imgNode) return false;
	imgNode.onerror = null;
	imgNode.onload = null;
	var requestedSpecies = speciesName || imgNode.getAttribute("data-species") || "";
	var resolvedSpecies = getIconSheetFallbackSpecies(requestedSpecies, imgNode);
	var position = getIconSheetPositionForSpecies(resolvedSpecies);
	if (!position) return false;
	if (imgNode.classList) imgNode.classList.add("sprite-icon");
	var useExpandedFallback = shouldUseExpandedIconFallback(imgNode);
	var renderBox = getIconSheetRenderBox(imgNode, useExpandedFallback);
	var scale = renderBox.cellWidth / POKEMON_ICON_WIDTH;
	if (imgNode.classList) {
		imgNode.classList.toggle("sprite-icon-expanded", false);
	}
	imgNode.src = POKEMON_ICON_FALLBACK_DATA_URL;
	imgNode.style.backgroundImage = getPokemonIconSheetBackgroundImageValue(imgNode);
	imgNode.style.backgroundRepeat = "no-repeat";
	imgNode.style.backgroundPosition = "-" + (position.col * POKEMON_ICON_WIDTH) + "px -" + (position.row * POKEMON_ICON_HEIGHT) + "px";
	imgNode.style.backgroundSize = "";
	imgNode.style.width = POKEMON_ICON_WIDTH + "px";
	imgNode.style.height = POKEMON_ICON_HEIGHT + "px";
	imgNode.style.objectFit = "fill";
	imgNode.style.objectPosition = "center center";
	imgNode.style.imageRendering = "auto";
	imgNode.style.transform = scale > 1
		? ("translate(" + renderBox.offsetX + "px, " + renderBox.offsetY + "px) scale(" + scale + ")")
		: "none";
	imgNode.style.transformOrigin = "center center";
	return true;
}

function applyPrimaryIconSheetIfNeeded(node, speciesName) {
	if (!node) return;
	var resolvedSpecies = String(speciesName || node.getAttribute("data-species") || "").trim();
	if (!resolvedSpecies) return;
	if (!shouldUseIconSheetAsPrimarySpriteSource(resolvedSpecies)) return;
	applyIconSheetFallbackImage(node, resolvedSpecies);
}

function advanceTrainerSpriteFallback(node, resolvedSpecies, tryShowdownFallback) {
	if (!node) return;
	var currentStage = String(node.getAttribute("data-sprite-fallback-stage") || "");
	var nextPrimaryUrl = consumeNextTrainerSpriteExtraUrl(node);
	var fallbackSpecies = String(node.getAttribute("data-sprite-fallback-species") || "").trim();
	if (nextPrimaryUrl && (currentStage === "" || currentStage === "alt-primary")) {
		node.setAttribute("data-sprite-fallback-stage", "alt-primary");
		node.src = nextPrimaryUrl;
		return;
	}
	if (tryShowdownFallback && (currentStage === "" || currentStage === "alt-primary")) {
		var showdownPrimaryUrl = getShowdownTrainerSpriteUrlByName(resolvedSpecies);
		if (showdownPrimaryUrl) {
			node.setAttribute("data-sprite-fallback-stage", "showdown-primary");
			node.src = showdownPrimaryUrl;
			return;
		}
	}
	if (shouldPreferIconFallbackForSpecies(resolvedSpecies) && currentStage !== "icon") {
		node.setAttribute("data-sprite-fallback-stage", "icon");
		if (applyIconSheetFallbackImage(node, resolvedSpecies)) {
			return;
		}
	}
	if (fallbackSpecies && currentStage !== "base" && currentStage !== "showdown-base") {
		node.setAttribute("data-sprite-fallback-stage", "base");
		node.src = getTrainerSpriteUrlByName(fallbackSpecies);
		return;
	}
	if (tryShowdownFallback && fallbackSpecies && currentStage !== "showdown-base") {
		var showdownBaseUrl = getShowdownTrainerSpriteUrlByName(fallbackSpecies);
		if (showdownBaseUrl) {
			node.setAttribute("data-sprite-fallback-stage", "showdown-base");
			node.src = showdownBaseUrl;
			return;
		}
	}
	applyIconSheetFallbackImage(node, resolvedSpecies);
}

function setTrainerSpriteImage(node, speciesName) {
	if (!node) return;
	var resolvedSpecies = speciesName || "";
	var baseFallbackSpecies = getTrainerSpriteBaseFallbackSpecies(resolvedSpecies);
	var extraPrimaryUrls = buildTrainerSpriteExtraUrls(resolvedSpecies);
	var tryShowdownFallback = shouldTryShowdownSpriteFallback(node);
	node.setAttribute("data-species", resolvedSpecies);
	node.setAttribute("data-sprite-fallback-stage", "");
	node.setAttribute("data-sprite-extra-urls", extraPrimaryUrls.join("\n"));
	node.setAttribute("data-sprite-fallback-species", baseFallbackSpecies && baseFallbackSpecies !== resolvedSpecies ? baseFallbackSpecies : "");
	// Clear any icon-sheet fallback styling from a previous failed load.
	if (node.classList) node.classList.remove("sprite-icon");
	if (node.classList) node.classList.remove("sprite-icon-expanded");
	node.style.width = "";
	node.style.height = "";
	node.style.objectFit = "";
	node.style.objectPosition = "";
	node.style.imageRendering = "";
	node.style.transform = "";
	node.style.transformOrigin = "";
	node.style.backgroundImage = "";
	node.style.backgroundRepeat = "";
	node.style.backgroundPosition = "";
	node.style.backgroundSize = "";
	if (shouldUseIconSheetAsPrimarySpriteSource(resolvedSpecies)) {
		node.setAttribute("data-sprite-fallback-stage", "icon");
		applyIconSheetFallbackImage(node, resolvedSpecies);
		return;
	}
	node.onload = function () {
		if (this.naturalWidth <= 1 || this.naturalHeight <= 1) {
			advanceTrainerSpriteFallback(this, resolvedSpecies, tryShowdownFallback);
		}
	};
	node.onerror = function () {
		advanceTrainerSpriteFallback(this, resolvedSpecies, tryShowdownFallback);
	};
	node.src = getTrainerSpriteUrlByName(resolvedSpecies);
}

function parseTrainerPartyEntry(entryText) {
	var closeBracket = entryText.indexOf("]");
	var indexText = closeBracket >= 0 ? entryText.substring(1, closeBracket) : "0";
	var fullSetName = closeBracket >= 0 ? entryText.substring(closeBracket + 1) : entryText;
	var pokemonName = fullSetName.split(" (")[0];
	var setName = fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")"));
	var trainerParts = parseTrainerSetName(setName);
	var setData = setdex[pokemonName] && setdex[pokemonName][setName] ? setdex[pokemonName][setName] : null;
	return {
		entryText: entryText,
		indexText: indexText,
		sortIndex: parseInt(indexText, 10) || 0,
		fullSetName: fullSetName,
		pokemonName: pokemonName,
		trainerLabel: setName,
		trainerName: trainerParts.trainerName,
		trainerBattleKey: trainerParts.battleKey,
		setData: setData
	};
}

function parseTrainerSetName(setName) {
	var normalizedSetName = (setName || "").trim();
	var separatorIndex = normalizedSetName.indexOf("|");
	if (separatorIndex < 0) {
		return {
			trainerName: normalizedSetName,
			battleKey: normalizedSetName
		};
	}
	var trainerName = normalizedSetName.substring(0, separatorIndex).trim();
	var battleKey = normalizedSetName.substring(separatorIndex + 1).trim();
	return {
		trainerName: trainerName || normalizedSetName,
		battleKey: battleKey || normalizedSetName
	};
}

function getTrainerFieldLocksState() {
	if (trainerFieldLocksCache && typeof trainerFieldLocksCache === "object") return trainerFieldLocksCache;
	var parsed = safeJsonParse(localStorage.getItem(TRAINER_FIELD_LOCKS_STORAGE_KEY), {});
	trainerFieldLocksCache = parsed && typeof parsed === "object" ? parsed : {};
	return trainerFieldLocksCache;
}

function saveTrainerFieldLocksState(nextState) {
	trainerFieldLocksCache = nextState && typeof nextState === "object" ? nextState : {};
	localStorage.setItem(TRAINER_FIELD_LOCKS_STORAGE_KEY, JSON.stringify(trainerFieldLocksCache));
}

function getCurrentTrainerFieldLockKey() {
	return FIELD_LOCK_GLOBAL_KEY;
}

function handleTrainerFieldLockTrainerTransition() {
	var currentKey = getCurrentTrainerFieldLockKey();
	if (!currentKey) return;
	trainerFieldLockActiveTrainerKey = currentKey;
	syncTrainerFieldLockButtonStyles();
}

function getTrainerFieldLockedIdsForKey(trainerKey) {
	var normalizedKey = String(trainerKey || "").trim();
	if (!normalizedKey) return [];
	var state = getTrainerFieldLocksState();
	var rawIds = state[normalizedKey];
	if (!Array.isArray(rawIds)) return [];
	var ids = [];
	for (var i = 0; i < rawIds.length; i++) {
		var fieldId = String(rawIds[i] || "").trim();
		if (!fieldId) continue;
		if (ids.indexOf(fieldId) !== -1) continue;
		ids.push(fieldId);
	}
	return ids;
}

function isTrainerFieldLockableId(fieldId) {
	var normalizedId = String(fieldId || "").trim();
	if (!normalizedId) return false;
	if (TRAINER_FIELD_LOCK_EXCLUDED_IDS[normalizedId]) return false;
	return !!TRAINER_FIELD_LOCKABLE_IDS[normalizedId];
}

function getTrainerFieldExclusiveGroup(fieldId) {
	var input = document.getElementById(String(fieldId || ""));
	if (!input) return "";
	var inputName = String(input.getAttribute("name") || "");
	if (inputName === "weather" || inputName === "gscWeather" || inputName === "terrain") return inputName;
	return "";
}

function setTrainerFieldLockEnabled(fieldId, enabled, trainerKey) {
	var normalizedId = String(fieldId || "").trim();
	if (!isTrainerFieldLockableId(normalizedId)) return false;
	var key = String(trainerKey || getCurrentTrainerFieldLockKey()).trim();
	if (!key) return false;
	var state = getTrainerFieldLocksState();
	var lockedIds = getTrainerFieldLockedIdsForKey(key);
	var isCurrentlyLocked = lockedIds.indexOf(normalizedId) !== -1;
	if (enabled) {
		if (!isCurrentlyLocked) {
			var exclusiveGroup = getTrainerFieldExclusiveGroup(normalizedId);
			if (exclusiveGroup) {
				lockedIds = lockedIds.filter(function (lockedId) {
					if (lockedId === normalizedId) return true;
					return getTrainerFieldExclusiveGroup(lockedId) !== exclusiveGroup;
				});
			}
			lockedIds.push(normalizedId);
		}
	} else if (isCurrentlyLocked) {
		lockedIds = lockedIds.filter(function (lockedId) {
			return lockedId !== normalizedId;
		});
	}
	if (lockedIds.length) {
		state[key] = lockedIds;
	} else {
		delete state[key];
	}
	saveTrainerFieldLocksState(state);
	return true;
}

function isTrainerFieldLockEnabled(fieldId, trainerKey) {
	var normalizedId = String(fieldId || "").trim();
	if (!normalizedId) return false;
	var key = String(trainerKey || getCurrentTrainerFieldLockKey()).trim();
	if (!key) return false;
	return getTrainerFieldLockedIdsForKey(key).indexOf(normalizedId) !== -1;
}

function isTrainerFieldExclusiveGroupLocked(exclusiveGroup, trainerKey) {
	var normalizedGroup = String(exclusiveGroup || "").trim();
	if (!normalizedGroup) return false;
	var key = String(trainerKey || getCurrentTrainerFieldLockKey()).trim();
	if (!key) return false;
	var lockedIds = getTrainerFieldLockedIdsForKey(key);
	for (var i = 0; i < lockedIds.length; i++) {
		if (getTrainerFieldExclusiveGroup(lockedIds[i]) === normalizedGroup) return true;
	}
	return false;
}

function getCurrentGenSpeciesNameByEvolutionId(speciesId) {
	if (!speciesId || !pokedex) return "";
	for (var speciesName in pokedex) {
		if (!Object.prototype.hasOwnProperty.call(pokedex, speciesName)) continue;
		if (toDexPokemonId(speciesName) === speciesId) return speciesName;
	}
	return "";
}

function appendUniqueFormeOption(optionNames, seenOptionNames, optionName) {
	var normalizedOptionName = String(optionName || "").trim();
	if (!normalizedOptionName || seenOptionNames[normalizedOptionName]) return;
	seenOptionNames[normalizedOptionName] = true;
	optionNames.push(normalizedOptionName);
}

function appendSpeciesAndOtherFormes(optionNames, seenOptionNames, excludedOptionNames, speciesName) {
	var normalizedSpeciesName = String(speciesName || "").trim();
	if (!normalizedSpeciesName || excludedOptionNames[normalizedSpeciesName]) return;
	appendUniqueFormeOption(optionNames, seenOptionNames, normalizedSpeciesName);
	var speciesEntry = pokedex && pokedex[normalizedSpeciesName];
	if (!speciesEntry || !speciesEntry.otherFormes) return;
	for (var i = 0; i < speciesEntry.otherFormes.length; i++) {
		var otherFormeName = String(speciesEntry.otherFormes[i] || "").trim();
		if (!otherFormeName || excludedOptionNames[otherFormeName]) continue;
		appendUniqueFormeOption(optionNames, seenOptionNames, otherFormeName);
	}
}

function collectEvolutionLineSpeciesIds(speciesId, speciesIds, visitedSpeciesIds) {
	if (!speciesId || visitedSpeciesIds[speciesId]) return;
	visitedSpeciesIds[speciesId] = true;
	speciesIds.push(speciesId);

	var nextEvoSpeciesIds = FRAG_NEXT_EVO_SPECIES_IDS[speciesId];
	if (!nextEvoSpeciesIds || !nextEvoSpeciesIds.length) return;
	for (var i = 0; i < nextEvoSpeciesIds.length; i++) {
		collectEvolutionLineSpeciesIds(nextEvoSpeciesIds[i], speciesIds, visitedSpeciesIds);
	}
}

function getEvolutionLineSpeciesNames(speciesName, excludedSpeciesNames) {
	var speciesId = resolveEvolutionLookupSpeciesId(speciesName);
	if (!speciesId) return [];

	var rootSpeciesId = speciesId;
	for (var depth = 0; depth < 12; depth++) {
		var prevoSpeciesId = FRAG_PREVO_BY_SPECIES_ID[rootSpeciesId];
		if (!prevoSpeciesId || prevoSpeciesId === rootSpeciesId) break;
		rootSpeciesId = prevoSpeciesId;
	}

	var excludedSpeciesIds = {};
	var excludedOptionNames = {};
	for (var i = 0; i < excludedSpeciesNames.length; i++) {
		var excludedSpeciesName = String(excludedSpeciesNames[i] || "").trim();
		if (!excludedSpeciesName) continue;
		excludedOptionNames[excludedSpeciesName] = true;
		var excludedSpeciesId = resolveEvolutionLookupSpeciesId(excludedSpeciesName) || toDexPokemonId(excludedSpeciesName);
		if (excludedSpeciesId) excludedSpeciesIds[excludedSpeciesId] = true;
	}

	var evolutionLineSpeciesIds = [];
	collectEvolutionLineSpeciesIds(rootSpeciesId, evolutionLineSpeciesIds, {});

	var seenOptionNames = {};
	var evolutionLineSpeciesNames = [];
	for (i = 0; i < evolutionLineSpeciesIds.length; i++) {
		var evolutionLineSpeciesId = evolutionLineSpeciesIds[i];
		if (excludedSpeciesIds[evolutionLineSpeciesId]) continue;
		var evolutionLineSpeciesName = getCurrentGenSpeciesNameByEvolutionId(evolutionLineSpeciesId);
		if (!evolutionLineSpeciesName) continue;
		appendSpeciesAndOtherFormes(
			evolutionLineSpeciesNames,
			seenOptionNames,
			excludedOptionNames,
			evolutionLineSpeciesName
		);
	}
	return evolutionLineSpeciesNames;
}

function applyTrainerFieldLocksForCurrentTrainer(options) {
	var applyOptions = options || {};
	var forceTrigger = !!applyOptions.forceTrigger;
	var key = getCurrentTrainerFieldLockKey();
	var lockedIds = getTrainerFieldLockedIdsForKey(key);
	if (!lockedIds.length) return;
	isApplyingTrainerFieldLocks = true;
	try {
		for (var i = 0; i < lockedIds.length; i++) {
			var input = document.getElementById(lockedIds[i]);
			if (!input) continue;
			var inputType = String(input.type || "").toLowerCase();
			var didChange = false;
			if (inputType === "radio") {
				if (input.name) $("input:radio[name='" + input.name + "']").prop("checked", false);
				if (!input.checked) {
					input.checked = true;
					didChange = true;
				}
			} else if (inputType === "checkbox") {
				if (!input.checked) {
					input.checked = true;
					didChange = true;
				}
			}
			if (didChange || forceTrigger) $(input).change();
		}
	} finally {
		isApplyingTrainerFieldLocks = false;
	}
	var weatherValue = gen === 2
		? $("input:radio[name='gscWeather']:checked").val()
		: $("input:radio[name='weather']:checked").val();
	var activeTerrain = $("input:checkbox[name='terrain']:checked").val() || "";
	applyFieldEnvironmentTheme(weatherValue, activeTerrain);
}

function syncTrainerFieldLockButtonStyles() {
	var key = getCurrentTrainerFieldLockKey();
	var lockedIds = getTrainerFieldLockedIdsForKey(key);
	$(document).find(".field-info label.btn[for]").each(function () {
		var fieldId = String($(this).attr("for") || "").trim();
		if (!fieldId) return;
		var isLockable = isTrainerFieldLockableId(fieldId);
		var isLocked = isLockable && lockedIds.indexOf(fieldId) !== -1;
		$(this).toggleClass("trainer-field-lock-on", isLocked);
		var baseTitle = $(this).attr("data-lock-base-title");
		if (typeof baseTitle === "undefined") {
			baseTitle = String($(this).attr("title") || "");
			$(this).attr("data-lock-base-title", baseTitle);
		}
		if (!isLockable) return;
		var lockHint = isLocked ? "Right-click: unlock field" : "Right-click: lock field";
		$(this).attr("title", baseTitle ? (baseTitle + " | " + lockHint) : lockHint);
	});
}

function handleTrainerFieldButtonContextMenu(ev, labelNode) {
	var fieldId = String($(labelNode).attr("for") || "").trim();
	if (!isTrainerFieldLockableId(fieldId)) return;
	ev.preventDefault();
	var trainerKey = getCurrentTrainerFieldLockKey();
	var currentlyLocked = isTrainerFieldLockEnabled(fieldId, trainerKey);
	setTrainerFieldLockEnabled(fieldId, !currentlyLocked, trainerKey);
	if (!currentlyLocked) {
		var input = document.getElementById(fieldId);
		if (input) {
			input.checked = true;
			$(input).change();
		}
	}
	applyTrainerFieldLocksForCurrentTrainer();
	syncTrainerFieldLockButtonStyles();
}

function handleTrainerFieldInputChangeForLocks() {
	if (isApplyingTrainerFieldLocks) return;
	var fieldId = String(this && this.id || "").trim();
	if (!isTrainerFieldLockableId(fieldId)) return;
	var lockGroup = getTrainerFieldExclusiveGroup(fieldId);
	if (lockGroup && isTrainerFieldExclusiveGroupLocked(lockGroup)) {
		applyTrainerFieldLocksForCurrentTrainer({forceTrigger: true});
		syncTrainerFieldLockButtonStyles();
		return;
	}
	if (!lockGroup && isTrainerFieldLockEnabled(fieldId)) {
		applyTrainerFieldLocksForCurrentTrainer({forceTrigger: true});
		syncTrainerFieldLockButtonStyles();
	}
}

function isTruthySetFlag(flagValue) {
	if (flagValue === true || flagValue === 1) return true;
	if (typeof flagValue === "string") {
		var normalized = flagValue.trim().toLowerCase();
		return normalized === "true" || normalized === "1" || normalized === "yes";
	}
	return false;
}

function getSetDoubleGroupId(setData) {
	if (!setData) return "";
	var rawGroup = setData.setdoubleGroup;
	if (typeof rawGroup === "undefined") rawGroup = setData.setdoublegroup;
	if (typeof rawGroup === "undefined") rawGroup = setData.setdoubleId;
	if (typeof rawGroup === "undefined") rawGroup = setData.setdoubleid;
	if (typeof rawGroup === "undefined" || rawGroup === null) return "";
	var normalizedGroup = String(rawGroup).trim();
	return normalizedGroup;
}

function getSetDoubleSide(setData) {
	if (!setData) return 0;
	var rawSide = setData.setdoubleSide;
	if (typeof rawSide === "undefined") rawSide = setData.setdoubleside;
	if (typeof rawSide === "undefined" || rawSide === null) return 0;
	if (typeof rawSide === "number") {
		return rawSide === 1 || rawSide === 2 ? rawSide : 0;
	}
	var normalizedSide = String(rawSide).trim().toLowerCase();
	if (normalizedSide === "1" || normalizedSide === "top" || normalizedSide === "primary") return 1;
	if (normalizedSide === "2" || normalizedSide === "bottom" || normalizedSide === "secondary") return 2;
	return 0;
}

function isSetDoubleEntry(setData) {
	return !!setData && (
		isTruthySetFlag(setData.setdouble) ||
		isTruthySetFlag(setData.truedoubles) ||
		getSetDoubleGroupId(setData) !== "" ||
		getSetDoubleSide(setData) > 0
	);
}

function hasSetDoubleLayoutMetadata(setData) {
	return !!setData && (
		getSetDoubleGroupId(setData) !== "" ||
		getSetDoubleSide(setData) > 0
	);
}

function shouldUseSetDoubleLayout(entries) {
	for (var i = 0; i < entries.length; i++) {
		if (hasSetDoubleLayoutMetadata(entries[i].setData)) return true;
	}
	return false;
}

function isSetDoubleEncounter(entries) {
	var hasSetDoubleFlag = false;
	for (var i = 0; i < entries.length; i++) {
		var setData = entries[i].setData;
		if (!setData) continue;
		var hasSetDoubleSignal = typeof setData.setdouble !== "undefined" ||
			getSetDoubleGroupId(setData) !== "" ||
			getSetDoubleSide(setData) > 0;
		if (!hasSetDoubleSignal) continue;
		hasSetDoubleFlag = true;
		if (isTruthySetFlag(setData.setdouble) || getSetDoubleGroupId(setData) !== "" || getSetDoubleSide(setData) > 0) return true;
	}
	if (hasSetDoubleFlag) return false;

	var hasLegacyTrueDoublesFlag = false;
	for (var p = 0; p < entries.length; p++) {
		var legacyTrueSet = entries[p].setData;
		if (!legacyTrueSet || typeof legacyTrueSet.truedoubles === "undefined") continue;
		hasLegacyTrueDoublesFlag = true;
		if (isTruthySetFlag(legacyTrueSet.truedoubles)) return true;
	}
	if (hasLegacyTrueDoublesFlag) return false;

	for (var q = 0; q < entries.length; q++) {
		var legacySet = entries[q].setData;
		if (legacySet && isTruthySetFlag(legacySet.doubles)) return true;
	}
	if (entries.length >= 4 && entries[0] && entries[0].fullSetName.indexOf("&") >= 0) {
		return true;
	}
	return false;
}

function shouldAutoEnableDoublesForSelection(fullSetName, trainerEntries) {
	if (Array.isArray(trainerEntries) && trainerEntries.length) {
		var parsedEntries = trainerEntries.slice().sort(sortmons).map(parseTrainerPartyEntry);
		return isSetDoubleEncounter(parsedEntries);
	}
	if (!fullSetName) return false;
	var selectedEntry = parseTrainerPartyEntry(fullSetName);
	return isSetDoubleEntry(selectedEntry.setData);
}

function enableDoublesFormatIfNeeded(fullSetName, trainerEntries) {
	if (!shouldAutoEnableDoublesForSelection(fullSetName, trainerEntries)) return;
	if ($("#doubles-format").prop("checked")) return;
	$("#doubles-format").prop("checked", true).change();
}

function syncBattleFormatForSelection(fullSetName, trainerEntries) {
	var shouldUseDoubles = shouldAutoEnableDoublesForSelection(fullSetName, trainerEntries);
	var targetFormat = shouldUseDoubles ? $("#doubles-format") : $("#singles-format");
	if (!targetFormat.length) return;
	var wasChecked = targetFormat.prop("checked");
	$("input:radio[name='format']").prop("checked", false);
	targetFormat.prop("checked", true);
	if (!wasChecked) targetFormat.change();
}

function normalizeSetWeatherValue(rawWeather) {
	var normalized = String(rawWeather || "").trim();
	if (!normalized) return "";
	var lower = normalized.toLowerCase();
	if (lower === "none" || lower === "clear" || lower === "(none)" || lower === "noweather" || lower === "no weather") {
		return "";
	}
	var weatherMap = {
		"sun": "Sun",
		"harsh sunshine": "Harsh Sunshine",
		"rain": "Rain",
		"heavy rain": "Heavy Rain",
		"sand": "Sand",
		"snow": "Snow",
		"hail": "Hail",
		"fog": "Fog",
		"strong winds": "Strong Winds"
	};
	return weatherMap[lower] || normalized;
}

function getWeatherFromSetData(setData) {
	if (!setData) return {hasWeather: false, weather: ""};
	var weatherKeys = ["Weather", "weather"];
	for (var i = 0; i < weatherKeys.length; i++) {
		var key = weatherKeys[i];
		if (typeof setData[key] === "undefined" || setData[key] === null) continue;
		return {
			hasWeather: true,
			weather: normalizeSetWeatherValue(setData[key])
		};
	}
	return {hasWeather: false, weather: ""};
}

function resolveWeatherForSelection(fullSetName, trainerEntries) {
	var selectedEntry = parseTrainerPartyEntry(fullSetName);
	var selectedWeather = getWeatherFromSetData(selectedEntry.setData);
	if (selectedWeather.hasWeather) return selectedWeather.weather;
	if (Array.isArray(trainerEntries)) {
		for (var i = 0; i < trainerEntries.length; i++) {
			var candidateEntry = parseTrainerPartyEntry(trainerEntries[i]);
			var candidateWeather = getWeatherFromSetData(candidateEntry.setData);
			if (candidateWeather.hasWeather) return candidateWeather.weather;
		}
	}
	return "";
}

function syncWeatherForSelection(fullSetName, trainerEntries) {
	var weatherValue = resolveWeatherForSelection(fullSetName, trainerEntries);
	var weatherName = gen === 2 ? "gscWeather" : "weather";
	if (isTrainerFieldExclusiveGroupLocked(weatherName)) {
		applyTrainerFieldLocksForCurrentTrainer();
		syncTrainerFieldLockButtonStyles();
		return;
	}
	var clearSelector = gen === 2 ? "#gscClear" : "#clear";
	var weatherInputs = $("input:radio[name='" + weatherName + "']");
	if (!weatherInputs.length) return;
	var targetInput = weatherInputs.filter(function () {
		return String($(this).val() || "") === weatherValue;
	}).first();
	if (!targetInput.length) targetInput = $(clearSelector);
	if (!targetInput.length) return;
	var wasChecked = targetInput.prop("checked");
	weatherInputs.prop("checked", false);
	targetInput.prop("checked", true);
	if (!wasChecked) targetInput.change();
	var terrainValue = $("input:checkbox[name='terrain']:checked").val() || "";
	applyFieldEnvironmentTheme(weatherValue, terrainValue);
	applyTrainerFieldLocksForCurrentTrainer();
	syncTrainerFieldLockButtonStyles();
}

function normalizeSetTerrainValue(rawTerrain) {
	var normalized = String(rawTerrain || "").trim();
	if (!normalized) return "";
	var lower = normalized.toLowerCase();
	if (lower === "none" || lower === "clear" || lower === "(none)" || lower === "noterrain" || lower === "no terrain") {
		return "";
	}
	var terrainMap = {
		"electric": "Electric",
		"electric terrain": "Electric",
		"grassy": "Grassy",
		"grassy terrain": "Grassy",
		"misty": "Misty",
		"misty terrain": "Misty",
		"psychic": "Psychic",
		"psychic terrain": "Psychic"
	};
	return terrainMap[lower] || normalized;
}

function getTerrainFromSetData(setData) {
	if (!setData) return {hasTerrain: false, terrain: ""};
	var terrainKeys = ["Terrain", "terrain"];
	for (var i = 0; i < terrainKeys.length; i++) {
		var key = terrainKeys[i];
		if (typeof setData[key] === "undefined" || setData[key] === null) continue;
		return {
			hasTerrain: true,
			terrain: normalizeSetTerrainValue(setData[key])
		};
	}
	return {hasTerrain: false, terrain: ""};
}

function resolveTerrainForSelection(fullSetName, trainerEntries) {
	var selectedEntry = parseTrainerPartyEntry(fullSetName);
	var selectedTerrain = getTerrainFromSetData(selectedEntry.setData);
	if (selectedTerrain.hasTerrain) return selectedTerrain;
	if (Array.isArray(trainerEntries)) {
		for (var i = 0; i < trainerEntries.length; i++) {
			var candidateEntry = parseTrainerPartyEntry(trainerEntries[i]);
			var candidateTerrain = getTerrainFromSetData(candidateEntry.setData);
			if (candidateTerrain.hasTerrain) return candidateTerrain;
		}
	}
	return {hasTerrain: false, terrain: ""};
}

function syncTerrainForSelection(fullSetName, trainerEntries) {
	var resolvedTerrain = resolveTerrainForSelection(fullSetName, trainerEntries);
	var terrainValue = resolvedTerrain.terrain;
	var terrainInputs = $("input:checkbox[name='terrain']");
	if (!terrainInputs.length) return;
	if (isTrainerFieldExclusiveGroupLocked("terrain")) {
		applyTrainerFieldLocksForCurrentTrainer();
		syncTrainerFieldLockButtonStyles();
		return;
	}
	if (!resolvedTerrain.hasTerrain) {
		terrainInputs.prop("checked", false);
		var activeInput = terrainInputs.filter(":checked").first();
		getTerrainEffects.call(activeInput.length ? activeInput[0] : terrainInputs.first()[0]);
		var activeTerrain = activeInput.length ? String(activeInput.val() || "") : "";
		var currentWeather = gen === 2
			? $("input:radio[name='gscWeather']:checked").val()
			: $("input:radio[name='weather']:checked").val();
		applyFieldEnvironmentTheme(currentWeather, activeTerrain);
		applyTrainerFieldLocksForCurrentTrainer();
		syncTrainerFieldLockButtonStyles();
		return;
	}
	var targetInput = terrainInputs.filter(function () {
		return String($(this).val() || "") === terrainValue;
	}).first();
	terrainInputs.prop("checked", false);
	if (targetInput.length) targetInput.prop("checked", true);
	getTerrainEffects.call(targetInput.length ? targetInput[0] : terrainInputs.first()[0]);
	var weatherValue = gen === 2
		? $("input:radio[name='gscWeather']:checked").val()
		: $("input:radio[name='weather']:checked").val();
	applyFieldEnvironmentTheme(weatherValue, terrainValue);
	applyTrainerFieldLocksForCurrentTrainer();
	syncTrainerFieldLockButtonStyles();
}

function splitSetDoubleEntries(entries) {
	var primaryFromSide = [];
	var secondaryFromSide = [];
	var unassignedEntries = [];
	var usesExplicitSide = false;
	for (var s = 0; s < entries.length; s++) {
		var side = getSetDoubleSide(entries[s].setData);
		if (side === 1) {
			primaryFromSide.push(entries[s]);
			usesExplicitSide = true;
		} else if (side === 2) {
			secondaryFromSide.push(entries[s]);
			usesExplicitSide = true;
		} else {
			unassignedEntries.push(entries[s]);
		}
	}
	if (usesExplicitSide) {
		for (var u = 0; u < unassignedEntries.length; u++) {
			if (primaryFromSide.length <= secondaryFromSide.length) primaryFromSide.push(unassignedEntries[u]);
			else secondaryFromSide.push(unassignedEntries[u]);
		}
		return {primary: primaryFromSide, secondary: secondaryFromSide};
	}

	var groupedEntries = {};
	var groupOrder = [];
	for (var i = 0; i < entries.length; i++) {
		var groupKey = entries[i].trainerName || entries[i].trainerLabel || "";
		if (!groupedEntries[groupKey]) {
			groupedEntries[groupKey] = [];
			groupOrder.push(groupKey);
		}
		groupedEntries[groupKey].push(entries[i]);
	}
	if (groupOrder.length >= 2) {
		var primaryGrouped = groupedEntries[groupOrder[0]].slice();
		var secondaryGrouped = [];
		for (var g = 1; g < groupOrder.length; g++) {
			secondaryGrouped = secondaryGrouped.concat(groupedEntries[groupOrder[g]]);
		}
		return {primary: primaryGrouped, secondary: secondaryGrouped};
	}

	var primary = [];
	var secondary = [];
	for (var n = 0; n < entries.length; n++) {
		if (n % 2 === 0) primary.push(entries[n]);
		else secondary.push(entries[n]);
	}
	if (!secondary.length && entries.length > 1) {
		var half = Math.ceil(entries.length / 2);
		primary = entries.slice(0, half);
		secondary = entries.slice(half);
	}
	return {primary: primary, secondary: secondary};
}

function isTrainerPartySideFullyMarkedDead(entries) {
	if (!Array.isArray(entries) || !entries.length) return false;
	for (var i = 0; i < entries.length; i++) {
		if (!isOpposingSetMarkedDead(entries[i].fullSetName)) return false;
	}
	return true;
}

function getCurrentOpposingTrainerSideSplitEntries() {
	var sortedEntries = (CURRENT_TRAINER_POKS || []).slice().sort(sortmons).map(parseTrainerPartyEntry);
	if (!sortedEntries.length || !isSetDoubleEncounter(sortedEntries) || !shouldUseSetDoubleLayout(sortedEntries)) return null;
	var splitEntries = splitSetDoubleEntries(sortedEntries);
	if (!splitEntries.primary.length || !splitEntries.secondary.length) return null;
	return splitEntries;
}

function shouldUseSingleTargetSpreadDamageForCurrentTrainerBattle() {
	if ($("input:radio[name='format']:checked").val() !== "Doubles") return false;
	var splitEntries = getCurrentOpposingTrainerSideSplitEntries();
	if (!splitEntries) return false;
	var isPrimaryCleared = isTrainerPartySideFullyMarkedDead(splitEntries.primary);
	var isSecondaryCleared = isTrainerPartySideFullyMarkedDead(splitEntries.secondary);
	return isPrimaryCleared !== isSecondaryCleared;
}

function getFieldWithSingleTargetSpreadDamageOverride(field, useSingleTargetSpreadDamage) {
	if (!field || !useSingleTargetSpreadDamage) return field;
	var adjustedField = typeof field.clone === "function" ? field.clone() : field;
	adjustedField.ignoreSpreadDamageReduction = true;
	return adjustedField;
}

function trainerPartyMonHtml(entry) {
	var label = "[" + entry.indexText + "]" + entry.fullSetName;
	return '<img class="trainer-pok right-side" src="' + escapeHtml(getInitialTrainerSpriteUrlByName(entry.pokemonName)) + '" data-id="' + escapeHtml(entry.fullSetName) + '" data-species="' + escapeHtml(entry.pokemonName) + '" title="' + escapeHtml(label + ", " + label + " BP") + '" loading="lazy" decoding="async"' + getPrimaryIconSheetLoadAttr(entry.pokemonName) + ' onerror="applyIconSheetFallbackImage(this, this.getAttribute(\'data-species\'))">';
}

function renderOpposingTrainerParties(selectedSetName) {
	var sortedEntries = (CURRENT_TRAINER_POKS || []).slice().sort(sortmons).map(parseTrainerPartyEntry);
	var useSplitLayout = shouldUseSetDoubleLayout(sortedEntries);

	var primaryEntries = [];
	var secondaryEntries = [];
	if (useSplitLayout) {
		var splitEntries = splitSetDoubleEntries(sortedEntries);
		primaryEntries = splitEntries.primary;
		secondaryEntries = splitEntries.secondary;
	} else {
		primaryEntries = sortedEntries.slice();
	}

	var primaryHtml = primaryEntries.map(trainerPartyMonHtml).join("");
	var secondaryHtml = secondaryEntries.map(trainerPartyMonHtml).join("");
	var showSecondary = useSplitLayout && secondaryEntries.length > 0;

	$(".trainer-pok-list-opposing").html(primaryHtml);
	$(".trainer-pok-list-opposing2").html(secondaryHtml).prop("hidden", !showSecondary);
	$(".trainer-pok-divider").prop("hidden", !showSecondary);
	$(".trainer-pok.right-side").each(function () {
		applyPrimaryIconSheetIfNeeded(this, this.getAttribute("data-species"));
	});
	applyOpposingDeadMarks();
}

// auto-update set details on select
$(".set-selector").change(function () {
	window.NO_CALC = true;
	var currentPokeInfo = $(this).closest(".poke-info");
	currentPokeInfo.removeAttr("data-transform-species");
	var fullSetName = String($(this).val() || "");
	var parsedSetName = parseSetId(fullSetName);
	if ($(this).hasClass('opposing')) {
		topPokemonIcon(fullSetName, $("#p2mon")[0])
		CURRENT_TRAINER_POKS = get_trainer_poks(fullSetName);
		handleTrainerFieldLockTrainerTransition();
		syncBattleFormatForSelection(fullSetName, CURRENT_TRAINER_POKS);
		renderOpposingTrainerParties(fullSetName);
	} else {
		topPokemonIcon(fullSetName, $("#p1mon")[0])
	}

	var pokemonName = parsedSetName.species;
	var setName = parsedSetName.label;
	var pokemonLookupName = resolveSetSpeciesNameForDexLookup(pokemonName);
	var pokemon = pokedex[pokemonLookupName];
	if (pokemon) {
		var pokeObj = $(this).closest(".poke-info");
		if (stickyMoves.getSelectedSide() === pokeObj.prop("id")) {
			stickyMoves.clearStickyMove();
		}
		pokeObj.find(".teraToggle").prop("checked", false);
		pokeObj.find(".analysis")
			.attr("href", astralDexUrl(pokemonLookupName))
			.attr("data-pokemon-name", pokemonLookupName)
			.text("Open In Pokedex");
		pokeObj.find(".type1").val(pokemon.types[0]);
		pokeObj.find(".type2").val(pokemon.types[1]);
		pokeObj.find(".hp .base").val(pokemon.bs.hp);
		var i;
		for (i = 0; i < LEGACY_STATS[gen].length; i++) {
			pokeObj.find("." + LEGACY_STATS[gen][i] + " .base").val(pokemon.bs[LEGACY_STATS[gen][i]]);
		}
		pokeObj.find(".boost").val(0);
		pokeObj.find(".percent-hp").val(100);
		pokeObj.find(".current-hp").removeAttr("data-set");
		pokeObj.find(".status").val("Healthy");
		$(".status").change();
		var moveObj;
		var abilityObj = pokeObj.find(".ability");
		var itemObj = pokeObj.find(".item");
		var set;
		var randset = $("#randoms").prop("checked") ? randdex[pokemonName] : undefined;
		var regSets = pokemonName in setdex && setName in setdex[pokemonName];

		if (randset) {
			var listItems = randdex[pokemonName].items ? randdex[pokemonName].items : [];
			var listAbilities = randdex[pokemonName].abilities ? randdex[pokemonName].abilities : [];
			if (gen >= 3) $(this).closest('.poke-info').find(".ability-pool").show();
			$(this).closest('.poke-info').find(".extraSetAbilities").text(listAbilities.join(', '));
			if (gen >= 2) $(this).closest('.poke-info').find(".item-pool").show();
			$(this).closest('.poke-info').find(".extraSetItems").text(listItems.join(', '));
			if (gen >= 9) {
				$(this).closest('.poke-info').find(".role-pool").show();
				$(this).closest('.poke-info').find(".tera-type-pool").show();
			}
			var listRoles = randdex[pokemonName].roles ? Object.keys(randdex[pokemonName].roles) : [];
			$(this).closest('.poke-info').find(".extraSetRoles").text(listRoles.join(', '));
			var listTeraTypes = [];
			if (randdex[pokemonName].roles) {
				for (var roleName in randdex[pokemonName].roles) {
					var role = randdex[pokemonName].roles[roleName];
					for (var q = 0; q < role.teraTypes.length; q++) {
						if (listTeraTypes.indexOf(role.teraTypes[q]) === -1) {
							listTeraTypes.push(role.teraTypes[q]);
						}
					}
				}
			}
			pokeObj.find(".teraType").val(listTeraTypes[0] || pokemon.types[0]);
			$(this).closest('.poke-info').find(".extraSetTeraTypes").text(listTeraTypes.join(', '));
		} else {
			$(this).closest('.poke-info').find(".ability-pool").hide();
			$(this).closest('.poke-info').find(".item-pool").hide();
			$(this).closest('.poke-info').find(".role-pool").hide();
			$(this).closest('.poke-info').find(".tera-type-pool").hide();
		}
		if (regSets || randset) {
			set = regSets ? correctHiddenPower(setdex[pokemonName][setName]) : randset;
			if (regSets) {
				pokeObj.find(".teraType").val(set.teraType || pokemon.types[0]);
			}
			pokeObj.find(".level").val(resolveSetLevelFlag(set.level, pokeObj.find(".level").val()));
			pokeObj.attr("data-level-flag", typeof set.level === "undefined" ? "" : String(set.level));
			pokeObj.find(".hp .evs").val((set.evs && set.evs.hp !== undefined) ? set.evs.hp : 0);
			pokeObj.find(".hp .ivs").val((set.ivs && set.ivs.hp !== undefined) ? set.ivs.hp : 31);
			pokeObj.find(".hp .dvs").val((set.dvs && set.dvs.hp !== undefined) ? set.dvs.hp : 15);
			for (i = 0; i < LEGACY_STATS[gen].length; i++) {
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .evs").val(
					(set.evs && set.evs[LEGACY_STATS[gen][i]] !== undefined) ?
						set.evs[LEGACY_STATS[gen][i]] : ($("#randoms").prop("checked") ? 84 : 0));
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .ivs").val(
					(set.ivs && set.ivs[LEGACY_STATS[gen][i]] !== undefined) ? set.ivs[LEGACY_STATS[gen][i]] : 31);
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .dvs").val(
					(set.dvs && set.dvs[LEGACY_STATS[gen][i]] !== undefined) ? set.dvs[LEGACY_STATS[gen][i]] : 15);
				var boostKey = legacyStatToStat(LEGACY_STATS[gen][i]);
				var boostValue = 0;
				if (set.boosts && typeof set.boosts === "object") {
					if (set.boosts[boostKey] !== undefined) {
						boostValue = set.boosts[boostKey];
					} else if (set.boosts[LEGACY_STATS[gen][i]] !== undefined) {
						boostValue = set.boosts[LEGACY_STATS[gen][i]];
					}
				}
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .boost").val(boostValue);
			}
			setSelectValueIfValid(pokeObj.find(".nature"), set.nature, "Hardy");
			var abilityFallback = (typeof pokemon.abilities !== "undefined") ? pokemon.abilities[0] : "";
			if ($("#randoms").prop("checked")) {
				setSelectValueIfValid(abilityObj, randset.abilities && randset.abilities[0], abilityFallback);
				setSelectValueIfValid(itemObj, randset.items && randset.items[0], "");
			} else {
				setSelectValueIfValid(abilityObj, set.ability, abilityFallback);
				setSelectValueIfValid(itemObj, set.item, "");
			}
			var setMoves = Array.isArray(set.moves) ? set.moves.slice() : [];
			if (randset) {
				if (gen < 9) {
					setMoves = randset.moves;
				} else {
					setMoves = [];
					for (var role in randset.roles) {
						for (var q = 0; q < randset.roles[role].moves.length; q++) {
							var moveName = randset.roles[role].moves[q];
							if (setMoves.indexOf(moveName) === -1) setMoves.push(moveName);
						}
					}
				}
			}
			for (var sm = 0; sm < setMoves.length; sm++) {
				var setMove = setMoves[sm];
				if (typeof setMove === "string") {
					setMoves[sm] = setMove;
				} else if (setMove && typeof setMove.name === "string") {
					setMoves[sm] = setMove.name;
				} else {
					setMoves[sm] = "(No Move)";
				}
			}
			var moves = randset ? selectMovesFromRandomOptions(setMoves) : setMoves.slice(0, 4);
			while (moves.length < 4) moves.push("(No Move)");
			for (i = 0; i < 4; i++) {
				moveObj = pokeObj.find(".move" + (i + 1) + " select.move-selector");
				moveObj.attr('data-prev', moveObj.val());
				setSelectValueIfValid(moveObj, moves[i], "(No Move)");
				moveObj.change();
			}
			if (randset) {
				$(this).closest('.poke-info').find(".move-pool").show();
				$(this).closest('.poke-info').find(".extraSetMoves").html(formatMovePool(setMoves));
			}
		} else {
			pokeObj.find(".teraType").val(pokemon.types[0]);
			pokeObj.find(".level").val(100);
			pokeObj.attr("data-level-flag", "");
			pokeObj.find(".hp .evs").val(0);
			pokeObj.find(".hp .ivs").val(31);
			pokeObj.find(".hp .dvs").val(15);
			for (i = 0; i < LEGACY_STATS[gen].length; i++) {
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .evs").val(0);
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .ivs").val(31);
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .dvs").val(15);
			}
			pokeObj.find(".nature").val("Hardy");
			setSelectValueIfValid(abilityObj, pokemon.ab, "");
			itemObj.val("");
			for (i = 0; i < 4; i++) {
				moveObj = pokeObj.find(".move" + (i + 1) + " select.move-selector");
				moveObj.attr('data-prev', moveObj.val());
				moveObj.val("(No Move)");
				moveObj.change();
			}
			if ($("#randoms").prop("checked")) {
				$(this).closest('.poke-info').find(".move-pool").hide();
			}
		}
		if (typeof getSelectedTiers === "function") { // doesn't exist when in 1vs1 mode
			var format = getSelectedTiers()[0];
			var is50lvl = startsWith(format, "VGC") || startsWith(format, "Battle Spot");
			//var isDoubles = format === 'Doubles' || has50lvl; *TODO*
			if (format === "LC") pokeObj.find(".level").val(5);
			if (is50lvl) pokeObj.find(".level").val(50);
			//if (isDoubles) field.gameType = 'Doubles'; *TODO*
		}
		var formeObj = currentPokeInfo.find(".forme").parent();
		itemObj.prop("disabled", false);
		var baseForme;
		if (pokemon.baseSpecies && pokemon.baseSpecies !== pokemon.name) {
			baseForme = pokedex[pokemon.baseSpecies];
		}
		var formeSourcePokemon = (baseForme && baseForme.otherFormes) ? baseForme : pokemon;
		var formeBaseName = (baseForme && baseForme.otherFormes) ? pokemon.baseSpecies : pokemonName;
		if (!showFormes(formeObj, pokemonName, formeSourcePokemon, formeBaseName)) {
			// Prevent stale hidden forme values from overriding the top sprite later.
			formeObj.children("select").find("option").remove().end().append(getSelectOptions([pokemonName], false, 0));
			formeObj.hide();
			var topSpriteNode = getTopSpriteNodeForPokeInfo(currentPokeInfo);
			if (topSpriteNode) setTrainerSpriteImage(topSpriteNode, pokemonName);
		}
		calcHP(pokeObj);
		calcStats(pokeObj);
		refreshRelativeSetLevels();
		applySetPreHp(pokeObj, set);
		abilityObj.change();
		itemObj.change();
		applySetStatus(pokeObj, set);
		if ($(this).hasClass('opposing')) {
			syncWeatherForSelection(fullSetName, CURRENT_TRAINER_POKS);
			syncTerrainForSelection(fullSetName, CURRENT_TRAINER_POKS);
		}
		if (pokemon.gender === "N") {
			pokeObj.find(".gender").parent().hide();
			pokeObj.find(".gender").val("");
		} else pokeObj.find(".gender").parent().show();
	}
	syncDittoTransformButtons();
	syncInlinePokeSprite(currentPokeInfo);
	saveLastEncounterSelection();
	window.NO_CALC = false;
});

$(document).on("click", "#transformL", function (ev) {
	ev.preventDefault();
	transformDittoFromOpposing("#p1", "#p2");
});

$(document).on("click", "#transformR", function (ev) {
	ev.preventDefault();
	transformDittoFromOpposing("#p2", "#p1");
});

$(document).on("click", ".poke-inline-sprite", function (ev) {
	ev.preventDefault();
	var pokeInfo = $(this).closest(".poke-info");
	var formeSelect = pokeInfo.find(".forme");
	if (!formeSelect.length) return;
	var formeContainer = formeSelect.parent();
	if (!formeContainer.length || !formeContainer.is(":visible")) return;
	var formeOptions = formeSelect.find("option");
	var enabledFormeOptions = formeOptions.filter(function () {
		return !this.disabled;
	});
	if (enabledFormeOptions.length <= 1) return;
	var currentIndex = formeSelect.prop("selectedIndex");
	if (currentIndex < 0) currentIndex = 0;
	for (var i = 0; i < formeOptions.length; i++) {
		currentIndex = (currentIndex + 1) % formeOptions.length;
		if (!formeOptions.eq(currentIndex).prop("disabled")) {
			formeSelect.prop("selectedIndex", currentIndex).change();
			return;
		}
	}
});

function getBattleCritToggleFromTopToggle(topToggleNode) {
	if (!topToggleNode) return null;
	var topId = String(topToggleNode.id || "");
	var match = /^critTop([LR])([1-4])$/.exec(topId);
	if (!match) return null;
	return document.getElementById("crit" + match[1] + match[2]);
}

function getTopCritToggleFromBattleToggle(battleToggleNode) {
	if (!battleToggleNode) return null;
	var battleId = String(battleToggleNode.id || "");
	var match = /^crit([LR])([1-4])$/.exec(battleId);
	if (!match) return null;
	return document.getElementById("critTop" + match[1] + match[2]);
}

$(document).on("change", "input.top-crit", function () {
	var battleCritToggle = getBattleCritToggleFromTopToggle(this);
	if (!battleCritToggle) return;
	battleCritToggle.checked = this.checked;
	$(battleCritToggle).change();
});

$(document).on("change", ".move-crit", function () {
	var topCritToggle = getTopCritToggleFromBattleToggle(this);
	if (!topCritToggle) return;
	topCritToggle.checked = this.checked;
});

function formatMovePool(moves) {
	var formatted = [];
	for (var i = 0; i < moves.length; i++) {
		formatted.push(isKnownDamagingMove(moves[i]) ? moves[i] : '<i>' + moves[i] + '</i>');
	}
	return formatted.join(', ');
}

function isKnownDamagingMove(move) {
	var m = GENERATION.moves.get(calc.toID(move));
	return m && m.basePower;
}

function selectMovesFromRandomOptions(moves) {
	var selected = [];

	var nonDamaging = [];
	for (var i = 0; i < moves.length; i++) {
		if (isKnownDamagingMove(moves[i])) {
			selected.push(moves[i]);
			if (selected.length >= 4) break;
		} else {
			nonDamaging.push(moves[i]);
		}
	}

	while (selected.length < 4 && nonDamaging.length) {
		selected.push(nonDamaging.pop());
	}

	return selected;
}

function showFormes(formeObj, pokemonName, pokemon, baseFormeName) {
	var formes = [];
	var seenFormeNames = {};
	appendUniqueFormeOption(formes, seenFormeNames, baseFormeName || pokemonName);
	if (pokemon.otherFormes) {
		for (var i = 0; i < pokemon.otherFormes.length; i++) {
			appendUniqueFormeOption(formes, seenFormeNames, pokemon.otherFormes[i]);
		}
	}
	var evolutionLine = getEvolutionLineSpeciesNames(pokemonName, formes);
	if (formes.length + evolutionLine.length <= 1) return false;

	var formeOptions = '';
	for (var i = 0; i < formes.length; i++) {
		formeOptions += '<option value="' + escapeHtml(formes[i]) + '" ' + (formes[i] === pokemonName ? 'selected' : '') + '>' + escapeHtml(formes[i]) + '</option>';
	}
	if (evolutionLine.length) {
		formeOptions += '<option value="" disabled>[ Evo Line ]</option>';
		for (i = 0; i < evolutionLine.length; i++) {
			formeOptions += '<option value="' + escapeHtml(evolutionLine[i]) + '">' + escapeHtml(evolutionLine[i]) + '</option>';
		}
	}
	formeObj.children("select").find("option").remove().end().append(formeOptions).change();
	formeObj.show();
	return true;
}

function setSelectValueIfValid(select, value, fallback) {
	select.val(!value ? fallback : select.children("option[value='" + value + "']").length ? value : fallback);
}

$(".forme").change(function () {
	if ($(this).find("option:selected").prop("disabled")) return;
	var selectedForme = String($(this).val() || "").trim();
	var altForme = pokedex[selectedForme];
	if (!altForme) return;
	var pokeInfo = $(this).closest(".poke-info");
	var container = pokeInfo;
	var fullSetName = container.find("input.set-selector").first().val() || "";
	var parsedSetName = parseSetId(fullSetName);
	var pokemonName = parsedSetName.species;
	var setName = parsedSetName.label;

	var type1Select = container.find(".type1");
	var type2Select = container.find(".type2");
	type1Select.val(altForme.types[0]).trigger("change");
	type2Select.val(altForme.types[1] ? altForme.types[1] : "").trigger("change");
	for (var i = 0; i < LEGACY_STATS[9].length; i++) {
		var baseStat = container.find("." + LEGACY_STATS[9][i]).find(".base");
		baseStat.val(altForme.bs[LEGACY_STATS[9][i]]);
		baseStat.keyup();
	}
	var isRandoms = $("#randoms").prop("checked");
	var pokemonSets = isRandoms ? randdex[pokemonName] : setdex[pokemonName];
	var chosenSet = pokemonSets && pokemonSets[setName];
	var greninjaSet = selectedForme.indexOf("Greninja") !== -1;
	var isAltForme = selectedForme !== pokemonName;
	if (isAltForme && abilities.indexOf(altForme.ab) !== -1 && !greninjaSet) {
		container.find(".ability").val(altForme.ab);
	} else if (greninjaSet) {
		$(this).parent().find(".ability");
	} else if (chosenSet) {
		if (!isRandoms) {
			container.find(".abilities").val(chosenSet.ability);
		} else {
			container.find(".ability").val(chosenSet.abilities[0]);
		}
	}
	container.find(".ability").keyup();

	if (selectedForme.indexOf("-Mega") !== -1 && selectedForme !== "Rayquaza-Mega") {
		container.find(".item").val("").keyup();
	} else {
		container.find(".item").prop("disabled", false);
	}
	pokeInfo.removeAttr("data-transform-species");
	var topSpriteNode = getTopSpriteNodeForPokeInfo(pokeInfo);
	if (topSpriteNode) setTrainerSpriteImage(topSpriteNode, selectedForme);
	syncInlinePokeSprite(pokeInfo);
});

function correctHiddenPower(pokemon) {
	// After Gen 7 bottlecaps means you can have a HP without perfect IVs
	if (gen >= 7) return pokemon;

	// Convert the legacy stats table to a useful one, and also figure out if all are maxed
	var ivs = {};
	var maxed = true;
	for (var i = 0; i <= LEGACY_STATS[9].length; i++) {
		var s = LEGACY_STATS[9][i];
		var iv = ivs[legacyStatToStat(s)] = (pokemon.ivs && pokemon.ivs[s]) || 31;
		if (iv !== 31) maxed = false;
	}

	var expected = calc.Stats.getHiddenPower(GENERATION, ivs);
	for (var i = 0; i < pokemon.moves.length; i++) {
		var m = pokemon.moves[i].match(HIDDEN_POWER_REGEX);
		if (!m) continue;
		// The Pokemon has Hidden Power and is not maxed but the types don't match we don't
		// want to attempt to reconcile the user's IVs so instead just correct the HP type
		if (!maxed && expected.type !== m[1]) {
			pokemon.moves[i] = "Hidden Power " + expected.type;
		} else {
			// Otherwise, use the default preset hidden power IVs that PS would use
			var hpIVs = calc.Stats.getHiddenPowerIVs(GENERATION, m[1]);
			if (!hpIVs) continue; // some impossible type was specified, ignore

			pokemon.ivs = pokemon.ivs || { hp: 31, at: 31, df: 31, sa: 31, sd: 31, sp: 31 };
			pokemon.dvs = pokemon.dvs || { hp: 15, at: 15, df: 15, sa: 15, sd: 15, sp: 15 };
			for (var stat in hpIVs) {
				pokemon.ivs[calc.Stats.shortForm(stat)] = hpIVs[stat];
				pokemon.dvs[calc.Stats.shortForm(stat)] = calc.Stats.IVToDV(hpIVs[stat]);
			}
			if (gen < 3) {
				pokemon.dvs.hp = calc.Stats.getHPDV({
					atk: pokemon.ivs.at,
					def: pokemon.ivs.df,
					spe: pokemon.ivs.sp,
					spc: pokemon.ivs.sa
				});
				pokemon.ivs.hp = calc.Stats.DVToIV(pokemon.dvs.hp);
			}
		}
	}
	return pokemon;
}

function createPokemon(pokeInfo) {
	if (typeof pokeInfo === "string") { // in this case, pokeInfo is the id of an individual setOptions value whose moveset's tier matches the selected tier(s)
		var name = pokeInfo.substring(0, pokeInfo.indexOf(" ("));
		var setName = pokeInfo.substring(pokeInfo.indexOf("(") + 1, pokeInfo.lastIndexOf(")"));
		var isRandoms = $("#randoms").prop("checked");
		var set = isRandoms ? randdex[name] : setdex[name][setName];

		var ivs = {};
		var evs = {};
		for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
			var legacyStat = LEGACY_STATS[gen][i];
			var stat = legacyStatToStat(legacyStat);

			ivs[stat] = (gen >= 3 && set.ivs && typeof set.ivs[legacyStat] !== "undefined") ? set.ivs[legacyStat] : 31;
			evs[stat] = (set.evs && typeof set.evs[legacyStat] !== "undefined") ? set.evs[legacyStat] : 0;
		}
		var moveNames = set.moves;
		if (isRandoms && gen >= 9) {
			moveNames = [];
			for (var role in set.roles) {
				for (var q = 0; q < set.roles[role].moves.length; q++) {
					var moveName = set.roles[role].moves[q];
					if (moveNames.indexOf(moveName) === -1) moveNames.push(moveName);
				}
			}
		}

		var pokemonMoves = [];
		for (var i = 0; i < 4; i++) {
			var moveName = moveNames[i];
			var isCrit = $('.move-crit')[i].checked;
			pokemonMoves.push(new calc.Move(gen, moves[moveName] ? moveName : "(No Move)", { ability: ability, item: item, isCrit: isCrit, }));
		}

		if (isRandoms) {
			pokemonMoves = pokemonMoves.filter(function (move) {
				return move.category !== "Status";
			});
		}

		return new calc.Pokemon(gen, name, {
			level: set.level,
			ability: set.ability,
			abilityOn: true,
			item: set.item && typeof set.item !== "undefined" && (set.item === "Eviolite" || set.item.indexOf("ite") < 0) ? set.item : "",
			nature: set.nature,
			ivs: ivs,
			evs: evs,
			moves: pokemonMoves
		});
	} else {
		var setName = pokeInfo.find("input.set-selector").val();
		var selectedFormeName = getSelectedFormeNameIfVisible(pokeInfo);
		var name;
		if (setName.indexOf("(") === -1) {
			name = selectedFormeName || setName;
		} else {
			var pokemonName = setName.substring(0, setName.indexOf(" ("));
			var pokemonLookupName = resolveSetSpeciesNameForDexLookup(pokemonName);
			var species = pokedex[pokemonLookupName];
			if (!species) {
				name = selectedFormeName || pokemonName;
			} else {
				name = selectedFormeName || pokemonLookupName;
			}
		}

		var baseStats = {};
		var ivs = {};
		var evs = {};
		var boosts = {};
		for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
			var stat = legacyStatToStat(LEGACY_STATS[gen][i]);
			baseStats[stat === 'spc' ? 'spa' : stat] = ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .base").val();
			ivs[stat] = gen > 2 ? ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .ivs").val() : ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .dvs").val() * 2 + 1;
			evs[stat] = ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .evs").val();
			boosts[stat] = ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .boost").val();
		}
		if (gen === 1) baseStats.spd = baseStats.spa;

		var ability = pokeInfo.find(".ability").val() || "";
		var item = getEffectiveItemFromPokeInfo(pokeInfo);
		var protoQuark = (ability === 'Quark Drive' || ability === 'Protosynthesis')
			? (pokeInfo.find(".proto-quark-state").val() || 'auto')
			: undefined;
		var abilityOn = (ability === 'Quark Drive' || ability === 'Protosynthesis')
			? protoQuark !== 'inactive'
			: pokeInfo.find(".abilityToggle").is(":checked");
		var isDynamaxed = pokeInfo.find(".max").prop("checked");
		var teraType = pokeInfo.find(".teraToggle").is(":checked") ? pokeInfo.find(".teraType").val() : undefined;
		pokeInfo.isDynamaxed = isDynamaxed;
		calcHP(pokeInfo);
		var curHP = ~~pokeInfo.find(".current-hp").val();
		// FIXME the Pokemon constructor expects non-dynamaxed HP
		if (isDynamaxed) curHP = Math.floor(curHP / 2);
		var types = [pokeInfo.find(".type1").val(), pokeInfo.find(".type2").val()];
		return new calc.Pokemon(gen, name, {
			level: ~~pokeInfo.find(".level").val(),
			ability: ability,
			abilityOn: abilityOn,
			protoQuark: protoQuark,
			item: item,
			gender: pokeInfo.find(".gender").is(":visible") ? getGender(pokeInfo.find(".gender").val()) : "N",
			nature: pokeInfo.find(".nature").val(),
			ivs: ivs,
			evs: evs,
			isDynamaxed: isDynamaxed,
			isSaltCure: pokeInfo.find(".saltcure").is(":checked"),
			alliesFainted: parseInt(pokeInfo.find(".alliesFainted").val()),
			teraType: teraType,
			boosts: boosts,
			curHP: curHP,
			status: CALC_STATUS[pokeInfo.find(".status").val()],
			toxicCounter: status === 'Badly Poisoned' ? ~~pokeInfo.find(".toxic-counter").val() : 0,
			moves: [
				getMoveDetails(pokeInfo.find(".move1"), name, ability, item, isDynamaxed),
				getMoveDetails(pokeInfo.find(".move2"), name, ability, item, isDynamaxed),
				getMoveDetails(pokeInfo.find(".move3"), name, ability, item, isDynamaxed),
				getMoveDetails(pokeInfo.find(".move4"), name, ability, item, isDynamaxed)
			],
			overrides: {
				baseStats: baseStats,
				types: types
			}
		});
	}
}

function getGender(gender) {
	if (!gender || gender === 'genderless' || gender === 'N') return 'N';
	if (gender.toLowerCase() === 'male' || gender === 'M') return 'M';
	return 'F';
}

function getMoveDetails(moveInfo, species, ability, item, useMax) {
	var moveName = moveInfo.find("select.move-selector").val();
	var isZMove = gen > 6 && moveInfo.find("input.move-z").prop("checked");
	var isCrit = moveInfo.find(".move-crit").prop("checked");
	var hits = +moveInfo.find(".move-hits").val();
	var timesUsed = +moveInfo.find(".stat-drops").val();
	var timesUsedWithMetronome = moveInfo.find(".metronome").is(':visible') ? +moveInfo.find(".metronome").val() : 1;
	var overrides = {
		basePower: +moveInfo.find(".move-bp").val(),
		type: moveInfo.find(".move-type").val()
	};
	if (gen >= 4) overrides.category = moveInfo.find(".move-cat").val();
	return new calc.Move(gen, moveName, {
		ability: ability, item: item, useZ: isZMove, species: species, isCrit: isCrit, hits: hits,
		timesUsed: timesUsed, timesUsedWithMetronome: timesUsedWithMetronome, overrides: overrides, useMax: useMax
	});
}

function getModifiedStatForStage(rawStat, stage) {
	var raw = Math.max(1, ~~rawStat);
	var boost = Math.max(-6, Math.min(6, ~~stage));
	if (boost === 0) return raw;
	if (boost > 0) return Math.floor(raw * (2 + boost) / 2);
	return Math.floor(raw * 2 / (2 - boost));
}

var DISPLAYED_MODIFIER_STAT_ROWS = {
	"at": "atk",
	"df": "def",
	"sa": "spa",
	"sd": "spd",
	"sl": "spa",
	"sp": "spe"
};

function ensureStatTotalModNode(statRow) {
	if (!statRow || !statRow.length) return $();
	var totalModNode = statRow.find(".totalMod").first();
	if (totalModNode.length) return totalModNode;
	statRow.append('<td><span class="totalMod">---</span></td>');
	return statRow.find(".totalMod").last();
}

function getDisplayedModifiedStatValue(pokemon, statKey, preferCalculatedStats) {
	if (!pokemon) return "---";
	var normalizedStat = statKey === "spc" ? "spa" : statKey;
	if (preferCalculatedStats && pokemon.stats && isFinite(pokemon.stats[normalizedStat])) {
		return pokemon.stats[normalizedStat];
	}
	var statSource = pokemon.rawStats || pokemon.stats || {};
	var rawStat = statSource[normalizedStat];
	if (!isFinite(rawStat)) return "---";
	var boostSource = pokemon.boosts || {};
	var boost = boostSource[normalizedStat];
	if (typeof boost === "undefined" && normalizedStat === "spa" && typeof boostSource.spc !== "undefined") {
		boost = boostSource.spc;
	}
	return getModifiedStatForStage(rawStat, boost);
}

function syncDisplayedModifiedStats(pokeInfo, pokemon, preferCalculatedStats) {
	if (!pokeInfo || !pokeInfo.length) return;
	for (var legacyStat in DISPLAYED_MODIFIER_STAT_ROWS) {
		if (!Object.prototype.hasOwnProperty.call(DISPLAYED_MODIFIER_STAT_ROWS, legacyStat)) continue;
		var statRow = pokeInfo.find("." + legacyStat).first();
		if (!statRow.length) continue;
		ensureStatTotalModNode(statRow).text(
			getDisplayedModifiedStatValue(pokemon, DISPLAYED_MODIFIER_STAT_ROWS[legacyStat], preferCalculatedStats)
		);
	}
}

var DEFAULT_CRIT_RATE_BY_STAGE = [
	{num: 1, den: 16},
	{num: 1, den: 8},
	{num: 1, den: 2},
	{num: 1, den: 1}
];
var CRIT_STATUS_RATE_OVERRIDE_BY_SIDE = {
	p1: {},
	p2: {
		0: {num: 1, den: 8},
		1: {num: 1, den: 4}
	}
};

function normalizeCritSpeciesId(rawSpecies) {
	return String(rawSpecies || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getCritStatusFromSetData(setData) {
	if (!setData) return {hasCritStatus: false, critStatus: false};
	var critStatusKeys = ["CritStatus", "critStatus", "critstatus"];
	for (var i = 0; i < critStatusKeys.length; i++) {
		var key = critStatusKeys[i];
		if (!Object.prototype.hasOwnProperty.call(setData, key)) continue;
		return {
			hasCritStatus: true,
			critStatus: isTruthySetFlag(setData[key])
		};
	}
	return {hasCritStatus: false, critStatus: false};
}

function getCritStatusForTrainerEntries(trainerEntries) {
	var foundExplicitFalse = false;
	if (!Array.isArray(trainerEntries)) return {hasCritStatus: false, critStatus: false};
	for (var i = 0; i < trainerEntries.length; i++) {
		var entry = parseTrainerPartyEntry(trainerEntries[i]);
		var critStatus = getCritStatusFromSetData(entry.setData);
		if (!critStatus.hasCritStatus) continue;
		if (critStatus.critStatus) return critStatus;
		foundExplicitFalse = true;
	}
	return {hasCritStatus: foundExplicitFalse, critStatus: false};
}

function isCritStatusActive() {
	var currentTrainerStatus = getCritStatusForTrainerEntries(CURRENT_TRAINER_POKS || []);
	if (currentTrainerStatus.hasCritStatus) return currentTrainerStatus.critStatus;
	var selectedOpposing = String($(".opposing").val() || "");
	if (selectedOpposing) {
		var selectedEntry = parseTrainerPartyEntry(selectedOpposing);
		var selectedStatus = getCritStatusFromSetData(selectedEntry.setData);
		if (selectedStatus.hasCritStatus) return selectedStatus.critStatus;
	}
	return false;
}

function getPassiveCritStageDetails(pokemon) {
	var stage = 0;
	var sources = [];
	if (!pokemon) return {stage: 0, sources: sources};
	if (pokemon.hasAbility && pokemon.hasAbility("Super Luck")) {
		stage += 1;
		sources.push("Super Luck");
	}
	var itemName = String(pokemon.item || "");
	var speciesId = normalizeCritSpeciesId(
		pokemon.name || (pokemon.species && pokemon.species.name) || ""
	);
	if (itemName === "Scope Lens" || itemName === "Razor Claw") {
		stage += 1;
		sources.push(itemName);
	} else if (itemName === "Lucky Punch" && speciesId === "chansey") {
		stage += 2;
		sources.push(itemName);
	} else if ((itemName === "Leek" || itemName === "Stick") &&
		(speciesId === "farfetchd" || speciesId === "sirfetchd")) {
		stage += 2;
		sources.push(itemName);
	}
	return {stage: stage, sources: sources};
}

function getCritChanceForStage(stage, sideId) {
	var normalizedStage = Math.max(0, Math.min(DEFAULT_CRIT_RATE_BY_STAGE.length - 1, ~~stage));
	var overrides = sideId ? CRIT_STATUS_RATE_OVERRIDE_BY_SIDE[sideId] : null;
	if (isCritStatusActive() && overrides && overrides[normalizedStage]) {
		return overrides[normalizedStage];
	}
	return DEFAULT_CRIT_RATE_BY_STAGE[normalizedStage];
}

function formatCritChanceText(chance) {
	var fallbackPercent = 100 / 16;
	if (!chance || !chance.den) {
		return fallbackPercent.toFixed(2).replace(/\.?0+$/, "") + "%";
	}
	var percent = (Number(chance.num || 0) / Number(chance.den)) * 100;
	if (!isFinite(percent)) percent = fallbackPercent;
	return percent.toFixed(2).replace(/\.?0+$/, "") + "%";
}

function getCritBlockerAbilityName(pokemon) {
	if (!pokemon || !pokemon.hasAbility) return "";
	var blockers = ["Battle Armor", "Shell Armor"];
	if (gen >= 5) blockers.push("Magma Armor");
	if (gen >= 7) blockers.push("Leaf Guard");
	return pokemon.hasAbility.apply(pokemon, blockers) ? String(pokemon.ability || blockers[0]) : "";
}

function hasResidualDisplayType(pokemon) {
	if (!pokemon) return false;
	var types = Array.prototype.slice.call(arguments, 1);
	if (pokemon.teraType) return types.indexOf(pokemon.teraType) !== -1;
	return pokemon.hasType ? pokemon.hasType.apply(pokemon, types) : false;
}

function isResidualDisplayGrounded(pokemon, field) {
	if (!pokemon || !field) return false;
	if (field.isGravity) return true;
	if (pokemon.teraType) return pokemon.teraType !== "Flying" &&
		!pokemon.hasAbility("Levitate") &&
		!pokemon.hasItem("Air Balloon");
	return !pokemon.hasType("Flying") &&
		!pokemon.hasAbility("Levitate") &&
		!pokemon.hasItem("Air Balloon");
}

function getMoveCritRateDisplay(pokemon, opposingPokemon, move, sideId) {
	if (!move || move.name === "(No Move)") {
		return {text: "--", title: "No move selected."};
	}
	if (move.category === "Status") {
		return {text: "--", title: move.name + " is a status move and cannot crit."};
	}
	var passiveDetails = getPassiveCritStageDetails(pokemon);
	var totalStage = passiveDetails.stage;
	var sources = passiveDetails.sources.slice();
	var moveCritStage = Math.max(0, ((move.critRatio || 1) - 1));
	if (moveCritStage) {
		totalStage += moveCritStage;
		sources.push(move.name);
	}
	var chance = getCritChanceForStage(totalStage, sideId);
	var chanceText = formatCritChanceText(chance);
	var title = "Current crit chance: " + chanceText + " (stage " + totalStage + ")";
	if (sources.length) title += " via " + sources.join(", ");
	if (isCritStatusActive() && sideId === "p2" && totalStage <= 1) {
		title += ". CritStatus active.";
	}
	var blockedBy = getCritBlockerAbilityName(opposingPokemon);
	if (blockedBy) {
		return {
			text: "0%",
			title: "Critical hits are blocked by " + blockedBy + "."
		};
	}
	if (move.willCrit) {
		return {
			text: "100%",
			title: move.name + " always crits."
		};
	}
	if (gen >= 7 &&
		pokemon && pokemon.hasAbility && pokemon.hasAbility("Merciless") &&
		opposingPokemon && opposingPokemon.hasStatus && opposingPokemon.hasStatus("psn", "tox")) {
		return {
			text: "100%",
			title: "Guaranteed critical hit via Merciless against a poisoned target."
		};
	}
	if (move.isCrit) {
		return {
			text: "100%",
			title: "Critical hit forced for the current calculation. Base chance: " + chanceText +
				" (stage " + totalStage + ")" + (sources.length ? " via " + sources.join(", ") : "") +
				(isCritStatusActive() && sideId === "p2" && totalStage <= 1 ? ". CritStatus active." : "")
		};
	}
	return {
		text: chanceText,
		title: title
	};
}

function getSelectedPokeInfoStatus(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return "Healthy";
	return String(pokeInfo.find(".status").val() || "Healthy");
}

function getSelectedPokeInfoToxicCounter(pokeInfo) {
	if (!pokeInfo || !pokeInfo.length) return 1;
	var toxicCounter = parseInt(pokeInfo.find(".toxic-counter").val(), 10);
	return Number.isNaN(toxicCounter) || toxicCounter < 1 ? 1 : toxicCounter;
}

function getSideResidualChipDisplay(pokeInfo, pokemon, opposingPokemon, field) {
	if (!pokeInfo || !pokeInfo.length || !pokemon || !field || typeof pokemon.maxHP !== "function") {
		return {text: "", title: ""};
	}
	var maxHP = pokemon.maxHP();
	if (!maxHP || maxHP <= 0) return {text: "", title: ""};
	var hpDelta = 0;
	var sources = [];
	var statusValue = getSelectedPokeInfoStatus(pokeInfo);
	var itemEffectsSuppressed = !!(field && field.isMagicRoom) || pokemon.hasAbility("Klutz");
	if (field.hasWeather("Sun", "Harsh Sunshine")) {
		if (pokemon.hasAbility("Dry Skin", "Solar Power")) {
			hpDelta -= Math.floor(maxHP / 8);
			sources.push(String(pokemon.ability || "Weather") + " damage");
		}
	} else if (field.hasWeather("Rain", "Heavy Rain")) {
		if (pokemon.hasAbility("Dry Skin")) {
			hpDelta += Math.floor(maxHP / 8);
			sources.push("Dry Skin recovery");
		} else if (pokemon.hasAbility("Rain Dish")) {
			hpDelta += Math.floor(maxHP / 16);
			sources.push("Rain Dish recovery");
		}
	} else if (field.hasWeather("Sand")) {
		if (!hasResidualDisplayType(pokemon, "Rock", "Ground", "Steel") &&
			!pokemon.hasAbility("Magic Guard", "Overcoat", "Sand Force", "Sand Rush", "Sand Veil") &&
			!pokemon.hasItem("Safety Goggles")) {
			hpDelta -= Math.floor(maxHP / (gen === 2 ? 8 : 16));
			sources.push("sandstorm damage");
		}
	} else if (field.hasWeather("Hail", "Snow")) {
		if (pokemon.hasAbility("Ice Body")) {
			hpDelta += Math.floor(maxHP / 16);
			sources.push("Ice Body recovery");
		} else if (!hasResidualDisplayType(pokemon, "Ice") &&
			!pokemon.hasAbility("Magic Guard", "Overcoat", "Snow Cloak") &&
			!pokemon.hasItem("Safety Goggles") &&
			field.hasWeather("Hail")) {
			hpDelta -= Math.floor(maxHP / 16);
			sources.push("hail damage");
		}
	}
	if (pokemon.hasItem("Leftovers") && !itemEffectsSuppressed) {
		hpDelta += Math.floor(maxHP / 16);
		sources.push("Leftovers recovery");
	} else if (pokemon.hasItem("Black Sludge") && !itemEffectsSuppressed) {
		if (hasResidualDisplayType(pokemon, "Poison")) {
			hpDelta += Math.floor(maxHP / 16);
			sources.push("Black Sludge recovery");
		} else if (!pokemon.hasAbility("Magic Guard")) {
			hpDelta -= Math.floor(maxHP / 8);
			sources.push("Black Sludge damage");
		}
	} else if (pokemon.hasItem("Sticky Barb") && !itemEffectsSuppressed && !pokemon.hasAbility("Magic Guard")) {
		hpDelta -= Math.floor(maxHP / 8);
		sources.push("Sticky Barb damage");
	}
	if (field.attackerSide && field.attackerSide.isSeeded && !pokemon.hasAbility("Magic Guard")) {
		hpDelta -= Math.floor(maxHP / (gen >= 2 ? 8 : 16));
		sources.push("Leech Seed damage");
	}
	if (field.defenderSide && field.defenderSide.isSeeded &&
		opposingPokemon && typeof opposingPokemon.maxHP === "function" &&
		!opposingPokemon.hasAbility("Magic Guard")) {
		var leechSeedAmount = Math.floor(opposingPokemon.maxHP() / (gen >= 2 ? 8 : 16));
		var hasBigRoot = !itemEffectsSuppressed && pokemon.hasItem && pokemon.hasItem("Big Root");
		if (hasBigRoot) leechSeedAmount = Math.floor(leechSeedAmount * 1.3);
		if (opposingPokemon.hasAbility("Liquid Ooze")) {
			if (!pokemon.hasAbility("Magic Guard")) {
				hpDelta -= leechSeedAmount;
				sources.push(hasBigRoot ? "Liquid Ooze damage (Big Root)" : "Liquid Ooze damage");
			}
		} else {
			hpDelta += leechSeedAmount;
			sources.push(hasBigRoot ? "Leech Seed recovery (Big Root)" : "Leech Seed recovery");
		}
	}
	if (field.hasTerrain("Grassy") && isResidualDisplayGrounded(pokemon, field)) {
		hpDelta += Math.floor(maxHP / 16);
		sources.push("Grassy Terrain recovery");
	}
	if (statusValue === "Poisoned") {
		if (pokemon.hasAbility("Poison Heal")) {
			hpDelta += Math.floor(maxHP / 8);
			sources.push("Poison Heal");
		} else if (!pokemon.hasAbility("Magic Guard")) {
			hpDelta -= Math.floor(maxHP / (gen === 1 ? 16 : 8));
			sources.push("poison damage");
		}
	} else if (statusValue === "Badly Poisoned") {
		if (pokemon.hasAbility("Poison Heal")) {
			hpDelta += Math.floor(maxHP / 8);
			sources.push("Poison Heal");
		} else if (!pokemon.hasAbility("Magic Guard")) {
			hpDelta -= Math.floor((getSelectedPokeInfoToxicCounter(pokeInfo) * maxHP) / 16);
			sources.push("toxic damage");
		}
	} else if (statusValue === "Burned" || statusValue === "Frostbite") {
		if (statusValue === "Burned" && pokemon.hasAbility("Heatproof")) {
			hpDelta -= Math.floor(maxHP / (gen > 6 ? 32 : 16));
			sources.push("reduced burn damage");
		} else if (!pokemon.hasAbility("Magic Guard")) {
			hpDelta -= Math.floor(maxHP / (gen === 1 || gen > 6 ? 16 : 8));
			sources.push(statusValue === "Frostbite" ? "frostbite damage" : "burn damage");
		}
	}
	if ((statusValue === "Asleep" || pokemon.hasAbility("Comatose")) &&
		opposingPokemon && opposingPokemon.hasAbility && opposingPokemon.hasAbility("Bad Dreams") &&
		!pokemon.hasAbility("Magic Guard")) {
		hpDelta -= Math.floor(maxHP / 8);
		sources.push("Bad Dreams");
	}
	if (pokemon.isSaltCure && !pokemon.hasAbility("Magic Guard")) {
		hpDelta -= Math.floor(maxHP / (hasResidualDisplayType(pokemon, "Water", "Steel") ? 4 : 8));
		sources.push("Salt Cure");
	}
	if (!pokemon.hasAbility("Magic Guard") && field.attackerSide) {
		if (!hasResidualDisplayType(pokemon, "Grass") && field.attackerSide.vinelash) {
			hpDelta -= Math.floor(maxHP / 6);
			sources.push("Vine Lash damage");
		}
		if (!hasResidualDisplayType(pokemon, "Fire") && field.attackerSide.wildfire) {
			hpDelta -= Math.floor(maxHP / 6);
			sources.push("Wildfire damage");
		}
		if (!hasResidualDisplayType(pokemon, "Water") && field.attackerSide.cannonade) {
			hpDelta -= Math.floor(maxHP / 6);
			sources.push("Cannonade damage");
		}
		if (!hasResidualDisplayType(pokemon, "Rock") && field.attackerSide.volcalith) {
			hpDelta -= Math.floor(maxHP / 6);
			sources.push("Volcalith damage");
		}
	}
	if (!hpDelta) return {text: "", title: ""};
	return {
		text: (hpDelta > 0 ? "+" : "") + hpDelta + " per turn",
		title: sources.join(", ")
	};
}

function renderSideSupplementalDisplays(sideSelector, pokemon, opposingPokemon, field) {
	var pokeInfo = $(sideSelector);
	if (!pokeInfo.length) return;
	var sideId = String(pokeInfo.attr("id") || "");
	for (var moveIndex = 0; moveIndex < 4; moveIndex++) {
		var move = pokemon && pokemon.moves ? pokemon.moves[moveIndex] : null;
		var critDisplay = getMoveCritRateDisplay(pokemon, opposingPokemon, move, sideId);
		var critTargets = $();
		var moveRow = pokeInfo.find(".move" + (moveIndex + 1)).first();
		if (moveRow.length) critTargets = critTargets.add(moveRow.find(".move-crit-rate-display"));
		critTargets = critTargets.add(
			pokeInfo.find('.simplified-side-move-row[data-move-index="' + moveIndex + '"] .move-crit-rate-display')
		);
		critTargets.text(critDisplay.text).attr("title", critDisplay.title);
	}
	var residualChips = pokeInfo.find(".side-residual-chip");
	if (!residualChips.length) return;
	var chipDisplay = getSideResidualChipDisplay(pokeInfo, pokemon, opposingPokemon, field);
	if (chipDisplay.text) {
		residualChips.text(chipDisplay.text);
		residualChips.attr("title", chipDisplay.title || "Expected end-of-turn HP swing");
		residualChips.prop("hidden", false).show();
	} else {
		residualChips.text("");
		residualChips.removeAttr("title");
		residualChips.prop("hidden", true).hide();
	}
}

function applyPowerSplitToPair(p1, p2) {
	if (!p1 || !p2) return;
	var isPowerSplitActive = $("#powerSplitL").prop("checked") || $("#powerSplitR").prop("checked");
	if (!isPowerSplitActive) return;

	var avgAtk = Math.floor((p1.rawStats.atk + p2.rawStats.atk) / 2);
	var avgSpa = Math.floor((p1.rawStats.spa + p2.rawStats.spa) / 2);
	p1.rawStats.atk = avgAtk;
	p2.rawStats.atk = avgAtk;
	p1.rawStats.spa = avgSpa;
	p2.rawStats.spa = avgSpa;
	p1.stats.atk = getModifiedStatForStage(avgAtk, p1.boosts.atk);
	p2.stats.atk = getModifiedStatForStage(avgAtk, p2.boosts.atk);
	p1.stats.spa = getModifiedStatForStage(avgSpa, p1.boosts.spa);
	p2.stats.spa = getModifiedStatForStage(avgSpa, p2.boosts.spa);
}

function createField() {
	var gameType = $("input:radio[name='format']:checked").val();
	var isBeadsOfRuin = $("#beads").prop("checked");
	var isTabletsOfRuin = $("#tablets").prop("checked");
	var isSwordOfRuin = $("#sword").prop("checked");
	var isVesselOfRuin = $("#vessel").prop("checked");
	var isMagicRoom = $("#magicroom").prop("checked");
	var isTrickRoom = $("#trickroom").prop("checked") || $("#trickRoomR").prop("checked");
	var isWonderRoom = $("#wonderroom").prop("checked");
	var isGravity = $("#gravity").prop("checked");
	var isInverse = $("#inverse").prop("checked");
	var isSR = [$("#srL").prop("checked"), $("#srR").prop("checked")];
	var weather;
	var spikes;
	if (gen === 2) {
		spikes = [$("#gscSpikesL").prop("checked") ? 1 : 0, $("#gscSpikesR").prop("checked") ? 1 : 0];
		weather = $("input:radio[name='gscWeather']:checked").val();
	} else {
		weather = $("input:radio[name='weather']:checked").val();
		spikes = [~~$("input:radio[name='spikesL']:checked").val(), ~~$("input:radio[name='spikesR']:checked").val()];
	}
	var steelsurge = [$("#steelsurgeL").prop("checked"), $("#steelsurgeR").prop("checked")];
	var vinelash = [$("#vinelashL").prop("checked"), $("#vinelashR").prop("checked")];
	var wildfire = [$("#wildfireL").prop("checked"), $("#wildfireR").prop("checked")];
	var cannonade = [$("#cannonadeL").prop("checked"), $("#cannonadeR").prop("checked")];
	var volcalith = [$("#volcalithL").prop("checked"), $("#volcalithR").prop("checked")];
	var terrain = ($("input:checkbox[name='terrain']:checked").val()) ? $("input:checkbox[name='terrain']:checked").val() : "";
	applyFieldEnvironmentTheme(weather, terrain);
	var isReflect = [$("#reflectL").prop("checked"), $("#reflectR").prop("checked")];
	var isLightScreen = [$("#lightScreenL").prop("checked"), $("#lightScreenR").prop("checked")];
	var isProtected = [$("#protectL").prop("checked"), $("#protectR").prop("checked")];
	var isSeeded = [$("#leechSeedL").prop("checked"), $("#leechSeedR").prop("checked")];
	var isForesight = [$("#foresightL").prop("checked"), $("#foresightR").prop("checked")];
	var isHelpingHand = [$("#helpingHandL").prop("checked"), $("#helpingHandR").prop("checked")];
	var isTailwind = [$("#tailwindL").prop("checked"), $("#tailwindR").prop("checked")];
	var isFlowerGift = [$("#flowerGiftL").prop("checked"), $("#flowerGiftR").prop("checked")];
	var isFriendGuard = [$("#friendGuardL").prop("checked"), $("#friendGuardR").prop("checked")];
	var isAuroraVeil = [$("#auroraVeilL").prop("checked"), $("#auroraVeilR").prop("checked")];
	var isBattery = [$("#batteryL").prop("checked"), $("#batteryR").prop("checked")];
	var isPowerSpot = [$("#powerSpotL").prop("checked"), $("#powerSpotR").prop("checked")];
	// TODO: support switching in as well!
	var isSwitchingOut = [$("#switchingL").prop("checked"), $("#switchingR").prop("checked")];

	var createSide = function (i) {
		return new calc.Side({
			spikes: spikes[i], isSR: isSR[i], steelsurge: steelsurge[i],
			vinelash: vinelash[i], wildfire: wildfire[i], cannonade: cannonade[i], volcalith: volcalith[i],
			isReflect: isReflect[i], isLightScreen: isLightScreen[i],
			isProtected: isProtected[i], isSeeded: isSeeded[i], isForesight: isForesight[i],
			isTailwind: isTailwind[i], isHelpingHand: isHelpingHand[i], isFlowerGift: isFlowerGift[i], isFriendGuard: isFriendGuard[i],
			isAuroraVeil: isAuroraVeil[i], isBattery: isBattery[i], isPowerSpot: isPowerSpot[i], isPlayer: i === 0,
			isSwitching: isSwitchingOut[i] ? 'out' : undefined
		});
	};
	return new calc.Field({
		gameType: gameType, weather: weather, terrain: terrain,
		isMagicRoom: isMagicRoom, isTrickRoom: isTrickRoom, isWonderRoom: isWonderRoom, isGravity: isGravity, isInverse: isInverse,
		isBeadsOfRuin: isBeadsOfRuin, isTabletsOfRuin: isTabletsOfRuin,
		isSwordOfRuin: isSwordOfRuin, isVesselOfRuin: isVesselOfRuin,
		attackerSide: createSide(0), defenderSide: createSide(1)
	});
}

var FIELD_WEATHER_THEME_CLASSES = "field-weather-none field-weather-sun field-weather-rain field-weather-sand field-weather-snow field-weather-hail field-weather-fog";
var FIELD_TERRAIN_THEME_CLASSES = "field-terrain-none field-terrain-electric field-terrain-grassy field-terrain-misty field-terrain-psychic";

function getFieldWeatherThemeKey(weatherValue) {
	var normalized = String(weatherValue || "").trim();
	switch (normalized) {
		case "Sun":
		case "Harsh Sunshine":
			return "sun";
		case "Rain":
		case "Heavy Rain":
			return "rain";
		case "Sand":
			return "sand";
		case "Snow":
			return "snow";
		case "Hail":
			return "hail";
		case "Fog":
		case "Strong Winds":
			return "fog";
		default:
			return "none";
	}
}

function getFieldTerrainThemeKey(terrainValue) {
	var normalized = String(terrainValue || "").trim();
	switch (normalized) {
		case "Electric":
			return "electric";
		case "Grassy":
			return "grassy";
		case "Misty":
			return "misty";
		case "Psychic":
			return "psychic";
		default:
			return "none";
	}
}

function applyFieldEnvironmentTheme(weatherValue, terrainValue) {
	var fieldInfo = $(".field-info");
	if (!fieldInfo.length) return;
	var weatherKey = getFieldWeatherThemeKey(weatherValue);
	var terrainKey = getFieldTerrainThemeKey(terrainValue);
	fieldInfo
		.removeClass(FIELD_WEATHER_THEME_CLASSES + " " + FIELD_TERRAIN_THEME_CLASSES)
		.addClass("field-weather-" + weatherKey)
		.addClass("field-terrain-" + terrainKey);
}

function applyFieldWeatherTheme(weatherValue) {
	var terrainValue = $("input:checkbox[name='terrain']:checked").val() || "";
	applyFieldEnvironmentTheme(weatherValue, terrainValue);
}

function calcHP(poke) {
	var total = calcStat(poke, "hp");
	var $maxHP = poke.find(".max-hp");

	var prevMaxHP = Number($maxHP.attr('data-prev')) || total;
	var $currentHP = poke.find(".current-hp");
	var prevCurrentHP = $currentHP.attr('data-set') ? Math.min(Number($currentHP.val()), prevMaxHP) : prevMaxHP;
	// NOTE: poke.find(".percent-hp").val() is a rounded value!
	var prevPercentHP = 100 * prevCurrentHP / prevMaxHP;

	$maxHP.text(total);
	$maxHP.attr('data-prev', total);

	var newCurrentHP = calcCurrentHP(poke, total, prevPercentHP);
	calcPercentHP(poke, total, newCurrentHP);

	$currentHP.attr('data-set', true);
}

function calcStat(poke, StatID) {
	var stat = poke.find("." + StatID);
	var base = ~~stat.find(".base").val();
	var level = ~~poke.find(".level").val();
	var nature, ivs, evs;
	if (gen < 3) {
		ivs = ~~stat.find(".dvs").val() * 2;
		evs = 252;
	} else {
		ivs = ~~stat.find(".ivs").val();
		evs = ~~stat.find(".evs").val();
		if (StatID !== "hp") nature = poke.find(".nature").val();
	}
	// Shedinja still has 1 max HP during the effect even if its Dynamax Level is maxed (DaWoblefet)
	var total = calc.calcStat(gen, legacyStatToStat(StatID), base, ivs, evs, level, nature);
	if (gen > 7 && StatID === "hp" && poke.isDynamaxed && total !== 1) {
		total *= 2;
	}
	var totalDisplay = stat.find(".total");
	totalDisplay.text(total);
	totalDisplay.removeClass("nature-boost nature-drop");
	if (gen >= 3 && StatID !== "hp") {
		var natureEffect = NATURE_EFFECTS[nature];
		if (natureEffect && natureEffect.plus !== natureEffect.minus) {
			if (natureEffect.plus === StatID) totalDisplay.addClass("nature-boost");
			if (natureEffect.minus === StatID) totalDisplay.addClass("nature-drop");
		}
	}
	return total;
}

var GENERATION = {
	'1': 1, 'rb': 1, 'rby': 1,
	'2': 2, 'gs': 2, 'gsc': 2,
	'3': 3, 'rs': 3, 'rse': 3, 'frlg': 3, 'adv': 3,
	'4': 4, 'dp': 4, 'dpp': 4, 'hgss': 4,
	'5': 5, 'bw': 5, 'bw2': 5, 'b2w2': 5,
	'6': 6, 'xy': 6, 'oras': 6,
	'7': 7, 'sm': 7, 'usm': 7, 'usum': 7,
	'8': 8, 'ss': 8,
	'9': 9, 'sv': 9
};

var SETDEX = [
	{},
	typeof SETDEX_RBY === 'undefined' ? {} : SETDEX_RBY,
	typeof SETDEX_GSC === 'undefined' ? {} : SETDEX_GSC,
	typeof SETDEX_ADV === 'undefined' ? {} : SETDEX_ADV,
	typeof SETDEX_DPP === 'undefined' ? {} : SETDEX_DPP,
	typeof SETDEX_BW === 'undefined' ? {} : SETDEX_BW,
	typeof SETDEX_XY === 'undefined' ? {} : SETDEX_XY,
	typeof SETDEX_SM === 'undefined' ? {} : SETDEX_SM,
	typeof SETDEX_SS === 'undefined' ? {} : SETDEX_SS,
	typeof SETDEX_SV === 'undefined' ? {} : SETDEX_SV,
];
var RANDDEX = [
	{},
	typeof GEN1RANDOMBATTLE === 'undefined' ? {} : GEN1RANDOMBATTLE,
	typeof GEN2RANDOMBATTLE === 'undefined' ? {} : GEN2RANDOMBATTLE,
	typeof GEN3RANDOMBATTLE === 'undefined' ? {} : GEN3RANDOMBATTLE,
	typeof GEN4RANDOMBATTLE === 'undefined' ? {} : GEN4RANDOMBATTLE,
	typeof GEN5RANDOMBATTLE === 'undefined' ? {} : GEN5RANDOMBATTLE,
	typeof GEN6RANDOMBATTLE === 'undefined' ? {} : GEN6RANDOMBATTLE,
	typeof GEN7RANDOMBATTLE === 'undefined' ? {} : GEN7RANDOMBATTLE,
	typeof GEN8RANDOMBATTLE === 'undefined' ? {} : GEN8RANDOMBATTLE,
	typeof GEN9RANDOMBATTLE === 'undefined' ? {} : GEN9RANDOMBATTLE,
];
var gen, genWasChanged, notation, pokedex, setdex, randdex, typeChart, moves, abilities, items, calcHP, calcStat, GENERATION;

TR_NAMES = get_trainer_names()

$(".gen").change(function () {
	/*eslint-disable */
	gen = ~~$(this).val() || 9;
	GENERATION = calc.Generations.get(gen);
	var params = new URLSearchParams(window.location.search);
	if (gen === 9) {
		params.delete('gen');
		params = '' + params;
		if (window.history && window.history.replaceState) {
			window.history.replaceState({}, document.title, window.location.pathname + (params.length ? '?' + params : ''));
		}
	} else {
		//params.set('gen', gen);
		if (window.history && window.history.pushState) {
			params.sort();
			var path = window.location.pathname + params; //removed questionmark here
			window.history.pushState({}, document.title, path);
			gtag('config', 'UA-26211653-3', { 'page_path': path });
		}
	}
	genWasChanged = true;
	/* eslint-enable */
	// declaring these variables with var here makes z moves not work; TODO
	pokedex = calc.SPECIES[gen];
	setdex = SETDEX[gen];
	randdex = RANDDEX[gen];
	typeChart = calc.TYPE_CHART[gen];
	moves = calc.MOVES[gen];
	items = calc.ITEMS[gen];
	abilities = calc.ABILITIES[gen];
	clearField();
	$("#importedSets").prop("checked", false);
	loadDefaultLists();
	$(".gen-specific.g" + gen).show();
	$(".gen-specific").not(".g" + gen).hide();
	var typeOptions = getSelectOptions(Object.keys(typeChart));
	$("select.type1, select.move-type").find("option").remove().end().append(typeOptions);
	$("select.teraType").find("option").remove().end().append(getSelectOptions(Object.keys(typeChart).slice(1)));
	$("select.type2").find("option").remove().end().append("<option value=\"\">(none)</option>" + typeOptions);
	var moveOptions = getSelectOptions(Object.keys(moves), true);
	$("select.move-selector").find("option").remove().end().append(moveOptions);
	var abilityOptions = getSelectOptions(abilities, true);
	$("select.ability").find("option").remove().end().append("<option value=\"\">(other)</option>" + abilityOptions);
	var itemOptions = getSelectOptions(items, true);
	$("select.item").find("option").remove().end().append("<option value=\"\">(none)</option>" + itemOptions);

	var firstValidSet = getFirstValidSetOption();
	if (firstValidSet && firstValidSet.id) {
		if (window.console && typeof window.console.debug === "function") {
			window.console.debug("[AstralCalc] gen change selecting default encounter", {
				firstValidSet: firstValidSet.id
			});
		}
		$(".set-selector").val(firstValidSet.id);
		$(".set-selector").change();
	}
});

function getFirstValidSetOptionFromOptions(sets) {
	// NB: The first set is never valid, so we start searching after it.
	for (var i = 1; i < sets.length; i++) {
		if (sets[i].id && sets[i].id.indexOf('(Blank Set)') === -1) return sets[i];
	}
	return undefined;
}

function getFirstValidSetOption() {
	return getFirstValidSetOptionFromOptions(getSetOptions());
}

$(".notation").change(function () {
	notation = $(this).val();
});

function clearField() {
	$("#singles-format").prop("checked", true);
	$("#clear").prop("checked", true);
	$("#gscClear").prop("checked", true);
	$("#gravity").prop("checked", false);
	$("#srL").prop("checked", false);
	$("#srR").prop("checked", false);
	$("#spikesL0").prop("checked", true);
	$("#spikesR0").prop("checked", true);
	$("#gscSpikesL").prop("checked", false);
	$("#gscSpikesR").prop("checked", false);
	$("#steelsurgeL").prop("checked", false);
	$("#steelsurgeR").prop("checked", false);
	$("#vinelashL").prop("checked", false);
	$("#vinelashR").prop("checked", false);
	$("#wildfireL").prop("checked", false);
	$("#wildfireR").prop("checked", false);
	$("#cannonadeL").prop("checked", false);
	$("#cannonadeR").prop("checked", false);
	$("#volcalithL").prop("checked", false);
	$("#volcalithR").prop("checked", false);
	$("#reflectL").prop("checked", false);
	$("#reflectR").prop("checked", false);
	$("#lightScreenL").prop("checked", false);
	$("#lightScreenR").prop("checked", false);
	$("#protectL").prop("checked", false);
	$("#protectR").prop("checked", false);
	$("#leechSeedL").prop("checked", false);
	$("#leechSeedR").prop("checked", false);
	$("#foresightL").prop("checked", false);
	$("#foresightR").prop("checked", false);
	$("#helpingHandL").prop("checked", false);
	$("#helpingHandR").prop("checked", false);
	$("#tailwindL").prop("checked", false);
	$("#tailwindR").prop("checked", false);
	$("#friendGuardL").prop("checked", false);
	$("#friendGuardR").prop("checked", false);
	$("#auroraVeilL").prop("checked", false);
	$("#auroraVeilR").prop("checked", false);
	$("#batteryL").prop("checked", false);
	$("#batteryR").prop("checked", false);
	$("#powerSplitL").prop("checked", false);
	$("#powerSplitR").prop("checked", false);
	$("#switchingL").prop("checked", false);
	$("#switchingR").prop("checked", false);
	$("#trickroom").prop("checked", false);
	$("#trickRoomR").prop("checked", false);
	$("input:checkbox[name='terrain']").prop("checked", false);
	applyTrainerFieldLocksForCurrentTrainer();
	var weatherValue = gen === 2
		? $("input:radio[name='gscWeather']:checked").val()
		: $("input:radio[name='weather']:checked").val();
	var terrainValue = $("input:checkbox[name='terrain']:checked").val() || "";
	applyFieldEnvironmentTheme(weatherValue, terrainValue);
}

function getSetOptions(sets) {
	var setsHolder = sets;
	if (setsHolder === undefined) {
		setsHolder = pokedex;
	}
	var pokeNames = Object.keys(setsHolder);
	pokeNames.sort();
	var setOptions = [];
	for (var i = 0; i < pokeNames.length; i++) {
		var pokeName = pokeNames[i];
		setOptions.push({
			pokemon: pokeName,
			text: pokeName
		});
		if ($("#randoms").prop("checked")) {
			if (pokeName in randdex) {
				setOptions.push({
					pokemon: pokeName,
					set: 'Randoms Set',
					text: pokeName + " (Randoms)",
					id: pokeName + " (Randoms)"
				});
			}
		} else {
			if (pokeName in setdex) {
				var setNames = Object.keys(setdex[pokeName]);
				for (var j = 0; j < setNames.length; j++) {
					var setName = setNames[j];
					var setData = setdex[pokeName][setName];
					if (!doesSetMatchStarterChoice(pokeName, setName, setData)) continue;
					setOptions.push({
						pokemon: pokeName,
						set: setName,
						text: pokeName + " (" + setName + ")",
						id: pokeName + " (" + setName + ")",
						isCustom: setData.isCustomSet,
						nickname: setData.nickname || ""
					});
				}
			}
			setOptions.push({
				pokemon: pokeName,
				set: "Blank Set",
				text: pokeName + " (Blank Set)",
				id: pokeName + " (Blank Set)"
			});
		}
	}
	return setOptions;
}

function getSelectOptions(arr, sort, defaultOption) {
	if (sort) {
		arr.sort();
	}
	var r = '';
	for (var i = 0; i < arr.length; i++) {
		r += '<option value="' + arr[i] + '" ' + (defaultOption === i ? 'selected' : '') + '>' + arr[i] + '</option>';
	}
	return r;
}
var stickyMoves = (function () {
	var lastClicked = 'resultMoveL1';
	$(".result-move[type='radio']").click(function () {
		if (this.id === lastClicked) {
			$(this).toggleClass("locked-move");
		} else {
			$('.locked-move').removeClass('locked-move');
		}
		lastClicked = this.id;
	});

	return {
		clearStickyMove: function () {
			lastClicked = null;
			$('.locked-move').removeClass('locked-move');
		},
		setSelectedMove: function (slot) {
			lastClicked = slot;
		},
		getSelectedSide: function () {
			if (lastClicked) {
				if (lastClicked.indexOf('resultMoveL') !== -1) {
					return 'p1';
				} else if (lastClicked.indexOf('resultMoveR') !== -1) {
					return 'p2';
				}
			}
			return null;
		}
	};
})();

function isPokeInfoGrounded(pokeInfo) {
	var teraType = pokeInfo.find(".teraToggle").is(":checked") ? pokeInfo.find(".teraType").val() : undefined;
	return $("#gravity").prop("checked") || (
		teraType ? teraType !== "Flying" : pokeInfo.find(".type1").val() !== "Flying" &&
			teraType ? teraType !== "Flying" : pokeInfo.find(".type2").val() !== "Flying" &&
			pokeInfo.find(".ability").val() !== "Levitate" &&
		getEffectiveItemFromPokeInfo(pokeInfo) !== "Air Balloon"
	);
}

function getTerrainEffects() {
	var className = String($(this).prop("className") || "").split(/\s+/)[0];
	switch (className) {
		case "type1":
		case "type2":
		case "teraType":
		case "teraToggle":
		case "item":
			var id = $(this).closest(".poke-info").prop("id");
			var terrainValue = $("input:checkbox[name='terrain']:checked").val();
			if (terrainValue === "Electric") {
				$("#" + id).find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#" + id)));
			} else if (terrainValue === "Misty") {
				$("#" + id).find(".status").prop("disabled", isPokeInfoGrounded($("#" + id)));
			}
			break;
		case "ability":
			// with autoset, ability change may cause terrain change, need to consider both sides
			var terrainValue = $("input:checkbox[name='terrain']:checked").val();
			if (terrainValue === "Electric") {
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
				$("#p1").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else if (terrainValue === "Misty") {
				$("#p1").find(".status").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find(".status").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else {
				$("#p1").find("[value='Asleep']").prop("disabled", false);
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find("[value='Asleep']").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
			}
			break;
		default:
			if (!$(this).is("input:checkbox[name='terrain']")) {
				break;
			}
			$("input:checkbox[name='terrain']").not(this).prop("checked", false);
			if ($(this).prop("checked") && $(this).val() === "Electric") {
				// need to enable status because it may be disabled by Misty Terrain before.
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
				$("#p1").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else if ($(this).prop("checked") && $(this).val() === "Misty") {
				$("#p1").find(".status").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find(".status").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else {
				$("#p1").find("[value='Asleep']").prop("disabled", false);
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find("[value='Asleep']").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
			}
			break;
	}
	var weatherValue = gen === 2
		? $("input:radio[name='gscWeather']:checked").val()
		: $("input:radio[name='weather']:checked").val();
	var activeTerrain = $("input:checkbox[name='terrain']:checked").val() || "";
	applyFieldEnvironmentTheme(weatherValue, activeTerrain);
}

function doesSetOptionMatchSearchTerms(option, terms) {
	if (!terms || !terms.length) return true;
	var pokeName = String((option && option.pokemon) || "").toUpperCase();
	var setName = String((option && option.set) || "").toUpperCase();
	var optionText = String((option && option.text) || "").toUpperCase();
	return terms.every(function (term) {
		return pokeName.indexOf(term) === 0 ||
			pokeName.indexOf("-" + term) >= 0 ||
			pokeName.indexOf(" " + term) >= 0 ||
			setName.indexOf(term) === 0 ||
			setName.indexOf("-" + term) >= 0 ||
			setName.indexOf(" " + term) >= 0 ||
			optionText.indexOf(term) >= 0;
	});
}

function loadDefaultLists() {
	var initialOptions = getSetOptions();
	var initialDefaultOption = getFirstValidSetOptionFromOptions(initialOptions);
	$(".set-selector").select2({
		formatResult: function (object) {
			if ($("#randoms").prop("checked")) {
				return getDisplaySpeciesName(object.pokemon);
			} else {
				return object.set
					? ("&nbsp;&nbsp;&nbsp;" + formatSetNameForDisplay(object.id || object.text || ""))
					: ("<b>" + getDisplaySpeciesName(object.text) + "</b>");
			}
		},
		formatSelection: function (object) {
			if (!object) return "";
			return formatSetNameForDisplay(object.id || object.text || "");
		},
		query: function (query) {
			var pageSize = 30;
			var results = [];
			var options = getSetOptions();
			var terms = String(query.term || "").toUpperCase().split(/\s+/).filter(Boolean);
			for (var i = 0; i < options.length; i++) {
				var option = options[i];
				if (doesSetOptionMatchSearchTerms(option, terms)) {
					if ($("#randoms").prop("checked")) {
						if (option.id) results.push(option);
					} else {
						results.push(option);
					}
				}
			}
			query.callback({
				results: results.slice((query.page - 1) * pageSize, query.page * pageSize),
				more: results.length >= query.page * pageSize
			});
		},
		initSelection: function (element, callback) {
			var selectedSetId = String($(element).val() || "").trim();
			var selectedOption = getSetOptionById(selectedSetId, initialOptions);
			callback(selectedOption || initialDefaultOption);
		}
	});
}

function allPokemon(selector) {
	var allSelector = "";
	for (var i = 0; i < $(".poke-info").length; i++) {
		if (i > 0) {
			allSelector += ", ";
		}
		allSelector += "#p" + (i + 1) + " " + selector;
	}
	return allSelector;
}

function loadCustomList(id) {
	var customOptions = getSetOptions();
	$("#" + id + " .set-selector").select2({
		formatResult: function (set) {
			if (set.nickname) return getDisplaySpeciesName(set.pokemon) + " (" + set.nickname + ")";
			return formatSetNameForDisplay(set.id);
		},
		formatSelection: function (set) {
			if (!set) return "";
			return formatSetNameForDisplay(set.id || set.text || "");
		},
		query: function (query) {
			var pageSize = 30;
			var results = [];
			var options = getSetOptions();
			var terms = String(query.term || "").toUpperCase().split(/\s+/).filter(Boolean);
			for (var i = 0; i < options.length; i++) {
				var option = options[i];
				if (option.isCustom && option.set && doesSetOptionMatchSearchTerms(option, terms)) {
					results.push(option);
				}
			}
			query.callback({
				results: results.slice((query.page - 1) * pageSize, query.page * pageSize),
				more: results.length >= query.page * pageSize
			});
		},
		initSelection: function (element, callback) {
			var selectedSetId = String($(element).val() || "").trim();
			var selectedOption = getCustomSetOptionById(selectedSetId, customOptions);
			callback(selectedOption || "");
		}
	});
}

function get_trainer_names() {
	var all_poks = SETDEX_SV
	var trainer_names = []

	for (const [pok_name, poks] of Object.entries(all_poks)) {
		var pok_tr_names = Object.keys(poks)
		for (i in pok_tr_names) {
			var index = (poks[pok_tr_names[i]]["index"])
			var trainer_name = pok_tr_names[i]
			trainer_names.push(`[${index}]${pok_name} (${trainer_name})`)
		}
	}
	return trainer_names
}
function addBoxed(poke) {
	var speciesName = String(poke && poke.name || "").trim();
	if (!speciesName) return;
	var setLabel = String(poke && poke.nameProp || "").trim() || "Custom Set";
	var setId = speciesName + " (" + setLabel + ")";
	var existingSetSprite = $(".trainer-pok.left-side").filter(function () {
		return String($(this).attr("data-id") || "").trim() === setId;
	}).get(0);
	if (existingSetSprite) {
		var keepSprite = existingSetSprite;
		if (!keepSprite.id) keepSprite.id = buildRosterSpriteNodeId(setId);
		keepSprite.dataset.id = setId;
		keepSprite.dataset.species = speciesName;
		setTrainerSpriteImage(keepSprite, speciesName);
		applyPrimaryIconSheetIfNeeded(keepSprite, speciesName);
		scheduleFragSheetRefresh();
		applyPlayerRosterSearchFilter();
		return;
	}
	// Different sets (and different individual Pokemon) of the same species
	// are distinct frag owners. Never repurpose a same-species sprite by
	// silently replacing its data-id.
	var spriteId = buildRosterSpriteNodeId(setId);
	var newPoke = document.createElement("img");
	newPoke.id = spriteId;
	newPoke.className = "trainer-pok left-side";
	newPoke.loading = "lazy";
	newPoke.decoding = "async";
	setTrainerSpriteImage(newPoke, speciesName);
	newPoke.dataset.id = setId;
	newPoke.dataset.species = speciesName;
	newPoke.addEventListener("dragstart", dragstart_handler);
	$('#box-poke-list')[0].appendChild(newPoke)
	applyPrimaryIconSheetIfNeeded(newPoke, speciesName);
	scheduleFragSheetRefresh();
	applyPlayerRosterSearchFilter();
}

function getSrcImgPokemon(poke) {
	//edge case
	if (!poke || !poke.name) {
		return
	}
	return getInitialTrainerSpriteUrlByName(poke.name);
}

function get_trainer_poks(trainer_name) {
	var selectedEntry = parseTrainerPartyEntry(trainer_name);
	if (selectedEntry.setData && !doesSetMatchStarterChoice(selectedEntry.pokemonName, selectedEntry.trainerLabel, selectedEntry.setData)) {
		return [];
	}
	var selectedTrainerLabel = selectedEntry.trainerLabel;
	window.CURRENT_TRAINER = selectedTrainerLabel;
	var matches = [];

	if (hasSetDoubleLayoutMetadata(selectedEntry.setData)) {
		var selectedGroupId = getSetDoubleGroupId(selectedEntry.setData);
		var selectedBattleKey = selectedEntry.trainerBattleKey;
		for (i in TR_NAMES) {
			var candidateEntry = parseTrainerPartyEntry(TR_NAMES[i]);
			if (!candidateEntry.setData) continue;
			if (!doesSetMatchStarterChoice(candidateEntry.pokemonName, candidateEntry.trainerLabel, candidateEntry.setData)) continue;
			if (!hasSetDoubleLayoutMetadata(candidateEntry.setData)) continue;
			if (selectedGroupId) {
				if (getSetDoubleGroupId(candidateEntry.setData) !== selectedGroupId) continue;
			} else if (candidateEntry.trainerBattleKey !== selectedBattleKey) {
				continue;
			}
			matches.push(TR_NAMES[i]);
		}
		if (matches.length) return matches;
	}

	for (i in TR_NAMES) {
		var standardEntry = parseTrainerPartyEntry(TR_NAMES[i]);
		if (standardEntry.setData && !doesSetMatchStarterChoice(standardEntry.pokemonName, standardEntry.trainerLabel, standardEntry.setData)) continue;
		if (TR_NAMES[i].indexOf("(" + selectedTrainerLabel + ")") >= 0) {
			matches.push(TR_NAMES[i]);
		}
	}
	return matches;
}

function topPokemonIcon(fullname, node) {
	var speciesName = parseSetId(fullname).species || String(fullname || "");
	setTrainerSpriteImage(node, speciesName);
	if (node && node.id === "p1mon") syncInlinePokeSprite($("#p1"));
	if (node && node.id === "p2mon") syncInlinePokeSprite($("#p2"));
}

$(document).on('click', '.right-side', function () {
	var set = $(this).attr('data-id');
	topPokemonIcon(set, $("#p2mon")[0])
	$('.opposing').val(set);
	$('.opposing').change();
	$('.opposing .select2-chosen').text(formatSetNameForDisplay(set));
	renderFragSheet();
})

$(document).on("contextmenu", ".trainer-pok.right-side", function (ev) {
	ev.preventDefault();
	var setId = String($(this).attr("data-id") || "").trim();
	if (!setId) return;
	closeFragContextMenu();
	closeOpposingContextMenu();
	setOpposingSetDeadMark(setId, !isOpposingSetMarkedDead(setId));
});

$(document).on('click', '.left-side', function () {
	var set = $(this).attr('data-id');
	topPokemonIcon(set, $("#p1mon")[0])
	$('.player').val(set);
	$('.player').change();
	$('.player .select2-chosen').text(formatSetNameForDisplay(set));
	renderFragSheet();
})

$(document).on("contextmenu", ".trainer-pok.left-side", function (ev) {
	openFragContextMenu(ev, $(this).attr("data-id"), this);
});


//select first mon of the box when loading
function selectFirstMon() {
	var pMons = document.getElementsByClassName("trainer-pok left-side");
	if (!pMons.length) {
		return;
	}
	let set = pMons[0].getAttribute("data-id");
	if (!set) {
		return;
	}
	$('.player').val(set);
	$('.player').change();
	$('.player .select2-chosen').text(formatSetNameForDisplay(set));
}

function selectTrainer(value) {
	localStorage.setItem("lasttimetrainer", value);
	all_poks = SETDEX_SV
	for (const [pok_name, poks] of Object.entries(all_poks)) {
		var pok_tr_names = Object.keys(poks)
		for (i in pok_tr_names) {
			var index = (poks[pok_tr_names[i]]["index"])
			if (!doesSetMatchStarterChoice(pok_name, pok_tr_names[i], poks[pok_tr_names[i]])) continue;
			if (index == value) {
				var set = `${pok_name} (${pok_tr_names[i]})`;
				$('.opposing').val(set);
				$('.opposing').change();
				$('.opposing .select2-chosen').text(formatSetNameForDisplay(set));
				renderFragSheet();
				return;
			}

		}
	}
}

function nextTrainer() {
	var trainerBounds = getCurrentTrainerIndexBounds();
	if (!trainerBounds) return;
	var maxIndex = trainerBounds.max;
	clearOpposingDeadMarks();
	selectTrainer(maxIndex + 1);
}

function previousTrainer() {
	var trainerBounds = getCurrentTrainerIndexBounds();
	if (!trainerBounds) return;
	var minIndex = trainerBounds.min;
	if (minIndex <= 1) return;
	clearOpposingDeadMarks();
	selectTrainer(minIndex - 1);
}

function getCurrentTrainerIndexBounds() {
	var selectedOpposing = String($(".opposing").val() || "").trim();
	var trainerEntries = selectedOpposing ? get_trainer_poks(selectedOpposing) : [];
	if ((!trainerEntries || !trainerEntries.length) && CURRENT_TRAINER_POKS && CURRENT_TRAINER_POKS.length) {
		trainerEntries = CURRENT_TRAINER_POKS.slice();
	}
	if (trainerEntries && trainerEntries.length) {
		CURRENT_TRAINER_POKS = trainerEntries.slice();
	}
	var minIndex = Infinity;
	var maxIndex = -Infinity;
	for (var i = 0; i < trainerEntries.length; i++) {
		var entry = parseTrainerPartyEntry(trainerEntries[i]);
		var index = getTrainerIndexFromSetData(entry.setData);
		if (index <= 0) index = entry.sortIndex || 0;
		if (!index || index <= 0 || Number.isNaN(index)) continue;
		if (index < minIndex) minIndex = index;
		if (index > maxIndex) maxIndex = index;
	}
	if (!Number.isFinite(minIndex) || !Number.isFinite(maxIndex)) {
		var selectedEntry = selectedOpposing ? parseTrainerPartyEntry(selectedOpposing) : null;
		var selectedIndex = selectedEntry ? getTrainerIndexFromSetData(selectedEntry.setData) : 0;
		if (selectedIndex > 0) return {min: selectedIndex, max: selectedIndex};
		return null;
	}
	return {min: minIndex, max: maxIndex};
}

function resetTrainer() {
	if (confirm(`Are you sure you want to reset? This will clear all imported sets and change your current trainer back to Younger Calvin. This cannot be undone.`)){
		captureFragBackupSnapshot("before-reset-trainer", true);
		selectTrainer(1);
		localStorage.removeItem("customsets");
		$(allPokemon("#importedSetsOptions")).hide();
		loadDefaultLists();
		for (let zone of document.getElementsByClassName("dropzone")){
			zone.innerHTML="";
		}
		applyPlayerRosterSearchFilter();
		syncFragRoster({pruneMissing: true, allowEmptyPrune: true});
		renderFragSheet();
	}
	
}

function refreshCurrentTrainerEncounter() {
	var selectedOpposing = $(".opposing").val();
	if (!selectedOpposing) return;
	CURRENT_TRAINER_POKS = get_trainer_poks(selectedOpposing);
	handleTrainerFieldLockTrainerTransition();
	syncBattleFormatForSelection(selectedOpposing, CURRENT_TRAINER_POKS);
	renderOpposingTrainerParties(selectedOpposing);
	syncWeatherForSelection(selectedOpposing, CURRENT_TRAINER_POKS);
	syncTerrainForSelection(selectedOpposing, CURRENT_TRAINER_POKS);
	renderFragSheet();
	if (typeof performCalculations === "function") performCalculations();
}


function HideShowCCSettings(){
	$('#show-cc')[0].toggleAttribute("hidden");
	$('#hide-cc')[0].toggleAttribute("hidden");
	$('#refr-cc')[0].toggleAttribute("hidden");
	$('#info-cc')[0].toggleAttribute("hidden");
	$('#cc-sets')[0].toggleAttribute("hidden");
}

function colorCodeUpdate(){
	var speCheck = document.getElementById("cc-spe-border").checked;
	var ohkoCheck = document.getElementById("cc-ohko-color").checked;
	if (!speCheck && !ohkoCheck){
		return
	}
	if (typeof calculationsColors !== "function") {
		console.error("Color coding is unavailable: calculationsColors is not defined.");
		return;
	}
	var pMons = document.getElementsByClassName("trainer-pok left-side");
	// calculate opposing Pokemon once to reduce repeated work
	var p2;
	try {
		p2 = createPokemon($("#p2"));
	} catch (err) {
		console.error("Color coding failed while reading the opposing Pokemon.", err);
		return;
	}
	for (let i = 0; i < pMons.length; i++) {
		let set = pMons[i].getAttribute("data-id");
		if (!set) {
			continue;
		}
		let idColor;
		try {
			idColor = calculationsColors(set, p2);
		} catch (err) {
			console.error(`Color coding skipped set "${set}" due to a calculation error.`, err);
			continue;
		}
		if (speCheck && ohkoCheck){
			pMons[i].className = `trainer-pok left-side mon-speed-${idColor.speed} mon-dmg-${idColor.code}`;
		}
		else if (speCheck){
			pMons[i].className = `trainer-pok left-side mon-speed-${idColor.speed}`;
		}
		else if (ohkoCheck){
			pMons[i].className = `trainer-pok left-side mon-dmg-${idColor.code}`;
		}
		
		
	}
}
function showColorCodes(){
	HideShowCCSettings();
	colorCodeUpdate();
}

function refreshColorCode(){
	colorCodeUpdate();
}

function hideColorCodes(){
	var pMons = document.getElementsByClassName("trainer-pok left-side");
	for (let i = 0; i < pMons.length; i++) {
		pMons[i].className = "trainer-pok left-side";
	}
	document.getElementById("cc-auto-refr").checked = false;
	HideShowCCSettings();
}

function ensureColorCodesEnabled() {
	var showBtn = document.getElementById("show-cc");
	var autoRefreshToggle = document.getElementById("cc-auto-refr");
	if (autoRefreshToggle) autoRefreshToggle.checked = true;
	if (showBtn && !showBtn.hidden) {
		showColorCodes();
		return;
	}
	colorCodeUpdate();
}

function toggleInfoColorCode(){
	document.getElementById("info-cc-field").toggleAttribute("hidden");
}

function TrashPokemon() {
	var maybeMultiple = document.getElementById("trash-box").getElementsByClassName("trainer-pok");
	if (maybeMultiple.length == 0){
		return; //nothing to delete
	}
	var numberPKM = maybeMultiple.length > 1 ? `${maybeMultiple.length} Pokemon(s)` : "this Pokemon"; 
	var yes = confirm(`do you really want to remove ${numberPKM}?`);
	if (!yes) {
		return;
	}
	captureFragBackupSnapshot("before-trash-remove", true);
	var customSets = safeJsonParse(localStorage.customsets, {});
	var length= maybeMultiple.length;
	for( let i = 0; i<length; i++){
		var pokeTrashed = maybeMultiple[i];
		var name = pokeTrashed.getAttribute("data-id").split(" (")[0];
		delete customSets[name];
	}
	document.getElementById("trash-box").innerHTML="";
	localStorage.setItem("customsets", JSON.stringify(customSets));
	if (typeof updateDex === "function") updateDex(customSets);
	applyPlayerRosterSearchFilter();
	$('#box-poke-list')[0].click();
	//switch to the next pokemon automatically
	
}
function RemoveAllPokemon() {
	document.getEle
}
function allowDrop(ev) {
	ev.preventDefault();
}

var pokeDragged = null;
function dragstart_handler(ev) {
	pokeDragged = getTrainerPokRootNode(ev.target);
}

function drop(ev) {
	ev.preventDefault();
	if (!pokeDragged) return;
	var targetNode = ev.target;
	var targetSprite = targetNode.classList.contains("left-side")
		? targetNode
		: $(targetNode).closest(".trainer-pok.left-side").get(0);
	var targetDropzone = targetNode.classList.contains("dropzone")
		? targetNode
		: $(targetNode).closest(".dropzone").get(0);
	if (targetSprite) {
		var targetRoot = getTrainerPokRootNode(targetSprite);
		if (targetRoot && targetRoot !== pokeDragged) {
			var draggedSprite = getTrainerPokSpriteElement(pokeDragged);
			var targetRootSprite = getTrainerPokSpriteElement(targetRoot);
			var draggedSetId = draggedSprite ? $(draggedSprite).attr("data-id") : "";
			var targetSetId = targetRootSprite ? $(targetRootSprite).attr("data-id") : "";
			if (shouldMergeFragsByEvolutionDrop(draggedSetId, targetSetId) &&
				mergeFragEntriesFromEvolutionDrop(draggedSetId, targetSetId)) {
				if (pokeDragged.parentNode) pokeDragged.parentNode.removeChild(pokeDragged);
				targetNode.classList.remove('over');
				targetRoot.classList.remove('over');
				pokeDragged = null;
				scheduleFragSheetRefresh();
				updateTrainerFragBorderTotals();
				return;
			}
			if (targetRoot.parentNode === pokeDragged.parentNode) {
				var sharedParent = targetRoot.parentNode;
				var draggedNext = pokeDragged.nextSibling;
				var targetNext = targetRoot.nextSibling;
				if (draggedNext === targetRoot) {
					sharedParent.insertBefore(targetRoot, pokeDragged);
				} else if (targetNext === pokeDragged) {
					sharedParent.insertBefore(pokeDragged, targetRoot);
				} else {
					sharedParent.insertBefore(pokeDragged, targetNext);
					sharedParent.insertBefore(targetRoot, draggedNext);
				}
			} else if (targetRoot.parentNode) {
				targetRoot.parentNode.insertBefore(pokeDragged, targetRoot.nextSibling);
			}
		}
	} else if (targetDropzone) {
		if (pokeDragged.parentNode) pokeDragged.parentNode.removeChild(pokeDragged);
		targetDropzone.appendChild(pokeDragged);
	}
	targetNode.classList.remove('over');
	pokeDragged = null;
	scheduleFragSheetRefresh();
	updateTrainerFragBorderTotals();
	applyPlayerRosterSearchFilter();
}

function handleDragEnter(ev) {
	ev.target.classList.add('over');
}

function handleDragLeave(ev) {
	ev.target.classList.remove('over');
}

function SpeedBorderSetsChange(ev){
	var monImgs = document.getElementsByClassName("left-side");
	if (ev.target.checked){
		for (let monImg of monImgs){
			monImg.classList.remove("mon-speed-none")
		}
	}else{
		for (let monImg of monImgs){
			monImg.classList.add("mon-speed-none")
		}
	}
}

function ColorCodeSetsChange(ev){
	var monImgs = document.getElementsByClassName("left-side");
	if (ev.target.checked){
		for (let monImg of monImgs){
			monImg.classList.remove("mon-dmg-none")
		}
	}else{
		for (let monImg of monImgs){
			monImg.classList.add("mon-dmg-none")
		}
	}
}
function setupSideCollapsers(){
	var applyF = (btns) => {
		for (var i = 0; i < btns.length; i++) {
			let btn = btns[i];
			btn.cum = btn.offsetHeight;
			btn.sisterEl = document.getElementsByClassName(btn.getAttribute("data-set"))[0];
			btn.prevEl = btns[i-1] || null;
			if (btn.prevEl){
				btn.cum += btn.prevEl.cum
			}else{
				btn.cum = 0;
			}
			btn.nextEl = btns[i+1] || null;
			btn.onclick = sideCollapsersCorrection
		}
	}
	var leftBtns = document.getElementsByClassName("l-side-button");
	var rigtBtns = document.getElementsByClassName("r-side-button");
	applyF(leftBtns);
	applyF(rigtBtns);
	/*
		readjust the left buttons
		Because i couldn't find a proper way to do it with css
	*/
	for(let btn of leftBtns){
		btn.style.left = "-" + btn.offsetWidth + "px";
	}
	leftBtns[0].onclick();
	rigtBtns[0].onclick();
}
function sideCollapsersCorrection(ev){
	if (ev){
		var arrow = ev.target.children[0] || ev.target.parentNode.children[0];
		collapseArrow(arrow);
	}
	var node = this;
	if (node.tagName != "BUTTON"){
		node = this.target.parentNode;
	}
	var prev = node.prevEl;
	var offset = node.sisterEl.offsetTop;
	var relativeHeight = node.parentNode.offsetTop;
	if(prev){
		//since the position is absolute, this will prevent from eating fellows.
		var prevLowPos = prev.offsetTop + prev.offsetHeight; - relativeHeight ;
		if(offset==0){// collapsed
			offset = prevLowPos;
		}else{// standing
			offset = offset - relativeHeight;
			if (offset < prevLowPos){
				offset = prevLowPos;
			}
		}
	}else{
		if(offset==0){// collapsed
			offset = node.offsetTop;
		}else{// standing
			offset = offset - relativeHeight;
		}
	}
	node.style.top = offset + "px"
	//propagate to next buttons
	if(node.nextEl){
		node.nextEl.onclick()
	}
}
function collapseArrow(arrow){
	var arrBtn = arrow.parentNode;
	var target = arrBtn.getAttribute("data-set");
	for (let div of document.getElementsByClassName(target)){
		div.toggleAttribute("hidden");
	}
	if (arrBtn.classList.contains("l-side-button")){
		if (arrow.classList.contains("arrowdown")){
			arrow.classList.remove("arrowdown");
			arrow.classList.add("arrowright");
		}else{
			arrow.classList.remove("arrowright");
			arrow.classList.add("arrowdown");
		}
	}
	else if (arrBtn.classList.contains("r-side-button")){
		if (arrow.classList.contains("arrowdown")){
			arrow.classList.remove("arrowdown");
			arrow.classList.add("arrowleft");
		}else{
			arrow.classList.remove("arrowleft");
			arrow.classList.add("arrowdown");
		}
	}
}

/* although those two function could be factorised in one, i may think about more in depth 
functionality laters that may involve two separate functions, i will remove this comment if i do*/
function setDoubleIconVisibility(isDoubles) {
	var doubleIcon = document.getElementById("monDouble");
	if (!doubleIcon) return;
	doubleIcon.hidden = !isDoubles;
}

function switchIconSingle(){
	setDoubleIconVisibility(false);
}

function switchIconDouble(){
	setDoubleIconVisibility(true);
}

$(document).ready(function () {
	if (window.console && typeof window.console.info === "function") {
		window.console.info("[AstralCalc] lastencounter-build v5");
	}
	var params = new URLSearchParams(window.location.search);
	var g = GENERATION[params.get('gen')] || 9;
	$("#gen" + g).prop("checked", true);
	$("#gen" + g).change();
	$("#percentage").prop("checked", true);
	$("#percentage").change();
	$("#singles-format").prop("checked", true);
	$("#singles-format").change();
	moveMetaVisible = !!getAppSettings().moveMeta;
	setMoveMetaVisibility(moveMetaVisible);
	loadMoveInfoLookup();
	setDoubleIconVisibility(false);
	bindAstralDexLinks();
	bindCalcToolEvents();
	trainerFieldLockActiveTrainerKey = getCurrentTrainerFieldLockKey();
	syncTrainerFieldLockButtonStyles();
	bindPlayerRosterSearchInput();
	ensureFragHistoryControls();
	bindAeLuaFragImportControls();
	bindFieldSideControlsToggle();
	loadDefaultLists();
	setupFragSheetAutoRefresh();
	syncSettingsPanelUi();
	syncFragRoster();
	renderFragSheet();
	$("select.move-selector").select2({
		dropdownAutoWidth: true,
		matcher: function (term, text) {
			// 2nd condition is for Hidden Power
			return text.toUpperCase().indexOf(term.toUpperCase()) === 0 || text.toUpperCase().indexOf(" " + term.toUpperCase()) >= 0;
		}
	});
	try {
		var didRestoreLastEncounter = restoreLastEncounterSelection();
		if (!didRestoreLastEncounter) {
			var firstValidSet = getFirstValidSetOption();
			if (firstValidSet && firstValidSet.id) {
				if (window.console && typeof window.console.debug === "function") {
					window.console.debug("[AstralCalc] document ready fallback selecting default encounter", {
						firstValidSet: firstValidSet.id
					});
				}
				$(".set-selector").val(firstValidSet.id);
				$(".set-selector").change();
			}
		}
	} finally {
		isBootstrappingLastEncounterSelection = false;
	}
	updateAllMoveMetaDisplays();
	startAppUpdateChecker();
	$(".terrain-trigger").bind("change keyup", getTerrainEffects);
	$("#previous-trainer").click(previousTrainer);
	$("#next-trainer").click(nextTrainer);
	$("#reset-trainer").click(resetTrainer);
	$("#info-trainer").click(refreshCurrentTrainerEncounter);
	$('#show-cc').click(showColorCodes);
	$('#hide-cc').click(hideColorCodes);
	$('#refr-cc').click(refreshColorCode);
	$('#info-cc').click(toggleInfoColorCode);
	$('#trash-pok').click(TrashPokemon);
	$('#cc-spe-border').change(SpeedBorderSetsChange);
	$('#cc-ohko-color').change(ColorCodeSetsChange);
	$('#cc-spe-border')[0].checked=true;
	$('#cc-ohko-color')[0].checked=true;
	for (let dropzone of document.getElementsByClassName("dropzone")){
		dropzone.ondragenter=handleDragEnter;
		dropzone.ondragleave=handleDragLeave;
		dropzone.ondrop=drop;
		dropzone.ondragover=allowDrop;
	}
	ensureColorCodesEnabled();
	applyPlayerRosterSearchFilter();
	renderFragSheet();
});

/* Click-to-copy function */
$("#mainResult").click(function () {
	navigator.clipboard.writeText($("#mainResult").text()).then(function () {
		document.getElementById('tooltipText').style.visibility = 'visible';
		setTimeout(function () {
			document.getElementById('tooltipText').style.visibility = 'hidden';
		}, 2000);
	});
});
