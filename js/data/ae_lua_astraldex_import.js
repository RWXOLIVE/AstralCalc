(function(global){
var payload={"pokemon":{"storage":[],"party":[{"speciesId":498,"item":"","nickname":"Aaaaaaaaaa","ability":"Iron Fist","level":8,"slotIndex":0,"evs":{"atk":0,"spa":0,"def":0,"spe":0,"spd":0,"hp":0},"nature":"Hardy","id":"party:0:498:3196544375:2023379531","metLocationName":"Fateful Encounter","otId":2023379531,"personality":3196544375,"moves":["Tackle","Ember","Tail Whip","(No Move)"],"species":"Tepig","location":"party","ivs":{"atk":31,"spa":24,"def":31,"spe":15,"spd":13,"hp":31},"metLocationHex":"0xFF","metLevel":5,"metLocation":255,"setName":"ae_lua Party 1"},{"speciesId":183,"item":"","nickname":"Marill","ability":"Thick Fat","level":5,"slotIndex":1,"evs":{"atk":0,"spa":0,"def":0,"spe":0,"spd":0,"hp":0},"nature":"Impish","id":"party:1:183:3799961658:2023379531","metLocationName":"Route 101","otId":2023379531,"personality":3799961658,"moves":["Tackle","(No Move)","(No Move)","(No Move)"],"species":"Marill","location":"party","ivs":{"atk":3,"spa":15,"def":27,"spe":31,"spd":13,"hp":27},"metLocationHex":"0x10","metLevel":5,"metLocation":16,"setName":"ae_lua Party 2"},{"speciesId":228,"item":"","nickname":"Houndour","ability":"Unnerve","level":5,"slotIndex":2,"evs":{"atk":0,"spa":0,"def":0,"spe":0,"spd":0,"hp":0},"nature":"Naughty","id":"party:2:228:4149758254:2023379531","metLocationName":"Oldale Town","otId":2023379531,"personality":4149758254,"moves":["Growl","Ember","Snarl","(No Move)"],"species":"Houndour","location":"party","ivs":{"atk":19,"spa":10,"def":17,"spe":18,"spd":21,"hp":11},"metLocationHex":"0x01","metLevel":5,"metLocation":1,"setName":"ae_lua Party 3"},{"speciesId":540,"item":"","nickname":"Sewaddle","ability":"Swarm","level":5,"slotIndex":3,"evs":{"atk":0,"spa":0,"def":0,"spe":0,"spd":0,"hp":0},"nature":"Sassy","id":"party:3:540:953147072:2023379531","metLocationName":"Route 103","otId":2023379531,"personality":953147072,"moves":["Absorb","Silver Wind","(No Move)","(No Move)"],"species":"Sewaddle","location":"party","ivs":{"atk":31,"spa":22,"def":23,"spe":0,"spd":14,"hp":27},"metLocationHex":"0x12","metLevel":5,"metLocation":18,"setName":"ae_lua Party 4"}]},"version":1,"astralDex":{"storageKey":"porydex-encounter-selections","encounterSelections":{"route101":"marill","starterlocation":"tepig","route103":"sewaddle","oldaletown":"houndour"},"importJavaScript":"(function(){var key=\"porydex-encounter-selections\";var incoming={\"route101\":\"marill\",\"starterlocation\":\"tepig\",\"route103\":\"sewaddle\",\"oldaletown\":\"houndour\"};var current={};try{current=JSON.parse(localStorage.getItem(key)||\"{}\")}catch(e){}localStorage.setItem(key,JSON.stringify(Object.assign(current||{},incoming||{})));location.reload();})();","sources":{"route101":[{"speciesId":183,"id":"party:1:183:3799961658:2023379531","metLocationName":"Route 101","metLevel":5,"nickname":"Marill","species":"Marill","location":"party","metLocation":16,"metLocationHex":"0x10","astralDexSpeciesId":"marill","slotIndex":1,"encounterSpeciesId":"marill"}],"starterlocation":[{"speciesId":498,"id":"party:0:498:3196544375:2023379531","metLocationName":"Fateful Encounter","metLevel":5,"nickname":"Aaaaaaaaaa","species":"Tepig","location":"party","metLocation":255,"metLocationHex":"0xFF","astralDexSpeciesId":"tepig","slotIndex":0,"encounterSpeciesId":"tepig"}],"route103":[{"speciesId":540,"id":"party:3:540:953147072:2023379531","metLocationName":"Route 103","metLevel":5,"nickname":"Sewaddle","species":"Sewaddle","location":"party","metLocation":18,"metLocationHex":"0x12","astralDexSpeciesId":"sewaddle","slotIndex":3,"encounterSpeciesId":"sewaddle"}],"oldaletown":[{"speciesId":228,"id":"party:2:228:4149758254:2023379531","metLocationName":"Oldale Town","metLevel":5,"nickname":"Houndour","species":"Houndour","location":"party","metLocation":1,"metLocationHex":"0x01","astralDexSpeciesId":"houndour","slotIndex":2,"encounterSpeciesId":"houndour"}]}},"source":"ae_lua","sessionId":"ae_lua:2026-06-30T20:00:13Z","updatedAt":"2026-06-30T20:14:50Z","deaths":[],"events":[]};
var storageKey="porydex-encounter-selections";
function own(value,key){return Object.prototype.hasOwnProperty.call(value,key);}
function objectKeys(value){var keys=[];for(var key in value){if(own(value,key))keys.push(key);}return keys;}
function asObject(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}
function readSelections(){try{return asObject(JSON.parse(global.localStorage.getItem(storageKey)||"{}"));}catch(err){return {};}}
function importAeLuaAstralDexEncounters(source){
source=asObject(source);
var dex=asObject(source.astralDex||source);
var incoming=asObject(dex.encounterSelections||dex.selections);
var current=readSelections();
var applied={};
var changed=false;
var keys=objectKeys(incoming);
for(var i=0;i<keys.length;i++){
var locationId=String(keys[i]||"");
var speciesId=String(incoming[locationId]||"");
if(!locationId||!speciesId)continue;
applied[locationId]=speciesId;
if(current[locationId]!==speciesId){current[locationId]=speciesId;changed=true;}
}
global.localStorage.setItem(storageKey,JSON.stringify(current));
var result={changed:changed,count:objectKeys(applied).length,selections:applied,storageKey:storageKey};
if(typeof global.CustomEvent==="function"&&typeof global.dispatchEvent==="function"){global.dispatchEvent(new global.CustomEvent("ae-lua-astraldex-import",{detail:result}));}
return result;
}
global.AE_LUA_FRAG_EXPORT=payload;
global.AE_LUA_ASTRALDEX_EXPORT=asObject(payload.astralDex);
global.importAeLuaAstralDexEncounters=importAeLuaAstralDexEncounters;
var host=String(global.location&&global.location.hostname||"");
var shouldAutoImport=!global.AE_LUA_ASTRALDEX_SKIP_AUTO_IMPORT&&(host==="astral-dex.vercel.app"||!!(global.document&&global.document.querySelector&&global.document.querySelector(".encounterlist-catch")));
if(shouldAutoImport&&global.localStorage){
var result=importAeLuaAstralDexEncounters(payload);
if(result.changed&&global.location&&typeof global.location.reload==="function"){global.location.reload();}
}
})(typeof window!=="undefined"?window:this);
