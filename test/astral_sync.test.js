/* eslint-env node, es6 */
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const http = require("http");
const sync = require("../src/js/astral_sync");
const calc = require("../dist/calc");

// Exercise the real converter without initializing the calculator DOM.
const shared = fs.readFileSync(require.resolve("../src/js/shared_controls"), "utf8");
const helpers = vm.createContext({});
for (const name of ["normalizeAeLuaPokemonIdentityPart", "getAeLuaPokemonIdentity",
	"normalizeAeLuaPokemonMoves", "aeLuaPokemonNumber", "aeLuaPokemonStatsToLegacy", "buildAeLuaPokemonSet"]) {
	const match = shared.match(new RegExp("function " + name + "\\([^]*?\\n\\}"));
	assert(match, "Missing existing helper " + name);
	vm.runInContext(match[0], helpers);
}
const adapter = {
	species: Object.keys(calc.SPECIES[9]), moves: Object.keys(calc.MOVES[9]),
	item: calc.ITEMS[9], ability: calc.ABILITIES[9], nature: Object.keys(calc.NATURES),
	buildSet: helpers.buildAeLuaPokemonSet
};
const mon = {
	species: "Feraligatr", speciesId: 160, level: 75, item: "Life Orb", ability: "Sheer Force", nature: "Adamant",
	currentHP: 218, maxHP: 251,
	ivs: {hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31},
	evs: {hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252},
	moves: [{name: "Liquidation", pp: 10, maxPP: 10}, "Crunch", "Ice Punch", "Dragon Dance"]
};
function payload(party = [mon], boxes = []) { return {protocol: 1, game: "Astral Emerald", party, boxes}; }
function transport(data, ping = {status: "ok", game: "Astral Emerald", protocol: 1}) {
	const paths = [];
	return {paths, AbortController, fetch: async url => {
		paths.push(url);
		return {ok: true, json: async () => url.endsWith("/ping") ? ping : data};
	}};
}
function json(value) { return JSON.parse(JSON.stringify(value)); }

async function main() {
	const parsed = sync.parseSnapshot(payload(), adapter);
	assert.strictEqual(parsed.warnings.length, 0);
	const set = parsed.party[0].set;
	assert.deepStrictEqual(json(set.ivs), {hp: 31, at: 31, df: 31, sa: 0, sd: 31, sp: 31});
	assert.deepStrictEqual(json(set.evs), {hp: 0, at: 252, df: 0, sa: 0, sd: 4, sp: 252});
	assert.deepStrictEqual(json(set.moves), ["Liquidation", "Crunch", "Ice Punch", "Dragon Dance"]);
	assert.strictEqual(set.level, 75);
	assert.strictEqual(set.item, "Life Orb");
	assert.strictEqual(set.ability, "Sheer Force");
	assert.strictEqual(set.nature, "Adamant");
	assert.strictEqual(set.astralSync.currentHP, 218);
	assert.deepStrictEqual(json(set.astralSync.pp[0]), {pp: 10, maxPP: 10});
	assert.strictEqual(set.prehp, undefined, "HP must not be applied automatically");
	assert.strictEqual(set.isCustomSet, false, "Live sets must not be saved imports");
	const species = ["Feraligatr", "Latias", "Scrafty-Mega", "Raichu-Alola", "Iron Hands", "Chandelure"];
	const party = species.map(name => ({...mon, species: name, nickname: name === "Feraligatr" ? "Tide" : undefined}));
	assert.deepStrictEqual(sync.parseSnapshot(payload(party), adapter).party.map(entry => entry.species), species);
	assert.strictEqual(sync.parseSnapshot(payload([{...mon, species: "Scrafty", form: "Mega"}]), adapter).party[0].species, "Scrafty-Mega");
	assert.strictEqual(sync.parseSnapshot(payload([{...mon, species: "Scrafty", speciesKey: "SCRAFTY_MEGA"}]), adapter).party[0].species, "Scrafty-Mega");
	const explicit = sync.parseSnapshot(payload([{...mon, slot: 6, speciesKey: "RAICHU_ALOLA"}, {...mon, slot: 2}]), adapter);
	assert.deepStrictEqual(explicit.party.map(entry => entry.slot), [2, 6]);
	assert.strictEqual(explicit.party[1].species, "Raichu-Alola");
	const gaps = sync.parseSnapshot(payload([{...mon, moves: [{slot: 4, name: "Crunch"}, {slot: 2, name: "Liquidation"}]}]), adapter);
	assert.deepStrictEqual(json(gaps.party[0].set.moves), ["(No Move)", "Liquidation", "(No Move)", "Crunch"]);
	const trained = sync.parseSnapshot(payload([{...mon, hyperTrained: {spa: true}, evs: {atk: 255}}]), adapter);
	assert.strictEqual(trained.party[0].set.ivs.sa, 31);
	assert.strictEqual(trained.party[0].set.astralSync.gameData.ivs.spa, 0);
	assert.strictEqual(trained.party[0].set.evs.at, 252);
	assert.strictEqual(sync.parseSnapshot(payload([{...mon, isEgg: true}, {...mon, slot: 4}]), adapter).party[0].slot, 4);
	const luaFixture = require("./fixtures/astral_sync_lua.json");
	const luaParsed = sync.parseSnapshot(luaFixture, adapter);
	assert.strictEqual(luaParsed.warnings.length, 0, "Actual Lua-produced fixture must resolve cleanly");
	assert.strictEqual(luaParsed.party.length, 2);
	assert.strictEqual(luaParsed.pcSupported, false);
	assert.strictEqual(luaParsed.party[1].set.ability, "Battle Armor");
	assert.strictEqual(luaParsed.party[1].set.astralSync.gameData.speciesKey, "FERALIGATR");
	const previousLayout = {
		team: ["Feraligatr (Synced Party Slot 1)", "Manual (Custom Set)"], teamRight: ["Right (Custom Set)"],
		box: ["Saved (Custom Set)", "Latias (Synced PC Box 1 Slot 1)"], box2: [], boxmega: [], trash: []
	};
	const previousSync = {party: [{id: "Feraligatr (Synced Party Slot 1)"}],
		pc: [{id: "Latias (Synced PC Box 1 Slot 1)"}]};
	const nextSync = {party: [{id: "Raichu (Synced Party Slot 1)"}, {id: "Feraligatr (Synced Party Slot 2)"}],
		pc: [{id: "Chandelure (Synced PC Box 2 Slot 4)"}]};
	const merged = sync.mergeRosterLayout(previousLayout, previousSync, nextSync);
	assert.deepStrictEqual(merged.team, ["Raichu (Synced Party Slot 1)", "Feraligatr (Synced Party Slot 2)"]);
	assert.deepStrictEqual(merged.box, ["Saved (Custom Set)", "Manual (Custom Set)", "Chandelure (Synced PC Box 2 Slot 4)"]);
	assert.deepStrictEqual(merged.teamRight, ["Right (Custom Set)"]);
	assert.deepStrictEqual(previousLayout.team, ["Feraligatr (Synced Party Slot 1)", "Manual (Custom Set)"],
		"Merging must not mutate the prior layout");
	assert.deepStrictEqual(sync.mergeRosterLayout(merged, nextSync, {party: [], pc: []}).team, [],
		"An empty game party must remove the prior synced Team");
	assert.strictEqual(sync.parseSnapshot(payload([{...mon, species: "Missing", speciesId: 160}]), adapter).party.length, 0,
		"ROM numeric IDs must never be interpreted as national dex IDs");
	assert.strictEqual(sync.parseSnapshot(payload([{...mon, form: "Unknown"}]), adapter).party.length, 0);
	const partial = sync.parseSnapshot(payload([null, {...mon, item: {bad: true}, moves: [{name: "Missing"}], ivs: {spa: -1}}, mon]), adapter);
	assert.strictEqual(partial.party.length, 2);
	assert.strictEqual(partial.party[1].slot, 3, "Skipped entries must retain original slots");
	assert(partial.warnings.length >= 3);
	assert.strictEqual(partial.party[0].set.item, "");
	assert.strictEqual(partial.party[0].set.moves[0], "(No Move)");
	assert.strictEqual(sync.parseSnapshot(payload(), adapter).pc.length, 0);
	assert.strictEqual(sync.parseSnapshot(payload([], [[mon], {pokemon: [null, mon]}, mon]), adapter).pc.length, 3);
	const actualBox = sync.parseSnapshot({...payload(), pcSupported: true, pcComplete: false, pcScanned: 12,
		boxes: [{box: 2, slot: 7, pokemon: {...mon, species: "Chandelure"}}]}, adapter);
	assert.strictEqual(actualBox.pc.length, 1, "The Lua box wrapper must import its nested Pokemon");
	assert.strictEqual(actualBox.pc[0].species, "Chandelure");
	assert.strictEqual(actualBox.pc[0].location, "PC Box 2");
	assert.strictEqual(actualBox.pc[0].slot, 7);
	assert.strictEqual(actualBox.pcComplete, false);
	const firstPc = sync.parseSnapshot({...payload(), pcComplete: true,
		boxes: [{box: 1, slot: 1, pokemon: {...mon, species: "Ivysaur"}}]}, adapter);
	assert.deepStrictEqual(sync.mergeIncompletePc(firstPc, actualBox).pc.map(entry => entry.location + ":" + entry.slot),
		["PC Box 1:1", "PC Box 2:7"], "Partial scans must retain previously known PC slots");
	assert.strictEqual(sync.mergeIncompletePc(firstPc, sync.parseSnapshot({...payload(), pcComplete: true,
		boxes: []}, adapter)).pc.length, 0, "Complete scans must remove deposited or withdrawn slots");
	assert.strictEqual(sync.parseSnapshot({...payload(), boxes: [{box: 1, slot: 1, pokemon: mon},
		{box: 1, slot: 1, pokemon: mon}]}, adapter).pc.length, 1);
	assert.strictEqual(sync.parseSnapshot({...payload(), boxes: [{box: 15, slot: 1, pokemon: mon}]}, adapter).pc.length, 0);
	assert.strictEqual(sync.parseSnapshot(payload([]), adapter).party.length, 0);
	for (const bad of [null, {}, {...payload(), party: {}}, {...payload(), party: Array(7).fill(mon)}, {...payload(), boxes: {}}]) {
		assert.throws(() => sync.parseSnapshot(bad, adapter));
	}
	const link = transport(payload());
	await sync.fetchSnapshot(link);
	assert.deepStrictEqual(link.paths, [sync.url + "/ping", sync.url + "/update"]);
	for (const [ping, code] of [[{status: "ok", game: "Other", protocol: 1}, "service"],
		[{status: "ok", game: "Astral Emerald", protocol: 2}, "protocol"],
		[{status: "ok", game: "Astral Emerald"}, "invalid"]]) {
		const invalid = transport(payload(), ping);
		await assert.rejects(sync.fetchSnapshot(invalid), error => error.code === code);
		assert.strictEqual(invalid.paths.length, 1, "Do not request /update after rejected /ping");
	}
	await assert.rejects(sync.fetchSnapshot(transport({...payload(), protocol: 2})), error => error.code === "protocol");
	await assert.rejects(sync.fetchSnapshot({}), error => error.code === "unsupported");
	await assert.rejects(sync.fetchSnapshot({AbortController, fetch: async () => { throw new Error("offline"); }}), error => error.code === "connection");
	await assert.rejects(sync.fetchSnapshot({AbortController, fetch: async () => ({ok: false, status: 503,
		json: async () => ({game: "Astral Emerald", protocol: 1, error: "ROM snapshot not detected"})})}), error => error.code === "ready");
	await assert.rejects(sync.fetchSnapshot({AbortController, fetch: async () => ({ok: true, json: async () => { throw new Error("bad JSON"); }})}), error => error.code === "invalid");
	await assert.rejects(sync.fetchSnapshot({AbortController, fetch: () => new Promise(() => {})}, 10), error => error.code === "connection");
	await assert.rejects(sync.fetchSnapshot({AbortController, fetch: async () => ({ok: true, json: () => new Promise(() => {})})}, 10), error => error.code === "connection");

	// Test real HTTP serialization and fetch using an isolated ephemeral port.
	const paths = [];
	const server = http.createServer((req, res) => {
		paths.push(req.url);
		res.setHeader("Content-Type", "application/json");
		res.end(JSON.stringify(req.url === "/ping" ? {status: "ok", game: "Astral Emerald", protocol: 1} : payload(party)));
	});
	await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
	try {
		const localUrl = "http://127.0.0.1:" + server.address().port;
		const roundTrip = await sync.fetchSnapshot({AbortController, fetch: (url, config) => fetch(url.replace(sync.url, localUrl), config)});
		assert.strictEqual(sync.parseSnapshot(roundTrip, adapter).party.length, 6);
		assert.deepStrictEqual(paths, ["/ping", "/update"]);
	} finally { await new Promise(resolve => server.close(resolve)); }

	// Minimal DOM harness tests UI updates and use of existing set selection.
	const nodes = [];
	function element(tag) {
		const node = {tag, children: [], listeners: {}, textContent: "", attrs: {}, className: "",
			appendChild(child) { this.children.push(child); }, setAttribute(key, value) { this.attrs[key] = value; },
			getAttribute(key) { return this.attrs[key]; }, addEventListener(type, handler) { this.listeners[type] = handler; }};
		nodes.push(node);
		return node;
	}
	const existing = {closest: () => ({id: "p1"}), parentNode: {insertBefore() {}}, nextSibling: null};
	const manual = {level: 40, moves: ["Crunch"], isCustomSet: true};
	const storage = {customsets: JSON.stringify({Feraligatr: {Manual: manual}}),
		getItem(key) { return this[key] || null; }, setItem(key, value) { this[key] = value; }};
	let rosterLayout = {team: ["Feraligatr (Manual)"], teamRight: [], box: ["Saved (Custom Set)"],
		box2: [], boxmega: [], trash: []};
	let appliedLayouts = 0;
	const uiLink = transport(payload(party));
	let selectedId = "Manual";
	const uiTimers = new Map();
	let timerId = 0;
	const panel = {find(selector) {
		if (selector.includes("set-selector")) return {val: () => selectedId};
		if (selector === ".max-hp") return {text: () => "251"};
		assert.strictEqual(selector, ".current-hp");
		return {val() { return this; }, keyup() { return this; }, change() { return this; }};
	}};
	const context = vm.createContext({AstralSync: sync, gen: 9, pokedex: calc.SPECIES[9], moves: calc.MOVES[9],
		items: calc.ITEMS[9], abilities: calc.ABILITIES[9], calc, buildAeLuaPokemonSet: helpers.buildAeLuaPokemonSet,
		setdex: {Feraligatr: {Manual: manual}}, localStorage: storage, console: {info() {}, warn() {}},
		setTimeout: (callback, delay) => { const id = ++timerId; uiTimers.set(id, {callback, delay}); return id; },
		clearTimeout: id => uiTimers.delete(id),
		document: {createElement: element, getElementById: () => ({}), querySelectorAll(selector) {
			return selector === ".ae-lua-frag-import-button" ? [existing] : nodes.filter(node => node.className.split(" ").includes(selector.slice(1)));
		}}, $: callback => {
			if (typeof callback === "function") callback();
			else return callback.includes("set-selector") ? {val: () => selectedId} : panel;
		}, collectPlayerRosterLayout: () => rosterLayout,
		applyPlayerRosterLayout: layout => { rosterLayout = layout; appliedLayouts++; },
		applyPlayerRosterSearchFilter() {}, syncFragRoster() {}, renderFragSheet() {}});
	context.window = context;
	context.updateDex = saved => {
		Object.keys(context.setdex).forEach(species => {
			Object.keys(context.setdex[species]).forEach(label => {
				if (context.setdex[species][label].isCustomSet) delete context.setdex[species][label];
			});
		});
		Object.keys(saved).forEach(species => {
			context.setdex[species] ||= {};
			Object.keys(saved[species]).forEach(label => {
				saved[species][label].isCustomSet = true;
				context.setdex[species][label] = saved[species][label];
			});
		});
		storage.customsets = JSON.stringify(saved);
	};
	context.fetch = uiLink.fetch;
	context.AbortController = AbortController;
	const selected = [];
	context.setSelectedSetIdForSide = (side, id) => { selectedId = id; selected.push([side, id]); return true; };
	vm.runInContext(fs.readFileSync(require.resolve("../src/js/astral_sync_ui"), "utf8"), context);
	context.SPECIES_DISPLAY_NAME_ALIASES = {};
	for (const name of ["parseSetId", "getDisplaySpeciesName", "formatSetNameForDisplay"]) {
		const match = shared.match(new RegExp("function " + name + "\\([^]*?\\n\\}"));
		assert(match, "Missing set display helper " + name);
		vm.runInContext(match[0], context);
	}
	assert.strictEqual(uiLink.paths.length, 0, "Startup must not contact emulator");
	const button = nodes.find(node => node.className.includes("astral-sync-button"));
	await button.listeners.click();
	assert.strictEqual(button.textContent, "Synced");
	assert.strictEqual(button.disabled, false);
	assert(!nodes.some(node => node.tag === "summary" || node.tag === "details"), "Sync status must not create a dropdown");
	const syncStatus = nodes.find(node => node.className === "astral-sync-status");
	assert.strictEqual(syncStatus.textContent, "Astral Emerald is connected. Party imported.");
	assert.strictEqual(context.AstralSyncUI.options().length, 6);
	assert.strictEqual(context.AstralSyncUI.options()[0].text, "Tide (Feraligatr)");
	assert.strictEqual(context.AstralSyncUI.options()[1].text, "Latias (Custom Set)");
	assert.strictEqual(context.AstralSyncUI.options()[0].isCustom, true);
	assert.strictEqual(context.formatSetNameForDisplay("Feraligatr (Synced Party Slot 1)"), "Tide (Feraligatr)");
	assert.strictEqual(context.formatSetNameForDisplay("Feraligatr (Manual)"), "Feraligatr (Manual)");
	assert.strictEqual(selected.length, 0, "Sync must not change manual calculator inputs");
	assert.strictEqual(context.setdex.Feraligatr.Manual.level, manual.level);
	assert.strictEqual(JSON.parse(storage.customsets).Feraligatr.Manual.level, manual.level,
		"Sync must preserve saved manual imports");
	assert.deepStrictEqual(rosterLayout.team, party.map((entry, index) => entry.species + " (Synced Party Slot " + (index + 1) + ")"));
	assert.deepStrictEqual(rosterLayout.box, ["Saved (Custom Set)", "Feraligatr (Manual)"],
		"Manual Team member must move to Box without losing saved sets");
	const checkConnection = [...uiTimers.values()].find(timer => timer.delay === 5000).callback;
	const rosterBeforeCheck = JSON.stringify(rosterLayout);
	await checkConnection();
	assert.strictEqual(syncStatus.textContent, "Astral Emerald is connected. Party imported.");
	assert.strictEqual(JSON.stringify(rosterLayout), rosterBeforeCheck, "Connection checks must not import or change the roster");
	context.fetch = async url => ({ok: url.endsWith("/ping"), status: url.endsWith("/ping") ? 200 : 503,
		json: async () => url.endsWith("/ping") ? {status: "ok", game: "Astral Emerald", protocol: 1} :
			{game: "Astral Emerald", protocol: 1, error: "ROM snapshot not detected"}});
	await [...uiTimers.values()].filter(timer => timer.delay === 5000).pop().callback();
	assert.strictEqual(syncStatus.textContent, "Not connected to Astral Emerald. Saved party available.",
		"A responding Lua service without a readable game must not count as connected");
	context.fetch = async () => { throw new Error("Game closed"); };
	await [...uiTimers.values()].filter(timer => timer.delay === 5000).pop().callback();
	assert.strictEqual(syncStatus.textContent, "Not connected to Astral Emerald. Saved party available.");
	assert.strictEqual(context.AstralSyncUI.options().length, 6, "Disconnect must keep imported Pokemon");
	assert(!syncStatus.textContent.includes("is connected"));
	context.setSelectedSetIdForSide("p1", "Feraligatr (Synced Party Slot 1)");
	const updated = transport(payload([{...mon, species: "Latias", level: 76}]));
	context.fetch = updated.fetch;
	await button.listeners.click();
	assert.strictEqual(context.AstralSyncUI.options().length, 1);
	assert.strictEqual(context.setdex.Feraligatr["Synced Party Slot 1"], undefined);
	assert.strictEqual(context.setdex.Latias["Synced Party Slot 1"].level, 76);
	assert.strictEqual(context.formatSetNameForDisplay("Latias (Synced Party Slot 1)"), "Latias (Custom Set)");
	assert.deepStrictEqual(selected[1], ["p1", "Latias (Synced Party Slot 1)"],
		"A previously selected synced slot must receive its refreshed set");
	assert.deepStrictEqual(rosterLayout.team, ["Latias (Synced Party Slot 1)"]);
	assert.deepStrictEqual(rosterLayout.box, ["Saved (Custom Set)", "Feraligatr (Manual)"],
		"Repeated Sync must retain manual Box entries and remove stale party entries");
	assert.strictEqual(appliedLayouts, 2);
	context.AstralSyncUI.install();
	assert.strictEqual(Object.keys(context.setdex.Latias).length, 1, "Repeated install must not duplicate sets");
	assert.strictEqual(context.setdex.Feraligatr.Manual.level, manual.level);
	const withPc = transport(payload([{...mon, species: "Latias", level: 76}],
		[{box: 1, slot: 1, pokemon: {...mon, species: "Chandelure", level: 60}}]));
	context.fetch = withPc.fetch;
	await button.listeners.click();
	assert.deepStrictEqual(rosterLayout.box, ["Saved (Custom Set)", "Feraligatr (Manual)",
		"Chandelure (Synced PC Box 1 Slot 1)"], "Future PC data must enter Box");
	assert.strictEqual(context.AstralSyncUI.options().length, 2);
	const persisted = JSON.parse(storage.customsets);
	assert.strictEqual(persisted.Latias["Synced Party Slot 1"].level, 76);
	assert.strictEqual(persisted.Chandelure["Synced PC Box 1 Slot 1"].level, 60);
	assert.strictEqual(persisted.Feraligatr.Manual.level, 40);
	const reloaded = vm.createContext({...context, setdex: {}, localStorage: storage});
	const callsBeforeReload = withPc.paths.length;
	reloaded.window = reloaded;
	vm.runInContext(fs.readFileSync(require.resolve("../src/js/astral_sync_ui"), "utf8"), reloaded);
	assert.strictEqual(syncStatus.textContent, "Not connected to Astral Emerald. Saved party available.");
	assert.strictEqual(withPc.paths.length, callsBeforeReload, "Restoring saved imports must not claim a live connection");
	Object.keys(persisted).forEach(species => { reloaded.setdex[species] = {...persisted[species]}; });
	reloaded.AstralSyncUI.install();
	assert.strictEqual(reloaded.AstralSyncUI.options().length, 2, "Saved Sync should restore without contacting Lua");
	assert.strictEqual(reloaded.setdex.Feraligatr.Manual.level, 40);
	assert.strictEqual(Object.keys(reloaded.setdex.Latias).length, 1, "Restore must not duplicate imported sets");
	assert.strictEqual(reloaded.setdex.Latias["Synced Party Slot 1"].level, 76);
	assert.strictEqual(reloaded.setdex.Chandelure["Synced PC Box 1 Slot 1"].level, 60);
	reloaded.SPECIES_DISPLAY_NAME_ALIASES = {};
	for (const name of ["parseSetId", "getDisplaySpeciesName", "formatSetNameForDisplay"]) {
		const match = shared.match(new RegExp("function " + name + "\\([^]*?\\n\\}"));
		vm.runInContext(match[0], reloaded);
	}
	assert.strictEqual(reloaded.formatSetNameForDisplay("Chandelure (Synced PC Box 1 Slot 1)"),
		"Chandelure (Custom Set)", "Reloaded PC set should not expose its box position");
	assert(rosterLayout.team.every(id => reloaded.setdex[id.split(" (")[0]][id.match(/\(([^()]*)\)$/)[1]]),
		"Saved Team IDs must resolve after a page reload");
	assert(rosterLayout.box.some(id => id === "Chandelure (Synced PC Box 1 Slot 1)"),
		"Saved PC slots must remain in Box");
	const withdrawn = transport(payload([{...mon, species: "Latias", level: 77}]));
	context.fetch = withdrawn.fetch;
	await button.listeners.click();
	assert.deepStrictEqual(rosterLayout.box, ["Saved (Custom Set)", "Feraligatr (Manual)"],
		"Removed PC Pokemon must leave Box without removing manual entries");
	assert.strictEqual(rosterLayout.team.length, 1);
	assert.strictEqual(context.setdex.Latias["Synced Party Slot 1"].level, 77);
	assert.strictEqual(JSON.parse(storage.customsets).Chandelure, undefined,
		"A complete later Sync must remove withdrawn PC sets from storage");
	const failed = transport(payload(), {game: "Other", status: "ok", protocol: 1});
	context.fetch = failed.fetch;
	await button.listeners.click();
	assert.strictEqual(button.textContent, "Sync Failed");
	assert.strictEqual(context.AstralSyncUI.options().length, 1, "Failed sync must preserve the last snapshot");
	assert.strictEqual(appliedLayouts, 4, "Failed Sync must preserve the roster layout");
	let readyAttempts = 0;
	context.setTimeout = (callback, delay) => delay === 350 ? setTimeout(callback, 0) : 1;
	context.fetch = async url => {
		const retry = url.endsWith("/update") && ++readyAttempts < 3;
		return {ok: !retry, status: retry ? 503 : 200, json: async () =>
			retry ? {game: "Astral Emerald", protocol: 1, error: "ROM snapshot not detected"} :
			url.endsWith("/ping") ? {status: "ok", game: "Astral Emerald", protocol: 1} :
			payload([{...mon, species: "Latias", level: 78}])};
	};
	await button.listeners.click();
	assert.strictEqual(readyAttempts, 3, "Sync should retry a temporarily unreadable ROM snapshot");
	assert.strictEqual(context.setdex.Latias["Synced Party Slot 1"].level, 78);
	assert.strictEqual(button.textContent, "Synced");
	let unavailableAttempts = 0;
	context.fetch = async url => {
		if (url.endsWith("/ping")) return {ok: true, status: 200,
			json: async () => ({status: "ok", game: "Astral Emerald", protocol: 1})};
		unavailableAttempts++;
		return {ok: false, status: 503,
			json: async () => ({game: "Astral Emerald", protocol: 1, error: "ROM snapshot not detected"})};
	};
	await button.listeners.click();
	assert.strictEqual(unavailableAttempts, 7, "An incompatible ROM must stop retrying");
	assert.strictEqual(button.textContent, "Sync Failed");
	assert.strictEqual(context.setdex.Latias["Synced Party Slot 1"].level, 78,
		"A permanently unavailable ROM must keep the last imported set");
	context.document.getElementById = () => null;
	context.fetch = transport(payload([{...mon, species: "Feraligatr"}])).fetch;
	await button.listeners.click();
	assert.strictEqual(button.textContent, "Synced");
	assert.strictEqual(appliedLayouts, 5, "Pages without Team/Box DOM must not overwrite the stored layout");
	context.fetch = transport(payload([{...mon, nickname: "Tide"}, {...mon, nickname: "Tide"}])).fetch;
	await button.listeners.click();
	assert.deepStrictEqual(json(context.AstralSyncUI.options().map(option => option.text)),
		["Tide (Feraligatr)", "Tide (Feraligatr) #2"], "Duplicate nicknames should remain distinguishable");
	context.gen = 3;
	assert.strictEqual(context.AstralSyncUI.options().length, 0);
	console.log("Astral Sync tests passed: parser, Astral data, protocol/errors/timeouts, HTTP round trip, UI persistence, and snapshot replacement.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
