'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const filenamify = require('filenamify');

const Column = require('./Column');
const Task = require('./Task');
const validateSchema = require('../schema/validateSchema');
const Duration = require('./Duration');
const TimeSync = require('./TimeSync');
const consoleHelper = require('../helpers/consoleHelper');

function translatePath(procedureFilePath, taskFileName) {
	// Look in tasks directory, sister to procedures directory
	// Someday look in a directory provided by dependency manager, issue #21
	const taskFilePath = path.join(
		path.dirname(procedureFilePath),
		'..',
		'tasks',
		taskFileName
	);

	// Validate & Load the yaml file!
	if (!fs.existsSync(taskFilePath)) {
		throw new Error(`Could not find task file ${taskFilePath}`);
	}

	return taskFilePath;
}

function mapActorToColumn(columnDefinition) {

	// Create a mapping of actor --> column
	const actorToColumn = {};

	for (const col of columnDefinition) {
		if (typeof col.actors === 'string') {
			col.actors = [col.actors]; // array-ify
		} else if (!Array.isArray(col.actors)) {
			throw new Error('Procedure columns.actors must be array or string');
		}

		for (const actor of col.actors) {
			actorToColumn[actor] = col.key;
		}
	}

	return actorToColumn;
}

function mapColumnKeyToDisplay(columnDefinition) {

	// Create a mapping of actor --> column
	const columnToDisplay = {};

	for (const col of columnDefinition) {
		if (col.display) {
			columnToDisplay[col.key] = col.display;
		} else {
			columnToDisplay[col.key] = col.key;
		}
	}

	return columnToDisplay;
}

module.exports = class Procedure {

	constructor() {
		this.name = '';
		this.number = '';
		this.m_number = '';
		this.location = '';
		this.duration = '';
		this.crew_required = '';
		this.referenced_procedures = '';
		this.filename = '';
		this.actors = [];
		this.columns = [];
		this.tasks = [];
		this.actorToColumn = {};

		this.taskDefinitions = {};
	}

	/**
	 * May actor key to column key. Both strings. this.actorToColumn in form:
	 *   {
	 *     "*": "IV",
	 *     "EV1": "EV1",
	 *     "EV2": "EV2"
	 *   }
	 * A more complicated form may be:
	 *   {
	 *     "*": "IV",
	 *     "EV1": "EV1",
	 *     "ROBO": "EV1"
	 *   }
	 * In this second example the "ROBO" actor gets mapped to the EV1 column.
	 *
	 * @param  {string} actor   key for actor
	 * @return {string}         key of column (key of primary actor of column)
	 */
	getActorColumnKey(actor) {
		if (this.actorToColumn[actor]) {
			return this.actorToColumn[actor];
		} else if (this.actorToColumn['*']) {
			return this.actorToColumn['*']; // wildcard for all others
		} else {
			throw new Error(`Unknown column for actor ${actor}. Consider adding wildcard * actor to a column`);
		}
	}

	getColumnKeys() {
		const keys = [];
		for (const column of this.columns) {
			keys.push(column.key);
		}
		return keys;
	}

	getColumnIndex(key) {
		for (let c = 0; c < this.columns.length; c++) {
			if (this.columns[c].key === key) {
				return c;
			}
		}
		throw new Error(`key ${key} not found in columns`);
	}

	getColumnHeaderText() {
		const headerTexts = [];
		for (const column of this.columns) {
			headerTexts.push(column.display);
		}
		return headerTexts;
	}

	getColumnHeaderTextByActor(actor) {
		const colKey = this.getActorColumnKey(actor);
		const colIndex = this.getColumnIndex(colKey);
		return this.getColumnHeaderText()[colIndex];
	}

	getActorsInLeadRoles() {
		const actorsDict = {};
		const actorsArr = [];
		for (const task of this.tasks) {
			for (const role of task.rolesArr) {
				if (!actorsDict[role.actor]) {
					actorsDict[role.actor] = true;
				}
			}
		}
		for (const actor in actorsDict) {
			actorsArr.push(actor);
		}
		return actorsArr;
	}

	getTasksWithActorInLeadRole(actorKey) {
		const actorTasks = [];
		for (const task of this.tasks) {
			if (task.actorRolesDict[actorKey]) {
				actorTasks.push(task);
			}
		}
		return actorTasks;
	}

	/**
	 * From the column definition in this procedure's YAML file, create an array of all defined
	 * actors. This does NOT mean that other actors/roles are not present in the procedure. They
	 * just may not have an explicit definition of which column to fall under.
	 *
	 * See also getColumnsOfActorsFillingRoles()
	 *
	 * @param {boolean} includeWildcard  Whether or not to include a '*' element in the array
	 * @return {Array}                   Array of actors
	 */
	getAllActorsDefinedInColumns(includeWildcard = false) {
		const allActors = [];
		for (const col of this.columns) {
			for (const actor of col.actors) {
				if (includeWildcard || actor !== '*') {
					allActors.push(actor);
				}
			}
		}
		return allActors;
	}

	/**
	 * Creates an array of actors within the columns their steps are displayed. Example:
	 *
	 * [
	 *   ['IV', 'SSRMS'],  <-- first column has two actors
	 *   ['EV1'],          <-- Second and third column have one actor, but still are in arrays
	 *   ['EV2']
	 * ]
	 *
	 * Note that actors are only present here if they are _filling roles_. Just because there is a
	 * step like this:
	 *
	 * - step: Do some robotics stuff
	 *   actor: ROBO
	 *
	 * This ^ does not mean that the actor "ROBO" will be present in the array returned by this
	 * function. For that to happen, "ROBO" must fulfill a role via the procedure YAML file, e.g.:
	 *
	 * tasks:
	 *  - file: some_task.yml
	 *    roles:
	 *      a_role_name: ROBO  <-- Within the procedure YAML file "ROBO" is the input to a task role
	 *
	 * ALSO NOTE that the returned array _may_ have empty elements, e.g. [<empty>, 'EV1', 'EV2'],
	 * meaning there are no actors filling roles in the column with index = 0. To remove empty
	 * elements set includeEmpty = false
	 *
	 * @param {boolean} includeEmpty  Whether or not to include empty elements
	 * @return {Array}                2-dimensional array of actors in columns
	 */
	getColumnsOfActorsFillingRoles(includeEmpty = true) {

		/**
		 * Creates actorColumnIndexes like:
		 * actorColumnIndexes = {
		 *   IV: 0,
		 *   SSRMS: 0,
		 *   EV1: 1,
		 *   EV2: 2
		 * }
		 */
		const actorColumnIndexes = {};
		for (const task of this.tasks) {
			for (const actor in task.actorRolesDict) {
				if (!actorColumnIndexes[actor]) {
					actorColumnIndexes[actor] = task.procedure.getColumnIndex(
						task.procedure.getActorColumnKey(actor)
					);
				}
			}
		}

		const columns = [];
		for (const actor in actorColumnIndexes) {
			const index = actorColumnIndexes[actor];
			if (!columns[index]) {
				columns[index] = [];
			}
			columns[index].push(actor);
		}

		if (includeEmpty) {
			return columns;
		}

		// strip out empty columns if desired
		return columns.filter((cur) => {
			return Boolean(cur);
		});

	}

	/**
	 * Procedures may have intended durations (e.g. common EVA length is 6 hours 30 minutes), but
	 * the actual duration based upon summing task times may differ.
	 *
	 * @return {Duration} Duration object representing end time of last task
	 */
	getActualDuration() {
		let longestEndTime;

		for (const actor in this.taskEndpoints) {
			const actorEndTime = this.taskEndpoints[actor] // for this actor get first/last task
				.last // choose the last task
				.actorRolesDict[actor] // .last points to task; within task, select actor's role
				.endTime; // get the time this actor finishes this (last) task

			if (!longestEndTime ||
				actorEndTime.getTotalSeconds() > longestEndTime.getTotalSeconds()
			) {
				longestEndTime = actorEndTime;
			}
		}

		// return a clone of the longest end time, in case the task moves
		return longestEndTime.clone();
	}

	/**
	 * Populates data, reading in the specified file.
	 * @param {string} fileName The full path to the YAML file
	 * @return {Error|null}
	 */
	addProcedureDefinitionFromFile(fileName) {
		this.procedureFile = fileName;

		if (!fs.existsSync(fileName)) {
			return new Error(`Could not find file ${fileName}`);
		}

		const procDef = YAML.safeLoad(fs.readFileSync(fileName, 'utf8'));

		const err = this.addProcedureDefinition(procDef);
		if (err) {
			return err;
		}

		this.loadTaskDefinitionsFromFiles();
		this.setupTimeSync();
	}

	/**
	 *
	 * @param {Object} procDef  Procedure definition in JS object form (not YAML/JSON string)
	 * @return {null|SchemaValidationError}  If schema validation errors found, returns err object
	 */
	addProcedureDefinition(procDef) {

		// Load and validate the input file
		try {
			validateSchema('procedure', procDef);
		} catch (err) {
			return err;
		}

		// Save the procedure Name
		this.name = procDef.procedure_name;
		this.number = procDef.procedure_number;
		this.m_number = procDef.m_number;
		this.objective = procDef.procedure_objective;
		this.location = procDef.location;
		this.duration = procDef.duration;
		this.crew_required = procDef.crew;
		this.referenced_procedures = procDef.referenced_procedure;
		this.filename = filenamify(this.name.replace(/\s+/g, '_'));

		if (procDef.columns) {
			for (var columnYaml of procDef.columns) {
				this.columns.push(new Column(columnYaml));
			}
		}

		this.actorToColumn = mapActorToColumn(this.columns);
		this.columnToDisplay = mapColumnKeyToDisplay(this.columns);

		this.procedureDefinition = procDef;
		this.proceduresTaskInstances = {};

		for (const task of this.procedureDefinition.tasks) {
			this.proceduresTaskInstances[task.file] = task;
		}

		return null;
	}

	/**
	 * @throws Error if this.procedureDefinition not set. Run this.addProcedureDefinition() first.
	 */
	loadTaskDefinitionsFromFiles() {

		if (!this.procedureDefinition) {
			throw new Error('populate() requires "procedureDefinition" set');
		}

		const taskDefinitions = {};

		for (const task of this.procedureDefinition.tasks) {
			// Since the task file is in relative path to the procedure
			// file, need to translate it!
			const taskFileName = translatePath(this.procedureFile, task.file);
			taskDefinitions[task.file] = YAML.safeLoad(fs.readFileSync(taskFileName, 'utf8'));
		}

		this.updateTaskDefinitions(taskDefinitions);
	}

	/**
	 * @param {Object} taskDefs  Object map of task file names to task definitions, in JS object
	 *                           form (not YAML/JSON string). Example:
	 *                           var taskDefs = {
	 *                             'my-task.yml': {
	 *                               title: 'sometitle',
	 *                               roles: [...],
	 *                               steps: [...]
	 *                             },
	 *                             'another-task.yml': { ... }, ...
	 *                           }
	 * @return {null|SchemaValidationError}  If schema validation errors found, returns err object
	 */
	updateTaskDefinitions(taskDefs) {

		for (const taskFile in taskDefs) {
			const err = this.updateTaskDefinition(taskFile, taskDefs[taskFile]);
			if (err) {
				return err;
			}
		}

		return null;
	}

	/**
	 * @param {string} taskFile              Task filename, as written in procedure file.
	 * @param {Object} taskDef               Single task definition. JS object not YAML/JSON string.
	 * @return {null|SchemaValidationError}  If schema validation errors found, returns err object
	 */
	updateTaskDefinition(taskFile, taskDef) {

		if (!this.proceduresTaskInstances) {
			throw new Error('populate() requires "proceduresTaskInstances" set');
		}

		// info about task from procedure file
		const proceduresTaskInstance = this.proceduresTaskInstances[taskFile];

		try {
			validateSchema('task', taskDef);
		} catch (err) {
			return err;
		}

		// Browser may load tasks asynchronously, and thus order may not be preserved.
		// Thus, need to determine the location of taskFile from the procedure
		// definition, and insert the new Task at that location within this.tasks
		const index = this.getTaskIndexByFilename(taskFile);

		if (index === -1) {
			throw new Error(`Task file ${taskFile} not found.`);
		}

		// Create task model
		this.tasks[index] = new Task(
			taskDef,
			proceduresTaskInstance,
			this.getColumnKeys(),
			this
		);

		// Save the raw definition
		this.taskDefinitions[taskFile] = taskDef;

		return null;

	}

	getTaskIndexByFilename(filename) {
		for (let i = 0; i < this.procedureDefinition.tasks.length; i++) {
			if (this.procedureDefinition.tasks[i].file === filename) {
				return i;
			}
		}
		return -1;
	}

	setupTimeSync() {

		if (!this.procedureDefinition || !this.taskDefinitions) {
			throw new Error('populate() requires "procedureDefinition" and "taskDefinitions" set');
		}

		// For each role, make a pointer to the latest (most recent) activity
		const roleLatestAct = {};

		// Loop over all tasks and all roles within those tasks
		for (const currentTask of this.tasks) {
			for (const role in currentTask.actorRolesDict) {

				// If the role has a defined latest activity
				if (roleLatestAct[role]) {

					// set currentTask's previous task to be the last-added task for this role
					currentTask.actorRolesDict[role].prevTask = roleLatestAct[role];

					// set the last-added task's _next_ task to be the currentTask
					roleLatestAct[role].actorRolesDict[role].nextTask = currentTask;

					// start time of this task (for this role) is the end time of the previous task
					// (for this role)
					currentTask.actorRolesDict[role].startTime =
						roleLatestAct[role].actorRolesDict[role].endTime;

				} else {
					// No latest (aka previous) activity for this role, so initially assume this
					// activity starts at time zero
					currentTask.actorRolesDict[role].startTime = new Duration({ seconds: 0 });
				}

				// end time of this task (for this role) is the start + duration
				currentTask.actorRolesDict[role].endTime = Duration.sum(
					currentTask.actorRolesDict[role].startTime,
					currentTask.actorRolesDict[role].duration
				);

				// make the current task be the last added task
				roleLatestAct[role] = currentTask;

			}
		}

		this.timeSync = new TimeSync(this.tasks, false);
		this.timeSync.sync();
		this.taskEndpoints = this.timeSync.endpoints();

	}

	handleParsingError(err, file) {
		// Check if an error occurred
		if (err && err instanceof Error) {
			consoleHelper.noExitError(`Error while processing procedure ${file}: ${err}`);
			if (err.validationErrors) {
				consoleHelper.noExitError('Validation Errors:');
				consoleHelper.noExitError(err.validationErrors);
			}
			return;
		}
	}

};
