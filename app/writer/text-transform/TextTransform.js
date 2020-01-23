'use strict';

const docx = require('docx');
const arrayHelper = require('../../helpers/arrayHelper');
let reactTextTransform; // only load this when needed, because JSX.

function htmlColor(text, color) {
	return `<span style="font-weight:bold;color:${color};">${text}</span>`;
}

function docxColor(text, color) {
	return new docx.TextRun({
		text: text,
		bold: true,
		color: color
	});
}

const transforms = [
	{
		text: '{{CHECK}}',
		html: '✓',
		ipvXml: '<Symbol name="odf-checkmark"/>',
		docx: '✓',
		react: null // see ReactTextTransform
	},
	{
		text: '{{VERIFY}}',
		html: 'verify',
		ipvXml: 'Verify', // todo figure out how to handle xml verify steps
		docx: 'verify',
		react: null // see ReactTextTransform
	},
	{
		text: '{{CHECKBOX}}',
		html: '☐',
		ipvXml: '',
		docx: () => {
			return new docx.SymbolRun('F071');
		},
		react: null // see ReactTextTransform
	},
	{
		text: '{{CHECKEDBOX}}',
		html: '☑',
		docx: '☑',
		ipvXml: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{LEFT}}',
		html: '←',
		ipvXml: '<Symbol name="odf-left-arrow"/>',
		docx: new docx.SymbolRun('F0DF'),
		react: null // see ReactTextTransform
	},
	{
		text: '{{UP}}',
		html: '↑',
		ipvXml: '<Symbol name="odf-up-arrow"/>',
		docx: new docx.SymbolRun('F0E1'),
		react: null // see ReactTextTransform
	},
	{
		text: '{{RIGHT}}',
		html: '→',
		ipvXml: '<Symbol name="odf-right-arrow"/>',
		docx: new docx.SymbolRun('F0E0'),
		react: null // see ReactTextTransform
	},
	{
		text: '{{DOWN}}',
		html: '↓',
		ipvXml: '<Symbol name="odf-down-arrow"/>',
		docx: new docx.SymbolRun('F0E2'),
		react: null // see ReactTextTransform
	},
	{
		text: '<',
		html: '<',
		ipvXml: '&lt;',
		docx: '<',
		react: null // see ReactTextTransform
	},
	{
		text: '&',
		html: '&',
		ipvXml: '&am;',
		docx: '&',
		react: null // see ReactTextTransform
	},
	{
		text: '{{DISCONNECT}}',
		html: '',
		ipvXml: '<Symbol name="odf-disconnect-symbol"/>',
		docx: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{CONNECT}}',
		html: '',
		ipvXml: '<Symbol name="odf-connect-symbol"/>',
		docx: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{COUNTERCLOCKWISE}}',
		html: '',
		ipvXml: '<Symbol name="odf-counterclockwise-sign"/>',
		docx: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{CLOCKWISE}}',
		html: '',
		ipvXml: '<Symbol name="odf-clockwise-sign"/>',
		docx: '',
		react: null // see ReactTextTransform
	}

];

/**
 * Add colors to list of transforms. Will add color transforms:
 *
 *  {
 *    text: 'BLACK',
 *    html: '<span style="font-weight:bold;color:black;">BLACK</span>',
 *    docx: TextRun {...}
 *    react: (<span style="font-weight:bold;color:black;">BLACK</span>) // <-- only if react in use
 *  }
 */
const colors = [
	{ text: 'GREEN', color: 'green' },
	{ text: 'RED', color: 'red' },
	{ text: 'YELLOW', color: '#FFC000' },
	{
		text: [
			'BLACK',
			'ANCHOR',
			'GO'
		],
		color: 'black'
	},
	{ text: 'BLUE', color: 'blue' },
	{ text: 'PURPLE', color: 'purple' },
	{ text: 'ORANGE', color: 'orange' }
];
const colorPointers = {};
for (const item of colors) {
	const texts = arrayHelper.parseArray(item.text);
	for (const text of texts) {
		transforms.push({
			text: text,
			html: htmlColor(text, item.color),
			docx: docxColor(text, item.color)
		});
		colorPointers[text] = transforms.length - 1; // for React transforms to easily be added
	}
}

function splitStringAndTransform(text, xform, xformFormat) {

	// In `text`, get the start and end index of xform.text
	const searchStart = text.indexOf(xform.text);
	const searchEnd = searchStart + xform.text.length;

	// prefix and suffix are strings before and after xform.text. Transform xform.text
	const result = {
		prefix: text.substring(0, searchStart),
		transformed: xform[xformFormat],
		suffix: text.substring(searchEnd)
	};

	// if result.transform isn't actually the tranformed result, but instead is a function, use that
	// function to generate the result.
	if (typeof result.transformed === 'function') {
		result.transformed = result.transformed(xform.text);
	}

	return result;
}

function findNextTransform(text, xformFormat) {
	for (const xform of transforms) {
		if (text.indexOf(xform.text) !== -1) {
			return splitStringAndTransform(text, xform, xformFormat);
		}
	}
	return false;
}

function doTransform(text, xformFormat) {
	if (!text) {
		return [];
	}
	const transform = findNextTransform(text, xformFormat);
	if (transform) {
		const result = doTransform(transform.prefix, xformFormat); // recurse until no prefix
		result.push(transform.transformed);
		result.push(...doTransform(transform.suffix, xformFormat)); // recurse until no suffix
		return result;
	} else {
		return [text];
	}
}

function docxStringsToTextRuns(transformArr) {
	return transformArr.map((cur) => {
		return typeof cur === 'string' ? new docx.TextRun(cur) : cur;
	});
}

module.exports = class TextTransform {

	constructor(format) {
		const validFormats = ['ipvXml', 'html', 'docx', 'react'];
		if (validFormats.indexOf(format) === -1) {
			throw new Error('new TextWriter(format) requires format to be in ${validFormats.toString()}');
		}
		this.format = format;

		// modify transforms to include React transforms if (1) using React and (2) prior
		// TextTransform objects haven't already modified them
		if (this.format === 'react' && !reactTextTransform) {
			// console.log('Creating React text transforms');
			const ReactTextTransform = require('./ReactTextTransform');

			// instantiate in module context
			reactTextTransform = new ReactTextTransform(transforms, colors, colorPointers);
		}
	}

	transform(text) {
		let transform = doTransform(text, this.format);
		if (this.format === 'docx') {
			transform = docxStringsToTextRuns(transform);
		} else if (this.format === 'react') {
			transform = reactTextTransform.reactStringsToJSX(transform);
		}
		return transform;
	}

	/**
	 * Exposed outside module purely for testing
	 * @param {string} text string like "RED"
	 * @param {string} color string like "red". If omitted, use `text` as the color.
	 * @return {string} HTML like <span style="font-weight:bold;color:red;">RED</span>
	 */
	htmlColor(text, color) {
		if (!color) {
			color = text.toLowerCase();
		}
		return htmlColor(text, color);
	}
};
