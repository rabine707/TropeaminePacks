import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasCardEdition, matchesBinderStatus, isFoilDisplay, matchesOwnedEdition, ownedCharacterIds} from './binder.ts';

test('foil-only pulls are collected and never appear as missing', () => {
  const owned = ['a:foil'];
  assert.equal(hasCardEdition(owned, 'a'), true);
  assert.equal(matchesBinderStatus('Collected', 'a', owned, []), true);
  assert.equal(matchesBinderStatus('Missing', 'a', owned, []), false);
  assert.equal(matchesBinderStatus('Missing', 'b', owned, []), true);
});

test('recent cards include foil editions and treatments do not displace recent pulls', () => {
  const owned = ['old', 'a:foil', 'b', 'c', 'd', 'e', ...Array.from({length:6}, (_,i) => `old:treatment:${i}`)];
  assert.equal(matchesBinderStatus('Recently acquired', 'a', owned, []), true);
  assert.equal(matchesBinderStatus('Recently acquired', 'old', owned, []), false);
  assert.equal(matchesBinderStatus('Favorites', 'a', owned, ['a']), true);
});

test('foil-only ownership defaults to foil; explicit base and treatment choices remain respected', () => {
  assert.equal(isFoilDisplay(['a:foil'], 'a', 'base'), true);
  assert.equal(isFoilDisplay(['a', 'a:foil'], 'a', 'base'), false);
  assert.equal(isFoilDisplay(['a', 'a:foil'], 'a', 'foil'), true);
  assert.equal(isFoilDisplay(['a', 'a:foil'], 'a', 'heartthrob'), false);
  assert.equal(isFoilDisplay(['a'], 'a', 'foil'), false);
});

test('edition filters distinguish a base collection from foil-only and combined ownership', () => {
  const owned=['base','foil:foil','both','both:foil'];
  assert.equal(matchesOwnedEdition('Foil editions','foil',owned),true);
  assert.equal(matchesOwnedEdition('Base editions','foil',owned),false);
  assert.equal(matchesOwnedEdition('Foil editions','base',owned),false);
  assert.equal(matchesOwnedEdition('Base editions','both',owned),true);
  assert.equal(matchesOwnedEdition('Foil editions','both',owned),true);
});

test('a selected edition overrides the saved finish without inventing foil ownership', () => {
  const owned=['both','both:foil','base'];
  assert.equal(isFoilDisplay(owned,'both','base','Foil editions'),true);
  assert.equal(isFoilDisplay(owned,'both','foil','Base editions'),false);
  assert.equal(isFoilDisplay(owned,'both','heartthrob','Foil editions'),true);
  assert.equal(isFoilDisplay(owned,'base','foil','Foil editions'),false);
  assert.equal(isFoilDisplay(owned,'both','heartthrob','All editions'),false);
});

test('Showcase includes foil-only cards once and excludes treatment-only ownership', () => {
  assert.deepEqual(ownedCharacterIds(['base','both','both:foil','foil:foil','unowned:treatment:holo','unknown:other','']),['base','both','foil']);
});
