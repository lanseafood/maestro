const fs = require('fs');
const path = require('path');
const React = require('react');
const jsdiff = require('diff');
const YAML = require('js-yaml');

const stateHandler = require('../state/index');
// const PropTypes = require('prop-types');
const HeaderComponent = require('./layout/HeaderComponent');
const ProcedureViewerComponent = require('./pages/ProcedureViewerComponent');
const ProcedureSelectorComponent = require('./pages/ProcedureSelectorComponent');
const ReactProcedureWriter = require('../../writer/procedure/ReactProcedureWriter');

const changes = {
	lastDefinitionYaml: null,
	diffs: []
};

/**
 * Compare procedure against previous version of procedure. Record state for comparison with future
 * changes and console.log() a diff from the previous change.
 *
 * @param {Procedure} latestProcedure  Procedure object with latest updates, used to generate latest
 *                                     YAML string to compare against previous change.
 */
function recordAndReportChange(latestProcedure) {
	const newYaml = YAML.dump(latestProcedure.getDefinition());

	const diff = jsdiff.diffLines(
		changes.lastDefinitionYaml,
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

	changes.diffs.push(diffText);

	console.log(diffText, ...css);
	changes.lastDefinitionYaml = newYaml;

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
 * @param {Procedure} procedure                 Procedure with latest changes to be saved back to
 *                                              files
 * @param {number} activityIndex                Activity file to save
 */
function saveChange(program, procedure, activityIndex) {
	const activity = procedure.tasks[activityIndex];
	const yamlString = YAML.dump(activity.getTaskDefinition());

	if (window.isElectron) {
		saveChangeElectron(program, activity, yamlString);
	} else {
		saveChangeWeb(program, activity, yamlString);
	}
}

class App extends React.Component {

	constructor() {
		super();
		window.appComponent = this;
	}

	state = {
		procedure: null
	};

	setProcedure = (procObject) => {
		stateHandler.state.procedure = procObject;
		changes.lastDefinitionYaml = YAML.dump(procObject.getDefinition());

		this.setState({
			procedure: stateHandler.state.procedure,
			procedureWriter: new ReactProcedureWriter(window.maestro.app, procObject)
		});

		stateHandler.modifyStep = (actIndex, divIndex, colKey, stepIndex, rawDefinition) => {

			// previously cloned-deep this because I thought I might need to. Doesn't seem necessary
			// at this point but keeping this here for a while to make sure.
			// const newProc = cloneDeep(this.state.procedure);
			const newProc = this.state.procedure;

			const division = newProc.tasks[actIndex].concurrentSteps[divIndex];
			const newStep = division.makeStep(colKey, rawDefinition);

			division.subscenes[colKey][stepIndex] = newStep;

			recordAndReportChange(newProc);

			saveChange(this.program, newProc, actIndex);

			this.setState({
				procedure: newProc
			});

		};

		console.log(`Procedure set to ${procObject.name}`);
	};

	getProcedureWriter = () => {
		return this.state.procedureWriter;
	}

	setProgram(program) {
		this.program = program;
	}

	renderNoProcedure() {
		if (window.isElectron) {
			return (<p>Please select a procedure file from the file:open menu</p>);
		} else {
			return (
				<ProcedureSelectorComponent
					procedureChoices={window.procedureChoices}
					procedure={this.state.procedure}
					setProcedure={this.setProcedure} />
			);
		}
	}

	render() {
		return (
			<div className='app'>
				<div className='container'>
					<HeaderComponent />
					{!this.state.procedure ?
						this.renderNoProcedure() :
						(
							<ProcedureViewerComponent
								procedure={this.state.procedure}
								getProcedureWriter={this.getProcedureWriter}
							/>
						)
					}
				</div>
			</div>
		);
	}
}

module.exports = App;
