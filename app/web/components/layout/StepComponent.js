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
		editMode: false
	}

	constructor(props) {
		super(props);

		// initialize to allow holding an in-work set of changes before saving
		// this.state.localStepState = this.props.stepState;

		this.editorInput = React.createRef();
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

		stateHandler.deleteStep(
			this.props.activityIndex,
			this.props.divisionIndex,
			this.props.primaryColumnKey,
			this.props.stepIndex
		);
	}

	getKey() {
		return `act${this.props.activityIndex}-div${this.props.divisionIndex}-${this.props.primaryColumnKey}-step${this.props.stepIndex}`;
	}

	render() {
		return this.state.editMode ?
			this.renderEditor() :
			(
				<StepViewerComponent
					stepState={this.props.stepState}
					columnKeys={this.props.columnKeys}
					taskWriter={this.props.taskWriter}
				/>
			);
	}

	// was renderViewer

	// was renderButton

	renderEditor() {

		const options = { level: 0 };

		// was: this.state.localStepState.text
		const initial = YAML.safeDump(this.props.stepState.raw);

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

		const newRaw = YAML.safeLoad(this.editorInput.current.value);
		// const newState = cloneDeep(this.props.stepState);
		// newState.raw = newRaw;

		stateHandler.modifyStep(
			this.props.activityIndex,
			this.props.divisionIndex,
			this.props.primaryColumnKey,
			this.props.stepIndex,
			newRaw
		);

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
	stepIndex: PropTypes.number.isRequired

};

module.exports = StepComponent;
