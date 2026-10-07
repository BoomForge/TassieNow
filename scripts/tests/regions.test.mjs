import test from 'node:test';
import assert from 'node:assert/strict';
import { regionFor } from '../discover/lib/regions.mjs';

test('Central Tasmania towns are not swallowed by north or south fallbacks', () => {
  assert.equal(regionFor(-42.30, 147.37, 'Oatlands'), 'Central Tasmania');
  assert.equal(regionFor(-42.38, 147.01, 'Bothwell'), 'Central Tasmania');
  assert.equal(regionFor(-41.99, 146.72, 'Miena'), 'Central Tasmania');
  assert.equal(regionFor(-42.03, 147.49, 'Ross'), 'Central Tasmania');
  assert.equal(regionFor(-41.93, 147.49, 'Campbell Town'), 'Central Tasmania');
  assert.equal(regionFor(-42.30, 147.37, ''), 'Central Tasmania');
});

test('border towns remain in their established regions', () => {
  assert.equal(regionFor(-41.53, 146.66, 'Deloraine'), 'Launceston & North');
  assert.equal(regionFor(-40.99, 145.72, 'Wynyard'), 'North West');
  assert.equal(regionFor(-42.88, 147.33, 'Hobart'), 'Hobart & South');
  assert.equal(regionFor(-41.87, 148.30, 'Bicheno'), 'East Coast');
  assert.equal(regionFor(-42.08, 145.56, 'Queenstown'), 'West Coast');
  assert.equal(regionFor(-39.93, 143.85, 'Currie'), 'King Island');
  assert.equal(regionFor(-40.12, 148.02, 'Whitemark'), 'Flinders Island');
});
