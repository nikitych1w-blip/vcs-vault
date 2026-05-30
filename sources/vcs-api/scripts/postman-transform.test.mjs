import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addRawUrl,
  buildSplitCollection,
  buildRawUrl,
  getFolderName,
  normalizeCollection,
  normalizeDescription,
  toPascalCase,
} from './postman-transform.mjs';

const sampleSurface = {
  id: 'v3',
  collectionPrefix: 'SourceControl API v3',
  folderNameOverrides: {
    branches: 'Branch',
  },
  policy: {
    auth: {
      type: 'basic',
      usernameVariable: 'basicAuthUsername',
      passwordVariable: 'basicAuthPassword',
    },
    removeTopLevelVariables: true,
  },
};

test('normalizeDescription normalizes supported description shapes', () => {
  assert.equal(normalizeDescription('Text'), 'Text');
  assert.equal(normalizeDescription({ content: 'Body', type: 'text/plain' }), 'Body');
  assert.equal(normalizeDescription(''), undefined);
  assert.equal(normalizeDescription({ content: '' }), undefined);
  assert.equal(normalizeDescription(undefined), undefined);
});

test('buildRawUrl ignores disabled query parameters', () => {
  const rawUrl = buildRawUrl({
    host: ['{{baseUrl}}'],
    path: ['repos', ':tenant', ':project'],
    query: [
      { key: 'page', value: '1', disabled: false },
      { key: 'limit', value: '20', disabled: true },
    ],
  });

  assert.equal(rawUrl, '{{baseUrl}}/repos/:tenant/:project?page=1');
});

test('addRawUrl mutates url object only when raw is missing', () => {
  const url = {
    host: ['{{baseUrl}}'],
    path: ['health'],
    query: [],
  };

  addRawUrl(url);

  assert.equal(url.raw, '{{baseUrl}}/health');
});

test('getFolderName uses overrides and falls back to pascal case', () => {
  assert.equal(getFolderName(sampleSurface, 'branches'), 'Branch');
  assert.equal(getFolderName(sampleSurface, 'review settings'), 'ReviewSettings');
  assert.equal(toPascalCase('review settings'), 'ReviewSettings');
  assert.equal(toPascalCase(''), 'Untagged');
});

test('buildSplitCollection keeps info first and narrows the collection to one folder', () => {
  const collection = {
    info: { name: 'Original', schema: 'schema-url' },
    item: [
      { name: 'Branches', item: [{ name: 'List branches' }] },
      { name: 'Users', item: [{ name: 'Get user' }] },
    ],
    auth: { type: 'basic' },
  };

  const splitCollection = buildSplitCollection(collection, collection.item[0], 'SourceControl API v3 Branch', 'Branch');

  assert.deepEqual(Object.keys(splitCollection), ['info', 'item', 'auth']);
  assert.equal(splitCollection.info.name, 'SourceControl API v3 Branch');
  assert.equal(splitCollection.item.length, 1);
  assert.equal(splitCollection.item[0].name, 'Branch');
});

test('normalizeCollection applies policy and removes collection variables', () => {
  const collection = {
    info: { name: 'PR', description: { content: 'SourceControl REST API v3' } },
    item: [{ name: 'PR', event: [] }],
    variable: [{ key: 'baseUrl', value: 'https://example.invalid/api/v3' }],
  };

  normalizeCollection(collection, sampleSurface);

  assert.equal(collection.auth.type, 'basic');
  assert.equal(collection.auth.basic[0].value, '{{basicAuthUsername}}');
  assert.equal(collection.auth.basic[1].value, '{{basicAuthPassword}}');
  assert.equal(collection.variable, undefined);
  assert.equal(collection.info.description, 'SourceControl REST API v3');
});
