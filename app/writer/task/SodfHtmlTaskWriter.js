'use strict';

const fs = require('fs');
const path = require('path');

const getImageFileDimensions = require('image-size');
const nunjucks = require('../../model/nunjucksEnvironment');
const consoleHelper = require('../../helpers/consoleHelper');
const envHelper = require('../../helpers/envHelper');
const TaskWriter = require('./TaskWriter');
const TextTransform = require('../TextTransform');

module.exports = class SodfHtmlTaskWriter extends TaskWriter {

	constructor(task, procedureWriter) {
		super(task, procedureWriter);
		this.textTransform = new TextTransform('ipvXml');
		// this.taskNumbering = null;
		// this.getNumbering();
	}

	// FROM SODFDOCX task wirter

	/**
	 * Using a ConcurrentStep, write a division.
	 * @param {ConcurrentStep} division    ConcurrentStep object
	 * @return {Array}                     Array of docx.TableRow objects
	 */
	writeDivision(division) {
		const tableRows = [];

		const preRows = [];
		let index = 0;

		const notSameActorAndLocation = (actor, location) => {
			return preRows[index].actor !== actor || preRows[index].location !== location;
		};

		/*
			division.subscenes = {
				IV: [step1, step2, step3],
				EV1: [step0, step1, step2...]
			}
		*/

		if (Object.keys(division.subscenes).length > 1) {
			// throw new Error('Sodf does not currently support multiple actors in a division');
		}

		for (const actor in division.subscenes) {

			const actorStepData = division.subscenes[actor];

			// returns array of step HTML
			const series = this.writeSeries(actorStepData);

			for (const stepInfo of series) {

				if (!preRows[index]) { // initiate the first row
					preRows[index] = stepInfo;
				} else if (notSameActorAndLocation(stepInfo.actor, stepInfo.location)) {
					index++;
					preRows[index] = stepInfo; // create new row if actor/loc don't match prev
				} else {
					// append step contents to previous step contents if matching actor/location
					preRows[index].stepContents.push(...stepInfo.stepContents);
				}
			}
		}

		for (const row of preRows) {

			const actor = row.actor === this.procedure.lastActor ? '' : row.actor;
			const location = row.location === this.procedure.lastLocation ? '' : row.location;

			tableRows.push(this.createRow(actor, location, row));

			this.procedure.lastActor = row.actor;
			this.procedure.lastLocation = row.location;
		}

		return tableRows;
	}

	/**
	 * Write a table row for an actor+location combination. Anytime actor or location changes a new
	 * row will be created, and only the value that changed will be passed in. So if actor changes
	 * but location stays the same, then location will be an empty string.
	 * @param {string} actor            Actor performing step or empty string
	 * @param {string} location         Location step is performed or empty string
	 * @param {Object} row              Object like {
	 *                                      stepNumber: 23,
	 *                                      actor: 'IV',
	 *                                      location: '',
	 *                                      stepContent: [...]
	 *                                  }
	 * @return {string}                 HTML output of row
	 */
	createRow(actor, location, row) {
		return row.stepContents.join('');
	}

	writeSeries(series, columnKeys) {
		const steps = [];
		for (const step of series) {
			step.columnKeys = Array.isArray(columnKeys) ? columnKeys : [columnKeys];
			const actor = step.actors[0];
			const location = step.location;
			steps.push({
				stepNumber: this.stepNumber,
				actor: actor,
				location: location,
				stepContents: this.insertStep(step)
			});
		}
		return steps;
	}

	/**
	 * BELOW IS STUFF TAKEN FROM HtmlTaskWriter
	 */

	addImages(images) {

		const imageXmlArray = [];
		const imagesPath = this.procedureWriter.program.imagesPath;
		const buildPath = this.procedureWriter.program.outputPath;
		for (const imageMeta of images) {

			const imageSrcPath = path.join(imagesPath, imageMeta.path);
			const imageBuildPath = path.join(buildPath, imageMeta.path);
			const imageSize = this.scaleImage(
				getImageFileDimensions(imageSrcPath),
				imageMeta
			);

			// copy image from ./images to ./build
			// Do this asynchronously...no need to wait
			// Also, super lazy: if the image already exists don't copy it again
			if (envHelper.isNode && !fs.existsSync(imageBuildPath)) {
				fs.copyFile(imageSrcPath, imageBuildPath, (err) => {
					if (err) {
						// for now don't throw errors on this. Allow build to finish
						consoleHelper.warn(err);
					}
					consoleHelper.success(`Image ${imageMeta.path} transferred to build directory`);
				});
			}

			const image = nunjucks.render('sodf/image.xml', {
				path: path.join('build', imageMeta.path),
				width: imageSize.width,
				height: imageSize.height
				// todo add fields for image number, and caption
			});

			imageXmlArray.push(image);
		}

		return imageXmlArray;
	}

	addParagraph(params = {}) {
		if (!params.text) {
			params.text = '';
		}
		return `<p>${params.text}</p>`;
	}

	addBlock(blockType, blockLines) {

		const blockTable = nunjucks.render('sodf/block-table.xml', {
			blockType: blockType,
			blockLines: blockLines.map((line) => {
				return this.textTransform.transform(line).join('');
			})
		});

		return blockTable;
	}

	/**
	 * ! TBD a description
	 * @param {*} stepText        Text to turn into a step
	 * @param {*} options         options = { level: 0, actors: [], columnKey: "" }
	 * @return {string}
	 */
	addStepText(stepText, options = {}) {
		if (!options.level) {
			options.level = 0;
		}
		if (!options.actors) {
			options.actors = [];
		}
		if (!options.columnKeys) {
			options.columnKeys = [];
		}

		let actorText = '';
		if (options.actors.length > 0) {
			const actorToColumnIntersect = options.actors.filter((value) => {
				return options.columnKeys.includes(value);
			});
			const isPrimeActor = actorToColumnIntersect.length > 0;

			if (!isPrimeActor) {
				actorText = options.actors[0];
			}
		}

		const texts = [];
		if (typeof stepText === 'string') {
			texts.push(...this.textTransform.transform(stepText));
		} else if (Array.isArray(stepText)) {
			for (let s = 0; s < stepText.length; s++) {
				let elem = stepText[s];
				if (typeof elem === 'string') {
					elem = this.textTransform.transform(elem);
				} else if (!Array.isArray(elem)) {
					throw new Error('Expect string or array');
				}
				texts.push(...elem);
			}
		} else {
			throw new Error('addStepText() stepText must be string or array');
		}

		// FIXMEFIXMEFIXME
		// console.log('\n\n');
		// console.log(texts);
		// const transformed = texts.join('');
		// console.log(transformed);

		// added class li-level-${options.level} really just as a way to remind that
		// some handling of this will be necessary
		return nunjucks.render('sodf/step-text.xml', {
			level: options.level,
			actorText,
			stepText: texts.join('')
		});
	}

	addCheckStepText(stepText, level, parent) {
		return nunjucks.render('sodf/checkbox-step-text.html', {
			parent,
			stepText: this.textTransform.transform(stepText).join(''),
			level
		});
	}

	addTitleText(title, duration) {
		const subtaskTitle = nunjucks.render('sodf/subtask-title.xml', {
			title: this.textTransform.transform(title.toUpperCase().trim()).join('')
		});

		return subtaskTitle;
	}

	preInsertSteps(level) {
		// let start;
		// if (!level || level === 0) {
		// 	start = `start="${this.stepNumber}"`;
		// } else {
		// 	start = '';
		// }
		// return `<ol ${start}>`;
	}

	postInsertSteps(level) { // eslint-disable-line no-unused-vars
		// return '</ol>';
	}

	setModuleOutputType() {
		return 'Html';
	}

};
