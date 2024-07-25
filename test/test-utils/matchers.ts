import { expect } from '@jest/globals';
import type { MatcherFunction } from 'expect';

import { collectAndMergeFields } from '../../src/compiler/visitors/collectAndMergeFields';

import { SelectionSet } from '../../src/compiler';

declare module 'expect' {
  interface Matchers<R, T> {
    toMatchSelectionSet(possibleTypeNames: string[], expectedResponseKeys: string[]): R;
    toContainSelectionSetMatching(possibleTypeNames: string[], expectedResponseKeys: string[]): R;
  }
}

const toMatchSelectionSet: MatcherFunction<[
  possibleTypeNames: string[],
  expectedResponseKeys: string[]
]> = function(received, possibleTypeNames, expectedResponseKeys) {
  const receivedSet = received as SelectionSet;
  const actualResponseKeys = collectAndMergeFields(receivedSet).map(field => field.responseKey);

  const pass = this.equals(actualResponseKeys, expectedResponseKeys);

  if (pass) {
    return {
      message: () =>
        `Expected selection set for ${this.utils.printExpected(possibleTypeNames)}\n` +
        `To not match:\n` +
        `   ${this.utils.printExpected(expectedResponseKeys)}` +
        'Received:\n' +
        `  ${this.utils.printReceived(actualResponseKeys)}`,
      pass: true
    };
  } else {
    return {
      message: () =>
        `Expected selection set for ${this.utils.printExpected(possibleTypeNames)}\n` +
        `To match:\n` +
        `   ${this.utils.printExpected(expectedResponseKeys)}\n` +
        'Received:\n' +
        `   ${this.utils.printReceived(actualResponseKeys)}`,
      pass: false
    };
  }
}

const toContainSelectionSetMatching: MatcherFunction<[
  possibleTypeNames: string[],
  expectedResponseKeys: string[]
]> = function(received, possibleTypeNames, expectedResponseKeys) {
  const receivedSet = received as SelectionSet[];
  const variant = receivedSet.find(variant => {
    return this.equals(Array.from(variant.possibleTypes).map(type => type.name), possibleTypeNames);
  });

  if (!variant) {
    return {
      message: () =>
        `Expected array to contain variant for:\n` +
        `  ${this.utils.printExpected(possibleTypeNames)}\n` +
        `But only found variants for:\n` +
        receivedSet
          .map(
            variant =>
              `  ${this.utils.printReceived(variant.possibleTypes)} -> ${this.utils.printReceived(
                collectAndMergeFields(variant).map(field => field.name)
              )}`
          )
          .join('\n'),
      pass: false
    };
  }

  return toMatchSelectionSet.call(this, variant, possibleTypeNames, expectedResponseKeys);
}

expect.extend({
  toMatchSelectionSet,
  toContainSelectionSetMatching
});
