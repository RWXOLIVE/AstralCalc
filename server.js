/* eslint-env node, es6 */
const express = require("express");
const calc = require("./calc/dist");

const app = express();

app.use(express.json({limit: "32kb"}));

app.get("/calculate", (req, res) => {
	const gen = calc.Generations.get((typeof req.body.gen === "undefined") ? 9 : req.body.gen);
	let error = "";
	if (typeof req.body.attackingPokemon === "undefined")
		error += "attackingPokemon must exist and have a valid pokemon name\n";
	if (typeof req.body.defendingPokemon === "undefined")
		error += "defendingPokemon must exist and have a valid pokemon name\n";
	if (error)
		throw new Error(error);
	const result = calc.calculate(
		gen,
		new calc.Pokemon(gen, req.body.attackingPokemon, req.body.attackingPokemonOptions),
		new calc.Pokemon(gen, req.body.defendingPokemon, req.body.defendingPokemonOptions),
		new calc.Move(gen, req.body.moveName),
		new calc.Field((typeof req.body.field === "undefined") ? undefined : req.body.field)
	);
	res.json(result);
});

app.use(express.static("dist"));

app.listen(3000, () => {
	console.log("Server running on port 3000");
});
