'use strict';

const cloneDeep = require('lodash/cloneDeep');

const arrayHelper = require('../helpers/arrayHelper');
const consoleHelper = require('../helpers/consoleHelper');
const stepModules = require('../writer/step-mods/stepModules');
const Duration = require('./Duration');

const loadedModules = {};

const props = {
	strings: ['title'],
	arrays: ['checkboxes', 'warnings', 'cautions', 'comments', 'notes']
};

module.exports = class Step {

	constructor(stepYaml, actorIdOrIds, taskRoles) {
		// Initiate the vars as empty.
		for (const prop of props.strings) {
			this[prop] = '';
		}

		// FIXME: This can't be in props.strings because the YAML input is "step" not "text", and in
		// getDefinition() it needs the proper YAML input name. Ultimately probably should change
		// "step" to "text".
		this.text = [];

		for (const prop of props.arrays) {
			this[prop] = [];
		}

		// handled differently by getDefinition()
		this.images = [];
		this.modules = [];
		this.substeps = [];

		this.raw = null;
		this.taskRolesMap = {};
		this.location = '';
		this.taskRoles = taskRoles;

		this.mapTaskRolesToActor(taskRoles);
		this.setActors(stepYaml.actor ? stepYaml.actor : actorIdOrIds);
		this.populateFromYaml(stepYaml);
	}

	getDefinition() {
		const def = {};

		for (const prop of props.strings) {
			if (this[prop]) {
				def[prop] = this[prop];
			}
		}

		// Currently YAML "step" prop maps to model "text" prop. See comment in constructor.
		if (this.text.length > 1) {
			def.step = this.text.slice(); // copy the array
		} else if (this.text.length === 1) {
			def.step = this.text[0];
		}

		if (this.images.length) {
			def.images = cloneDeep(this.images);
		}

		for (const prop of props.arrays) {
			const parsedValue = arrayHelper.parseToArrayOrString(this[prop].slice());
			if (parsedValue !== '' && !arrayHelper.isEmptyArray(parsedValue)) {
				def[prop] = parsedValue;
			}
		}

		if (!arrayHelper.isEmptyArray(this.substeps)) {
			def.substeps = this.substeps.map((substep) => {
				return substep.getDefinition();
			});
		}

		for (const module of this.modules) {
			def[module.key] = module.getDefinition();
		}

		const durationDef = this.duration ? this.duration.getDefinition() : false;
		if (durationDef) {
			def.duration = durationDef;
		}

		return def;
	}

	populateFromYaml(stepYaml) {

		this.raw = stepYaml;

		// Check if the step is a simple string
		if (typeof stepYaml === 'string') {
			this.text = [this.parseStepText(stepYaml)];
			return;
		}

		this.duration = new Duration(stepYaml.duration);

		// Check for the title
		if (stepYaml.title) {
			this.title = this.parseTitle(stepYaml.title);
		}

		if (stepYaml.location) {
			this.location = stepYaml.location;
		}

		// Check for the text
		if (stepYaml.step) {
			const preStep = arrayHelper.parseArray(stepYaml.step);
			this.text = preStep.map((text) => this.parseStepText(text));
		}

		// Check for images
		if (stepYaml.images) {
			this.images = arrayHelper.parseArray(stepYaml.images);

			for (let i = 0; i < this.images.length; i++) {
				if (typeof this.images[i] === 'string') {
					this.images[i] = { path: this.images[i] };
				}
				const image = this.images[i];

				if (image.width && !Number.isInteger(image.width) && image.width < 1) {
					throw new Error(`Width should be empty or a positive integer: ${image.path}`);
				}
				if (image.height && !Number.isInteger(image.height) && image.height < 1) {
					throw new Error(`Height should be empty or a positive integer: ${image.path}`);
				}
			}
		}

		const blocks = {
			// yaml prop    internal prop
			checkboxes: 'checkboxes',
			warning: 'warnings',
			caution: 'cautions',
			note: 'notes',
			comment: 'comments'
		};
		for (const yamlKey in blocks) {
			// user-generated YAML has different property names than internal JS property names
			const jsKey = blocks[yamlKey];
			this[jsKey] = this.parseBlock(stepYaml[yamlKey]);
		}

		// Check for substeps
		if (stepYaml.substeps) {
			this.substeps = this.parseSubsteps(stepYaml.substeps);
		}

		for (const module of stepModules) {
			if (stepYaml[module.key]) {
				if (!loadedModules[module.key]) {
					loadedModules[module.key] = require(`../writer/step-mods/${module.class}`);
				}

				// todo for any modules already in this.modules:
				// todo (1) add suggestions for modules to use along with this (module.suggest)
				// todo ... probably aggregate a list of suggestions, and after all modules loaded
				// todo ... then you can check that list against all modules
				// todo (2) add Errors for any module.reject
				// todo (3) add warnings for modules in neither module.suggest nor module.reject

				// instantiate StepModule
				this.modules.push(new loadedModules[module.key](this, stepYaml));
			}
		}
	}

	parseBlock(textOrArray) {
		if (textOrArray) {
			return arrayHelper.parseArray(textOrArray).map(this.replaceTaskRoles.bind(this));
		} else {
			return [];
		}
	}

	/**
	 * Create a dict taskRolesMap to be able to determine role-->actor. Then
	 * create function replaceTaskRoles(text) to allow changing text like
	 * "{{role:crewB}}" into "EV1" if taskRolesMap['crewB'] === 'EV1'
	 *
	 * @param  {Object} taskRoles object of TaskRole objects. Example:
	 *                    taskRoles === {
	 *                      crewA: TaskRole{
	 *                        name: 'crewA',
	 *                        description: 'Crewmember exiting A/L first',
	 *                        actor: 'EV1'
	 *                      },
	 *                      crewB: TaskRole{
	 *                        name: 'crewB',
	 *                        description: 'Crewmember exiting A/L second',
	 *                        actor: 'EV2'
	 *                      }
	 *                    }
	 */
	mapTaskRolesToActor(taskRoles) {
		this.taskRoles = taskRoles;
		this.taskRolesMap = {};
		for (const role in taskRoles) {
			this.taskRolesMap[role] = taskRoles[role].actor;
		}
	}

	replaceTaskRoles(text) {
		for (const role in this.taskRolesMap) {
			text = text.replace(`{{role:${role}}}`, this.taskRolesMap[role]);
		}
		return text;
	}

	setActors(actorIdOrIds) {
		this.actors = arrayHelper.parseArray(actorIdOrIds);
	}

	/**
	 * Return formatted title
	 *
	 * @param   {*} titleYaml YAML for the title
	 * @return  {*} array of substeps
     */
	parseTitle(titleYaml) {
		const title = this.replaceTaskRoles(titleYaml);

		const titleWarnings = [];

		// check if text like "(01:15)" is in the title and warn against it
		const regex = /\([\d\w]{2}:[\d\w]{2}\)/g;
		if (regex.test(title)) {
			titleWarnings.push(
				`Should not have "${title.match(regex)}" within title, use duration field`
			);
		}

		// check if duration is zero, and recommend adding duration
		if (this.duration.getTotalSeconds() === 0) {
			titleWarnings.push(
				'Should include "duration" field with hours, minutes, and/or seconds field'
			);
			titleWarnings.push('Example:\n     duration:\n       hours: 1\n       minutes: 15');
		}

		// warn if necessary
		if (titleWarnings.length > 0) {
			consoleHelper.warn(titleWarnings, `Title "${title}"`);
		}

		return title;
	}

	/**
	 * Return formatted step text
	 *
	 * @param   {*} stepTextYaml YAML for the step text
	 * @return  {Array} array of substeps
	 */
	parseStepText(stepTextYaml) {
		// return stepTextYaml;
		return this.replaceTaskRoles(stepTextYaml);
	}

	/**
	 * Returns an array of substeps for the step, or an empty array if none are found.
	 *
	 * @param   {string|Array} substepsDefinition YAML for the substeps
	 * @return  {Array} array of substeps
	 */
	parseSubsteps(substepsDefinition) {

		const substeps = [];

		// Check for string. If string, it's not multiple substeps but a single
		// ! FIXME: Realistically why write a substep this way? Wouldn't you want it indented?
		if (typeof substepsDefinition === 'string') {
			substeps.push(new Step(substepsDefinition, this.actors, this.taskRoles));

		// Check for array
		} else if (Array.isArray(substepsDefinition)) {
			for (const singleSubstepDef of substepsDefinition) {
				substeps.push(new Step(singleSubstepDef, this.actors, this.taskRoles));
			}

		// Don't know how to process
		} else {
			throw new Error(
				`Expected substeps to be string or array. Instead got: ${JSON.stringify(substepsDefinition)}`
			);
		}

		return substeps;

	}

};
