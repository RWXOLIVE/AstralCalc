/* eslint-env browser, node, es6 */
(function (root, factory) {
	"use strict";
	var api = factory(root);
	if (typeof module === "object" && module.exports) module.exports = api;
	else root.AstralSwitchIn = api;
})(typeof window !== "undefined" ? window : global, function (root) {
	"use strict";

	var enabled = false;
	var initialized = false;
	var refreshTimer = null;
	var EXPLOSION_MOVES = {
		"Explosion": true,
		"Misty Explosion": true,
		"Self-Destruct": true
	};

	function scoreFromMetrics(metrics) {
		var score;
		if (metrics.aiMonFaster && metrics.isPalafinZero) score = 8;
		else if (metrics.aiMonFaster && metrics.hitsToFaintPlayer === 1) score = 7;
		else if (metrics.hitsToFaintPlayer === 1 && metrics.hitsToFaintAI > 1) score = 6;
		else if (metrics.aiMonFaster && metrics.hitsToFaintPlayer <= metrics.hitsToFaintAI) score = 5;
		else if (!metrics.aiMonFaster && metrics.hitsToFaintAI > metrics.hitsToFaintPlayer) score = 4;
		else if (metrics.aiMonFaster) score = 3;
		else if (!metrics.aiMonFaster && metrics.hitsToFaintAI === 1) score = 1;
		else score = 2;

		if (metrics.isWobbuffetFamily && metrics.aiMonFaster && metrics.hitsToFaintAI > 1) score += 2;
		if (metrics.isDitto) score += 2;
		return score;
	}

	function describeScore(score, metrics) {
		var baseScore = score - (metrics.isDitto ? 2 : 0) -
			(metrics.isWobbuffetFamily && metrics.aiMonFaster && metrics.hitsToFaintAI > 1 ? 2 : 0);
		var labels = {
			8: "fast Palafin-Zero",
			7: "fast KO",
			6: "safe slow KO",
			5: "fast favorable damage",
			4: "slow favorable damage",
			3: "faster switch-in",
			2: "default switch-in",
			1: "slow and OHKO'd"
		};
		var reason = labels[baseScore] || "Astral switch-in score";
		if (metrics.isDitto) reason += ", Ditto bonus";
		if (metrics.isWobbuffetFamily && metrics.aiMonFaster && metrics.hitsToFaintAI > 1) reason += ", Wobbuffet/Wynaut bonus";
		return reason;
	}

	function describeHitCount(attackerName, defenderName, hits) {
		if (!hits || hits < 1) return attackerName + " has no damaging KO on " + defenderName;
		if (hits === 1) return attackerName + " can OHKO " + defenderName;
		return attackerName + " needs " + hits + " hits to KO " + defenderName;
	}

	function describeMatchup(metrics, playerName, switchInName) {
		var playerLabel = String(playerName || "selected Pokemon");
		var switchInLabel = String(switchInName || "switch-in");
		var speedReason = metrics.aiMonFaster ?
			switchInLabel + " acts before " + playerLabel :
			playerLabel + " acts before " + switchInLabel;
		return speedReason + "; " +
			describeHitCount(switchInLabel, playerLabel, metrics.hitsToFaintPlayer) + "; " +
			describeHitCount(playerLabel, switchInLabel, metrics.hitsToFaintAI);
	}

	function getSetData(setId) {
		if (typeof root.parseSetId !== "function" || !root.setdex) return null;
		var parsed = root.parseSetId(setId);
		var speciesName = String(parsed.species || "").trim();
		var setName = String(parsed.label || "").trim();
		if (!speciesName || !setName || !root.setdex[speciesName]) return null;
		var set = root.setdex[speciesName][setName];
		return set ? {speciesName: speciesName, setName: setName, set: set} : null;
	}

	function normalizeMoveName(rawMove) {
		if (typeof rawMove === "string") return rawMove;
		if (rawMove && typeof rawMove.name === "string") return rawMove.name;
		return "(No Move)";
	}

	function createPokemonFromSetId(setId) {
		var payload = getSetData(setId);
		if (!payload || !root.calc || !root.calc.Pokemon || !root.calc.Move) return null;
		var set = payload.set;
		var ivs = {};
		var evs = {};
		var statKeys = root.LEGACY_STATS[root.gen] || root.LEGACY_STATS[9] || [];
		for (var i = 0; i < statKeys.length; i++) {
			var legacyStat = statKeys[i];
			var stat = root.legacyStatToStat(legacyStat);
			ivs[stat] = root.gen >= 3 && set.ivs && typeof set.ivs[legacyStat] !== "undefined" ? set.ivs[legacyStat] : 31;
			evs[stat] = set.evs && typeof set.evs[legacyStat] !== "undefined" ? set.evs[legacyStat] : 0;
		}

		var ability = String(set.ability || "");
		var item = String(set.item || "");
		var moveNames = Array.isArray(set.moves) ? set.moves.slice(0, 4).map(normalizeMoveName) : [];
		while (moveNames.length < 4) moveNames.push("(No Move)");
		var pokemonMoves = moveNames.map(function (moveName) {
			return new root.calc.Move(root.gen, root.moves && root.moves[moveName] ? moveName : "(No Move)", {
				ability: ability,
				item: item,
				species: payload.speciesName
			});
		});

		var levelFallback = typeof root.getLevelCap === "function" ? root.getLevelCap() : 100;
		var level = typeof root.resolveSetLevelFlag === "function" ?
			root.resolveSetLevelFlag(set.level, levelFallback) :
			(parseInt(set.level) || levelFallback);
		return new root.calc.Pokemon(root.gen, payload.speciesName, {
			level: level,
			ability: ability,
			abilityOn: true,
			item: item,
			nature: set.nature,
			ivs: ivs,
			evs: evs,
			moves: pokemonMoves
		});
	}

	function cloneFieldForSwitchIn(player, candidate) {
		var field = root.createField();
		var ability = String(candidate.ability || "");
		switch (ability) {
		case "Drizzle": field.weather = "Rain"; break;
		case "Drought": field.weather = "Sun"; break;
		case "Sand Stream": field.weather = "Sand"; break;
		case "Snow Warning": field.weather = root.gen >= 9 ? "Snow" : "Hail"; break;
		case "Electric Surge":
		case "Hadron Engine": field.terrain = "Electric"; break;
		case "Grassy Surge": field.terrain = "Grassy"; break;
		case "Misty Surge": field.terrain = "Misty"; break;
		case "Psychic Surge": field.terrain = "Psychic"; break;
		}
		if ([player.ability, candidate.ability].some(function (activeAbility) {
			return activeAbility === "Cloud Nine" || activeAbility === "Air Lock";
		})) field.weather = undefined;

		field.isBeadsOfRuin = player.ability === "Beads of Ruin" || candidate.ability === "Beads of Ruin";
		field.isSwordOfRuin = player.ability === "Sword of Ruin" || candidate.ability === "Sword of Ruin";
		field.isTabletsOfRuin = player.ability === "Tablets of Ruin" || candidate.ability === "Tablets of Ruin";
		field.isVesselOfRuin = player.ability === "Vessel of Ruin" || candidate.ability === "Vessel of Ruin";
		return field;
	}

	function medianDamage(result) {
		if (!result) return 0;
		var range = result.range();
		if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) return 0;
		return Math.max(0, Math.floor((range[0] + range[1]) / 2));
	}

	function getBestMedianDamage(attacker, defender, field, options) {
		var bestDamage = 0;
		var bestMove = null;
		for (var i = 0; i < attacker.moves.length; i++) {
			var move = attacker.moves[i];
			if (!move || move.category === "Status" || move.name === "(No Move)") continue;
			if (options.excludeFocusPunch && move.name === "Focus Punch") continue;
			if (options.excludeExplosion && EXPLOSION_MOVES[move.name]) continue;
			try {
				var result = root.calc.calculate(root.gen, attacker.clone(), defender.clone(), move.clone(), field.clone());
				var damage = medianDamage(result);
				if (damage > bestDamage) {
					bestDamage = damage;
					bestMove = move;
				}
			} catch (err) {
				if (root.console && typeof root.console.debug === "function") {
					root.console.debug("[AstralCalc] Switch In skipped a damage result", move.name, err);
				}
			}
		}
		return {damage: bestDamage, move: bestMove};
	}

	function hasMoldBreakerAbility(pokemon) {
		return pokemon && ["Mold Breaker", "Teravolt", "Turboblaze"].indexOf(pokemon.ability) >= 0;
	}

	function canEndureOneHit(attacker, defender, damage) {
		if (!defender || damage <= 0 || damage < defender.curHP()) return false;
		var atFullHp = defender.curHP() === defender.maxHP();
		if (atFullHp && defender.item === "Focus Sash") return true;
		if (!hasMoldBreakerAbility(attacker) && atFullHp && defender.ability === "Sturdy") return true;
		return !hasMoldBreakerAbility(attacker) && defender.ability === "Disguise" &&
			(defender.name === "Mimikyu" || defender.name === "Mimikyu-Busted");
	}

	function hitsToFaintFromDamage(attacker, defender, damage) {
		if (damage <= 0) return 0;
		var hits = Math.ceil(defender.curHP() / damage);
		if (hits === 1 && canEndureOneHit(attacker, defender, damage)) hits++;
		return hits;
	}

	function getTypeEffectiveness(typeName, pokemon) {
		if (!root.GENERATION || !root.GENERATION.types) return 1;
		var typeData = root.GENERATION.types.get(String(typeName || "").toLowerCase());
		if (!typeData) return 1;
		var effectiveness = 1;
		for (var i = 0; i < pokemon.types.length; i++) {
			effectiveness *= typeof typeData.effectiveness[pokemon.types[i]] === "number" ?
				typeData.effectiveness[pokemon.types[i]] :
				1;
		}
		return effectiveness;
	}

	function isItemSuppressed(pokemon, field) {
		return !!field.isMagicRoom || pokemon.ability === "Klutz";
	}

	function isGrounded(pokemon, field) {
		if (field.isGravity || pokemon.item === "Iron Ball") return true;
		if (pokemon.types.indexOf("Flying") >= 0) return false;
		if (pokemon.ability === "Levitate") return false;
		return pokemon.item !== "Air Balloon" || isItemSuppressed(pokemon, field);
	}

	function fractionDamage(maxHp, denominator) {
		return Math.max(1, Math.floor(maxHp / denominator));
	}

	function getSwitchInHazardDamage(candidate, field) {
		var side = field.defenderSide;
		if (!side || candidate.ability === "Magic Guard") return 0;
		var itemActive = !isItemSuppressed(candidate, field);
		if (itemActive && candidate.item === "Heavy-Duty Boots") return 0;
		var maxHp = candidate.maxHP();
		var damage = 0;
		if (side.isSR) damage += Math.floor(getTypeEffectiveness("Rock", candidate) * maxHp / 8);
		if (side.steelsurge) damage += Math.floor(getTypeEffectiveness("Steel", candidate) * maxHp / 8);
		if (side.spikes > 0 && isGrounded(candidate, field)) {
			damage += fractionDamage(maxHp, (5 - Math.min(3, side.spikes)) * 2);
		}
		return damage;
	}

	function normalizeWeather(field) {
		return String(field.weather || "");
	}

	function getWeatherImpact(candidate, field) {
		var weather = normalizeWeather(field);
		if (!weather) return 0;
		var maxHp = candidate.maxHP();
		var ability = candidate.ability;
		var itemBlockedWeather = candidate.item === "Utility Umbrella" && !isItemSuppressed(candidate, field);
		var protectedFromChip = candidate.item === "Safety Goggles" || ability === "Magic Guard" || ability === "Overcoat";
		var impact = 0;
		if (!protectedFromChip) {
			if (weather === "Hail" && candidate.types.indexOf("Ice") < 0 &&
				["Snow Cloak", "Ice Body"].indexOf(ability) < 0) {
				impact = fractionDamage(maxHp, 16);
			} else if (weather === "Sand" && !candidate.types.some(function (type) {
				return ["Rock", "Ground", "Steel"].indexOf(type) >= 0;
			}) && ["Sand Veil", "Sand Rush", "Sand Force"].indexOf(ability) < 0) {
				impact = fractionDamage(maxHp, 16);
			}
		}
		if (weather === "Sun" && !itemBlockedWeather && (ability === "Solar Power" || ability === "Dry Skin")) {
			impact = fractionDamage(maxHp, 8);
		}
		if (weather === "Rain" && !itemBlockedWeather) {
			if (ability === "Dry Skin") impact = -fractionDamage(maxHp, 8);
			else if (ability === "Rain Dish") impact = -fractionDamage(maxHp, 16);
		}
		if ((weather === "Hail" || weather === "Snow") && ability === "Ice Body") {
			impact = -fractionDamage(maxHp, 16);
		}
		return impact;
	}

	function getRecurringHealing(candidate, field) {
		if (isItemSuppressed(candidate, field)) return 0;
		if (candidate.item === "Leftovers") return fractionDamage(candidate.maxHP(), 16);
		if (candidate.item === "Black Sludge" && candidate.types.indexOf("Poison") >= 0) {
			return fractionDamage(candidate.maxHP(), 16);
		}
		return 0;
	}

	function getRecurringDamage(candidate, field) {
		if (candidate.ability === "Magic Guard" || isItemSuppressed(candidate, field)) return 0;
		if (candidate.item === "Black Sludge" && candidate.types.indexOf("Poison") < 0) {
			return fractionDamage(candidate.maxHP(), 8);
		}
		if (candidate.item === "Life Orb" && candidate.ability !== "Sheer Force") {
			return fractionDamage(candidate.maxHP(), 10);
		}
		if (candidate.item === "Sticky Barb") return fractionDamage(candidate.maxHP(), 8);
		return 0;
	}

	function getSingleUseHealing(candidate, currentHp, opponent, field) {
		if (isItemSuppressed(candidate, field) || opponent.ability === "Unnerve") return 0;
		var maxHp = candidate.maxHP();
		if (currentHp >= maxHp / 2) return 0;
		if (candidate.item === "Oran Berry") return 10;
		if (candidate.item === "Berry Juice") return 20;
		if (candidate.item === "Sitrus Berry") return fractionDamage(maxHp, 4);
		if (["Aguav Berry", "Figy Berry", "Iapapa Berry", "Mago Berry", "Wiki Berry"].indexOf(candidate.item) >= 0 && currentHp < maxHp / 4) {
			return fractionDamage(maxHp, 3);
		}
		return 0;
	}

	function getSwitchInHitsToKO(candidate, opponent, damageTaken, field) {
		var maxHp = candidate.maxHP();
		var hazardDamage = getSwitchInHazardDamage(candidate, field);
		if (hazardDamage >= maxHp) return 1;
		var currentHp = maxHp - hazardDamage;
		var weatherImpact = getWeatherImpact(candidate, field);
		var recurringDamage = getRecurringDamage(candidate, field);
		var recurringHealing = getRecurringHealing(candidate, field);
		if (damageTaken + recurringDamage <= recurringHealing || damageTaken + recurringDamage === 0) return 0;

		var hits = 0;
		var usedSingleUseHealingItem = false;
		var opponentBreaksMold = hasMoldBreakerAbility(opponent);
		while (currentHp > 0 && hits < 1000) {
			currentHp -= damageTaken;
			if (damageTaken >= maxHp && hazardDamage === 0 && hits < 1 &&
				(candidate.item === "Focus Sash" || (!opponentBreaksMold && candidate.ability === "Sturdy"))) {
				currentHp = 1;
			}
			if (currentHp > 0) currentHp -= weatherImpact;
			if (currentHp > 0 && !usedSingleUseHealingItem) {
				var singleUseHeal = getSingleUseHealing(candidate, currentHp, opponent, field);
				if (singleUseHeal > 0) {
					currentHp = Math.min(maxHp, currentHp + singleUseHeal);
					usedSingleUseHealingItem = true;
				}
			}
			if (currentHp > 0) currentHp += recurringHealing - recurringDamage;
			hits++;
		}
		if (!opponentBreaksMold && candidate.ability === "Disguise" && candidate.name.indexOf("Mimikyu") === 0) hits++;
		return hits;
	}

	function getEffectiveSpeed(pokemon, field, side) {
		var speed = pokemon.stats.spe;
		var weather = normalizeWeather(field);
		var ability = pokemon.ability;
		var itemActive = !isItemSuppressed(pokemon, field);
		var weatherItemBlocked = itemActive && pokemon.item === "Utility Umbrella";
		if (!weatherItemBlocked && ((weather === "Sun" && ["Chlorophyll", "Heated Rush"].indexOf(ability) >= 0) ||
			(weather === "Rain" && ["Swift Swim", "Surge Cutter"].indexOf(ability) >= 0) ||
			(weather === "Sand" && ability === "Sand Rush") ||
			((weather === "Hail" || weather === "Snow") && ability === "Slush Rush"))) speed *= 2;
		if (field.terrain === "Electric" && ability === "Surge Surfer") speed *= 2;
		if (ability === "Quick Feet" && pokemon.status) speed *= 1.5;
		if (ability === "Slow Start" && pokemon.abilityOn) speed *= 0.5;
		if (ability === "Unburden" && pokemon.abilityOn && !pokemon.item) speed *= 2;
		if ((ability === "Protosynthesis" && (weather === "Sun" || pokemon.item === "Booster Energy")) ||
			(ability === "Quark Drive" && (field.terrain === "Electric" || pokemon.item === "Booster Energy"))) {
			var otherStats = [pokemon.rawStats.atk, pokemon.rawStats.def, pokemon.rawStats.spa, pokemon.rawStats.spd];
			if (otherStats.every(function (stat) { return pokemon.rawStats.spe > stat; })) speed *= 1.5;
		}
		if (pokemon.status === "par" && ability !== "Quick Feet") speed *= root.gen >= 7 ? 0.5 : 0.25;
		if (side && side.isTailwind) speed *= 2;
		if (itemActive) {
			if (pokemon.item === "Choice Scarf") speed *= 1.5;
			if (["Iron Ball", "Macho Brace", "Power Anklet", "Power Band", "Power Belt", "Power Bracer", "Power Lens", "Power Weight"].indexOf(pokemon.item) >= 0) speed *= 0.5;
			if (pokemon.item === "Quick Powder" && pokemon.name === "Ditto") speed *= 2;
		}
		return Math.floor(speed);
	}

	function switchInIsFaster(candidate, player, field) {
		var candidateItem = isItemSuppressed(candidate, field) ? "" : candidate.item;
		var playerItem = isItemSuppressed(player, field) ? "" : player.item;
		var laggingItems = ["Lagging Tail", "Full Incense"];
		if (laggingItems.indexOf(candidateItem) >= 0 && laggingItems.indexOf(playerItem) < 0) return false;
		if (laggingItems.indexOf(candidateItem) < 0 && laggingItems.indexOf(playerItem) >= 0) return true;
		if (candidateItem === "Quick Claw" && playerItem !== "Quick Claw") return true;
		if (candidateItem !== "Quick Claw" && playerItem === "Quick Claw") return false;
		if (candidate.ability === "Stall" && player.ability !== "Stall") return false;
		if (candidate.ability !== "Stall" && player.ability === "Stall") return true;
		if (candidate.ability === "Quick Draw" && player.ability !== "Quick Draw") return true;
		if (candidate.ability !== "Quick Draw" && player.ability === "Quick Draw") return false;

		var candidateSpeed = getEffectiveSpeed(candidate, field, field.defenderSide);
		var playerSpeed = getEffectiveSpeed(player, field, field.attackerSide);
		if (candidateSpeed === playerSpeed) return true;
		return field.isTrickRoom ? candidateSpeed < playerSpeed : candidateSpeed > playerSpeed;
	}

	function scoreCandidate(setId, player) {
		var candidate = createPokemonFromSetId(setId);
		if (!candidate) throw new Error("Missing set data for " + setId);
		var playerClone = player.clone();
		var field = cloneFieldForSwitchIn(playerClone, candidate);
		if (typeof root.applyPowerSplitToPair === "function") root.applyPowerSplitToPair(playerClone, candidate);
		var playerAttack = getBestMedianDamage(playerClone, candidate, field, {
			excludeFocusPunch: true,
			excludeExplosion: false
		});
		var candidateAttack = getBestMedianDamage(candidate, playerClone, field.clone().swap(), {
			excludeFocusPunch: false,
			excludeExplosion: true
		});
		var metrics = {
			aiMonFaster: switchInIsFaster(candidate, playerClone, field),
			hitsToFaintPlayer: hitsToFaintFromDamage(candidate, playerClone, candidateAttack.damage),
			hitsToFaintAI: getSwitchInHitsToKO(candidate, playerClone, playerAttack.damage, field),
			isPalafinZero: candidate.name === "Palafin",
			isWobbuffetFamily: candidate.name === "Wobbuffet" || candidate.name === "Wynaut",
			isDitto: candidate.name === "Ditto"
		};
		var score = scoreFromMetrics(metrics);
		return {
			setId: setId,
			score: score,
			metrics: metrics,
			reason: describeScore(score, metrics),
			details: describeMatchup(metrics, playerClone.name, candidate.name)
		};
	}

	function getOriginalPartyOrder() {
		var order = {};
		var party = Array.isArray(root.CURRENT_TRAINER_POKS) ? root.CURRENT_TRAINER_POKS.slice() : [];
		if (typeof root.sortmons === "function") party.sort(root.sortmons);
		for (var i = 0; i < party.length; i++) {
			var entry = root.parseTrainerPartyEntry(String(party[i] || ""));
			if (typeof order[entry.fullSetName] === "undefined") order[entry.fullSetName] = i;
		}
		return order;
	}

	function orderPartyRows(rows) {
		var result = {
			leadRows: [],
			candidates: [],
			excluded: []
		};
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			if (row.isTrainerLead) result.leadRows.push(row);
			else if (row.isExcluded) result.excluded.push(row);
			else result.candidates.push(row);
		}
		result.leadRows.sort(function (left, right) { return left.originalOrder - right.originalOrder; });
		result.candidates.sort(function (left, right) {
			if (left.score !== right.score) return right.score - left.score;
			return left.originalOrder - right.originalOrder;
		});
		result.excluded.sort(function (left, right) { return left.originalOrder - right.originalOrder; });
		result.orderedRows = result.leadRows.concat(result.candidates, result.excluded);
		return result;
	}

	function clearPredictionDecorations() {
		var nodes = root.document.querySelectorAll(".trainer-pok-list-opposing .trainer-pok.right-side, .trainer-pok-list-opposing2 .trainer-pok.right-side");
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			node.classList.remove("switch-in-leading", "switch-in-ranked");
			node.removeAttribute("data-switch-in-rank");
			node.removeAttribute("data-switch-in-score");
			var baseTitle = node.getAttribute("data-switch-in-base-title");
			if (baseTitle !== null) node.title = baseTitle;
		}
	}

	function restoreOriginalOrder() {
		clearPredictionDecorations();
		var originalOrder = getOriginalPartyOrder();
		var lists = root.document.querySelectorAll(".trainer-pok-list-opposing, .trainer-pok-list-opposing2");
		for (var listIndex = 0; listIndex < lists.length; listIndex++) {
			var list = lists[listIndex];
			var nodes = Array.prototype.slice.call(list.querySelectorAll(".trainer-pok.right-side"));
			nodes.sort(function (left, right) {
				var leftId = String(left.getAttribute("data-id") || "");
				var rightId = String(right.getAttribute("data-id") || "");
				var leftOrder = typeof originalOrder[leftId] === "number" ? originalOrder[leftId] : Number.MAX_SAFE_INTEGER;
				var rightOrder = typeof originalOrder[rightId] === "number" ? originalOrder[rightId] : Number.MAX_SAFE_INTEGER;
				return leftOrder - rightOrder;
			});
			for (var i = 0; i < nodes.length; i++) list.appendChild(nodes[i]);
		}
	}

	function hideSwitchInGuide() {
		var guide = root.document && root.document.getElementById("switch-in-guide");
		if (guide) guide.hidden = true;
	}

	function showSwitchInGuideMessage(message) {
		var guide = root.document.getElementById("switch-in-guide");
		var matchup = root.document.getElementById("switch-in-guide-matchup");
		var lead = root.document.getElementById("switch-in-guide-lead");
		var list = root.document.getElementById("switch-in-guide-list");
		var empty = root.document.getElementById("switch-in-guide-empty");
		if (!guide || !matchup || !lead || !list || !empty) return;
		guide.hidden = false;
		matchup.textContent = "";
		lead.textContent = "";
		list.textContent = "";
		empty.textContent = message;
		empty.hidden = false;
	}

	function getRowSpeciesName(row) {
		if (!row || !row.node) return row && row.setId ? row.setId : "Unknown Pokemon";
		return String(row.node.getAttribute("data-species") || row.setId || "Unknown Pokemon");
	}

	function selectGuideRow(row) {
		if (row && row.node && typeof row.node.click === "function") row.node.click();
	}

	function createGuideRow(row, rank) {
		var item = root.document.createElement("div");
		item.className = "switch-in-guide-row";
		item.setAttribute("role", "listitem");
		item.setAttribute("tabindex", "0");
		item.setAttribute("data-switch-in-rank", String(rank));
		item.setAttribute("data-switch-in-score", String(row.score));
		item.title = "Select " + getRowSpeciesName(row) + " in Pokemon 2";

		var sprite = row.node.cloneNode(false);
		sprite.className = "switch-in-guide-sprite";
		sprite.removeAttribute("title");
		sprite.removeAttribute("draggable");
		sprite.removeAttribute("data-switch-in-base-title");
		sprite.removeAttribute("data-switch-in-rank");
		sprite.removeAttribute("data-switch-in-score");
		sprite.alt = "";
		sprite.loading = "eager";

		var name = root.document.createElement("span");
		name.className = "switch-in-guide-name";
		var rankLabel = root.document.createElement("span");
		rankLabel.className = "switch-in-guide-rank";
		rankLabel.textContent = "#" + rank;
		name.appendChild(rankLabel);
		name.appendChild(root.document.createTextNode(getRowSpeciesName(row)));

		var score = root.document.createElement("span");
		score.className = "switch-in-guide-score";
		score.textContent = (row.score >= 0 ? "+" : "") + row.score;

		var reason = root.document.createElement("span");
		reason.className = "switch-in-guide-reason";
		reason.textContent = row.reason + ". " + row.details;

		item.appendChild(sprite);
		item.appendChild(name);
		item.appendChild(score);
		item.appendChild(reason);
		item.addEventListener("click", function () { selectGuideRow(row); });
		item.addEventListener("keydown", function (event) {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			selectGuideRow(row);
		});
		return item;
	}

	function renderSwitchInGuide(player, ordered) {
		var guide = root.document.getElementById("switch-in-guide");
		var matchup = root.document.getElementById("switch-in-guide-matchup");
		var lead = root.document.getElementById("switch-in-guide-lead");
		var list = root.document.getElementById("switch-in-guide-list");
		var empty = root.document.getElementById("switch-in-guide-empty");
		if (!guide || !matchup || !lead || !list || !empty) return;
		guide.hidden = false;
		matchup.textContent = "Ranked against selected Pokemon: " + String(player.name || "Unknown Pokemon");
		lead.textContent = ordered.leadRows.length ?
			"Fixed trainer lead: " + getRowSpeciesName(ordered.leadRows[0]) :
			"No indexed trainer lead found";
		list.textContent = "";
		for (var i = 0; i < ordered.candidates.length; i++) {
			list.appendChild(createGuideRow(ordered.candidates[i], i + 1));
		}
		empty.textContent = ordered.candidates.length ? "" : "No eligible switch-ins remain.";
		empty.hidden = ordered.candidates.length > 0;
	}

	function updateNodePrediction(node, row, rank) {
		if (!node.hasAttribute("data-switch-in-base-title")) {
			node.setAttribute("data-switch-in-base-title", node.title || "");
		}
		node.classList.add("switch-in-ranked");
		node.setAttribute("data-switch-in-rank", String(rank));
		node.setAttribute("data-switch-in-score", String(row.score));
		var prefix = rank === 1 ? "Predicted next switch-in" : "Predicted switch rank #" + rank;
		node.title = prefix + " - " + row.reason + " (score " + row.score + "). " + node.getAttribute("data-switch-in-base-title");
	}

	function refresh() {
		if (!enabled || !root.document || !root.jQuery) return;
		clearPredictionDecorations();
		var isDoubles = root.jQuery("input:radio[name='format']:checked").val() === "Doubles";
		var secondaryList = root.document.querySelector(".trainer-pok-list-opposing2");
		if (isDoubles || (secondaryList && !secondaryList.hidden && secondaryList.children.length)) {
			restoreOriginalOrder();
			showSwitchInGuideMessage("Switch-in Guide is available in Singles only.");
			return;
		}

		var list = root.document.querySelector(".trainer-pok-list-opposing");
		if (!list) {
			showSwitchInGuideMessage("Select an opposing trainer to build the guide.");
			return;
		}
		var nodes = Array.prototype.slice.call(list.querySelectorAll(".trainer-pok.right-side"));
		if (!nodes.length) {
			showSwitchInGuideMessage("Select an opposing trainer to build the guide.");
			return;
		}
		var originalOrder = getOriginalPartyOrder();
		// The selected P1 panel is the matchup source; the selected P2 panel never affects party ranking.
		var player = root.createPokemon(root.jQuery("#p1"));
		var partyRows = [];
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			var setId = String(node.getAttribute("data-id") || "").trim();
			var row = {
				node: node,
				setId: setId,
				originalOrder: typeof originalOrder[setId] === "number" ? originalOrder[setId] : i
			};
			var isTrainerLead = node.classList.contains("trainer-party-leading") || row.originalOrder === 0;
			row.isTrainerLead = isTrainerLead;
			row.isExcluded = !setId || node.classList.contains("trainer-pok-dead");
			if (isTrainerLead) {
				node.classList.add("trainer-party-leading");
				partyRows.push(row);
				continue;
			}
			if (row.isExcluded) {
				partyRows.push(row);
				continue;
			}
			try {
				var result = scoreCandidate(setId, player);
				row.score = result.score;
				row.metrics = result.metrics;
				row.reason = result.reason;
				row.details = result.details;
				partyRows.push(row);
			} catch (err) {
				row.score = -1;
				row.reason = "Could not score this set";
				row.details = "Review this set's moves and data.";
				partyRows.push(row);
				if (root.console && typeof root.console.warn === "function") {
					root.console.warn("[AstralCalc] Switch In could not score", setId, err);
				}
			}
		}

		var ordered = orderPartyRows(partyRows);
		for (i = 0; i < ordered.orderedRows.length; i++) list.appendChild(ordered.orderedRows[i].node);
		for (i = 0; i < ordered.candidates.length; i++) updateNodePrediction(ordered.candidates[i].node, ordered.candidates[i], i + 1);
		renderSwitchInGuide(player, ordered);
	}

	function scheduleRefresh() {
		if (!enabled) return;
		if (refreshTimer) root.clearTimeout(refreshTimer);
		refreshTimer = root.setTimeout(function () {
			refreshTimer = null;
			refresh();
		}, 80);
	}

	function bindRefreshEvents() {
		if (!root.jQuery) return;
		root.jQuery(root.document)
			.off("change.astralswitchin input.astralswitchin")
			.on("change.astralswitchin input.astralswitchin", "input.player, .calc-trigger, #p1 input, #p1 select", scheduleRefresh);
	}

	function setEnabled(nextEnabled) {
		enabled = !!nextEnabled;
		if (root.document && root.document.body) root.document.body.classList.toggle("switch-in-enabled", enabled);
		if (!initialized) {
			initialized = true;
			bindRefreshEvents();
		}
		if (enabled) scheduleRefresh();
		else {
			if (refreshTimer) root.clearTimeout(refreshTimer);
			refreshTimer = null;
			restoreOriginalOrder();
			hideSwitchInGuide();
		}
	}

	return {
		setEnabled: setEnabled,
		scheduleRefresh: scheduleRefresh,
		refresh: refresh,
		scoreFromMetrics: scoreFromMetrics,
		describeScore: describeScore,
		describeMatchup: describeMatchup,
		orderPartyRows: orderPartyRows,
		getSwitchInHitsToKO: getSwitchInHitsToKO
	};
});
