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
