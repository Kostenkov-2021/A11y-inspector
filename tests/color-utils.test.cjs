const assert = require('node:assert/strict');
const { test } = require('node:test');
const ColorUtils = require('../accessibility-inspector/utils/color-utils.js');

test('contrast recommendations meet the requested ratio after RGB serialization', () => {
  const cases = [
    ['#888888', '#FFFFFF', 4.5, 'darken'],
    ['#555555', '#000000', 4.5, 'lighten'],
    ['#BBBBBB', '#AAAAAA', 7, 'darken'],
    ['#AAAAAA', '#FFFFFF', 3, 'darken']
  ];
  for (const [text, background, ratio, direction] of cases) {
    const suggestion = ColorUtils.suggestContrastImprovements(text, background, ratio);
    assert.equal(suggestion.improvement, direction);
    const actualRatio = ColorUtils.calculateContrastRatio(suggestion.suggested, background);
    assert.ok(actualRatio >= ratio, `${text} on ${background}: ${actualRatio}`);
    assert.equal(actualRatio, suggestion.suggestedRatio);
  }
});

test('already sufficient contrast is preserved with a complete result', () => {
  const suggestion = ColorUtils.suggestContrastImprovements('#000000', '#FFFFFF', 4.5);
  assert.equal(suggestion.improvement, 'none');
  assert.equal(suggestion.currentHex, suggestion.suggestedHex);
  assert.equal(suggestion.currentRatio, 21);
  assert.equal(suggestion.score, 'AAA');
});

test('impossible contrast is reported as a failed recommendation', () => {
  const suggestion = ColorUtils.suggestContrastImprovements('#888888', '#777777', 21);
  assert.equal(suggestion.improvement, 'error');
  assert.match(suggestion.error, /Не удалось/);
});
