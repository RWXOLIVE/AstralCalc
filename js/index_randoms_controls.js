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
var LAYOUT_STANDARD = "standard";
var LAYOUT_SIMPLIFIED = "simplified";
var SIMPLIFIED_SIDE_SELECTORS = ["#p1", "#p2"];
var simplifiedSideExpandedState = {"#p1": false, "#p2": false};
var simplifiedStatDisplayOrder = [
	{statKey: "hp", boostKey: "", label: "HP"},
	{statKey: "atk", boostKey: "atk", label: "Atk"},
	{statKey: "def", boostKey: "def", label: "Def"},
	{statKey: "spa", boostKey: "spa", label: "SpA"},
	{statKey: "spd", boostKey: "spd", label: "SpD"},
	{statKey: "spe", boostKey: "spe", label: "Spe"}
];
var simplifiedStatRowClassByStatKey = {
	"hp": "hp",
	"atk": "at",
	"def": "df",
	"spa": "sa",
	"spd": "sd",
	"spe": "sp"
};
var simplifiedDamageTooltipNode = null;
var simplifiedRollsShiftHeld = false;
var damageApplyMenuNode = null;
var damageApplySelectionPayload = null;

function normalizeLayoutModeChoice(rawChoice) {
	return String(rawChoice || "").toLowerCase() === LAYOUT_SIMPLIFIED ? LAYOUT_SIMPLIFIED : LAYOUT_STANDARD;
}

function getCurrentLayoutMode() {
	if (typeof getAppSettings !== "function") return LAYOUT_STANDARD;
	return normalizeLayoutModeChoice(getAppSettings().layoutMode);
}

function isSimplifiedLayoutEnabled() {
	return getCurrentLayoutMode() === LAYOUT_SIMPLIFIED;
}

function applyLayoutMode(layoutMode) {
	var normalized = normalizeLayoutModeChoice(layoutMode);
	$("body").toggleClass("layout-simplified", normalized === LAYOUT_SIMPLIFIED);
	syncSimplifiedSideLayoutState(normalized);
	if (normalized !== LAYOUT_SIMPLIFIED) {
		simplifiedSideExpandedState["#p1"] = false;
		simplifiedSideExpandedState["#p2"] = false;
		hideSimplifiedDamageTooltip();
	}
}

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

function escapeHtmlText(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function formatCompactNumber(value) {
	var rounded = Math.floor(value * 10) / 10;
	if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
	return String(rounded.toFixed(1)).replace(/\.0$/, "");
}

function formatSimplifiedPercent(damage, maxHP) {
	if (!maxHP || maxHP <= 0) return "0%";
	var percent = Math.floor((damage * 1000) / maxHP) / 10;
	return formatCompactNumber(percent) + "%";
}

function formatSimplifiedDamageValue(damage) {
	return String(Math.floor(damage));
}

function normalizePercentRangeText(text) {
	return String(text || "").replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%/g, function (match, minValue, maxValue) {
		return minValue + "% - " + maxValue + "%";
	});
}

function getSimplifiedBarLevelClass(maxPercent) {
	if (maxPercent >= 100) return "is-lethal";
	if (maxPercent >= 60) return "is-high";
	if (maxPercent >= 30) return "is-medium";
	return "is-low";
}

function getSimplifiedDamageRolls(result, move) {
	if (!result) return [];
	var hits = move && move.hits ? +move.hits : 1;
	var damage = result.damage;
	if (typeof damage === "number") return [damage * hits];
	if (!Array.isArray(damage)) return [];
	if (damage.length > 2) {
		var flatRolls = [];
		for (var i = 0; i < damage.length; i++) {
			flatRolls.push(damage[i] * hits);
		}
		return flatRolls;
	}
	if (typeof damage[0] === "number" && typeof damage[1] === "number") {
		return [damage[0] + damage[1]];
	}
	if (Array.isArray(damage[0]) && Array.isArray(damage[1])) {
		var groupedRolls = [];
		var firstHitRolls = damage[0];
		var secondHitRolls = damage[1];
		var rollCount = Math.min(firstHitRolls.length, secondHitRolls.length);
		for (var j = 0; j < rollCount; j++) {
			groupedRolls.push(firstHitRolls[j] + secondHitRolls[j]);
		}
		return groupedRolls;
	}
	return [];
}

function buildSimplifiedRollTooltipHtml(result, move) {
	var rolls = getSimplifiedDamageRolls(result, move);
	if (!rolls.length) return "";
	var rollParts = [];
	for (var i = 0; i < rolls.length; i++) {
		var formattedRoll = escapeHtmlText(formatSimplifiedDamageValue(rolls[i]));
		if (i === DAMAGE_ROLL_HIGHLIGHT_INDEX) {
			formattedRoll = '<span class="damage-roll-highlight">' + formattedRoll + '</span>';
		}
		rollParts.push('<span class="simplified-roll-value">' + formattedRoll + '</span>');
		if ((i + 1) % 8 === 0 && i + 1 < rolls.length) rollParts.push("<br>");
	}
	var koText = "";
	if (result && typeof result.kochance === "function") {
		var koInfo = result.kochance(false);
		koText = koInfo && koInfo.text ? koInfo.text : "";
	}
	if (!koText) koText = "0% chance to OHKO";
	return '<div class="simplified-rolls-title">Rolls:</div>' +
		'<div class="simplified-rolls-grid">' + rollParts.join(" ") + '</div>' +
		'<div class="simplified-rolls-ko">' + escapeHtmlText(koText) + '</div>' +
		'<div class="simplified-rolls-hint">Hold Shift to keep this visible.</div>';
}

function buildSimplifiedHitsIndicatorHtml(move) {
	if (!move || !Array.isArray(move.multihit) || move.multihit.length < 2) return "";
	var minHits = Number(move.multihit[0]);
	var maxHits = Number(move.multihit[move.multihit.length - 1]);
	if (!isFinite(minHits) || !isFinite(maxHits) || maxHits < minHits) return "";
	var selectedHits = Number(move.hits) || minHits;
	var hitParts = [];
	for (var hits = minHits; hits <= maxHits; hits++) {
		hitParts.push('<span class="simplified-hit-segment' + (hits === selectedHits ? " is-active" : "") + '"></span>');
	}
	return '<span class="simplified-hit-indicator" title="Hits: ' + escapeHtmlText(selectedHits + " (" + minHits + "-" + maxHits + ")") + '">' +
		'<span class="simplified-hit-track">' + hitParts.join("") + "</span></span>";
}

function buildSimplifiedDamageChip(result, move, defender) {
	if (!result || !move || !defender) {
		return {
			html: '<span class="simplified-damage-chip-display simplified-status-output">-</span>',
			tooltipHtml: ""
		};
	}
	var range = result.range();
	var hits = move.hits || 1;
	var minDamage = range[0] * hits;
	var maxDamage = range[1] * hits;
	if (move.category === "Status" || maxDamage <= 0) {
		return {
			html: '<span class="simplified-damage-chip-display simplified-status-output">Status</span>',
			tooltipHtml: ""
		};
	}
	var maxPercent = defender.maxHP() > 0 ? (maxDamage * 100) / defender.maxHP() : 0;
	var barWidth = Math.round(Math.max(3, Math.min(100, (maxPercent / 150) * 100)));
	var percentText = formatSimplifiedPercent(minDamage, defender.maxHP()) + " - " + formatSimplifiedPercent(maxDamage, defender.maxHP());
	var rawText = formatSimplifiedDamageValue(minDamage) + " - " + formatSimplifiedDamageValue(maxDamage);
	var hitsHtml = buildSimplifiedHitsIndicatorHtml(move);
	var chipHtml =
		'<span class="simplified-damage-chip-display" tabindex="0">' +
			'<span class="simplified-damage-percent">' + percentText + "</span>" +
			'<span class="simplified-damage-bar ' + getSimplifiedBarLevelClass(maxPercent) + '">' +
				'<span class="simplified-damage-bar-fill" style="width:' + barWidth + '%"></span>' +
			"</span>" +
			'<span class="simplified-damage-raw">&nbsp;' + rawText + "</span>" +
			hitsHtml +
		"</span>";
	return {
		html: chipHtml,
		tooltipHtml: buildSimplifiedRollTooltipHtml(result, move)
	};
}

function applySimplifiedChipToNode(containerNode, chip) {
	var node = $(containerNode);
	node.html(chip.html);
	var chipNode = node.find(".simplified-damage-chip-display");
	if (chip.tooltipHtml) {
		chipNode.data("rollsTooltipHtml", chip.tooltipHtml);
	} else {
		chipNode.removeData("rollsTooltipHtml");
	}
}

function ensureSimplifiedSideCard(sideSelector) {
	var pokeInfo = $(sideSelector);
	if (!pokeInfo.length) return $();
	var existingCard = pokeInfo.children(".simplified-side-card");
	if (existingCard.length) return existingCard;
	var sideClass = sideSelector === "#p2" ? "side-right" : "side-left";
	var sideToken = sideSelector === "#p2" ? "R" : "L";
	var statParts = [];
	for (var i = 0; i < simplifiedStatDisplayOrder.length; i++) {
		var statInfo = simplifiedStatDisplayOrder[i];
		var sourceStatClass = simplifiedStatRowClassByStatKey[statInfo.statKey] || "";
		var boostControlsHtml = "";
		if (statInfo.boostKey) {
			boostControlsHtml = '' +
				'<select class="simplified-side-stat-boost-input"></select>' +
				'<button type="button" class="btn simplified-side-stat-step" data-step="1">+</button>' +
				'<button type="button" class="btn simplified-side-stat-step" data-step="-1">-</button>';
		}
		statParts.push(
			'<div class="simplified-side-stat-row ' + sourceStatClass + '" data-stat-key="' + statInfo.statKey + '">' +
				'<span class="simplified-side-stat-label">' + statInfo.label + "</span>" +
				'<span class="simplified-side-stat-base">-</span>' +
				'<span class="simplified-side-stat-iv">-</span>' +
				'<span class="simplified-side-stat-value">-</span>' +
				'<span class="simplified-side-stat-controls">' + boostControlsHtml + "</span>" +
				'<span class="simplified-side-speed-state" aria-hidden="true"></span>' +
			"</div>"
		);
	}
	var moveParts = [];
	for (var moveIndex = 0; moveIndex < 4; moveIndex++) {
		var critInputId = "simplifiedCrit" + sideToken + (moveIndex + 1);
		moveParts.push(
			'<div class="simplified-side-move-row" data-move-index="' + moveIndex + '">' +
				'<div class="simplified-side-move-info">' +
					'<span class="simplified-side-move-name"></span>' +
					'<span class="simplified-side-move-meta"></span>' +
				"</div>" +
				'<span class="simplified-side-move-crit-wrap">' +
					'<input aria-describedby="criticalHitInstruction" class="simplified-side-move-crit-input visually-hidden" type="checkbox" id="' + critInputId + '" />' +
					'<label class="btn crit-btn simplified-side-move-crit-btn" for="' + critInputId + '" title="Force this attack to be a critical hit?">Crit</label>' +
				"</span>" +
				'<span class="simplified-side-move-damage simplified-damage-chip"></span>' +
			"</div>"
		);
	}
	var cardHtml =
		'<div class="simplified-side-card ' + sideClass + '">' +
			'<div class="simplified-side-header">' +
				'<button type="button" class="btn simplified-side-edit-btn">Edit</button>' +
				'<div class="simplified-side-header-text">' +
					'<div class="simplified-side-name">-</div>' +
					'<div class="simplified-side-controls">' +
						'<label class="simplified-side-control-label">Lvl ' +
							'<input type="number" step="1" class="simplified-side-level-input" />' +
						"</label>" +
						'<label class="simplified-side-control-label simplified-side-level-cap-wrap">Cap ' +
							'<input type="number" step="1" class="simplified-side-level-cap-input" />' +
						"</label>" +
						'<label class="simplified-side-control-label">Status ' +
							'<select class="simplified-side-status-input"></select>' +
						"</label>" +
						'<label class="simplified-side-control-label simplified-side-nature-wrap">Nature ' +
							'<select class="simplified-side-nature-input"></select>' +
						"</label>" +
					"</div>" +
				"</div>" +
			"</div>" +
			'<div class="simplified-side-meta">' +
				'<label class="simplified-side-control-label simplified-side-ability-wrap">Ability ' +
					'<select class="simplified-side-ability-input"></select>' +
				"</label>" +
				'<label class="simplified-side-control-label simplified-side-item-wrap">Item ' +
					'<select class="simplified-side-item-input"></select>' +
				"</label>" +
				'<label class="simplified-side-ignore-item-label" title="When checked, this Pokemon is treated as if it has no held item, without clearing the selected item.">' +
					'<input type="checkbox" class="simplified-side-ignore-item-toggle" />' +
					"No Item" +
				"</label>" +
				'<div class="simplified-side-types"></div>' +
				'<div class="simplified-side-form-wrap">' +
					'<img class="simplified-side-form-sprite" src="" alt="Pokemon form sprite" title="No alternate forms" />' +
				"</div>" +
				'<a class="analysis links-lighten simplified-side-open-dex" target="_blank" href="">Open In Pokedex</a>' +
			"</div>" +
			'<div class="simplified-side-hp">' +
				'<div class="simplified-side-hp-edit">' +
					'<span class="simplified-side-hp-prefix">HP</span>' +
					'<input type="number" step="1" class="simplified-side-current-hp-input" />' +
					'<span class="simplified-side-hp-sep">/</span>' +
					'<span class="simplified-side-max-hp">-</span>' +
					'<span class="simplified-side-hp-paren">(</span>' +
					'<input type="number" min="0" max="100" step="1" class="simplified-side-percent-hp-input" />' +
					'<span class="simplified-side-hp-percent">%)</span>' +
				"</div>" +
				'<div class="hpbar simplified-side-hpbar hp-green"></div>' +
			"</div>" +
			'<div class="simplified-side-stats">' +
				'<div class="simplified-side-stat-head">' +
					'<span class="simplified-side-stat-label"></span>' +
					'<span class="simplified-side-stat-base">Base</span>' +
					'<span class="simplified-side-stat-iv">IVs</span>' +
					'<span class="simplified-side-stat-value">Total</span>' +
					'<span class="simplified-side-stat-controls"></span>' +
					'<span class="simplified-side-speed-state"></span>' +
				"</div>" +
				statParts.join("") +
			"</div>" +
			'<div class="simplified-side-moves">' + moveParts.join("") + "</div>" +
		"</div>";
	pokeInfo.append(cardHtml);
	return pokeInfo.children(".simplified-side-card");
}

function buildSimplifiedTypeTagsHtml(types) {
	var list = Array.isArray(types) ? types : [];
	if (!list.length) return "";
	var typingColoursEnabled = isSimplifiedLayoutEnabled() || (typeof getAppSettings === "function" ? !!getAppSettings().moreColour : false);
	var tags = [];
	for (var i = 0; i < list.length; i++) {
		if (!list[i]) continue;
		var typeName = String(list[i]);
		var styleText = "";
		if (typingColoursEnabled) {
			var typeColor = getMoveTypeColor(typeName);
			if (typeColor) {
				styleText = ' style="background-color:' + escapeHtmlText(typeColor) +
					";border-color:" + escapeHtmlText(typeColor) +
					";color:" + escapeHtmlText(getMoveLabelTextColor(typeColor)) + '"';
			}
		}
		tags.push('<span class="simplified-side-type-tag"' + styleText + '>' + escapeHtmlText(typeName) + "</span>");
	}
	return tags.join("");
}

function ensureSimplifiedMoveSelectOptions(selectNode, preferredMoveName) {
	var moveSelect = $(selectNode);
	if (!moveSelect.length) return;
	var optionCount = moveSelect.find("option").length;
	if (optionCount > 1 && moveSelect.data("srcHtml")) return;
	if (typeof moves === "undefined" || !moves) return;
	var moveNames = Object.keys(moves);
	if (!moveNames.length || typeof getSelectOptions !== "function") return;
	var currentValue = moveSelect.val();
	if (moveSelect.data("select2")) {
		moveSelect.select2("destroy");
		moveSelect.removeClass("select2-offscreen");
	}
	moveSelect.html(getSelectOptions(moveNames, true));
	moveSelect.data("srcHtml", moveSelect.html() || "");
	var desiredValue = currentValue || preferredMoveName || "(No Move)";
	var hasDesiredValue = moveSelect.find("option").filter(function () {
		return $(this).val() === desiredValue;
	}).length > 0;
	if (hasDesiredValue) {
		moveSelect.val(desiredValue);
		return;
	}
	if (moveSelect.find("option").filter(function () {
		return $(this).val() === "(No Move)";
	}).length > 0) {
		moveSelect.val("(No Move)");
		return;
	}
	moveSelect.prop("selectedIndex", 0);
}

function refreshSourceMoveMeta(sourceMoveRow) {
	if (!sourceMoveRow || !sourceMoveRow.length) return;
	if (typeof updateMoveMetaForGroup === "function") {
		updateMoveMetaForGroup(sourceMoveRow);
	}	
}

function applySimplifiedMoveDisplayFallback(moveSelectNode, moveName) {
	var moveSelect = $(moveSelectNode);
	if (!moveSelect.length) return;
	var currentValue = moveSelect.val();
	var normalizedCurrentValue = currentValue === null || typeof currentValue === "undefined" ? "" : String(currentValue);
	var fallbackValue = moveName ? String(moveName) : "";
	if (!fallbackValue || fallbackValue === "(No Move)") return;
	if (normalizedCurrentValue && normalizedCurrentValue !== "(No Move)") return;
	var hasFallbackOption = moveSelect.find("option").filter(function () {
		return $(this).val() === fallbackValue;
	}).length > 0;
	if (!hasFallbackOption) return;
	moveSelect.val(fallbackValue);
	if (!moveSelect.data("select2")) return;
	moveSelect.data("simplifiedSyncing", true);
	try {
		moveSelect.select2("val", fallbackValue, false);
	} finally {
		moveSelect.removeData("simplifiedSyncing");
	}
}

function buildFallbackMoveMetaText(moveName) {
	if (!moveName || moveName === "(No Move)" || typeof moves === "undefined" || !moves) return "";
	var info = moves[moveName];
	if (!info) return "";
	var ppText = typeof info.pp === "number" && info.pp >= 0 ? String(info.pp) : "--";
	var accText = "--";
	if (typeof info.accuracy === "number" && isFinite(info.accuracy)) {
		accText = String(info.accuracy) + "%";
	}
	return "PP " + ppText + " | ACC " + accText;
}

function simplifiedSelectSearchMatcher(term, text) {
	var searchText = String(text || "").toUpperCase();
	var queryText = String(term || "").toUpperCase();
	return searchText.indexOf(queryText) === 0 || searchText.indexOf(" " + queryText) >= 0;
}

function isSimplifiedMoveSearchSelect(targetNode) {
	return targetNode.hasClass("simplified-side-move-select");
}

function ensureSimplifiedMoveSearchSelect(targetNode) {
	if (!targetNode || !targetNode.length) return;
	if (typeof targetNode.select2 !== "function") return;
	if (targetNode.data("select2")) return;
	targetNode.select2({
		dropdownAutoWidth: true,
		matcher: simplifiedSelectSearchMatcher
	});
}

function syncSimplifiedFormSprite(sideSelector, card, attacker) {
	var pokeInfo = $(sideSelector);
	if (!pokeInfo.length || !card || !card.length) return;
	var spriteNode = card.find(".simplified-side-form-sprite").first();
	if (!spriteNode.length) return;
	var speciesName = "";
	var transformedSpecies = String(pokeInfo.attr("data-transform-species") || "").trim();
	if (transformedSpecies) speciesName = transformedSpecies;
	var formeSelect = pokeInfo.find(".forme").first();
	if (!speciesName && formeSelect.length) {
		var selectedForme = String(formeSelect.val() || "").trim();
		if (selectedForme) speciesName = selectedForme;
	}
	if (!speciesName && typeof resolveInlineSpriteSpeciesForPokeInfo === "function") {
		speciesName = String(resolveInlineSpriteSpeciesForPokeInfo(pokeInfo) || "").trim();
	}
	if (!speciesName && attacker && attacker.name) {
		speciesName = String(attacker.name).trim();
	}
	if (speciesName && typeof setTrainerSpriteImage === "function") {
		setTrainerSpriteImage(spriteNode.get(0), speciesName);
	}
	var hasFormes = !!(formeSelect.length && formeSelect.find("option").length > 1);
	spriteNode.attr("title", hasFormes ? "Click to cycle forms" : "No alternate forms");
	spriteNode.css("cursor", hasFormes ? "pointer" : "default");
}

function syncSimplifiedDexLink(sideSelector, card) {
	var pokeInfo = $(sideSelector);
	if (!pokeInfo.length || !card || !card.length) return;
	var dexLink = card.find(".simplified-side-open-dex").first();
	if (!dexLink.length) return;
	var sourceLink = pokeInfo.find(".info-group.top .analysis").first();
	var pokemonName = "";
	var href = "";
	if (sourceLink.length) {
		pokemonName = String(sourceLink.attr("data-pokemon-name") || "").trim();
		href = String(sourceLink.attr("href") || "").trim();
	}
	if (!pokemonName && typeof getSelectedPokemonNameForAnalysis === "function") {
		pokemonName = String(getSelectedPokemonNameForAnalysis(sourceLink.length ? sourceLink.get(0) : dexLink.get(0)) || "").trim();
	}
	if ((!href || href === "#") && pokemonName && typeof astralDexUrl === "function") {
		href = astralDexUrl(pokemonName);
	}
	dexLink.attr("href", href || "");
	if (pokemonName) dexLink.attr("data-pokemon-name", pokemonName);
	dexLink.text("Open In Pokedex");
}

function syncSimplifiedSelectFromSource(sideSelector, sourceSelector, targetNode) {
	var source = $(sideSelector + " " + sourceSelector).first();
	var target = $(targetNode);
	if (!source.length || !target.length) return;
	var isMoveSearchSelect = isSimplifiedMoveSearchSelect(target);
	var sourceHtml = source.html() || "";
	var sourceValue = source.val();
	if (sourceValue === null || typeof sourceValue === "undefined") {
		var sourceSelected = source.find("option:selected").first();
		sourceValue = sourceSelected.length ? sourceSelected.val() : "";
	}
	if (sourceValue === null || typeof sourceValue === "undefined") sourceValue = "";
	sourceValue = String(sourceValue);
	if (isMoveSearchSelect && !sourceValue) {
		var rememberedMoveValue = String(target.data("lastValidMove") || "");
		if (rememberedMoveValue) {
			sourceValue = rememberedMoveValue;
		} else {
			var existingTargetValue = target.val();
			var normalizedExistingTargetValue = existingTargetValue === null || typeof existingTargetValue === "undefined"
				? ""
				: String(existingTargetValue);
			if (normalizedExistingTargetValue) sourceValue = normalizedExistingTargetValue;
		}
	}
	var sourceDisabled = source.prop("disabled");
	if (isMoveSearchSelect && target.data("select2") && target.data("srcHtml") !== sourceHtml) {
		target.select2("destroy");
		target.removeClass("select2-offscreen");
	}
	if (target.data("srcHtml") !== sourceHtml) {
		target.html(sourceHtml);
		target.data("srcHtml", sourceHtml);
	}
	target.val(sourceValue);
	if (isMoveSearchSelect && sourceValue && sourceValue !== "(No Move)") {
		target.data("lastValidMove", sourceValue);
	}
	target.prop("disabled", sourceDisabled);
	if (!isMoveSearchSelect) return;
	ensureSimplifiedMoveSearchSelect(target);
	if (!target.data("select2")) return;
	target.data("simplifiedSyncing", true);
	try {
		target.select2("val", sourceValue, false);
		target.select2("enable", !sourceDisabled);
	} finally {
		target.removeData("simplifiedSyncing");
	}
}

function syncSimplifiedInputFromSource(sideSelector, sourceSelector, targetNode) {
	var source = $(sideSelector + " " + sourceSelector).first();
	var target = $(targetNode);
	if (!source.length || !target.length) return;
	target.val(source.val());
	target.prop("disabled", source.prop("disabled"));
}

function updateSimplifiedSpeedState(sideSelector, statRow) {
	var speedNode = $(sideSelector + " .sp .totalMod").first();
	var speedState = "";
	if (speedNode.hasClass("speed-faster")) speedState = "speed-faster";
	else if (speedNode.hasClass("speed-slower")) speedState = "speed-slower";
	else if (speedNode.hasClass("speed-tie")) speedState = "speed-tie";
	var speedStateNode = statRow.find(".simplified-side-speed-state");
	speedStateNode.removeClass("speed-faster speed-slower speed-tie");
	speedStateNode.text($.trim(speedNode.text()));
	if (speedState) speedStateNode.addClass(speedState);
}

function updateSimplifiedHpBar(sideSelector, card) {
	var currentHpInput = $(sideSelector + " .current-hp").first();
	var maxHpSpan = $(sideSelector + " .max-hp").first();
	var percentHpInput = $(sideSelector + " .percent-hp").first();
	var currentHp = Number(currentHpInput.val());
	var maxHp = Number(maxHpSpan.text());
	var percentHp = Number(percentHpInput.val());
	if (!isFinite(currentHp)) currentHp = 0;
	if (!isFinite(maxHp) || maxHp <= 0) maxHp = 1;
	if (!isFinite(percentHp)) percentHp = Math.round((currentHp * 1000) / maxHp) / 10;
	var derivedPercent = (currentHp * 100) / maxHp;
	var clampedPercent = Math.max(0, Math.min(100, isFinite(derivedPercent) ? derivedPercent : percentHp));
	var boundedCurrentHp = Math.max(0, Math.min(maxHp, isFinite(currentHp) ? currentHp : 0));
	var hpBar = card.find(".simplified-side-hpbar");
	var hpCurrentInput = card.find(".simplified-side-current-hp-input");
	var hpPercentInput = card.find(".simplified-side-percent-hp-input");
	var hpMaxNode = card.find(".simplified-side-max-hp");
	if (typeof drawHealthBar === "function") {
		drawHealthBar(card.find(".simplified-side-hp"), maxHp, boundedCurrentHp);
	} else if (hpBar.length) {
		var fillColor = clampedPercent > 50 ? "green" : (clampedPercent > 20 ? "yellow" : "red");
		hpBar.removeClass("hp-green hp-yellow hp-red").addClass("hp-" + fillColor);
		hpBar.css("background", "linear-gradient(to right, " + fillColor + " " + clampedPercent + "%, white 0%)");
	}
	hpCurrentInput.val(Math.floor(boundedCurrentHp));
	hpPercentInput.val(Math.round(clampedPercent));
	hpMaxNode.text(Math.floor(maxHp));
}

function syncSimplifiedSideEditButton(sideSelector) {
	var pokeInfo = $(sideSelector);
	if (!pokeInfo.length) return;
	var isExpanded = pokeInfo.hasClass("simplified-side-expanded");
	var button = pokeInfo.find(".simplified-side-edit-btn");
	button.text(isExpanded ? "Done" : "Edit");
}

function syncSimplifiedSideLayoutState(layoutMode) {
	var simplifiedEnabled = normalizeLayoutModeChoice(layoutMode) === LAYOUT_SIMPLIFIED;
	for (var i = 0; i < SIMPLIFIED_SIDE_SELECTORS.length; i++) {
		var sideSelector = SIMPLIFIED_SIDE_SELECTORS[i];
		var pokeInfo = $(sideSelector);
		if (!pokeInfo.length) continue;
		ensureSimplifiedSideCard(sideSelector);
		if (!simplifiedEnabled) {
			pokeInfo.removeClass("simplified-side-expanded");
		} else {
			pokeInfo.toggleClass("simplified-side-expanded", !!simplifiedSideExpandedState[sideSelector]);
		}
		syncSimplifiedSideEditButton(sideSelector);
	}
}

function renderSimplifiedSideCard(sideSelector, sideIndex, attacker, defender) {
	var card = ensureSimplifiedSideCard(sideSelector);
	if (!card.length) return;
	var displayName = attacker && attacker.name ? attacker.name : "-";
	var genderValue = attacker && attacker.gender ? String(attacker.gender).toUpperCase() : "";
	if (genderValue === "M") displayName += " (M)";
	if (genderValue === "F") displayName += " (F)";
	card.find(".simplified-side-name").text(displayName);

	syncSimplifiedInputFromSource(sideSelector, ".level", card.find(".simplified-side-level-input"));
	var levelCapSource = $(sideSelector + " .level-cap").first();
	card.find(".simplified-side-level-cap-wrap").toggle(!!levelCapSource.length);
	if (levelCapSource.length) {
		syncSimplifiedInputFromSource(sideSelector, ".level-cap", card.find(".simplified-side-level-cap-input"));
	}
	syncSimplifiedSelectFromSource(sideSelector, ".status", card.find(".simplified-side-status-input"));
	syncSimplifiedSelectFromSource(sideSelector, ".nature", card.find(".simplified-side-nature-input"));
	syncSimplifiedSelectFromSource(sideSelector, ".ability", card.find(".simplified-side-ability-input"));
	syncSimplifiedSelectFromSource(sideSelector, ".item", card.find(".simplified-side-item-input"));
	var sourceIgnoreItemToggle = $(sideSelector + " .ignore-item-toggle").first();
	var simplifiedIgnoreItemToggle = card.find(".simplified-side-ignore-item-toggle").first();
	if (simplifiedIgnoreItemToggle.length) {
		simplifiedIgnoreItemToggle.prop("checked", sourceIgnoreItemToggle.length && sourceIgnoreItemToggle.is(":checked"));
		simplifiedIgnoreItemToggle.prop("disabled", sourceIgnoreItemToggle.length ? sourceIgnoreItemToggle.prop("disabled") : false);
	}
	card.find(".simplified-side-types").html(buildSimplifiedTypeTagsHtml(attacker && attacker.types ? attacker.types : []));
	syncSimplifiedFormSprite(sideSelector, card, attacker);
	syncSimplifiedDexLink(sideSelector, card);
	updateSimplifiedHpBar(sideSelector, card);

	for (var statIndex = 0; statIndex < simplifiedStatDisplayOrder.length; statIndex++) {
		var statInfo = simplifiedStatDisplayOrder[statIndex];
		var statRow = card.find('.simplified-side-stat-row[data-stat-key="' + statInfo.statKey + '"]');
		var sourceStatClass = simplifiedStatRowClassByStatKey[statInfo.statKey];
		var sourceStatRow = sourceStatClass ? $(sideSelector + " ." + sourceStatClass).first() : $();
		var sourceTotalNode = sourceStatRow.find(".total").first();
		var statValueNode = statRow.find(".simplified-side-stat-value");
		var statValue = sourceTotalNode.length ? $.trim(sourceTotalNode.text()) : "";
		if (!statValue) {
			statValue = attacker && attacker.stats && typeof attacker.stats[statInfo.statKey] !== "undefined"
				? attacker.stats[statInfo.statKey]
				: "-";
		}
		statValueNode.text(statValue);
		var baseValue = sourceStatRow.find(".base").first().val();
		var ivValue = sourceStatRow.find(".ivs").first().val();
		if (typeof ivValue === "undefined" || ivValue === "") {
			ivValue = sourceStatRow.find(".dvs").first().val();
		}
		statRow.find(".simplified-side-stat-base").text(typeof baseValue === "undefined" || baseValue === "" ? "-" : baseValue);
		statRow.find(".simplified-side-stat-iv").text(typeof ivValue === "undefined" || ivValue === "" ? "-" : ivValue);
		statValueNode.removeClass("nature-boost nature-drop");
		if (sourceTotalNode.hasClass("nature-boost")) statValueNode.addClass("nature-boost");
		if (sourceTotalNode.hasClass("nature-drop")) statValueNode.addClass("nature-drop");
		if (!statInfo.boostKey) {
			statRow.find(".simplified-side-stat-controls").addClass("is-empty");
			if (statInfo.statKey === "spe") updateSimplifiedSpeedState(sideSelector, statRow);
			continue;
		}
		statRow.find(".simplified-side-stat-controls").removeClass("is-empty");
		if (sourceStatClass) {
			syncSimplifiedSelectFromSource(sideSelector, "." + sourceStatClass + " .boost", statRow.find(".simplified-side-stat-boost-input"));
		}
		var boostValue = attacker && attacker.boosts && typeof attacker.boosts[statInfo.boostKey] !== "undefined"
			? Number(attacker.boosts[statInfo.boostKey])
			: 0;
		if (!isFinite(boostValue)) boostValue = 0;
		statRow.removeClass("is-boost-positive is-boost-negative");
		if (boostValue === 0) {
		} else if (boostValue > 0) {
			statRow.addClass("is-boost-positive");
		} else {
			statRow.addClass("is-boost-negative");
		}
		if (statInfo.statKey === "spe") updateSimplifiedSpeedState(sideSelector, statRow);
	}

	var showMoveMeta = typeof getAppSettings === "function" ? !!getAppSettings().moveMeta : false;
	for (var moveIndex = 0; moveIndex < 4; moveIndex++) {
		var moveRow = card.find('.simplified-side-move-row[data-move-index="' + moveIndex + '"]');
		var move = attacker && attacker.moves ? attacker.moves[moveIndex] : null;
		var moveName = move && move.name ? move.name : "";
		var sourceMoveRow = $(sideSelector + " .move" + (moveIndex + 1)).first();
		refreshSourceMoveMeta(sourceMoveRow);
		moveRow.find(".simplified-side-move-name").text(moveName || "(No Move)");
		var metaText = sourceMoveRow.length ? $.trim(sourceMoveRow.find(".move-meta").first().text()) : "";
		if (!metaText || metaText === "PP -- | ACC --") {
			var fallbackMetaText = buildFallbackMoveMetaText(moveName);
			if (fallbackMetaText) metaText = fallbackMetaText;
		}
		moveRow.find(".simplified-side-move-meta").text(metaText);
		moveRow.toggleClass("is-meta-hidden", !showMoveMeta || !metaText);
		var sourceCritToggle = sourceMoveRow.find(".move-crit").first();
		var simplifiedCritToggle = moveRow.find(".simplified-side-move-crit-input").first();
		if (simplifiedCritToggle.length) {
			var critChecked = sourceCritToggle.length && sourceCritToggle.is(":checked");
			simplifiedCritToggle.prop("checked", critChecked);
			simplifiedCritToggle.prop("disabled", sourceCritToggle.length ? sourceCritToggle.prop("disabled") : false);
		}
		var moveDamageNode = moveRow.find(".simplified-side-move-damage");
		var result = damageResults && damageResults[sideIndex] ? damageResults[sideIndex][moveIndex] : null;
		var chip = buildSimplifiedDamageChip(result, move, defender);
		applySimplifiedChipToNode(moveDamageNode, chip);
	}
}

function renderSimplifiedSideCards(p1, p2) {
	if (!isSimplifiedLayoutEnabled()) return;
	renderSimplifiedSideCard("#p1", 0, p1, p2);
	renderSimplifiedSideCard("#p2", 1, p2, p1);
}

function renderDamageResultDisplay(sideIndex, moveIndex, result, attacker, defender) {
	var damageNode = $(resultLocations[sideIndex][moveIndex].damage);
	if (!isSimplifiedLayoutEnabled()) {
		damageNode.removeClass("simplified-damage-chip");
		damageNode.text(normalizePercentRangeText(result.moveDesc(notation)));
		return;
	}
	var move = attacker && attacker.moves ? attacker.moves[moveIndex] : null;
	var chip = buildSimplifiedDamageChip(result, move, defender);
	damageNode.addClass("simplified-damage-chip");
	applySimplifiedChipToNode(damageNode, chip);
}

function ensureSimplifiedDamageTooltip() {
	if (simplifiedDamageTooltipNode && document.body.contains(simplifiedDamageTooltipNode)) return simplifiedDamageTooltipNode;
	var tooltip = document.createElement("div");
	tooltip.id = "simplified-rolls-tooltip";
	tooltip.className = "simplified-rolls-tooltip";
	tooltip.hidden = true;
	document.body.appendChild(tooltip);
	simplifiedDamageTooltipNode = tooltip;
	return simplifiedDamageTooltipNode;
}

function hideSimplifiedDamageTooltip() {
	if (!simplifiedDamageTooltipNode) return;
	simplifiedDamageTooltipNode.hidden = true;
	simplifiedDamageTooltipNode.innerHTML = "";
}

function ensureDamageApplyMenu() {
	if (damageApplyMenuNode && document.body.contains(damageApplyMenuNode)) return damageApplyMenuNode;
	var menu = document.createElement("div");
	menu.id = "damage-apply-menu";
	menu.className = "damage-apply-menu";
	menu.hidden = true;
	menu.innerHTML = '' +
		'<div class="damage-apply-title">Apply selected damage</div>' +
		'<div class="damage-apply-value"></div>' +
		'<div class="damage-apply-actions">' +
			'<button type="button" class="btn damage-apply-btn" data-target="#p1">- P1 HP</button>' +
			'<button type="button" class="btn damage-apply-btn" data-target="#p2">- P2 HP</button>' +
		"</div>";
	document.body.appendChild(menu);
	damageApplyMenuNode = menu;
	return damageApplyMenuNode;
}

function closeDamageApplyMenu() {
	if (!damageApplyMenuNode) return;
	damageApplyMenuNode.hidden = true;
	damageApplySelectionPayload = null;
}

function isDamageSelectionNode(node) {
	if (!node) return false;
	var elementNode = node.nodeType === 1 ? node : node.parentNode;
	if (!elementNode) return false;
	return !!$(elementNode).closest("#damageValues, [id^='resultDamage'], .damage-roll-highlight, .simplified-damage-percent, .simplified-damage-raw, .simplified-roll-value").length;
}

function parseDamageSelectionText(selectionText) {
	var text = String(selectionText || "").replace(/\s+/g, " ").trim();
	if (!text) return null;
	var hasPercent = text.indexOf("%") >= 0;
	var numberMatches = text.match(/\d+(?:\.\d+)?(?!\s*(?:st|nd|rd|th)\b)/gi);
	if (!numberMatches || !numberMatches.length) return null;
	var numericValues = [];
	for (var i = 0; i < numberMatches.length; i++) {
		var parsed = parseFloat(numberMatches[i]);
		if (isFinite(parsed)) numericValues.push(parsed);
	}
	if (!numericValues.length) return null;
	var selectedValues = numericValues.length > 2 ? numericValues.slice(0, 2) : numericValues.slice();
	var minValue = Math.min.apply(null, selectedValues);
	var maxValue = Math.max.apply(null, selectedValues);
	var value = selectedValues.length > 1 ? ((minValue + maxValue) / 2) : selectedValues[0];
	if (!isFinite(value) || value <= 0) return null;
	return {
		type: hasPercent ? "percent" : "raw",
		value: value,
		min: minValue,
		max: maxValue,
		fromRange: selectedValues.length > 1
	};
}

function formatDamageApplySelectionPayload(payload) {
	if (!payload) return "";
	if (payload.type === "percent") {
		if (payload.fromRange) {
			return formatCompactNumber(payload.min) + "% - " + formatCompactNumber(payload.max) + "% (avg " + formatCompactNumber(payload.value) + "%)";
		}
		return formatCompactNumber(payload.value) + "%";
	}
	var roundedValue = Math.round(payload.value);
	if (payload.fromRange) {
		return Math.round(payload.min) + " - " + Math.round(payload.max) + " (avg " + roundedValue + ")";
	}
	return String(roundedValue);
}

function openDamageApplyMenuForSelection(selectionText, selectionRect) {
	var payload = parseDamageSelectionText(selectionText);
	if (!payload) {
		closeDamageApplyMenu();
		return;
	}
	var menu = ensureDamageApplyMenu();
	var valueNode = menu.querySelector(".damage-apply-value");
	if (valueNode) valueNode.textContent = "Selected: " + formatDamageApplySelectionPayload(payload);
	damageApplySelectionPayload = payload;
	menu.hidden = false;
	var left = 8;
	var top = 8;
	if (selectionRect && isFinite(selectionRect.left) && isFinite(selectionRect.bottom)) {
		left = selectionRect.left + (selectionRect.width / 2);
		top = selectionRect.bottom + 10;
	}
	var maxLeft = window.innerWidth - menu.offsetWidth - 10;
	var maxTop = window.innerHeight - menu.offsetHeight - 10;
	menu.style.left = Math.max(8, Math.min(left, maxLeft)) + "px";
	menu.style.top = Math.max(8, Math.min(top, maxTop)) + "px";
}

function applySelectedDamageToPoke(sideSelector) {
	if (!damageApplySelectionPayload) return;
	var pokeInfo = $(sideSelector);
	if (!pokeInfo.length) return;
	var currentHpInput = pokeInfo.find(".current-hp").first();
	var maxHpNode = pokeInfo.find(".max-hp").first();
	if (!currentHpInput.length || !maxHpNode.length) return;
	var currentHp = parseInt(currentHpInput.val(), 10);
	var maxHp = parseInt(maxHpNode.text(), 10);
	if (Number.isNaN(currentHp) || Number.isNaN(maxHp) || maxHp <= 0) return;
	var damageAmount = Math.floor(damageApplySelectionPayload.value);
	if (damageApplySelectionPayload.type === "percent") {
		damageAmount = Math.floor((maxHp * damageApplySelectionPayload.value) / 100);
	}
	if (!isFinite(damageAmount) || damageAmount <= 0) return;
	var nextHp = Math.max(0, currentHp - damageAmount);
	currentHpInput.val(nextHp);
	currentHpInput.trigger("keyup");
	currentHpInput.trigger("change");
	closeDamageApplyMenu();
}

function updateDamageApplyMenuFromSelection() {
	var selection = window.getSelection ? window.getSelection() : null;
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		closeDamageApplyMenu();
		return;
	}
	if (!isDamageSelectionNode(selection.anchorNode) && !isDamageSelectionNode(selection.focusNode)) {
		closeDamageApplyMenu();
		return;
	}
	var selectedText = selection.toString();
	if (!selectedText || !selectedText.trim()) {
		closeDamageApplyMenu();
		return;
	}
	var rangeRect = selection.getRangeAt(0).getBoundingClientRect();
	openDamageApplyMenuForSelection(selectedText, rangeRect);
}

function positionSimplifiedDamageTooltip(targetNode, tooltipNode) {
	var targetRect = targetNode.getBoundingClientRect();
	var tooltipRect = tooltipNode.getBoundingClientRect();
	var margin = 8;
	var left = window.scrollX + targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
	var minLeft = window.scrollX + margin;
	var maxLeft = window.scrollX + window.innerWidth - tooltipRect.width - margin;
	if (left < minLeft) left = minLeft;
	if (left > maxLeft) left = maxLeft;
	var top = window.scrollY + targetRect.bottom + margin;
	var maxTop = window.scrollY + window.innerHeight - tooltipRect.height - margin;
	if (top > maxTop) {
		top = window.scrollY + targetRect.top - tooltipRect.height - margin;
	}
	tooltipNode.style.left = left + "px";
	tooltipNode.style.top = top + "px";
}

function showSimplifiedDamageTooltip(targetNode) {
	if (!isSimplifiedLayoutEnabled()) return;
	var content = $(targetNode).data("rollsTooltipHtml");
	if (!content) return;
	var tooltip = ensureSimplifiedDamageTooltip();
	tooltip.innerHTML = content;
	tooltip.hidden = false;
	positionSimplifiedDamageTooltip(targetNode, tooltip);
}

function getSimplifiedDamageTooltipAnchorNode() {
	var hovered = $(".simplified-damage-chip-display:hover").get(0);
	if (hovered) return hovered;
	var activeElement = document.activeElement;
	if (!activeElement) return null;
	var focusedChip = $(activeElement).closest(".simplified-damage-chip-display");
	return focusedChip.length ? focusedChip.get(0) : null;
}

$(document)
	.off("mouseenter.simplifiedrolls focusin.simplifiedrolls", ".simplified-damage-chip-display")
	.on("mouseenter.simplifiedrolls focusin.simplifiedrolls", ".simplified-damage-chip-display", function () {
		showSimplifiedDamageTooltip(this);
	})
	.off("mouseleave.simplifiedrolls blur.simplifiedrolls", ".simplified-damage-chip-display")
	.on("mouseleave.simplifiedrolls blur.simplifiedrolls", ".simplified-damage-chip-display", function () {
		if (simplifiedRollsShiftHeld) return;
		hideSimplifiedDamageTooltip();
	});

$(document)
	.off("keydown.simplifiedrolls keyup.simplifiedrolls")
	.on("keydown.simplifiedrolls keyup.simplifiedrolls", function (ev) {
		var isShiftEvent = ev.key === "Shift" || ev.keyCode === 16;
		if (!isShiftEvent) return;
		simplifiedRollsShiftHeld = ev.type === "keydown";
		if (simplifiedRollsShiftHeld) {
			var anchorNodeWhilePressed = getSimplifiedDamageTooltipAnchorNode();
			if (anchorNodeWhilePressed) showSimplifiedDamageTooltip(anchorNodeWhilePressed);
			return;
		}
		var anchorNodeAfterRelease = getSimplifiedDamageTooltipAnchorNode();
		if (anchorNodeAfterRelease) {
			showSimplifiedDamageTooltip(anchorNodeAfterRelease);
			return;
		}
		hideSimplifiedDamageTooltip();
	});

$(window).off("resize.simplifiedrolls scroll.simplifiedrolls blur.simplifiedrolls").on("resize.simplifiedrolls scroll.simplifiedrolls blur.simplifiedrolls", function () {
	simplifiedRollsShiftHeld = false;
	hideSimplifiedDamageTooltip();
	closeDamageApplyMenu();
});

$(document)
	.off("mouseup.damageapply keyup.damageapply touchend.damageapply")
	.on("mouseup.damageapply keyup.damageapply touchend.damageapply", function () {
		setTimeout(updateDamageApplyMenuFromSelection, 0);
	})
	.off("click.damageapply", ".damage-apply-btn")
	.on("click.damageapply", ".damage-apply-btn", function (ev) {
		ev.preventDefault();
		var sideSelector = String($(this).attr("data-target") || "");
		if (sideSelector !== "#p1" && sideSelector !== "#p2") return;
		applySelectedDamageToPoke(sideSelector);
	})
	.off("mousedown.damageapply touchstart.damageapply")
	.on("mousedown.damageapply touchstart.damageapply", function (ev) {
		if ($(ev.target).closest("#damage-apply-menu").length) return;
		closeDamageApplyMenu();
	});

$(document)
	.off("click.simplifiedsideedit", ".simplified-side-edit-btn")
	.on("click.simplifiedsideedit", ".simplified-side-edit-btn", function (ev) {
		ev.preventDefault();
		var pokeInfo = $(this).closest(".poke-info");
		var sideSelector = "#" + pokeInfo.attr("id");
		if (sideSelector !== "#p1" && sideSelector !== "#p2") return;
		var isExpanded = !pokeInfo.hasClass("simplified-side-expanded");
		simplifiedSideExpandedState[sideSelector] = isExpanded;
		pokeInfo.toggleClass("simplified-side-expanded", isExpanded);
		syncSimplifiedSideEditButton(sideSelector);
		hideSimplifiedDamageTooltip();
	});

$(document)
	.off("click.simplifiedforms", ".simplified-side-form-sprite")
	.on("click.simplifiedforms", ".simplified-side-form-sprite", function (ev) {
		ev.preventDefault();
		if (!isSimplifiedLayoutEnabled()) return;
		var pokeInfo = $(this).closest(".poke-info");
		if (!pokeInfo.length) return;
		var formeSelect = pokeInfo.find(".forme").first();
		if (!formeSelect.length) return;
		var formeOptions = formeSelect.find("option");
		if (formeOptions.length <= 1) return;
		var currentIndex = formeSelect.prop("selectedIndex");
		if (currentIndex < 0) currentIndex = 0;
		var nextIndex = (currentIndex + 1) % formeOptions.length;
		formeSelect.prop("selectedIndex", nextIndex).change();
	});

$(document)
	.off("change.simplifiedcontrols input.simplifiedcontrols", ".simplified-side-level-input, .simplified-side-level-cap-input, .simplified-side-status-input, .simplified-side-nature-input, .simplified-side-ability-input, .simplified-side-item-input, .simplified-side-ignore-item-toggle, .simplified-side-current-hp-input, .simplified-side-percent-hp-input, .simplified-side-stat-boost-input, .simplified-side-move-crit-input")
	.on("change.simplifiedcontrols input.simplifiedcontrols", ".simplified-side-level-input, .simplified-side-level-cap-input, .simplified-side-status-input, .simplified-side-nature-input, .simplified-side-ability-input, .simplified-side-item-input, .simplified-side-ignore-item-toggle, .simplified-side-current-hp-input, .simplified-side-percent-hp-input, .simplified-side-stat-boost-input, .simplified-side-move-crit-input", function () {
		var controlNode = $(this);
		if (controlNode.data("simplifiedSyncing")) return;
		var pokeInfo = controlNode.closest(".poke-info");
		if (!pokeInfo.length) return;
		var sideSelector = "#" + pokeInfo.attr("id");
		if (sideSelector !== "#p1" && sideSelector !== "#p2") return;
		var sourceNode = $();
		if (controlNode.hasClass("simplified-side-level-input")) {
			sourceNode = $(sideSelector + " .level").first();
			sourceNode.val(controlNode.val());
		} else if (controlNode.hasClass("simplified-side-level-cap-input")) {
			sourceNode = $(sideSelector + " .level-cap").first();
			sourceNode.val(controlNode.val());
		} else if (controlNode.hasClass("simplified-side-status-input")) {
			sourceNode = $(sideSelector + " .status").first();
			sourceNode.val(controlNode.val());
		} else if (controlNode.hasClass("simplified-side-nature-input")) {
			sourceNode = $(sideSelector + " .nature").first();
			sourceNode.val(controlNode.val());
		} else if (controlNode.hasClass("simplified-side-ability-input")) {
			sourceNode = $(sideSelector + " .ability").first();
			sourceNode.val(controlNode.val());
		} else if (controlNode.hasClass("simplified-side-item-input")) {
			sourceNode = $(sideSelector + " .item").first();
			sourceNode.val(controlNode.val());
		} else if (controlNode.hasClass("simplified-side-ignore-item-toggle")) {
			sourceNode = $(sideSelector + " .ignore-item-toggle").first();
			sourceNode.prop("checked", controlNode.is(":checked"));
		} else if (controlNode.hasClass("simplified-side-current-hp-input")) {
			sourceNode = $(sideSelector + " .current-hp").first();
			sourceNode.val(controlNode.val());
			sourceNode.trigger("keyup");
		} else if (controlNode.hasClass("simplified-side-percent-hp-input")) {
			sourceNode = $(sideSelector + " .percent-hp").first();
			sourceNode.val(controlNode.val());
			sourceNode.trigger("keyup");
		} else if (controlNode.hasClass("simplified-side-stat-boost-input")) {
			var statRow = controlNode.closest(".simplified-side-stat-row");
			var statKey = statRow.attr("data-stat-key");
			var sourceStatClass = simplifiedStatRowClassByStatKey[statKey];
			if (sourceStatClass) {
				sourceNode = $(sideSelector + " ." + sourceStatClass + " .boost").first();
				sourceNode.val(controlNode.val());
			}
		} else if (controlNode.hasClass("simplified-side-move-crit-input")) {
			var moveRow = controlNode.closest(".simplified-side-move-row");
			var sourceMoveIndex = parseInt(moveRow.attr("data-move-index"), 10);
			if (isFinite(sourceMoveIndex) && sourceMoveIndex >= 0 && sourceMoveIndex < 4) {
				sourceNode = $(sideSelector + " .move" + (sourceMoveIndex + 1) + " .move-crit").first();
				sourceNode.prop("checked", controlNode.is(":checked"));
			}
		}
		if (!sourceNode.length) return;
		sourceNode.trigger("change");
	});

$(document)
	.off("click.simplifiedbooststep", ".simplified-side-stat-step")
	.on("click.simplifiedbooststep", ".simplified-side-stat-step", function (ev) {
		ev.preventDefault();
		var stepButton = $(this);
		var pokeInfo = stepButton.closest(".poke-info");
		if (!pokeInfo.length) return;
		var sideSelector = "#" + pokeInfo.attr("id");
		if (sideSelector !== "#p1" && sideSelector !== "#p2") return;
		var statRow = stepButton.closest(".simplified-side-stat-row");
		var statKey = statRow.attr("data-stat-key");
		var sourceStatClass = simplifiedStatRowClassByStatKey[statKey];
		if (!sourceStatClass) return;
		var sourceBoost = $(sideSelector + " ." + sourceStatClass + " .boost").first();
		if (!sourceBoost.length) return;
		var delta = Number(stepButton.attr("data-step")) || 0;
		if (!delta) return;
		var sourceButtons = sourceBoost.closest("tr").find(".stat-changer");
		if (sourceButtons.length >= 2) {
			var sourceButton = delta > 0 ? sourceButtons.first() : sourceButtons.last();
			sourceButton.trigger("click");
			syncSimplifiedSelectFromSource(sideSelector, "." + sourceStatClass + " .boost", statRow.find(".simplified-side-stat-boost-input"));
			return;
		}
		var currentBoost = parseInt(sourceBoost.val(), 10);
		if (Number.isNaN(currentBoost)) currentBoost = 0;
		var nextBoost = Math.max(-6, Math.min(6, currentBoost + delta));
		sourceBoost.val(String(nextBoost)).trigger("change");
		statRow.find(".simplified-side-stat-boost-input").val(String(nextBoost)).trigger("change");
	});

function performCalculations() {
	var p1info = $("#p1");
	var p2info = $("#p2");
	var p1 = createPokemon(p1info);
	var p2 = createPokemon(p2info);
	hideSimplifiedDamageTooltip();
	closeDamageApplyMenu();
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
		renderDamageResultDisplay(0, i, result, p1, p2);

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
		renderDamageResultDisplay(1, i, result, p2, p1);

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
	renderSimplifiedSideCards(p1, p2);
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
			var desc = normalizePercentRangeText(result.fullDesc(notation, false));
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
