'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const jsdiff = require('diff');

const state = {};

// FIXME should this be in state too?
const changesDiffs = [];

/**
 *
 * @param {*} changes
 */
function setState(changes) {
	for (const prop in changes) {
		const change = changes[prop];
		state[prop] = change;
	}
	// FIXME add subscription
}

/**
 * Compare procedure against previous version of procedure. Record state for comparison with future
 * changes and console.log() a diff from the previous change.
 *
 * @param {Procedure} latestProcedure  Procedure object with latest updates, used to generate latest
 *                                     YAML string to compare against previous change.
 *
 * FIXME: does this belong in stateHandler?
 */
function recordAndReportChange(latestProcedure) {
	const newYaml = YAML.dump(latestProcedure.getDefinition());

	const diff = jsdiff.diffLines(
		state.lastProcDefinitionYaml,
		newYaml
	);

	const css = [];

	const diffText = diff
		.map((change) => {
			if (change.added) {
				css.push('color: green');
				return `%c+ ${change.value.trimEnd()}`;
			} else if (change.removed) {
				css.push('color: red');
				return `%c- ${change.value.trimEnd()}`;
			} else {
				css.push('color: gray');
				return `%c  (${change.count} unchanged line${change.count === 1 ? '' : 's'})`;
			}
		})
		.join('\n');

	changesDiffs.push(diffText);

	console.log(diffText, ...css);
	setState({ lastProcDefinitionYaml: newYaml });

}

/**
 * Save yamlString to Activity file
 *
 * @param {ElectronProgram} program
 * @param {Task} activity
 * @param {string} yamlString
 */
function saveChangeElectron(program, activity, yamlString) {
	fs.writeFile(
		path.join(program.tasksPath, activity.taskReqs.file),
		yamlString,
		{},
		(err) => {
			if (err) {
				throw err;
			}
		}
	);

}

/**
 * Save yamlString to Activity file
 *
 * @param {WebProgram} program
 * @param {Task} activity
 * @param {string} yamlString
 */
function saveChangeWeb(program, activity, yamlString) {
	fetch(
		`edit/tasks/${activity.taskReqs.file}`,
		{
			method: 'POST', // or 'PUT'
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				yaml: yamlString
			})
		}
	)
		.then((response) => response.json())
		.then((data) => {
			console.log('Success:', data);
		})
		.catch((error) => {
			console.error('Error:', error);
		});
}

/**
 * Save changes for a particular Activity
 *
 * @param {WebProgram|ElectronProgram} program
 * @param {Procedure} procedure                 Procedure with latest changes to be saved back
 *                                              to files
 * @param {number} activityIndex                Activity file to save
 */
function saveChange(program, procedure, activityIndex) {
	const activity = state.procedure.tasks[activityIndex];
	console.log(`saving activity index ${activityIndex}`); // FIXME remove when done with TSing
	console.log('procedure', procedure);
	console.log('activity', activity);
	const yamlString = YAML.dump(activity.getTaskDefinition());

	if (window.isElectron) {
		saveChangeElectron(state.program, activity, yamlString);
	} else {
		saveChangeWeb(state.program, activity, yamlString);
	}

	recordAndReportChange(state.procedure);
}

module.exports = {
	state: state,
	setState: setState,
	saveChange: saveChange,
	recordAndReportChange: recordAndReportChange
};
