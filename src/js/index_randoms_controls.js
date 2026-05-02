$("#p2 .ability").bind("keyup change", function () {
	autosetWeather($(this).val(), 1);
	autosetTerrain($(this).val(), 1);
});

$("#p2 .item").bind("keyup change", function () {
	autosetStatus("#p2", getEffectiveItemFromPokeInfo($(this).closest(".poke-info")));
});

lastManualStatus["#p2"] = "Healthy";
lastAutoStatus["#p1"] = "Healthy";

var resultLocations = [[], []];
for (var i = 0; i < 4; i++) {
	resultLocations[0].push({
		"move": "#resultMoveL" + (i + 1),
		"damage": "#resultDamageL" + (i + 1)
	});
	resultLocations[1].push({
		"move": "#resultMoveR" + (i + 1),
		"damage": "#resultDamageR" + (i + 1)
	});
}

var damageResults;
var DAMAGE_ROLL_HIGHLIGHT_INDEX = 8;

function getFastestSide(p1, p2, field) {
	if (p1.stats.spe === p2.stats.spe) {
		return "tie";
	}
	if (field.isTrickRoom) {
		return p1.stats.spe < p2.stats.spe ? 0 : 1;
	}
	return p1.stats.spe > p2.stats.spe ? 0 : 1;
}

function getSpeedState(p1s, p2s, field) {
	if (p1s === p2s) {
		return "T";
	}
	if (field.isTrickRoom) {
		return p1s < p2s ? "F" : "S";
	}
	return p1s > p2s ? "F" : "S";
}

function updateSpeedClasses(p1info, p2info, p1, p2, field) {
	var p1Speed = p1info.find(".sp .totalMod");
	var p2Speed = p2info.find(".sp .totalMod");
	var speedClasses = "speed-faster speed-slower speed-tie";
	p1Speed.removeClass(speedClasses);
	p2Speed.removeClass(speedClasses);

	var fastestSide = getFastestSide(p1, p2, field);
	if (fastestSide === "tie") {
		p1Speed.addClass("speed-tie");
		p2Speed.addClass("speed-tie");
		return;
	}
	if (fastestSide === 0) {
		p1Speed.addClass("speed-faster");
		p2Speed.addClass("speed-slower");
		return;
	}
	p1Speed.addClass("speed-slower");
	p2Speed.addClass("speed-faster");
}

function normalizeMoveTypeKey(rawType) {
	return String(rawType || "")
		.trim()
		.toLowerCase()
		.replace(/[()]/g, "")
		.replace(/\s+/g, "");
}

function getMoveTypeColor(typeName) {
	var key = normalizeMoveTypeKey(typeName);
	return TYPE_COLOR_MAP && TYPE_COLOR_MAP[key] ? TYPE_COLOR_MAP[key] : "";
}

function getMoveLabelTextColor(backgroundHex) {
	return "#101622";
}

function applyMoveResultLabelColor(labelNode, typeName, enabled) {
	if (!labelNode || !labelNode.length) return;
	if (!enabled) {
		labelNode.removeClass("move-colour-btn");
		labelNode.css({
			backgroundColor: "",
			borderColor: "",
			color: ""
		});
		return;
	}
	var typeColor = getMoveTypeColor(typeName);
	if (!typeColor) {
		labelNode.removeClass("move-colour-btn");
		labelNode.css({
			backgroundColor: "",
			borderColor: "",
			color: ""
		});
		return;
	}
	labelNode.addClass("move-colour-btn");
	labelNode.css({
		backgroundColor: typeColor,
		borderColor: typeColor,
		color: getMoveLabelTextColor(typeColor)
	});
}

function applyMoveResultColors(p1, p2) {
	var enabled = typeof getAppSettings === "function" ? !!getAppSettings().moveColors : false;
	for (var i = 0; i < 4; i++) {
		var leftLabel = $(resultLocations[0][i].move + " + label");
		var rightLabel = $(resultLocations[1][i].move + " + label");
		var leftType = p1 && p1.moves && p1.moves[i] ? p1.moves[i].type : "";
		var rightType = p2 && p2.moves && p2.moves[i] ? p2.moves[i].type : "";
		applyMoveResultLabelColor(leftLabel, leftType, enabled);
		applyMoveResultLabelColor(rightLabel, rightType, enabled);
	}
}

function performCalculations() {
	var p1info = $("#p1");
	var p2info = $("#p2");
	var p1 = createPokemon(p1info);
	var p2 = createPokemon(p2info);
	applyPowerSplitToPair(p1, p2);
	syncCommanderButton(p1info, p1);
	syncCommanderButton(p2info, p2);
	var p1field = createField();
	var p2field = p1field.clone().swap();

	// Keep speed indicators in sync even if damage calc fails.
	p1info.find(".sp .totalMod").text(p1.stats.spe);
	p2info.find(".sp .totalMod").text(p2.stats.spe);
	updateSpeedClasses(p1info, p2info, p1, p2, p1field);

	try {
		damageResults = calculateAllMoves(gen, p1, p1field, p2, p2field);
	} catch (err) {
		console.error("Damage calculation failed while updating results.", err);
		applyMoveResultColors(p1, p2);
		return;
	}
	p1 = damageResults[0][0].attacker;
	p2 = damageResults[1][0].attacker;
	var battling = [p1, p2];
	p1.maxDamages = [];
	p2.maxDamages = [];
	p1info.find(".sp .totalMod").text(p1.stats.spe);
	p2info.find(".sp .totalMod").text(p2.stats.spe);
	updateSpeedClasses(p1info, p2info, p1, p2, p1field);
	var fastestSide = getFastestSide(p1, p2, p1field);

	var result, maxDamage;
	var bestResult;
	var zProtectAlerted = false;
	for (var i = 0; i < 4; i++) {
		// P1
		result = damageResults[0][i];
		maxDamage = result.range()[1] * p1.moves[i].hits;
		if (!zProtectAlerted && maxDamage > 0 && p1.item.indexOf(" Z") === -1 && p1field.defenderSide.isProtected && p1.moves[i].isZ) {
			alert('Although only possible while hacking, Z-Moves fully damage through protect without a Z-Crystal');
			zProtectAlerted = true;
		}
		p1.maxDamages.push({moveOrder: i, maxDamage: maxDamage});
		p1.maxDamages.sort(function (firstMove, secondMove) {
			return secondMove.maxDamage - firstMove.maxDamage;
		});
		$(resultLocations[0][i].move + " + label").text(p1.moves[i].name.replace("Hidden Power", "HP"));
		$(resultLocations[0][i].damage).text(result.moveDesc(notation));

		// P2
		result = damageResults[1][i];
		maxDamage = result.range()[1] * p2.moves[i].hits;
		if (!zProtectAlerted && maxDamage > 0 && p2.item.indexOf(" Z") === -1 && p2field.defenderSide.isProtected && p2.moves[i].isZ) {
			alert('Although only possible while hacking, Z-Moves fully damage through protect without a Z-Crystal');
			zProtectAlerted = true;
		}
		p2.maxDamages.push({moveOrder: i, maxDamage: maxDamage});
		p2.maxDamages.sort(function (firstMove, secondMove) {
			return secondMove.maxDamage - firstMove.maxDamage;
		});
		$(resultLocations[1][i].move + " + label").text(p2.moves[i].name.replace("Hidden Power", "HP"));
		$(resultLocations[1][i].damage).text(result.moveDesc(notation));

		// BOTH
		var bestMove;
		if (fastestSide === "tie") {
			// Technically the order should be random in a speed tie, but this non-determinism makes manual testing more difficult.
			// battling.sort(function () { return 0.5 - Math.random(); });
			bestMove = battling[0].maxDamages[0].moveOrder;
			var chosenPokemon = battling[0] === p1 ? "0" : "1";
			bestResult = $(resultLocations[chosenPokemon][bestMove].move);
		} else {
			bestMove = battling[fastestSide].maxDamages[0].moveOrder;
			bestResult = $(resultLocations[fastestSide][bestMove].move);
		}
	}
	applyMoveResultColors(p1, p2);
	if ($('.locked-move').length) {
		bestResult = $('.locked-move');
	} else {
		stickyMoves.setSelectedMove(bestResult.prop("id"));
	}
	bestResult.prop("checked", true);
	bestResult.change();
	$("#resultHeaderL").text(p1.name + "'s Moves (select one to show detailed results)");
	$("#resultHeaderR").text(p2.name + "'s Moves (select one to show detailed results)");
}


function calculationsColors(p1info, p2) {
	if (!p2) {
		var p2info = $("#p2");
		var p2 = createPokemon(p2info);
	} else if (typeof p2.clone === "function") {
		p2 = p2.clone();
	}
	var p1 = createPokemon(p1info);
	applyPowerSplitToPair(p1, p2);
	var p1field = createField();
	var p2field = p1field.clone().swap();

	damageResults = calculateAllMoves(gen, p1, p1field, p2, p2field);
	p1 = damageResults[0][0].attacker;
	p2 = damageResults[1][0].attacker;
	p1.maxDamages = [];
	p2.maxDamages = [];
	var p1s = p1.stats.spe;
	var p2s = p2.stats.spe;
	//Faster Tied Slower
	var fastest = getSpeedState(p1s, p2s, p1field);
	var result, highestRoll, lowestRoll, damage = 0;
	//goes from the most optimist to the least optimist
	var p1KO = 0, p2KO = 0;
	//Highest damage
	var p1HD = 0, p2HD = 0;
	for (var i = 0; i < 4; i++) {
		// P1
		result = damageResults[0][i];
		//lowest rolls in %
		damage = result.damage[0] ? result.damage[0] : result.damage;
		lowestRoll = damage * p1.moves[i].hits / p2.stats.hp * 100;
		damage = result.damage[15] ? result.damage[15] : result.damage;
		highestRoll = damage * p1.moves[i].hits / p2.stats.hp * 100;
		if (highestRoll > p1HD) {
			p1HD = highestRoll;
		}
		if (lowestRoll >= 100) {
			p1KO = 1;
		} else { //if lowest kill obviously highest will
			//highest rolls in %
			if (highestRoll >= 100) {
				if (p1KO == 0) {
					p1KO = 2;
				}
			}
		}

		// P2
		result = damageResults[1][i];
		//some damage like sonic boom acts a bit weird.
		damage = result.damage[0] ? result.damage[0] : result.damage;
		lowestRoll = damage * p2.moves[i].hits / p1.stats.hp * 100;
		damage = result.damage[15] ? result.damage[15] : result.damage;
		highestRoll = damage * p2.moves[i].hits / p1.stats.hp * 100;
		if (highestRoll > p2HD) {
			p2HD = highestRoll;
		}
		if (lowestRoll >= 100) {
			p2KO = 4;
		} else {
			if (highestRoll >= 100) {
				if (p2KO < 3) {
					p2KO = 3;
				}
			}
		}
	}
	// Checks if the pokemon walls it
	// i wouldn't mind change this algo for a smarter one.

	// if the adversary don't three shots our pokemon
	if (Math.round(p2HD * 3) < 100) {
		// And if our pokemon does more damage
		if (p1HD > p2HD) {
			if (p1HD > 100) {
				// Then i consider it a wall that may OHKO
				return {speed: fastest, code: "WMO"};
			}
			// if not Then i consider it a good wall
			return {speed: fastest, code: "W"};
		}
	}
	p1KO = p1KO > 0 ? p1KO.toString() : "";
	p2KO = p2KO > 0 ? p2KO.toString() : "";
	return {speed: fastest, code: p1KO + p2KO};
}

$(".result-move[type='radio']").change(function () {
	if (damageResults) {
		var result = findDamageResult($(this));
		if (result) {
			var desc = result.fullDesc(notation, false);
			if (desc.indexOf('--') === -1) desc += ' -- possibly the worst move ever';
			$("#mainResult").text(desc);
			$("#damageValues").html("Possible damage amounts: (" + displayDamageHits(result.damage) + ")");
		}
	}
});

function displayDamageHits(damage) {
	// Fixed Damage
	if (typeof damage === 'number') return escapeDamageRoll(damage);
	// Standard Damage
	if (damage.length > 2) return formatDamageRolls(damage);
	// Fixed Parental Bond Damage
	if (typeof damage[0] === 'number' && typeof damage[1] === 'number') {
		return '1st Hit: ' + escapeDamageRoll(damage[0]) + '; 2nd Hit: ' + escapeDamageRoll(damage[1]);
	}
	// Parental Bond Damage
	return '1st Hit: ' + formatPlainDamageRolls(damage[0]) + '; 2nd Hit: ' + formatPlainDamageRolls(damage[1]);
}

function formatDamageRolls(damage) {
	var rolls = [];
	for (var i = 0; i < damage.length; i++) {
		rolls.push(formatDamageRoll(damage[i], i));
	}
	return rolls.join(', ');
}

function formatPlainDamageRolls(damage) {
	var rolls = [];
	for (var i = 0; i < damage.length; i++) {
		rolls.push(escapeDamageRoll(damage[i]));
	}
	return rolls.join(', ');
}

function formatDamageRoll(damageRoll, index) {
	var escapedRoll = escapeDamageRoll(damageRoll);
	if (index !== DAMAGE_ROLL_HIGHLIGHT_INDEX) return escapedRoll;
	return '<span class="damage-roll-highlight">' + escapedRoll + '</span>';
}

function escapeDamageRoll(damageRoll) {
	return String(damageRoll)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function findDamageResult(resultMoveObj) {
	var selector = "#" + resultMoveObj.attr("id");
	for (var i = 0; i < resultLocations.length; i++) {
		for (var j = 0; j < resultLocations[i].length; j++) {
			if (resultLocations[i][j].move === selector) {
				return damageResults[i][j];
			}
		}
	}
}

function checkStatBoost(p1, p2) {
	if ($('#StatBoostL').prop("checked")) {
		for (var stat in p1.boosts) {
			if (stat === 'hp') continue;
			p1.boosts[stat] = Math.min(6, p1.boosts[stat] + 1);
		}
	}
	if ($('#StatBoostR').prop("checked")) {
		for (var stat in p2.boosts) {
			if (stat === 'hp') continue;
			p2.boosts[stat] = Math.min(6, p2.boosts[stat] + 1);
		}
	}
}

function isCommanderDondozo(pokemon) {
	return pokemon && pokemon.name && pokemon.name.indexOf('Dondozo') === 0;
}

function syncCommanderButton(pokeInfo, pokemon) {
	var button = pokeInfo.find(".commander-boost");
	if (!button.length) return;
	button.toggleClass("hide", !(gen === 9 && isCommanderDondozo(pokemon)));
}

function applyCommanderBoost(pokeInfo) {
	var stats = ['at', 'df', 'sa', 'sd', 'sp'];
	for (var i = 0; i < stats.length; i++) {
		var boostSelector = pokeInfo.find("." + stats[i] + " .boost");
		if (!boostSelector.length) continue;
		var currentBoost = parseInt(boostSelector.val(), 10);
		if (Number.isNaN(currentBoost)) currentBoost = 0;
		boostSelector.val(String(Math.min(6, currentBoost + 2))).change();
	}
}

function calculateAllMoves(gen, p1, p1field, p2, p2field) {
	checkStatBoost(p1, p2);
	var results = [[], []];
	for (var i = 0; i < 4; i++) {
		results[0][i] = calc.calculate(gen, p1, p2, p1.moves[i], p1field);
		results[1][i] = calc.calculate(gen, p2, p1, p2.moves[i], p2field);
	}
	return results;
}

$(document).on("click", ".commander-boost", function (ev) {
	ev.preventDefault();
	var pokeInfo = $(this).closest(".poke-info");
	var pokemon = createPokemon(pokeInfo);
	if (!(gen === 9 && isCommanderDondozo(pokemon))) return;
	applyCommanderBoost(pokeInfo);
	performCalculations();
});

$(".mode").change(function () {
	var params = new URLSearchParams(window.location.search);
	params.set('mode', $(this).attr("id"));
	var mode = params.get('mode');
	if (mode === 'randoms') {
		window.location.replace('randoms' + linkExtension + '?' + params);
	} else if (mode === 'one-vs-one') {
		window.location.replace('index' + linkExtension + '?' + params);
	} else {
		window.location.replace('honkalculate' + linkExtension + '?' + params);
	}
});

$(".notation").change(function () {
	performCalculations();
});

$(document).ready(function () {
	var params = new URLSearchParams(window.location.search);
	var m = params.get('mode');
	if (m) {
		if (m !== 'one-vs-one' && m !== 'randoms') {
			window.location.replace('honkalculate' + linkExtension + '?' + params);
		} else {
			if ($('#randoms').prop('checked')) {
				if (m === 'one-vs-one') {
					window.location.replace('index' + linkExtension + '?' + params);
				}
			} else {
				if (m === 'randoms') {
					window.location.replace('randoms' + linkExtension + '?' + params);
				}
			}
		}
	}
	$(".calc-trigger").bind("change keyup", function (ev) {
		/*
			This prevents like 8 performCalculations out of 8 that were useless
			without causing bugs (so far)
		*/
		if (window.NO_CALC) {
			return;
		}
		var autoRefreshColorCodes = document.getElementById("cc-auto-refr");
		if (autoRefreshColorCodes && autoRefreshColorCodes.checked && typeof window.refreshColorCode === "function") {
			window.refreshColorCode();
		}
		if (typeof updateAllMoveMetaDisplays === "function") {
			updateAllMoveMetaDisplays();
		}
		performCalculations();
	});
	if (typeof updateAllMoveMetaDisplays === "function") {
		updateAllMoveMetaDisplays();
	}
	performCalculations();
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
