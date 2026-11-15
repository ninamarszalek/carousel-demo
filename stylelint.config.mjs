/**
 * Stylelint enforces the style rules from specs/project-setup.md §8:
 * modern SCSS, a fixed property order, BEM class names and token-friendly, flat selectors.
 *
 * @type {import('stylelint').Config}
 */
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-clean-order'],
  rules: {
    // BEM: block, block__element, block--modifier, block__element--modifier (kebab-case parts).
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
      { message: (selector) => `Expected class selector "${selector}" to follow BEM naming` },
    ],
    'max-nesting-depth': [3, { ignore: ['pseudo-classes'], ignoreAtRules: ['include', 'media'] }],
    'selector-max-id': 0,
    'selector-max-compound-selectors': 3,
    'declaration-no-important': true,
    'color-named': 'never',
    // Blank lines group related tokens (colors, spacing, ...) in abstracts.
    'scss/dollar-variable-empty-line-before': null,
    'scss/no-global-function-names': true,
  },
};
