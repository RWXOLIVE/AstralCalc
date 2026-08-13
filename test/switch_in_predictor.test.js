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
