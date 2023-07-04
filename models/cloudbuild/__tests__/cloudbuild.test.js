'use strict';

const cloudbuild = require('..');
const assert = require('assert').strict;

assert.strictEqual(cloudbuild(), 'Hello from cloudbuild');
console.info("cloudbuild tests passed");
