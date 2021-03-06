'use strict';

const path = require('path');
const React = require('react');

const SeriesComponent = require('../../web/components/layout/SeriesComponent');

const getImageFileDimensions = require('image-size');
const TextTransform = require('../text-transform/TextTransform');

const maestroKey = require('../../web/components/helpers/maestroKey');
const uuidv4 = require('uuid/v4');

const TaskWriter = require('./TaskWriter');
const EvaDivisionWriter = require('./EvaDivisionWriter');
const filters = require('../../helpers/filters');

module.exports = class ReactTaskWriter extends TaskWriter {

	/**
	 * Create a TaskWriter for web/React format
	 * @param {Task} task
	 * @param {ProcedureWriter} procedureWriter
	 */
	constructor(task, procedureWriter) {
		super(task, procedureWriter);

		this.taskColumns = task.getColumns();
		this.textTransform = new TextTransform('react');

		this.numCols = this.taskColumns.length;
		this.numContentRows = task.concurrentSteps.length;
		this.numRows = this.numContentRows + 1;
	}

	getTableHeaderCells() {

		const columnKeys = this.task.getColumns();
		const columnNames = [];

		for (const colKey of columnKeys) {
			columnNames.push(this.procedure.ColumnsHandler.getDisplayTextFromColumnKey(colKey));
		}

		return columnNames.map((name) => (
			<th
				key={filters.uniqueHtmlId(`table-header-${name}`)}
				style={{ width: `${100 / columnKeys.length}%` }}
			>
				{name}
			</th>
		));
	}

	// FIXME: duplication from HtmlTaskWriter or something like that
	writeDivision(division, activityIndex, divisionIndex) {
		const divWriter = new EvaDivisionWriter();

		const columns = divWriter.prepareDivision(
			division, this, true
		);

		for (let c = 0; c < this.numCols; c++) {
			if (!columns[c]) {
				columns[c] = {
					children: [], // FIXME remove these if the stuff below works...
					content: [],
					colspan: 1,

					series: [], // FIXME is this right?
					columnKeys: [this.task.getColumns()[c]] // ['NONE'] // FIXME
				};
				columns[c].stateColumnKey = columns[c].columnKeys[0];
				continue;
			}
			if (columns[c].colspan > 1) {
				c += columns[c].colspan - 1;
			}
		}

		return (
			<tr>
				{Object.keys(columns).map((colId) => {
					const startStep = this.preInsertSteps(); // FIXME this doesn't seem right

					const key = maestroKey.getKey(
						activityIndex,
						divisionIndex,
						columns[colId].stateColumnKey
					);

					return (
						<SeriesComponent
							key={key}
							startStep={startStep}
							colspan={columns[colId].colspan}
							primaryColumnKey={columns[colId].stateColumnKey}
							columnKeys={columns[colId].columnKeys}
							seriesState={columns[colId].series}
							activityIndex={activityIndex}
							divisionIndex={divisionIndex}
							taskWriter={this}
						/>
					);
				})}
			</tr>
		);

	}

	// used by sub-steps
	wrapStepLists(steps, startStep = 1) {
		return (<ol key={uuidv4()} start={startStep}>{steps}</ol>);
	}

	/**
	 *
	 * ! FIXME Below is heavily ripped off from HtmlTaskWriter
	 */

	addImages(images) {

		const imageHtmlArray = [];

		const program = this.procedureWriter.program;
		for (const imageMeta of images) {

			const imageSrcPath = path.join(this.procedureWriter.program.imagesPath, imageMeta.path);

			// if electron, need to get images with file://path/to/image
			const htmlImagePath = program.isElectron ?
				program.getHtmlImagePath(imageMeta.path) : path.join('images', imageMeta.path);

			const imageSize = this.scaleImage(
				getImageFileDimensions(imageSrcPath),
				imageMeta
			);

			const image = (
				<a href={htmlImagePath} key={uuidv4()}>
					<img
						className="img-fluid"
						src={htmlImagePath}
						width={imageSize.width}
						height={imageSize.height}
						alt="image"
					/>
				</a>
			);

			imageHtmlArray.push(image);
		}

		return imageHtmlArray;
	}

	addParagraph(params = {}) {
		if (!params.text) {
			params.text = '';
		}
		return (<p key={uuidv4()}>{params.text}</p>);
	}

	addBlock(blockType, blockLines) {

		blockLines = blockLines.map((line) => {
			return this.textTransform.transform(line);
		});

		return (
			<div key={uuidv4()} className="ncw ncw-{{blockType}}">
				<div className="ncw-head">
					{blockType.toUpperCase()}
				</div>
				<div className="ncw-body">
					<ol>
						{Object.keys(blockLines).map((key) => (
							<li key={uuidv4()}>{blockLines[key]}</li>
						))}
					</ol>
				</div>
			</div>
		);
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

		// ! FIXME does not yet handle if step has text component and a module with JSX/react
		// const stepTextComponent = typeof stepText === 'string' ?
		// this.textTransform.transform(stepText) :
		// stepText;
		let stepTextComponent;

		if (typeof stepText === 'string') {
			stepTextComponent = this.textTransform.transform(stepText);
		} else if (Array.isArray(stepText)) {
			// ! FIXME I'm pretty sure this will always be the case now

			stepTextComponent = [];
			for (let s = 0; s < stepText.length; s++) {
				let elem = stepText[s];
				if (typeof elem === 'string') {
					elem = this.textTransform.transform(elem);
				} else {
					console.log(elem);
				}
				// else { assume it's a react object }

				stepTextComponent.push(elem);
			}
		} else {
			// probably a react object
			stepTextComponent = stepText;
		}

		return (
			<div key={uuidv4()} className={`li-level-${options.level}`}>
				{ actorText ?
					(<strong>{actorText}: </strong>) :
					(<React.Fragment></React.Fragment>)
				}
				{stepTextComponent.map((t) => (<p key={uuidv4()}>{t}</p>))}
			</div>
		);
	}

	addCheckStepText(stepText, level, parent) {
		return (
			<li key={uuidv4()} className={`li-level-${level}`}>
				<label>
					<input
						data-level="step"
						data-parent={parent}
						className="step"
						type="checkbox"
					/>
					{this.textTransform.transform(stepText)}
				</label>
			</li>
		);
	}

	addTitleText(title, duration) {
		return (
			<h3 key={uuidv4()} data-level="subtask">
				<span className="subtask-title">{title.toUpperCase().trim()}</span>
				&nbsp;
				<span className="subtask-duration">({duration.format('H:M')})</span>
			</h3>
		);
	}

	preInsertSteps(level) {
		if (!level || level === 0) {
			return this.stepNumber;
		} else {
			return undefined;
		}
		// return `<ol ${start}>`;
	}

	// unused
	postInsertSteps(level) { // eslint-disable-line no-unused-vars
		return null; // '</ol>';
	}

	setModuleOutputType() {
		return 'React';
	}

};
