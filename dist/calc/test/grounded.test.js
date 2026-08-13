"use strict";
exports.__esModule = true;
var helper_1 = require("./helper");
describe('grounded field status', function () {
    (0, helper_1.inGens)(4, 9, function (_a) {
        var gen = _a.gen, calculate = _a.calculate, Pokemon = _a.Pokemon, Move = _a.Move, Field = _a.Field;
        test("forces Flying-type Pok\u00E9mon to take Ground damage (gen ".concat(gen, ")"), function () {
            var attacker = Pokemon('Garchomp');
            var defender = Pokemon('Zapdos', { ability: 'Pressure' });
            expect(calculate(attacker, defender, Move('Earthquake')).range()).toEqual([0, 0]);
            expect(calculate(attacker, defender, Move('Earthquake'), Field({ defenderSide: { isGrounded: true } })).range()[0]).toBeGreaterThan(0);
        });
    });
    (0, helper_1.inGen)(9, function (_a) {
        var calculate = _a.calculate, Pokemon = _a.Pokemon, Move = _a.Move, Field = _a.Field;
        test.each([
            ['Levitate', Pokemon('Rotom', { ability: 'Levitate' })],
            ['Eelevate', Pokemon('Blastoise', { ability: 'Eelevate' })],
            ['Air Balloon', Pokemon('Blastoise', { item: 'Air Balloon' })],
        ])('overrides %s Ground immunity', function (_source, defender) {
            var attacker = Pokemon('Garchomp');
            expect(calculate(attacker, defender, Move('Earthquake')).range()).toEqual([0, 0]);
            expect(calculate(attacker, defender, Move('Earthquake'), Field({ defenderSide: { isGrounded: true } })).range()[0]).toBeGreaterThan(0);
        });
        test('applies terrain effects to a forced-grounded attacker', function () {
            var attacker = Pokemon('Zapdos', { ability: 'Pressure' });
            var defender = Pokemon('Blastoise');
            var plain = calculate(attacker, defender, Move('Thunderbolt'), Field({ terrain: 'Electric' }));
            var grounded = calculate(attacker, defender, Move('Thunderbolt'), Field({ terrain: 'Electric', attackerSide: { isGrounded: true } }));
            expect(grounded.range()[0]).toBeGreaterThan(plain.range()[0]);
        });
        test('applies Spikes to a forced-grounded Flying-type defender', function () {
            var result = calculate(Pokemon('Garchomp'), Pokemon('Corviknight', { ability: 'Pressure' }), Move('Stone Edge'), Field({ defenderSide: { isGrounded: true, spikes: 1 } }));
            expect(result.fullDesc()).toContain('after 1 layer of Spikes');
        });
    });
    (0, helper_1.inGen)(9, function (_a) {
        var Field = _a.Field;
        test('preserves the status when fields are cloned and swapped', function () {
            var field = Field({ defenderSide: { isGrounded: true } });
            expect(field.clone().defenderSide.isGrounded).toBe(true);
            expect(field.clone().swap().attackerSide.isGrounded).toBe(true);
        });
    });
});
//# sourceMappingURL=grounded.test.js.map