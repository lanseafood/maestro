// const fs = require('fs'); // FIXME cleanup
// const path = require('path');
const React = require('react');
const YAML = require('js-yaml');

const stateHandler = require('../state/index');
// const PropTypes = require('prop-types'); FIXME CLEANPUP
const HeaderComponent = require('./layout/HeaderComponent');
const ProcedureViewerComponent = require('./pages/ProcedureViewerComponent');
const ProcedureSelectorComponent = require('./pages/ProcedureSelectorComponent');
const ReactProcedureWriter = require('../../writer/procedure/ReactProcedureWriter');

/**
 * Compare procedure against previous version of procedure. Record state for comparison with future
 * changes and console.log() a diff from the previous change.
 *
 * @param {Procedure} latestProcedure  Procedure object with latest updates, used to generate latest
 *                                     YAML string to compare against previous change.
 *
 * FIXME: the new implementation of saving steps does not use this. Generalize...
 */
/*
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
*/

/**
 * Save yamlString to Activity file
 *
 * @param {ElectronProgram} program
 * @param {Task} activity
 * @param {string} yamlString
 */
// function saveChangeElectron(program, activity, yamlString) {
// fs.writeFile(
// path.join(program.tasksPath, activity.taskReqs.file),
// yamlString,
// {},
// (err) => {
// if (err) {
// throw err;
// }
// }
// );
// }

/**
 * Save yamlString to Activity file
 *
 * @param {WebProgram} program
 * @param {Task} activity
 * @param {string} yamlString
 */
// function saveChangeWeb(program, activity, yamlString) {
// fetch(
// `edit/tasks/${activity.taskReqs.file}`,
// {
// method: 'POST', // or 'PUT'
// headers: {
// 'Content-Type': 'application/json'
// },
// body: JSON.stringify({
// yaml: yamlString
// })
// }
// )
// .then((response) => response.json())
// .then((data) => {
// console.log('Success:', data);
// })
// .catch((error) => {
// console.error('Error:', error);
// });
// }

/**
 * Save changes for a particular Activity
 *
 * @param {WebProgram|ElectronProgram} program
 * @param {Procedure} procedure                 Procedure with latest changes to be saved back to
 *                                              files
 * @param {number} activityIndex                Activity file to save
 */
// function saveChange(program, procedure, activityIndex) {
// const activity = procedure.tasks[activityIndex];
// const yamlString = YAML.dump(activity.getTaskDefinition());
// if (window.isElectron) {
// saveChangeElectron(program, activity, yamlString);
// } else {
// saveChangeWeb(program, activity, yamlString);
// }
// }

class App extends React.Component {

	constructor() {
		super();
		window.appComponent = this;
	}

	state = {
		procedure: null
	};

	setProcedure = (procObject) => {

		stateHandler.setState({
			procedure: procObject,

			// this.program is set in ElectronProgram constructor...FIXME?
			program: this.program,

			// Set initial YAML representation of entire procedure (including activities). Changes
			// can diff against this.
			lastProcDefinitionYaml: YAML.dump(procObject.getDefinition())
		});

		this.setState({
			procedure: stateHandler.state.procedure,
			procedureWriter: new ReactProcedureWriter(window.maestro.app, procObject)
		});

		// const draggedFrom = { activityIndex, divisionIndex, primaryColumnKey, stepIndex };
		stateHandler.handleMoveStep = (from, to) => {

			const match = (prop) => (from[prop] === to[prop]);
			const newProc = this.state.procedure;

			const fromList = newProc
				.tasks[from.activityIndex]
				.concurrentSteps[from.divisionIndex]
				.subscenes[from.primaryColumnKey].steps;

			const toList = newProc
				.tasks[to.activityIndex]
				.concurrentSteps[to.divisionIndex]
				.subscenes[to.primaryColumnKey].steps;

			const [step] = fromList.splice(from.stepIndex, 1);

			if (match('activityIndex') && match('divisionIndex') && match('primaryColumnKey')) {
				// move step indices in array

				const insertIndex = from.stepIndex < to.stepIndex ?
					to.stepIndex :
					to.stepIndex + 1;

				toList.splice(insertIndex, 0, step);

			} else {
				toList.splice(to.stepIndex + 1, 0, step);

			}

			stateHandler.recordAndReportChange(newProc);

			stateHandler.saveChange(this.program, newProc, from.activityIndex);
			// saveChange(this.program, newProc, from.activityIndex);
			if (!match('activityIndex')) {
				stateHandler.saveChange(this.program, newProc, to.activityIndex);
				// saveChange(this.program, newProc, to.activityIndex);
			}

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
				<HeaderComponent />
				<div className='procedure-container' style={{ margin: '0 20px' }}>
					{this.state.procedure ?
						(
							<ProcedureViewerComponent
								procedure={this.state.procedure}
								getProcedureWriter={this.getProcedureWriter}
							/>
						) :
						this.renderNoProcedure()
					}
				</div>
			</div>
		);
	}
}

module.exports = App;
