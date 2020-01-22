/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;
console.log(assert);

const TemplateTransform = require('./TemplateTransform');
const TextTransform = require('./TextTransform');

describe('TemplateTransform', function() {

	describe('#constructor', function() {
		// probably nothing to test here
	});

	describe('replaceTemplate()', function() {

		// FIXME set these up for testing purposes. They'll have to live somewhere in the Maestro
		// codebase, probably within TextTransform.js
		const testTemplateName = 'VERIFY';
		console.log(testTemplateName);
		const testReplacerFn = function(argsArray) {
			return `<strong>VERIFY:</strong> ${argsArray[0]}`;
		};

		console.log(testReplacerFn);

		const testCases = [
			{
				input: 'Do some {{VERIFY | this is a test}} stuff',
				expected: {
					prefix: 'Do some ',
					transformed: '<strong>VERIFY:</strong> this is a test',
					suffix: ' stuff'
				}
			},
			{
				input: 'Do some {{VERIFY | this is a {{GREEN}} test}} stuff',
				expected: {
					prefix: 'Do some ',
					transformed: '<strong>VERIFY:</strong> this is a HOWEVERGREENHTMLLOOKS test',
					suffix: ' stuff'
				}
			}
		];

		const templateTransform = new TemplateTransform(new TextTransform('html'));
		console.log(templateTransform);

		for (const testCase of testCases) {
			console.log(testCase);
			/* it(`should return ${testCase.expected} on input ${testCase.input}`, function() {
				assert.deepStrictEqual(
					templateTransform.replaceTemplate(
						testCase.input, testTemplateName, testReplacerFn
					),
					testCase.expected
				);
			}); */
		}
	});

});