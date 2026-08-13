/* eslint-env jest */

import {inGen, inGens} from './helper';

describe('grounded field status', () => {
  inGens(4, 9, ({gen, calculate, Pokemon, Move, Field}) => {
    test(`forces Flying-type Pokémon to take Ground damage (gen ${gen})`, () => {
      const attacker = Pokemon('Garchomp');
      const defender = Pokemon('Zapdos', {ability: 'Pressure'});

      expect(calculate(attacker, defender, Move('Earthquake')).range()).toEqual([0, 0]);
      expect(calculate(
        attacker,
        defender,
        Move('Earthquake'),
        Field({defenderSide: {isGrounded: true}})
      ).range()[0]).toBeGreaterThan(0);
    });
  });

  inGen(9, ({calculate, Pokemon, Move, Field}) => {
    test.each([
      ['Levitate', Pokemon('Rotom', {ability: 'Levitate'})],
      ['Eelevate', Pokemon('Blastoise', {ability: 'Eelevate'})],
      ['Air Balloon', Pokemon('Blastoise', {item: 'Air Balloon'})],
    ])('overrides %s Ground immunity', (_source, defender) => {
      const attacker = Pokemon('Garchomp');

      expect(calculate(attacker, defender, Move('Earthquake')).range()).toEqual([0, 0]);
      expect(calculate(
        attacker,
        defender,
        Move('Earthquake'),
        Field({defenderSide: {isGrounded: true}})
      ).range()[0]).toBeGreaterThan(0);
    });

    test('applies terrain effects to a forced-grounded attacker', () => {
      const attacker = Pokemon('Zapdos', {ability: 'Pressure'});
      const defender = Pokemon('Blastoise');
      const plain = calculate(
        attacker,
        defender,
        Move('Thunderbolt'),
        Field({terrain: 'Electric'})
      );
      const grounded = calculate(
        attacker,
        defender,
        Move('Thunderbolt'),
        Field({terrain: 'Electric', attackerSide: {isGrounded: true}})
      );

      expect(grounded.range()[0]).toBeGreaterThan(plain.range()[0]);
    });

    test('applies Spikes to a forced-grounded Flying-type defender', () => {
      const result = calculate(
        Pokemon('Garchomp'),
        Pokemon('Corviknight', {ability: 'Pressure'}),
        Move('Stone Edge'),
        Field({defenderSide: {isGrounded: true, spikes: 1}})
      );

      expect(result.fullDesc()).toContain('after 1 layer of Spikes');
    });
  });

  inGen(9, ({Field}) => {
    test('preserves the status when fields are cloned and swapped', () => {
      const field = Field({defenderSide: {isGrounded: true}});

      expect(field.clone().defenderSide.isGrounded).toBe(true);
      expect(field.clone().swap().attackerSide.isGrounded).toBe(true);
    });
  });
});
