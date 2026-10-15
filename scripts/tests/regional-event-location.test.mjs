import assert from 'node:assert/strict';
import test from 'node:test';
import { regionalCardLocation } from '../../src/lib/regional-event-location.js';

test('uses the explicit Cranbrook address instead of the source default', () => {
  assert.deepEqual(
    regionalCardLocation(
      'Sat 5 Dec 2026 80 Glen Gala Road, Cranbrook, 7190',
      { defaultTown: 'St Helens', region: 'East Coast', eventName: '19-Twenty live at Craigie Knowe Vineyard' }
    ),
    {
      town: 'Cranbrook',
      region: 'East Coast',
      venue: 'Craigie Knowe Vineyard',
      address: '80 Glen Gala Road, Cranbrook TAS 7190',
    }
  );
});

test('handles multi-word east-coast localities', () => {
  assert.equal(
    regionalCardLocation(
      '100 Mayfield Jetty Road, Little Swanport, 7190',
      { defaultTown: 'St Helens', region: 'East Coast' }
    ).town,
    'Little Swanport'
  );
});

test('retains the source default when no explicit locality is present', () => {
  assert.deepEqual(
    regionalCardLocation('Event details to be announced', {
      defaultTown: 'St Helens',
      region: 'East Coast',
    }),
    { town: 'St Helens', region: 'East Coast', venue: undefined, address: undefined }
  );
});
