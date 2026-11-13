/* eslint-env browser, node */
/* global Promise */
(function (root, factory) {
	"use strict";
	var api = factory();
	if (typeof module === "object" && module.exports) module.exports = api;
	else root.AstralSync = api;
})(typeof window === "undefined" ? this : window, function () {
	"use strict";
	var ASTRAL_SYNC_URL = "http://127.0.0.1:31124";
	var SUPPORTED_ASTRAL_SYNC_PROTOCOL = 1;
	var messages = {
		connection: "Could not connect to Astral Emerald. Make sure Astral Emerald is running in mGBA and Xtransceiver-v1/ae_lua.lua is loaded. Browser local-network permission must also be allowed.",
		service: "The service on port 31124 is not Astral Emerald AE_Lua.",
		protocol: "AstralCalc and AE_Lua use different sync protocol versions. Update AstralCalc or AE_Lua.",
		invalid: "Astral Emerald returned invalid sync data.",
		unsupported: "This browser does not support localhost Sync. The calculator remains available."
	};
	function fail(code) {
		var error = new Error(messages[code]);
		error.code = code;
		return error;
	}
	function record(value) {
		return value !== null && typeof value === "object" && !Array.isArray(value);
	}
	function validateHeader(payload, ping) {
		if (!record(payload)) throw fail("invalid");
		if (payload.game !== "Astral Emerald" || (ping && payload.status !== "ok")) throw fail("service");
		if (!Object.prototype.hasOwnProperty.call(payload, "protocol")) throw fail("invalid");
		if (payload.protocol !== SUPPORTED_ASTRAL_SYNC_PROTOCOL) throw fail("protocol");
		return payload;
	}
	function request(path, transport, timeoutMs) {
		return new Promise(function (resolve, reject) {
			var controller = new transport.AbortController();
			var timer = setTimeout(function () {
				controller.abort();
				reject(fail("connection"));
			}, timeoutMs || 3500);
			Promise.resolve().then(function () {
				return transport.fetch(ASTRAL_SYNC_URL + path, {cache: "no-store", signal: controller.signal});
			}).then(function (response) {
				if (response.status === 503) return response.json().then(function (payload) {
					validateHeader(payload, false);
					var error = new Error("Astral Emerald sync is not ready. Run a compatible sync-enabled ROM and let it advance. " +
						(typeof payload.error === "string" ? payload.error.slice(0, 240) : ""));
					error.code = "ready";
					throw error;
				});
				if (!response.ok) throw fail("connection");
				return response.json().catch(function () { throw fail("invalid"); });
			}).then(function (payload) {
				clearTimeout(timer);
				resolve(payload);
			}, function (error) {
				clearTimeout(timer);
				reject(error.code ? error : fail("connection"));
			});
		});
	}
	function fetchSnapshot(transport, timeoutMs) {
		if (!transport || !transport.fetch || !transport.AbortController) return Promise.reject(fail("unsupported"));
		return request("/ping", transport, timeoutMs).then(function (ping) {
			validateHeader(ping, true);
			return request("/update", transport, timeoutMs);
		}).then(function (payload) {
			validateHeader(payload, false);
			if (!Array.isArray(payload.party) || payload.party.length > 6 ||
				(typeof payload.boxes !== "undefined" && (!Array.isArray(payload.boxes) || payload.boxes.length > 420))) throw fail("invalid");
			return payload;
		});
	}
	function key(name) {
		return name.toLowerCase().replace(/[\s_.\-'’:]/g, "");
	}
	// ROM IDs are not national dex numbers. Only use canonical names from the
	// loaded Astral data until a shared generated ROM-ID manifest is available.
	function lookup(name, names) {
		if (typeof name !== "string") return "";
		if (names.indexOf(name) !== -1) return name;
		var matches = names.filter(function (candidate) { return key(candidate) === key(name); });
		return matches.length === 1 ? matches[0] : "";
	}
	function integer(value, min, max) {
		return typeof value === "number" && isFinite(value) && Math.floor(value) === value && value >= min && value <= max;
	}
	function convert(mon, location, slot, adapter, warnings) {
		if (!record(mon)) {
			if (mon !== null) warnings.push(location + " slot " + slot + ": malformed Pokemon");
			return null;
		}
		if (mon.isEgg === true) {
			warnings.push(location + " slot " + slot + ": egg skipped");
			return null;
		}
		var species = lookup(mon.speciesKey, adapter.species) || lookup(mon.species, adapter.species);
		if (typeof mon.form === "string" && mon.form && mon.form !== mon.species) {
			var form = lookup(mon.form, adapter.species) || lookup(mon.species + "-" + mon.form, adapter.species);
			if (!form) {
				warnings.push(location + " slot " + slot + ": unknown form " + mon.form);
				return null;
			}
			species = form;
		}
		if (!species || !integer(mon.level, 1, 100)) {
			warnings.push(location + " slot " + slot + ": unknown species or invalid level; speciesName=" +
				String(mon.species) + ", speciesId=" + String(mon.speciesId));
			return null;
		}
		var safe = {level: mon.level, evs: {}, ivs: {}, moves: []};
		["item", "ability", "nature"].forEach(function (field) {
			var resolved = lookup(mon[field], adapter[field]);
			if (!resolved && mon[field]) warnings.push(location + " slot " + slot + ": unknown " + field + "=" + String(mon[field]));
			safe[field] = resolved || (field === "nature" ? "Hardy" : "");
		});
		["hp", "atk", "def", "spa", "spd", "spe"].forEach(function (stat) {
			["ivs", "evs"].forEach(function (field) {
				var value = record(mon[field]) ? mon[field][stat] : undefined;
				var valid = integer(value, 0, field === "ivs" ? 31 : 255);
				if (typeof value !== "undefined" && !valid) warnings.push(location + " slot " + slot + ": invalid " + field + "." + stat);
				safe[field][stat] = valid ? Math.min(value, field === "ivs" ? 31 : 252) : (field === "ivs" ? 31 : 0);
				if (field === "ivs" && record(mon.hyperTrained) && mon.hyperTrained[stat] === true) safe.ivs[stat] = 31;
			});
		});
		var pp = [];
		var slottedMoves = [];
		(Array.isArray(mon.moves) ? mon.moves : []).forEach(function (move, index) {
			var position = record(move) && Object.prototype.hasOwnProperty.call(move, "slot") ? move.slot : index + 1;
			if (!integer(position, 1, 4) || typeof slottedMoves[position - 1] !== "undefined") {
				warnings.push(location + " slot " + slot + ": invalid or duplicate move slot");
				return;
			}
			slottedMoves[position - 1] = move;
		});
		for (var i = 0; i < 4; i++) {
			var move = slottedMoves[i];
			var name = record(move) ? move.name : move;
			var resolvedMove = lookup(name, adapter.moves);
			if (!resolvedMove && name) warnings.push(location + " slot " + slot + ": unknown move=" + String(name));
			safe.moves.push(resolvedMove || "(No Move)");
			pp.push(record(move) && integer(move.pp, 0, 99) && integer(move.maxPP, 1, 99) && move.pp <= move.maxPP ?
				{pp: move.pp, maxPP: move.maxPP} : null);
		}
		if (typeof mon.nickname === "string") safe.nickname = mon.nickname.slice(0, 32);
		if (integer(mon.personality, 0, 4294967295)) safe.personality = mon.personality;
		if (integer(mon.otId, 0, 4294967295)) safe.otId = mon.otId;
		var set = adapter.buildSet(safe);
		set.isCustomSet = false;
		set.astralSync = {location: location, slot: slot, pp: pp};
		// Keep ROM metadata, including original IVs/nature, separate from the
		// effective values used in damage calculations.
		set.astralSync.gameData = mon;
		if (integer(mon.currentHP, 0, 9999) && integer(mon.maxHP, 1, 9999) && mon.currentHP <= mon.maxHP) {
			set.astralSync.currentHP = mon.currentHP;
			set.astralSync.maxHP = mon.maxHP;
		}
		return {species: species, set: set, slot: slot, location: location};
	}
	function parseSnapshot(payload, adapter) {
		validateHeader(payload, false);
		if (!Array.isArray(payload.party) || payload.party.length > 6 ||
			(typeof payload.boxes !== "undefined" && (!Array.isArray(payload.boxes) || payload.boxes.length > 420))) throw fail("invalid");
		var warnings = [];
		var party = [];
		var pc = [];
		var seenSlots = {};
		var seenPc = {};
		payload.party.forEach(function (mon, index) {
			var slot = record(mon) && Object.prototype.hasOwnProperty.call(mon, "slot") ? mon.slot : index + 1;
			if (!integer(slot, 1, 6) || seenSlots[slot]) {
				warnings.push("Party: invalid or duplicate slot " + String(slot));
				return;
			}
			seenSlots[slot] = true;
			var entry = convert(mon, "Party", slot, adapter, warnings);
			if (entry) party.push(entry);
		});
		party.sort(function (left, right) { return left.slot - right.slot; });
		(payload.boxes || []).forEach(function (box, boxIndex) {
			if (record(box) && Object.prototype.hasOwnProperty.call(box, "pokemon") && !Array.isArray(box.pokemon)) {
				if (!integer(box.box, 1, 14) || !integer(box.slot, 1, 30)) {
					warnings.push("PC entry " + (boxIndex + 1) + ": invalid box or slot");
					return;
				}
				var pcPosition = box.box + "|" + box.slot;
				if (seenPc[pcPosition]) {
					warnings.push("PC entry " + (boxIndex + 1) + ": duplicate box slot");
					return;
				}
				seenPc[pcPosition] = true;
				var boxedEntry = convert(box.pokemon, "PC Box " + box.box, box.slot, adapter, warnings);
				if (boxedEntry) pc.push(boxedEntry);
				return;
			}
			var mons = Array.isArray(box) ? box : (record(box) && Array.isArray(box.pokemon) ? box.pokemon : [box]);
			mons.forEach(function (mon, index) {
				var entry = convert(mon, "PC Box " + (boxIndex + 1), index + 1, adapter, warnings);
				if (entry) pc.push(entry);
			});
		});
		// Retain optional battle metadata without changing manual field controls.
		return {party: party, pc: pc, warnings: warnings, pcSupported: payload.pcSupported !== false,
			pcComplete: payload.pcComplete !== false, pcScanned: payload.pcScanned,
			battle: record(payload.battle) ? payload.battle : null};
	}
	function mergeIncompletePc(previous, next) {
		if (next.pcSupported === false || next.pcComplete || !previous || !Array.isArray(previous.pc)) return next;
		var positions = {};
		previous.pc.forEach(function (entry) {
			positions[entry.location + "|" + entry.slot] = entry;
		});
		next.pc.forEach(function (entry) {
			positions[entry.location + "|" + entry.slot] = entry;
		});
		next.pc = Object.keys(positions).map(function (key) { return positions[key]; });
		next.pc.sort(function (left, right) {
			var leftBox = Number(left.location.replace("PC Box ", "")) || 0;
			var rightBox = Number(right.location.replace("PC Box ", "")) || 0;
			return leftBox - rightBox || left.slot - right.slot;
		});
		return next;
	}
	function mergeRosterLayout(layout, previous, next) {
		var zones = ["team", "teamRight", "box", "box2", "boxmega", "trash"];
		var merged = {};
		var priorIds = {};
		(previous.party || []).concat(previous.pc || []).forEach(function (entry) {
			if (entry.id) priorIds[entry.id] = true;
		});
		zones.forEach(function (zone) {
			merged[zone] = (Array.isArray(layout[zone]) ? layout[zone] : []).filter(function (id) {
				return !priorIds[id];
			});
		});
		// Manual Team members stay available in Box. The Team itself mirrors
		// current in-game party order on every successful snapshot.
		var manualTeam = merged.team.slice();
		merged.team = next.party.map(function (entry) { return entry.id; });
		var existing = {};
		zones.forEach(function (zone) {
			merged[zone].forEach(function (id) { existing[id] = true; });
		});
		manualTeam.concat(next.pc.map(function (entry) { return entry.id; })).forEach(function (id) {
			if (!id || existing[id]) return;
			merged.box.push(id);
			existing[id] = true;
		});
		return merged;
	}
	return {url: ASTRAL_SYNC_URL, protocol: SUPPORTED_ASTRAL_SYNC_PROTOCOL,
		fetchSnapshot: fetchSnapshot, parseSnapshot: parseSnapshot, mergeIncompletePc: mergeIncompletePc,
		mergeRosterLayout: mergeRosterLayout, lookup: lookup};
});
