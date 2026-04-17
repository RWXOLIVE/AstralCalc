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
	'Frozen': 'frz'
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
	var moveHits =
		$(this).val() === 'Skill Link' ? 5 :
			pokeInfo.find(".item").val() === 'Loaded Dice' ? 4 : 3;
	pokeInfo.find(".move-hits").val(moveHits);

	var ability = pokeInfo.find(".ability").val();
	var isProtoQuark = ability === 'Quark Drive' || ability === 'Protosynthesis';
	var protoQuarkState = pokeInfo.find(".proto-quark-state");

	var TOGGLE_ABILITIES = ['Flash Fire', 'Electromorphosis', 'Intimidate', 'Illuminate', 'Minus', 'Plus', 'Slow Start', 'Unburden', 'Stakeout', 'Teraform Zero'];

	if (isProtoQuark) {
		protoQuarkState.show();
		pokeInfo.find(".abilityToggle").hide().prop("checked", protoQuarkState.val() !== 'inactive');
	} else if (TOGGLE_ABILITIES.indexOf(ability) >= 0) {
		pokeInfo.find(".abilityToggle").show();
		protoQuarkState.val("auto").hide();
	} else {
		pokeInfo.find(".abilityToggle").hide();
		protoQuarkState.val("auto").hide();
	}

	if (ability === "Supreme Overlord") {
		pokeInfo.find(".alliesFainted").show();
	} else {
		pokeInfo.find(".alliesFainted").val('0');
		pokeInfo.find(".alliesFainted").hide();

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
}

var lastManualTerrain = "";
var lastAutoTerrain = ["", ""];
function autosetTerrain(ability, i) {
	var currentTerrain = $("input:checkbox[name='terrain']:checked").val() || "No terrain";
	if (lastAutoTerrain.indexOf(currentTerrain) === -1) {
		lastManualTerrain = currentTerrain;
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
			var newTerrain = lastAutoTerrain[1 - i] !== "" ? lastAutoTerrain[1 - i] : lastManualTerrain;
			if ("No terrain" !== newTerrain) {
				$("input:checkbox[name='terrain'][value='" + newTerrain + "']").prop("checked", true);
			}
			break;
	}
}

$("#p1 .item").bind("keyup change", function () {
	autosetStatus("#p1", $(this).val());
});

var lastManualStatus = { "#p1": "Healthy" };
var lastAutoStatus = { "#p1": "Healthy" };
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

function getDisplayedMoveAccuracy(moveAccuracy, weatherValue, moveGroupObj, moveCategory) {
	if (typeof moveAccuracy !== "number" || moveAccuracy <= 0) return "--";
	var accuracyMultiplier = 1;
	if (weatherValue === "Fog") accuracyMultiplier *= FOG_ACCURACY_MULTIPLIER;
	var attackerInfo = moveGroupObj.closest(".poke-info");
	var ability = attackerInfo.find(".ability").val();
	if (ability === "Hustle" && moveCategory === "Physical") accuracyMultiplier *= HUSTLE_ACCURACY_MULTIPLIER;
	var attackerId = attackerInfo.attr("id");
	var defenderInfo = attackerId === "p1"
		? $("#p2")
		: attackerId === "p2"
			? $("#p1")
			: $(".poke-info").not(attackerInfo).first();
	if (defenderInfo.length && defenderInfo.find(".item").val() === "Bright Powder") {
		accuracyMultiplier *= BRIGHT_POWDER_ACCURACY_MULTIPLIER;
	}
	if (accuracyMultiplier !== 1) {
		return String(Math.max(1, Math.floor(moveAccuracy * accuracyMultiplier))) + "%";
	}
	return String(moveAccuracy) + "%";
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
		if (typeof info.pp === "number" && info.pp >= 0) ppText = String(info.pp);
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

	var stat = move.category === 'Special' ? 'spa' : 'atk';
	var dropsStats =
		move.self && move.self.boosts && move.self.boosts[stat] && move.self.boosts[stat] < 0;
	if (Array.isArray(move.multihit)) {
		moveGroupObj.children(".stat-drops").hide();
		moveGroupObj.children(".move-hits").show();
		var pokemon = $(this).closest(".poke-info");
		var moveHits =
		pokemon.find(".ability").val() === 'Skill Link' ? 5 :
			pokemon.find(".item").val() === 'Loaded Dice' ? 4 : 3;
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
	var itemName = $(this).val();
	var $metronomeControl = $(this).closest('.poke-info').find('.metronome');
	if (itemName === "Metronome") {
		$metronomeControl.show();
	} else {
		$metronomeControl.hide();
	}
	updateAllMoveMetaDisplays();
});

var ASTRALDEX_BASE_URL = "https://astral-dex.vercel.app/";
var ASTRALDEX_TOP_CHROME_PX = 52;
var APP_SETTINGS_STORAGE_KEY = "astralCalcSettings";
var FRAG_SHEET_STORAGE_KEY = "astralCalcFragSheet";
var STARTER_CHOICES = ["chikorita", "tepig", "totodile"];
var RIVAL_STARTER_BY_CHOICE = {
	chikorita: "tepig",
	tepig: "totodile",
	totodile: "chikorita"
};
var appSettingsCache = null;
var fragSheetState = null;
var fragContextSourceSet = "";
var fragContextSourceElement = null;
var fragSheetAutoObserver = null;
var fragSheetRefreshTimer = null;
var deadOpposingSetMap = {};
var opposingContextSourceSet = "";
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

function safeJsonParse(rawJson, fallbackValue) {
	if (!rawJson) return fallbackValue;
	try {
		return JSON.parse(rawJson);
	} catch (err) {
		return fallbackValue;
	}
}

function normalizeStarterChoice(rawChoice) {
	var normalizedChoice = String(rawChoice || "").trim().toLowerCase();
	if (STARTER_CHOICES.indexOf(normalizedChoice) >= 0) return normalizedChoice;
	return "totodile";
}

function getDefaultAppSettings() {
	return {
		starterChoice: "totodile",
		moreColour: true,
		moveColors: false,
		moveMeta: true
	};
}

function getAppSettings(forceReload) {
	if (!forceReload && appSettingsCache) return appSettingsCache;
	var defaults = getDefaultAppSettings();
	var parsed = safeJsonParse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY), {});
	appSettingsCache = {
		starterChoice: normalizeStarterChoice(parsed.starterChoice || defaults.starterChoice),
		moreColour: typeof parsed.moreColour === "boolean" ? parsed.moreColour : defaults.moreColour,
		moveColors: typeof parsed.moveColors === "boolean" ? parsed.moveColors : defaults.moveColors,
		moveMeta: typeof parsed.moveMeta === "boolean" ? parsed.moveMeta : defaults.moveMeta
	};
	return appSettingsCache;
}

function saveAppSettings(nextSettings) {
	appSettingsCache = {
		starterChoice: normalizeStarterChoice(nextSettings.starterChoice),
		moreColour: !!nextSettings.moreColour,
		moveColors: !!nextSettings.moveColors,
		moveMeta: !!nextSettings.moveMeta
	};
	localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(appSettingsCache));
	return appSettingsCache;
}

function updateAppSettings(partial) {
	var current = getAppSettings();
	return saveAppSettings({
		starterChoice: partial && typeof partial.starterChoice !== "undefined" ? partial.starterChoice : current.starterChoice,
		moreColour: partial && typeof partial.moreColour !== "undefined" ? partial.moreColour : current.moreColour,
		moveColors: partial && typeof partial.moveColors !== "undefined" ? partial.moveColors : current.moveColors,
		moveMeta: partial && typeof partial.moveMeta !== "undefined" ? partial.moveMeta : current.moveMeta
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

function getFragSpriteUrl(speciesName) {
	return getTrainerSpriteUrlByName(speciesName);
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
	panel.setAttribute("aria-hidden", "true");
	panel.style.cssText = "position:fixed;top:0;right:0;height:100vh;width:min(48vw,700px);min-width:360px;max-width:96vw;border-left:1px solid #888;box-shadow:-6px 0 20px rgba(0,0,0,.35);z-index:2500;transform:translateX(100%);transition:transform 160ms ease-in-out;display:flex;flex-direction:column;";
	panel.innerHTML = '<div class="astraldex-side-header" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;"><strong class="astraldex-side-title">AstralDex</strong><button type="button" class="astraldex-side-close" style="padding:3px 10px;border-radius:4px;cursor:pointer;">Close</button></div><div class="astraldex-side-body" style="position:relative;overflow:hidden;flex:1 1 auto;"><iframe class="astraldex-side-frame" title="AstralDex" src="' + ASTRALDEX_BASE_URL + '" style="position:absolute;top:0;left:0;width:100%;height:calc(100% + ' + ASTRALDEX_TOP_CHROME_PX + 'px);transform:translateY(-' + ASTRALDEX_TOP_CHROME_PX + 'px);border:0;"></iframe></div>';
	document.body.appendChild(panel);
	applyAstralDexPanelTheme(panel);

	panel.querySelector(".astraldex-side-close").onclick = closeAstralDexSidePanel;
	return panel;
}

function closeAstralDexSidePanel() {
	var panel = document.getElementById("astraldex-side-panel");
	if (!panel) return;
	panel.style.transform = "translateX(100%)";
	panel.setAttribute("aria-hidden", "true");
}

function openAstralDexSidePanel(url, pokemonName) {
	var panel = ensureAstralDexSidePanel();
	applyAstralDexPanelTheme(panel);
	panel.querySelector(".astraldex-side-frame").src = url || astralDexUrl(pokemonName);
	panel.querySelector(".astraldex-side-title").textContent = pokemonName ? ("AstralDex: " + pokemonName) : "AstralDex";
	panel.style.transform = "translateX(0)";
	panel.setAttribute("aria-hidden", "false");
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
		lastVictim: entry.lastVictim ? String(entry.lastVictim) : "",
		isDead: isDead,
		deathFight: deathFight
	};
}

function getFragSheetState() {
	if (fragSheetState) return fragSheetState;
	var parsed = safeJsonParse(localStorage.getItem(FRAG_SHEET_STORAGE_KEY), {});
	var rawEntries = parsed && parsed.entries ? parsed.entries : {};
	fragSheetState = {entries: {}};
	for (var setId in rawEntries) {
		if (!Object.prototype.hasOwnProperty.call(rawEntries, setId)) continue;
		fragSheetState.entries[setId] = normalizeFragEntry(setId, rawEntries[setId]);
	}
	return fragSheetState;
}

function saveFragSheetState() {
	localStorage.setItem(FRAG_SHEET_STORAGE_KEY, JSON.stringify(getFragSheetState()));
}

function ensureFragEntryForSet(setId) {
	if (!setId) return null;
	var state = getFragSheetState();
	if (!state.entries[setId]) {
		state.entries[setId] = normalizeFragEntry(setId, {});
	}
	return state.entries[setId];
}

function collectPlayerRosterSetIds() {
	var rosterSetIds = [];
	$("#team-poke-list .trainer-pok.left-side, #box-poke-list .trainer-pok.left-side, #box-poke-list2 .trainer-pok.left-side, #trash-box .trainer-pok.left-side").each(function () {
		var setId = $(this).attr("data-id");
		if (!setId) return;
		if (rosterSetIds.indexOf(setId) === -1) rosterSetIds.push(setId);
	});
	return rosterSetIds;
}

function syncFragRoster(options) {
	var syncOptions = options || {};
	var pruneMissing = !!syncOptions.pruneMissing;
	var rosterSetIds = collectPlayerRosterSetIds();
	var state = getFragSheetState();
	var didChange = false;
	for (var i = 0; i < rosterSetIds.length; i++) {
		if (!state.entries[rosterSetIds[i]]) {
			state.entries[rosterSetIds[i]] = normalizeFragEntry(rosterSetIds[i], {});
			didChange = true;
		}
	}
	if (pruneMissing) {
		for (var setId in state.entries) {
			if (!Object.prototype.hasOwnProperty.call(state.entries, setId)) continue;
			if (rosterSetIds.indexOf(setId) !== -1) continue;
			delete state.entries[setId];
			didChange = true;
		}
	}
	if (didChange) saveFragSheetState();
}

function scheduleFragSheetRefresh() {
	if (fragSheetRefreshTimer) return;
	fragSheetRefreshTimer = window.setTimeout(function () {
		fragSheetRefreshTimer = null;
		syncFragRoster({pruneMissing: true});
		renderFragSheet();
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
	if (!entry) return;
	var fight = String(fightLabel || getCurrentFightLabel() || "Unknown Fight");
	var split = String(getCurrentSplitNumber(fight));
	entry.totalKills += 1;
	entry.fights[fight] = (entry.fights[fight] || 0) + 1;
	entry.splits[split] = (entry.splits[split] || 0) + 1;
	entry.lastVictim = parseSetId(victimSetId).species || "";
	saveFragSheetState();
	renderFragSheet();
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
	var split = String(getCurrentSplitNumber(targetFight));
	entry.fights[targetFight] -= 1;
	if (entry.fights[targetFight] <= 0) delete entry.fights[targetFight];
	if (entry.splits[split]) {
		entry.splits[split] -= 1;
		if (entry.splits[split] <= 0) delete entry.splits[split];
	}
	entry.totalKills = Math.max(0, entry.totalKills - 1);
	saveFragSheetState();
	renderFragSheet();
}

function clearFragsForCurrentFight() {
	var fight = getCurrentFightLabel();
	var split = String(getCurrentSplitNumber(fight));
	var state = getFragSheetState();
	var hadKills = false;
	for (var setId in state.entries) {
		if (!Object.prototype.hasOwnProperty.call(state.entries, setId)) continue;
		var entry = state.entries[setId];
		if (!entry.fights[fight]) continue;
		var removed = entry.fights[fight];
		entry.totalKills = Math.max(0, entry.totalKills - removed);
		delete entry.fights[fight];
		if (entry.splits[split]) {
			entry.splits[split] = Math.max(0, entry.splits[split] - removed);
			if (entry.splits[split] <= 0) delete entry.splits[split];
		}
		hadKills = true;
	}
	if (hadKills) saveFragSheetState();
	renderFragSheet();
}

function clearAllFrags() {
	var state = getFragSheetState();
	state.entries = {};
	saveFragSheetState();
	syncFragRoster({pruneMissing: true});
	renderFragSheet();
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

function renderFragSheet() {
	syncFragRoster();
	var container = document.getElementById("frags-table-wrap");
	var summaryText = document.getElementById("frags-summary-text");
	var currentFightLabelNode = document.getElementById("frags-current-fight-label");
	if (!container || !summaryText || !currentFightLabelNode) return;
	var fragsPanel = document.getElementById("frags-side-panel");
	var showAllSplits = !!(fragsPanel && fragsPanel.classList.contains("fullscreen"));

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
				splitPercentColumns += "<td class=\"frag-percent-col\">" + renderFragPercentBar(splitPercent, isDead) + "</td>";
			}
		}
		var overallPercent = toFragPercent(entry.totalKills, totals.overall);
		rowsHtml += "<tr class=\"frags-row" + placementClass + lifeClass + "\">" +
			"<td class=\"frag-num\">" + (i + 1) + "</td>" +
			"<td title=\"" + escapeHtml(titleText) + "\" class=\"frags-mon-cell\">" +
			"<div class=\"frags-mon-content\">" +
			"<img class=\"frags-mon-sprite\" src=\"" + escapeHtml(getFragSpriteUrl(entry.species)) + "\" data-species=\"" + escapeHtml(entry.species) + "\" onerror=\"applyIconSheetFallbackImage(this, this.getAttribute('data-species'))\" alt=\"\">" +
			"<span>" + escapeHtml(entry.species) + "</span></div></td>" +
			"<td class=\"frag-life-cell\"><span class=\"frags-life-badge " + (isDead ? "frags-life-dead" : "frags-life-alive") + "\">" + (isDead ? "Dead" : "Alive") + "</span>" +
			(deathFight ? "<div class=\"frags-death-fight\" title=\"Died on " + escapeHtml(deathFight) + "\">" + escapeHtml(deathFight) + "</div>" : "") +
			"</td>" +
			"<td class=\"frag-num\">" + entry.totalKills + "</td>" +
			"<td class=\"frag-percent-col\">" + renderFragPercentBar(overallPercent, isDead) + "</td>" +
			splitPercentColumns +
			"<td class=\"frag-num\">" + fightKills + "</td>" +
			"<td><div class=\"frags-actions\">" +
			"<button type=\"button\" class=\"btn frags-action-btn frags-inc\" data-frag-set=\"" + escapeHtml(entry.setId) + "\">+1</button>" +
			"<button type=\"button\" class=\"btn frags-action-btn frags-dec\" data-frag-set=\"" + escapeHtml(entry.setId) + "\">-1</button>" +
			"</div></td>" +
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

function updateCalcSideBackdrop() {
	var backdrop = document.getElementById("calc-side-backdrop");
	if (!backdrop) return;
	var hasOpenPanel = $(".calc-side-panel.open").length > 0;
	backdrop.hidden = !hasOpenPanel;
	backdrop.classList.toggle("open", hasOpenPanel);
}

function openCalcSidePanel(panelId) {
	var panel = document.getElementById(panelId);
	if (!panel) return;
	panel.hidden = false;
	panel.classList.add("open");
	panel.setAttribute("aria-hidden", "false");
	updateCalcSideBackdrop();
}

function closeCalcSidePanel(panelId) {
	var panel = document.getElementById(panelId);
	if (!panel) return;
	panel.classList.remove("open");
	panel.classList.remove("fullscreen");
	panel.setAttribute("aria-hidden", "true");
	panel.hidden = true;
	if (panelId === "frags-side-panel") {
		$("#frags-panel-fullscreen").text("Fullscreen");
	}
	updateCalcSideBackdrop();
}

function closeCalcSidePanels() {
	$(".calc-side-panel.open").each(function () {
		closeCalcSidePanel(this.id);
	});
}

function openFragsPanel() {
	openCalcSidePanel("frags-side-panel");
	renderFragSheet();
}

function openSettingsPanel() {
	openCalcSidePanel("settings-side-panel");
	syncSettingsPanelUi();
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
	if (isDead) deadOpposingSetMap[key] = true;
	else delete deadOpposingSetMap[key];
	applyOpposingDeadMarks();
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
	var sourceParentId = sourceElement && sourceElement.parentNode ? sourceElement.parentNode.id : "";
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
	targetContainer.appendChild(spriteElement);
	if (containerId !== "trash-box") {
		topPokemonIcon(setId, $("#p1mon")[0]);
		$(".player").val(setId);
		$(".player").change();
		$(".player .select2-chosen").text(formatSetNameForDisplay(setId));
	}
	syncFragRoster({pruneMissing: true});
	renderFragSheet();
}

function isSetOptionAvailable(setId) {
	var options = getSetOptions();
	for (var i = 0; i < options.length; i++) {
		if (options[i].id === setId) return true;
	}
	return false;
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
	$("#settings-more-colour").prop("checked", !!settings.moreColour);
	$("#settings-move-colors").prop("checked", !!settings.moveColors);
	$("#settings-move-meta").prop("checked", !!settings.moveMeta);
	setMoveMetaVisibility(!!settings.moveMeta);
	applyMoreColourSetting(!!settings.moreColour);
	refreshThemeChoiceButtons();
}

function bindCalcToolEvents() {
	ensureOpposingContextMenu();

	$("#open-pokedex-panel").off("click").on("click", function () {
		var selectedSet = $(".player").val() || "";
		var selectedSpecies = parseSetId(selectedSet).species;
		openAstralDexSidePanel(astralDexUrl(selectedSpecies), selectedSpecies);
	});

	$("#open-frags-panel").off("click").on("click", function () {
		openFragsPanel();
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

	$("#frags-panel-fullscreen").off("click").on("click", function () {
		var fragsPanel = document.getElementById("frags-side-panel");
		if (!fragsPanel) return;
		var isFullscreen = fragsPanel.classList.toggle("fullscreen");
		$(this).text(isFullscreen ? "Exit Fullscreen" : "Fullscreen");
		renderFragSheet();
	});

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

	$(document).off("change.fragopposing", ".opposing").on("change.fragopposing", ".opposing", function () {
		renderFragSheet();
		if (!$("#frag-context-menu").prop("hidden")) populateFragContextTargets();
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

	$(document).off("click.fragsactionsdec", ".frags-dec").on("click.fragsactionsdec", ".frags-dec", function () {
		removeFragKill($(this).attr("data-frag-set"), getCurrentFightLabel());
	});

	$("#frags-clear-fight").off("click").on("click", function () {
		if (!confirm("Clear all frags for the current fight?")) return;
		clearFragsForCurrentFight();
	});

	$(document).off("click.settingsstarter", ".settings-choice-btn[data-starter-choice]").on("click.settingsstarter", ".settings-choice-btn[data-starter-choice]", function () {
		var starterChoice = $(this).attr("data-starter-choice");
		updateAppSettings({starterChoice: starterChoice});
		syncSettingsPanelUi();
		refreshSetSelectorsForStarterChoice();
	});

	$("#settings-more-colour").off("change").on("change", function () {
		var enabled = $(this).is(":checked");
		updateAppSettings({moreColour: enabled});
		applyMoreColourSetting(enabled);
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
	return parseInt(a.split("[")[1].split("]")[0]) - parseInt(b.split("[")[1].split("]")[0])
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
	return spriteName;
}

var POKEMON_ICON_SHEET_URL = "https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png?v16";
var POKEMON_ICON_WIDTH = 40;
var POKEMON_ICON_HEIGHT = 30;

function getTrainerSpriteUrlByName(pokemonName) {
	var normalizedName = pokemonName === "Aegislash-Shield" ? "Aegislash" : pokemonName;
	var spriteName = normalizeTrainerSpriteName(normalizedName);
	return "https://raw.githubusercontent.com/May8th1995/sprites/master/" + spriteName + ".png";
}

function getIconSheetPositionForSpecies(speciesName) {
	var iconIndexTable = typeof BattlePokemonIconIndexes === "undefined" ? null : BattlePokemonIconIndexes;
	if (!iconIndexTable) return null;
	var speciesId = toDexPokemonId(speciesName);
	if (!speciesId) return null;
	var num = iconIndexTable[speciesId];
	if (num === undefined || num === null) return null;
	return {
		left: (num % 12) * POKEMON_ICON_WIDTH,
		top: Math.floor(num / 12) * POKEMON_ICON_HEIGHT
	};
}

function applyIconSheetFallbackImage(imgNode, speciesName) {
	if (!imgNode) return false;
	imgNode.onerror = null;
	var resolvedSpecies = speciesName || imgNode.getAttribute("data-species") || "";
	var position = getIconSheetPositionForSpecies(resolvedSpecies);
	if (!position) return false;
	imgNode.src = POKEMON_ICON_SHEET_URL;
	imgNode.style.width = POKEMON_ICON_WIDTH + "px";
	imgNode.style.height = POKEMON_ICON_HEIGHT + "px";
	imgNode.style.objectFit = "none";
	imgNode.style.objectPosition = "-" + position.left + "px -" + position.top + "px";
	imgNode.style.imageRendering = "auto";
	return true;
}

function setTrainerSpriteImage(node, speciesName) {
	if (!node) return;
	var resolvedSpecies = speciesName || "";
	node.setAttribute("data-species", resolvedSpecies);
	// Clear any icon-sheet fallback styling from a previous failed load.
	node.style.width = "";
	node.style.height = "";
	node.style.objectFit = "";
	node.style.objectPosition = "";
	node.style.imageRendering = "";
	node.onerror = function () {
		applyIconSheetFallbackImage(this, resolvedSpecies);
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
	if (!resolvedTerrain.hasTerrain) {
		var activeInput = terrainInputs.filter(":checked").first();
		getTerrainEffects.call(activeInput.length ? activeInput[0] : terrainInputs.first()[0]);
		var activeTerrain = activeInput.length ? String(activeInput.val() || "") : "";
		var currentWeather = gen === 2
			? $("input:radio[name='gscWeather']:checked").val()
			: $("input:radio[name='weather']:checked").val();
		applyFieldEnvironmentTheme(currentWeather, activeTerrain);
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

function trainerPartyMonHtml(entry) {
	var label = "[" + entry.indexText + "]" + entry.fullSetName;
	return '<img class="trainer-pok right-side" src="' + escapeHtml(getTrainerSpriteUrlByName(entry.pokemonName)) + '" data-id="' + escapeHtml(entry.fullSetName) + '" data-species="' + escapeHtml(entry.pokemonName) + '" title="' + escapeHtml(label + ", " + label + " BP") + '" onerror="applyIconSheetFallbackImage(this, this.getAttribute(\'data-species\'))">';
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
	applyOpposingDeadMarks();
}

// auto-update set details on select
$(".set-selector").change(function () {
	window.NO_CALC = true;
	var fullSetName = $(this).val();
	if ($(this).hasClass('opposing')) {
		topPokemonIcon(fullSetName, $("#p2mon")[0])
		CURRENT_TRAINER_POKS = get_trainer_poks(fullSetName);
		syncBattleFormatForSelection(fullSetName, CURRENT_TRAINER_POKS);
		renderOpposingTrainerParties(fullSetName);
	} else {
		topPokemonIcon(fullSetName, $("#p1mon")[0])
	}

	var pokemonName = fullSetName.substring(0, fullSetName.indexOf(" ("));
	var setName = fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")"));
	var pokemon = pokedex[pokemonName];
	if (pokemon) {
		var pokeObj = $(this).closest(".poke-info");
		if (stickyMoves.getSelectedSide() === pokeObj.prop("id")) {
			stickyMoves.clearStickyMove();
		}
		pokeObj.find(".teraToggle").prop("checked", false);
		pokeObj.find(".analysis")
			.attr("href", astralDexUrl(pokemonName))
			.attr("data-pokemon-name", pokemonName)
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
		var formeObj = $(this).siblings().find(".forme").parent();
		itemObj.prop("disabled", false);
		var baseForme;
		if (pokemon.baseSpecies && pokemon.baseSpecies !== pokemon.name) {
			baseForme = pokedex[pokemon.baseSpecies];
		}
		if (pokemon.otherFormes) {
			showFormes(formeObj, pokemonName, pokemon, pokemonName);
		} else if (baseForme && baseForme.otherFormes) {
			showFormes(formeObj, pokemonName, baseForme, pokemon.baseSpecies);
		} else {
			formeObj.hide();
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
	window.NO_CALC = false;
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
	var formes = pokemon.otherFormes.slice();
	formes.unshift(baseFormeName);

	var defaultForme = formes.indexOf(pokemonName);
	if (defaultForme < 0) defaultForme = 0;

	var formeOptions = getSelectOptions(formes, false, defaultForme);
	formeObj.children("select").find("option").remove().end().append(formeOptions).change();
	formeObj.show();
}

function setSelectValueIfValid(select, value, fallback) {
	select.val(!value ? fallback : select.children("option[value='" + value + "']").length ? value : fallback);
}

$(".forme").change(function () {
	var altForme = pokedex[$(this).val()],
		container = $(this).closest(".info-group").siblings(),
		fullSetName = container.find("input.set-selector").first().val() || "",
		pokemonName = fullSetName.substring(0, fullSetName.indexOf(" (")),
		setName = fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")"));

	$(this).parent().siblings().find(".type1").val(altForme.types[0]);
	$(this).parent().siblings().find(".type2").val(altForme.types[1] ? altForme.types[1] : "");
	for (var i = 0; i < LEGACY_STATS[9].length; i++) {
		var baseStat = container.find("." + LEGACY_STATS[9][i]).find(".base");
		baseStat.val(altForme.bs[LEGACY_STATS[9][i]]);
		baseStat.keyup();
	}
	var isRandoms = $("#randoms").prop("checked");
	var pokemonSets = isRandoms ? randdex[pokemonName] : setdex[pokemonName];
	var chosenSet = pokemonSets && pokemonSets[setName];
	var greninjaSet = $(this).val().indexOf("Greninja") !== -1;
	var isAltForme = $(this).val() !== pokemonName;
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

	if ($(this).val().indexOf("-Mega") !== -1 && $(this).val() !== "Rayquaza-Mega") {
		container.find(".item").val("").keyup();
	} else {
		container.find(".item").prop("disabled", false);
	}
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
		var name;
		if (setName.indexOf("(") === -1) {
			name = setName;
		} else {
			var pokemonName = setName.substring(0, setName.indexOf(" ("));
			var species = pokedex[pokemonName];
			name = (species.otherFormes || (species.baseSpecies && species.baseSpecies !== pokemonName)) ? pokeInfo.find(".forme").val() : pokemonName;
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
		var item = pokeInfo.find(".item").val() || "";
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

	$(".set-selector").val(getFirstValidSetOption().id);
	$(".set-selector").change();
});

function getFirstValidSetOption() {
	var sets = getSetOptions();
	// NB: The first set is never valid, so we start searching after it.
	for (var i = 1; i < sets.length; i++) {
		if (sets[i].id && sets[i].id.indexOf('(Blank Set)') === -1) return sets[i];
	}
	return undefined;
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
	$("#switchingL").prop("checked", false);
	$("#switchingR").prop("checked", false);
	$("#trickroom").prop("checked", false);
	$("#trickRoomR").prop("checked", false);
	$("input:checkbox[name='terrain']").prop("checked", false);
	applyFieldEnvironmentTheme("", "");
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
	$(".result-move").click(function () {
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
		pokeInfo.find(".item").val() !== "Air Balloon"
	);
}

function getTerrainEffects() {
	var className = $(this).prop("className");
	className = className.substring(0, className.indexOf(" "));
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
			callback(getFirstValidSetOption());
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
			var data = "";
			callback(data);
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
	if (document.getElementById(`${poke.name}${poke.nameProp}`)) {
		//nothing to do it already exist
		return
	}
	var newPoke = document.createElement("img");
	newPoke.id = `${poke.name}${poke.nameProp}`
	newPoke.className = "trainer-pok left-side";
	setTrainerSpriteImage(newPoke, poke.name);
	newPoke.dataset.id = `${poke.name} (${poke.nameProp})`
	newPoke.addEventListener("dragstart", dragstart_handler);
	$('#box-poke-list')[0].appendChild(newPoke)
	scheduleFragSheetRefresh();
}

function getSrcImgPokemon(poke) {
	//edge case
	if (!poke || !poke.name) {
		return
	}
	return getTrainerSpriteUrlByName(poke.name);
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
	var speciesName = fullname.split(" (")[0];
	setTrainerSpriteImage(node, speciesName);
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
	openOpposingContextMenu(ev, $(this).attr("data-id"));
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
	if (!CURRENT_TRAINER_POKS || !CURRENT_TRAINER_POKS.length) return;
	var maxIndex = parseInt(CURRENT_TRAINER_POKS.slice().sort(sortmons).slice(-1)[0].split("[")[1].split("]")[0], 10);
	if (Number.isNaN(maxIndex)) return;
	clearOpposingDeadMarks();
	selectTrainer(maxIndex + 1);
}

function previousTrainer() {
	if (!CURRENT_TRAINER_POKS || !CURRENT_TRAINER_POKS.length) return;
	var minIndex = parseInt(CURRENT_TRAINER_POKS.slice().sort(sortmons)[0].split("[")[1].split("]")[0], 10);
	if (Number.isNaN(minIndex) || minIndex <= 1) return;
	selectTrainer(minIndex - 1);
}

function resetTrainer() {
	if (confirm(`Are you sure you want to reset? This will clear all imported sets and change your current trainer back to Younger Calvin. This cannot be undone.`)){
		selectTrainer(1);
		localStorage.removeItem("customsets");
		$(allPokemon("#importedSetsOptions")).hide();
		loadDefaultLists();
		for (let zone of document.getElementsByClassName("dropzone")){
			zone.innerHTML="";
		}
		syncFragRoster({pruneMissing: true});
		renderFragSheet();
	}
	
}

function refreshCurrentTrainerEncounter() {
	var selectedOpposing = $(".opposing").val();
	if (!selectedOpposing) return;
	CURRENT_TRAINER_POKS = get_trainer_poks(selectedOpposing);
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
	var customSets = JSON.parse(localStorage.customsets);
	var length= maybeMultiple.length;
	for( let i = 0; i<length; i++){
		var pokeTrashed = maybeMultiple[i];
		var name = pokeTrashed.getAttribute("data-id").split(" (")[0];
		delete customSets[name];
	}
	document.getElementById("trash-box").innerHTML="";
	localStorage.setItem("customsets", JSON.stringify(customSets));
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
	pokeDragged = ev.target;
}

function drop(ev) {
	ev.preventDefault();
	if (ev.target.classList.contains("dropzone")) {
		pokeDragged.parentNode.removeChild(pokeDragged);
		ev.target.appendChild(pokeDragged);	
	}
	// if it's a pokemon
	else if(ev.target.classList.contains("left-side")) {
		//And if a sibling switch them
		if(ev.target.parentNode == pokeDragged.parentNode){
			let prev1 = ev.target.previousSibling || ev.target;
			let prev2 = pokeDragged.previousSibling || pokeDragged;

			prev1.after(pokeDragged);
			prev2.after(ev.target);
		}
		//if not just append to the box it belongs
		else{
			let prev1 = ev.target.previousSibling || ev.target;
			prev1.after(pokeDragged);
		}
	}
	ev.target.classList.remove('over');
	scheduleFragSheetRefresh();
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
	bindFieldSideControlsToggle();
	loadDefaultLists();
	setupFragSheetAutoRefresh();
	syncSettingsPanelUi();
	syncFragRoster({pruneMissing: true});
	renderFragSheet();
	$(".move-selector").select2({
		dropdownAutoWidth: true,
		matcher: function (term, text) {
			// 2nd condition is for Hidden Power
			return text.toUpperCase().indexOf(term.toUpperCase()) === 0 || text.toUpperCase().indexOf(" " + term.toUpperCase()) >= 0;
		}
	});
	$(".set-selector").val(getFirstValidSetOption().id);
	$(".set-selector").change();
	updateAllMoveMetaDisplays();
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
	//select last trainer
	let last = localStorage.getItem("lasttimetrainer");
	if (last != "") {
		selectTrainer(parseInt(last, 10));
	};
	ensureColorCodesEnabled();
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
