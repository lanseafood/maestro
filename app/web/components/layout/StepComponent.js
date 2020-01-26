const React = require('react');
const PropTypes = require('prop-types');
const YAML = require('js-yaml');

const stateHandler = require('../../state/index');

const StepViewerComponent = require('./StepViewerComponent');

const liStyle = {
	position: 'relative'
};
const textareaStyle = {
	height: '80px',
	width: '100%'
};

// NOTE: See base-eva.css for :hover styles, etc

class StepComponent extends React.Component {

	state = {
		editMode: false,
		stepState: false
	}

	constructor(props) {
		super(props);

		// initialize to allow holding an in-work set of changes before saving
		// this.state.localStepState = this.props.stepState;

		this.editorInput = React.createRef();

		// when Step.reload() is called, run function to update this component state
		this.unsubscribeReloadFn = this.props.stepState.subscribeReload((newState) => {
			this.setState({ stepState: newState });
		});
	}

	componentWillUnmount() {
		this.unsubscribeReloadFn();
	}

	handleEditButtonClick = (e) => {
		console.log('edit button click');
		e.preventDefault();
		e.stopPropagation();
		this.setState({ editMode: true });
	}

	handleDeleteButtonClick = (e) => {
		console.log('edit button click');
		e.preventDefault();
		e.stopPropagation();

		this.props.deleteStepFromSeries(this.props.stepIndex);

		stateHandler.saveChange(stateHandler.state.program,
			stateHandler.state.procedure, this.props.activityIndex);

	}

	getKey() {
		return `act${this.props.activityIndex}-div${this.props.divisionIndex}-${this.props.primaryColumnKey}-step${this.props.stepIndex}`;
	}

	render() {
		console.log('rendering StepComponent');
		return this.state.editMode ?
			this.renderEditor() :
			(
				<StepViewerComponent
					stepState={this.props.stepState}
					columnKeys={this.props.columnKeys}
					taskWriter={this.props.taskWriter}

					activityIndex={this.props.activityIndex}
					divisionIndex={this.props.divisionIndex}
					primaryColumnKey={this.props.primaryColumnKey}
					stepIndex={this.props.stepIndex}

					handleEditButtonClick={this.handleEditButtonClick}
					handleDeleteButtonClick={this.handleDeleteButtonClick}
					handleMoveStep={this.props.handleMoveStep}

				/>
			);
	}

	renderEditor() {

		const options = { level: 0 };

		// was: this.state.localStepState.text
		const initial = YAML.safeDump(this.props.stepState.getDefinition());

		// had: onChange={this.handleEditTextChange}
		return (
			<li
				style={liStyle}
				className={`li-level-${options.level}`}
			>
				<div>
					<textarea
						style={textareaStyle}
						type='text'
						defaultValue={initial}
						ref={this.editorInput}
					/>
				</div>
				<button className='save-button' onClick={this.handleSave}>save</button>
				<button className='cancel-button' onClick={this.handleCancel}>cancel</button>
			</li>
		);

	}

	handleSave = (e) => {
		console.log('handle save');

		e.preventDefault();
		e.stopPropagation();

		const newDefinition = YAML.safeLoad(this.editorInput.current.value);

		// update the state with new definition
		this.props.stepState.reload(newDefinition);
		stateHandler.saveChange(stateHandler.state.program,
			stateHandler.state.procedure, this.props.activityIndex);

		this.setState({
			editMode: false
			// localStepState: newStep
		});
	}

	handleCancel = (e) => {
		console.log('handle cancel');

		e.preventDefault();
		e.stopPropagation();

		this.setState({
			editMode: false
			// localStepState: this.props.stepState
		});
	}

}

StepComponent.propTypes = {

	stepState: PropTypes.object.isRequired,
	columnKeys: PropTypes.array.isRequired,
	taskWriter: PropTypes.object.isRequired,

	activityIndex: PropTypes.number.isRequired,
	divisionIndex: PropTypes.number.isRequired,
	primaryColumnKey: PropTypes.string.isRequired,
	stepIndex: PropTypes.number.isRequired,

	deleteStepFromSeries: PropTypes.func.isRequired,
	handleMoveStep: PropTypes.func.isRequired
};

module.exports = StepComponent;
