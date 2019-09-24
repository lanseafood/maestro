'use strict';

const fs = require('fs');
const path = require('path');
const docx = require('docx');
const getImageFileDimensions = require('image-size');

const consoleHelper = require('../../helpers/consoleHelper');

const TaskWriter = require('./TaskWriter');

module.exports = class DocxTaskWriter extends TaskWriter {

	constructor(task, procedureWriter) {
		super(task, procedureWriter);

		this.procedureWriter.taskNumbering = null;
		this.getNumbering();
	}

	/*
	FIXME: thought this would be necessary but it doesn't seem to be. Keeping
	it for now while things are in flux

	getContainerType() {
		if (this.container instanceof TableCell) {
			return 'tablecell';
		} else if (this.container instanceof SectionContainer) {
			return 'sectioncontainer';
		} else {
			const containerJson = JSON.stringify(this.container, null, 4);
			throw new Error(`Unknown container type: ${containerJson}`);
		}
	}
	*/

	addImages(images) {

		const imagesPath = this.procedureWriter.program.imagesPath;
		for (const imageMeta of images) {

			const imagePath = path.join(imagesPath, imageMeta.path);
			const imageSize = this.scaleImage(
				getImageFileDimensions(imagePath),
				imageMeta
			);

			const image = docx.Media.addImage(
				this.doc,
				fs.readFileSync(imagePath),
				imageSize.width,
				imageSize.height
			);

			this.container.add(new docx.Paragraph(image));
		}

	}

	addParagraph(params = {}) {
		if (!params.text) {
			params.text = '';
		}
		if (!params.style) {
			params.style = 'normal';
		}

		this.container.add(new docx.Paragraph(params));
	}

	// taskCell
	addBlock(blockType, blockLines, numbering) {
		const blockTable = new docx.Table({
			rows: 2,
			columns: 1
		});

		const fillColors = {
			comment: '00FF00',
			note: 'FFFFFF',
			caution: 'FFFF00',
			warning: 'FF0000'
		};

		const textColors = {
			comment: '000000',
			note: '000000',
			caution: '000000',
			warning: 'FFFFFF'
		};

		// FIXME add logic for formatting based upon type
		blockTable.getCell(0, 0).add(new docx.Paragraph({
			children: [new docx.TextRun({
				text: blockType.toUpperCase(),
				color: textColors[blockType]
			})],
			alignment: docx.AlignmentType.CENTER
		})).setShading({
			fill: fillColors[blockType],
			val: docx.ShadingType.CLEAR,
			color: 'auto'
		});
		const contentCell = blockTable.getCell(1, 0);

		for (const line of blockLines) {
			contentCell.add(new docx.Paragraph({
				text: this.markupFilter(line),
				numbering: {
					num: numbering.concrete,
					level: 0
				}

			}));
		}

		this.container.add(blockTable);
	}

	getNumbering() {
		this.procedureWriter.taskNumbering = {};

		// const numbering = new docx.Numbering();
		// const abstractNum = numbering.createAbstractNumbering();
		// const abstractNum = doc.Numbering.createAbstractNumbering();
		this.procedureWriter.taskNumbering.abstract = this.doc.Numbering.createAbstractNumbering();

		for (let i = 0; i < 3; i++) {
			// var stepText = getLongStepString(i);
			var indents = this.procedureWriter.getIndents(i);
			this.procedureWriter.levels[i] = this.procedureWriter.taskNumbering.abstract.createLevel(
				i, this.procedureWriter.levelTypes[i], `%${i + 1}.`, 'left'
			);
			this.procedureWriter.levels[i].indent({ left: indents.left, hanging: indents.hanging });
			this.procedureWriter.levels[i].leftTabStop(indents.tab);
		}

		this.procedureWriter.taskNumbering.concrete = this.doc.Numbering.createConcreteNumbering(
			this.procedureWriter.taskNumbering.abstract
		);
	}

	insertStep(step, level = 0) {

		// writeStep:
		// step.text via markdownformatter
		// loop over step.checkboxes via markdownformatter

		if (step.images) {
			this.addImages(step.images);
		}

		if (step.title) {
			this.addParagraph({
				children: [
					new docx.TextRun({
						text: step.title.toUpperCase().trim(),
						underline: {
							type: 'single'
						}
					}),
					new docx.TextRun({
						text: ` (${step.duration.format('H:M')})`
					})
				]
			});
		}

		if (step.warnings.length) {
			this.addBlock('warning', step.warnings, this.procedureWriter.taskNumbering);
		}
		if (step.cautions.length) {
			this.addBlock('caution', step.cautions, this.procedureWriter.taskNumbering);
		}
		if (step.notes.length) {
			this.addBlock('note', step.notes, this.procedureWriter.taskNumbering);
		}
		if (step.comments.length) {
			this.addBlock('comment', step.comments, this.procedureWriter.taskNumbering);
		}

		if (step.text) {
			this.addParagraph({
				text: this.markupFilter(step.text),
				numbering: {
					num: this.procedureWriter.taskNumbering.concrete,
					level: level
				}
			});
		}

		if (step.substeps.length) {
			for (const substep of step.substeps) {
				this.insertStep(substep, level + 1);
			}
		}

		if (step.checkboxes.length) {
			for (const checkstep of step.checkboxes) {
				this.addParagraph({
					text: this.markupFilter(`☐ ${checkstep}`),
					numbering: {
						num: this.procedureWriter.taskNumbering.concrete,
						level: level + 1
					}
				});
			}
		}

	}

};
