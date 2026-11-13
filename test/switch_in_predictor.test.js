/* eslint-env browser, node, es6 */
(function (root) {
	"use strict";

	var isNode = typeof module === "object" && module.exports;
	var activeBodyClasses = new Set();
	if (isNode) {
		global.document = {
			body: {
				classList: {
					toggle: function (name, enabled) {
						if (enabled) activeBodyClasses.add(name);
						else activeBodyClasses.delete(name);
					}
				}
			},
			querySelectorAll: function () { return []; },
			getElementById: function () { return null; }
		};
	}

	var switchIn = isNode ? require("../src/js/switch_in_predictor") : root.AstralSwitchIn;
	var assertions = 0;

	function assertEqual(actual, expected, label) {
		assertions++;
		if (actual !== expected) throw new Error(label + ": expected " + expected + ", received " + actual);
	}

	function assertDeepEqual(actual, expected, label) {
		assertions++;
		var actualJson = JSON.stringify(actual);
		var expectedJson = JSON.stringify(expected);
		if (actualJson !== expectedJson) throw new Error(label + ": expected " + expectedJson + ", received " + actualJson);
	}

	function assertMatches(actual, pattern, label) {
		assertions++;
		if (!pattern.test(actual)) throw new Error(label + ": " + actual);
	}

	function metrics(overrides) {
		return Object.assign({
			aiMonFaster: false,
			hitsToFaintPlayer: 3,
			hitsToFaintAI: 2,
			isPalafinZero: false,
			isWobbuffetFamily: false,
			isDitto: false
		}, overrides);
	}

	var scoringCases = [
		["fast Palafin-Zero", metrics({aiMonFaster: true, isPalafinZero: true}), 8],
		["fast OHKO", metrics({aiMonFaster: true, hitsToFaintPlayer: 1, hitsToFaintAI: 1}), 7],
		["safe slow OHKO", metrics({hitsToFaintPlayer: 1, hitsToFaintAI: 2}), 6],
		["fast favorable race", metrics({aiMonFaster: true, hitsToFaintPlayer: 2, hitsToFaintAI: 2}), 5],
		["slow favorable race", metrics({hitsToFaintPlayer: 2, hitsToFaintAI: 3}), 4],
		["fast fallback", metrics({aiMonFaster: true, hitsToFaintPlayer: 3, hitsToFaintAI: 2}), 3],
		["slow and OHKO'd", metrics({hitsToFaintPlayer: 2, hitsToFaintAI: 1}), 1],
		["default", metrics({hitsToFaintPlayer: 3, hitsToFaintAI: 2}), 2],
		["Wobbuffet bonus", metrics({aiMonFaster: true, hitsToFaintPlayer: 3, hitsToFaintAI: 2, isWobbuffetFamily: true}), 5],
		["Ditto bonus", metrics({hitsToFaintPlayer: 3, hitsToFaintAI: 2, isDitto: true}), 4]
	];

	for (var caseIndex = 0; caseIndex < scoringCases.length; caseIndex++) {
		var scoringCase = scoringCases[caseIndex];
		assertEqual(switchIn.scoreFromMetrics(scoringCase[1]), scoringCase[2], scoringCase[0]);
	}

	assertEqual(
		switchIn.scoreFromMetrics(metrics({aiMonFaster: true, hitsToFaintPlayer: switchIn.UNKNOWN_NO_OF_HITS})),
		3,
		"fast status-only candidate uses Astral's unknown-hit sentinel"
	);
	assertEqual(
		switchIn.scoreFromMetrics(metrics({hitsToFaintPlayer: switchIn.UNKNOWN_NO_OF_HITS})),
		2,
		"slow status-only candidate uses Astral's default tier"
	);

	assertEqual(
		switchIn.medianDamage({damage: [85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100]}),
		93,
		"Astral AI sees the ninth damage roll"
	);
	assertEqual(
		switchIn.medianDamage({damage: [[85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100], [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]]}),
		118,
		"ninth roll is combined across multiple damage parts"
	);
	assertEqual(
		switchIn.medianDamage({damage: [85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100]}, {hits: 3}),
		279,
		"fixed-power multihit damage includes every AI-assumed strike"
	);
	["Explosion", "Misty Explosion", "Self-Destruct"].forEach(function (moveName) {
		assertEqual(
			switchIn.isDamagingMoveForSwitchIn({name: moveName, category: "Physical"}),
			false,
			moveName + " is not a damaging move for switch-in scoring"
		);
	});
	assertEqual(
		switchIn.isDamagingMoveForSwitchIn({name: "Tackle", category: "Physical"}),
		true,
		"ordinary attacks remain damaging moves for switch-in scoring"
	);

	function mockPokemon(overrides) {
		var pokemon = Object.assign({
			ability: "",
			abilityOn: false,
			boosts: {spe: 0},
			isDynamaxed: false,
			item: "",
			name: "Testmon",
			rawStats: {atk: 80, def: 80, spa: 80, spd: 80, spe: 100},
			stats: {spe: 100},
			status: "",
			types: ["Normal"],
			toxicCounter: 0,
			curHP: function () { return 100; },
			maxHP: function () { return 100; }
		}, overrides || {});
		return pokemon;
	}

	assertEqual(
		switchIn.hitsToFaintFromDamage(mockPokemon(), mockPokemon(), 0, null),
		switchIn.UNKNOWN_NO_OF_HITS,
		"zero damage is not a zero-hit KO"
	);
	assertEqual(
		switchIn.hitsToFaintFromDamage(mockPokemon(), mockPokemon({item: "Focus Sash"}), 100, {hits: 1, category: "Physical", name: "Tackle"}),
		2,
		"Focus Sash adds a hit to a single-hit KO"
	);
	assertEqual(
		switchIn.hitsToFaintFromDamage(mockPokemon(), mockPokemon({item: "Focus Sash"}), 100, {hits: 2, category: "Physical", name: "Double Kick"}),
		1,
		"multi-hit attacks bypass Focus Sash in Astral's KO count"
	);
	assertEqual(
		switchIn.hitsToFaintFromDamage(mockPokemon(), mockPokemon({item: "Focus Sash"}), 100, {hits: 2, category: "Physical", name: "Dragon Darts"}),
		2,
		"predictor mirrors Astral's singles Dragon Darts endurance exception"
	);
	assertEqual(
		switchIn.hitsToFaintFromDamage(mockPokemon(), mockPokemon({item: "Focus Sash"}), 100, {hits: 1, category: "Physical", name: "Tackle"}, {isMagicRoom: true}),
		1,
		"Magic Room suppresses Focus Sash in Astral's endurance check"
	);

	var neutralField = {
		weather: undefined,
		terrain: undefined,
		isMagicRoom: false,
		attackerSide: {isTailwind: false},
		defenderSide: {isTailwind: false}
	};
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({boosts: {spe: 1}, status: "par"}), neutralField, neutralField.attackerSide, false),
		37,
		"speed stages and Astral's Gen 6 paralysis setting are applied in engine order"
	);
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({ability: "Slow Start", abilityOn: true}), neutralField, neutralField.defenderSide, true),
		100,
		"fresh switch candidate has no simulated Slow Start volatile"
	);
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({ability: "Slow Start", abilityOn: true}), neutralField, neutralField.attackerSide, false),
		50,
		"active Slow Start state is respected"
	);
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({ability: "Unburden", abilityOn: true}), neutralField, neutralField.defenderSide, true),
		100,
		"fresh itemless switch candidate does not receive Unburden"
	);
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({ability: "Protosynthesis", abilityOn: true, item: "Booster Energy"}), neutralField, neutralField.defenderSide, true),
		100,
		"fresh switch candidate has no simulated Booster Energy volatile"
	);
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({ability: "Protosynthesis", abilityOn: true, item: "Booster Energy"}), neutralField, neutralField.attackerSide, false),
		150,
		"active player can represent an activated Booster Energy speed boost"
	);
	assertEqual(
		switchIn.getEffectiveSpeed(mockPokemon({ability: "Quark Drive", protoQuark: "spe"}), neutralField, neutralField.attackerSide, false),
		150,
		"explicit Paradox speed state is respected"
	);
	assertEqual(
		switchIn.switchInIsFaster(mockPokemon(), mockPokemon(), neutralField),
		true,
		"AI treats a speed tie as faster"
	);
	assertEqual(
		switchIn.switchInIsFaster(mockPokemon({item: "Quick Claw", rawStats: {spe: 50}, stats: {spe: 50}}), mockPokemon(), neutralField),
		true,
		"AI sees its Quick Claw and treats itself as faster"
	);
	assertEqual(
		switchIn.switchInIsFaster(mockPokemon({item: "Quick Claw", rawStats: {spe: 50}, stats: {spe: 50}}), mockPokemon({item: "Quick Claw"}), neutralField),
		true,
		"AI's Quick Claw still wins the predictor check when both sides hold one"
	);
	assertEqual(
		switchIn.switchInIsFaster(mockPokemon({ability: "Quick Draw", item: "Lagging Tail", rawStats: {spe: 50}, stats: {spe: 50}}), mockPokemon({ability: "Quick Draw"}), neutralField),
		true,
		"AI's Quick Draw takes precedence even with matching Quick Draw and a lagging item"
	);

	var bootsField = {
		weather: undefined,
		terrain: undefined,
		isGravity: false,
		isMagicRoom: false,
		attackerSide: {},
		defenderSide: {isGrounded: false, isSR: false, spikes: 1, steelsurge: false}
	};
	assertEqual(
		switchIn.getSwitchInHitsToKO(mockPokemon({item: "Heavy-Duty Boots"}), mockPokemon(), 30, bootsField),
		3,
		"predictor mirrors Astral AI's current Boots and Spikes interaction"
	);

	var magicRoomHazards = {
		weather: undefined,
		terrain: undefined,
		isGravity: false,
		isMagicRoom: true,
		attackerSide: {},
		defenderSide: {isGrounded: false, isSR: true, spikes: 1, steelsurge: false}
	};
	assertEqual(
		switchIn.getSwitchInHitsToKO(mockPokemon({item: "Heavy-Duty Boots"}), mockPokemon(), 30, Object.assign({}, magicRoomHazards, {
			defenderSide: {isGrounded: false, isSR: true, spikes: 0, steelsurge: false}
		})),
		3,
		"Magic Room suppresses Boots against rocks in Astral's cached hold-effect data"
	);
	assertEqual(
		switchIn.getSwitchInHitsToKO(mockPokemon({types: ["Flying"]}), mockPokemon(), 30, magicRoomHazards),
		3,
		"predictor mirrors Astral's current Magic Room grounding override"
	);

	var hailField = {
		weather: "Hail",
		terrain: undefined,
		isGravity: false,
		isMagicRoom: true,
		attackerSide: {},
		defenderSide: {isGrounded: false, isSR: false, spikes: 0, steelsurge: false}
	};
	assertEqual(
		switchIn.getSwitchInHitsToKO(mockPokemon({item: "Safety Goggles"}), mockPokemon(), 20, hailField),
		4,
		"Magic Room suppresses Safety Goggles in Astral's cached hold-effect data"
	);

	var explanation = switchIn.describeMatchup(metrics({
		aiMonFaster: true,
		hitsToFaintPlayer: 1,
		hitsToFaintAI: 3
	}), "Abomasnow", "Empoleon");
	assertMatches(explanation, /Empoleon acts before Abomasnow/, "speed explanation");
	assertMatches(explanation, /Empoleon can OHKO Abomasnow/, "switch-in damage explanation");
	assertMatches(explanation, /Abomasnow needs 3 hits to KO Empoleon/, "selected Pokemon damage explanation");

	var ordered = switchIn.orderPartyRows([
		{setId: "Lead", originalOrder: 0, score: 0, isTrainerLead: true, isExcluded: false},
		{setId: "Tie Later", originalOrder: 3, score: 5, isTrainerLead: false, isExcluded: false},
		{setId: "Dead", originalOrder: 2, score: 99, isTrainerLead: false, isExcluded: true},
		{setId: "Best", originalOrder: 4, score: 7, isTrainerLead: false, isExcluded: false},
		{setId: "Tie Earlier", originalOrder: 1, score: 5, isTrainerLead: false, isExcluded: false}
	]);
	assertDeepEqual(
		ordered.orderedRows.map(function (row) { return row.setId; }),
		["Lead", "Best", "Tie Earlier", "Tie Later", "Dead"],
		"lead, score, tie, and dead ordering"
	);
	assertDeepEqual(
		ordered.candidates.map(function (row) { return row.setId; }),
		["Best", "Tie Earlier", "Tie Later"],
		"guide candidate order"
	);

	function orderForSelectedP1(candidateScores) {
		return switchIn.orderPartyRows([
			{setId: "Lead", originalOrder: 0, score: 0, isTrainerLead: true, isExcluded: false},
			{setId: "Fire Candidate", originalOrder: 1, score: candidateScores.fire, isTrainerLead: false, isExcluded: false},
			{setId: "Water Candidate", originalOrder: 2, score: candidateScores.water, isTrainerLead: false, isExcluded: false}
		]).orderedRows.map(function (row) { return row.setId; });
	}

	assertDeepEqual(
		orderForSelectedP1({fire: 7, water: 3}),
		["Lead", "Fire Candidate", "Water Candidate"],
		"first P1 matchup order"
	);
	assertDeepEqual(
		orderForSelectedP1({fire: 2, water: 6}),
		["Lead", "Water Candidate", "Fire Candidate"],
		"changed P1 matchup order"
	);

	switchIn.setEnabled(true);
	assertEqual(
		isNode ? activeBodyClasses.has("switch-in-enabled") : root.document.body.classList.contains("switch-in-enabled"),
		true,
		"purple-border mode follows Switch In on"
	);
	switchIn.setEnabled(false);
	assertEqual(
		isNode ? activeBodyClasses.has("switch-in-enabled") : root.document.body.classList.contains("switch-in-enabled"),
		false,
		"purple-border mode follows Switch In off"
	);

	if (isNode) {
		delete global.document;
		console.log("Switch In predictor tests passed: " + assertions);
	} else {
		root.document.documentElement.setAttribute("data-test-status", "passed");
		root.document.body.textContent = "Switch In predictor tests passed: " + assertions;
	}
})(typeof window !== "undefined" ? window : global);
