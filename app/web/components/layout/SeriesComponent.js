const React = require('react');
const PropTypes = require('prop-types');
const uuidv4 = require('uuid/v4');

const maestroKey = require('../helpers/maestroKey');

const Series = require('../../../model/Series');
const StepComponent = require('./StepComponent');
const StepFirstDropComponent = require('./StepFirstDropComponent');
const stateHandler = require('../../state/index');

class SeriesComponent extends React.Component {

	state = {
		seriesState: false
	}

	constructor(props) {
		super(props);

		this.unsubscribeFns = {
			reloadSeries: null,
			appendStep: null,
			deleteStep: null,
			insertStep: null,
			transferStep: null
		};

		for (const seriesModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[seriesModelMethod] = this.props.seriesState.subscribe(
				seriesModelMethod, // reloadSeries, appendStep, etc
				(newState) => { // perform this func when the Series method is run
					this.setState({ seriesState: newState });
				}
			);
		}

	}

	componentWillUnmount() {
		for (const seriesModelMethod of this.unsubscribeFns) {
			this.unsubscribeFns[seriesModelMethod](); // run each unsubscribe function
		}
	}

	deleteStepFromSeries = (stepIndex) => {
		this.props.seriesState.deleteStep(stepIndex);
	}

	handleMoveStep = (from, to) => {

		const destinationSeries = stateHandler.state.procedure
			.tasks[to.activityIndex]
			.concurrentSteps[to.divisionIndex]
			.subscenes[to.primaryColumnKey];

		this.props.seriesState.transferStep(from.stepIndex, destinationSeries, to.stepIndex);

		stateHandler.saveChange(stateHandler.state.program,
			stateHandler.state.procedure, this.props.activityIndex);

	}

	render() {
		// const startStep = this.props.taskWriter.preInsertSteps();

		return (
			<td key={uuidv4()} colSpan={this.props.colspan}>
				<StepFirstDropComponent
					activityIndex={this.props.activityIndex}
					divisionIndex={this.props.divisionIndex}
					primaryColumnKey={this.props.primaryColumnKey}
				/>
				<ol>
					{/* FIXME start={startStep} removed from <ol> above -- need to fix step nums */}
					{this.props.seriesState.steps.map((step, index) => {
						const key = maestroKey.getKey(
							this.props.activityIndex,
							this.props.divisionIndex,
							this.props.primaryColumnKey,
							index
						);
						return (
							<StepComponent
								key={key}
								stepState={step}
								columnKeys={this.props.columnKeys}
								taskWriter={this.props.taskWriter}

								activityIndex={this.props.activityIndex}
								divisionIndex={this.props.divisionIndex}
								primaryColumnKey={this.props.primaryColumnKey}
								stepIndex={index}

								deleteStepFromSeries={this.deleteStepFromSeries}
								handleMoveStep={this.handleMoveStep}
							/>
						);
					})}
				</ol>
			</td>
		);
	}

}

SeriesComponent.propTypes = {
	colspan: PropTypes.number.isRequired,
	startStep: PropTypes.number.isRequired,
	// steps: PropTypes.array.isRequired,
	columnKeys: PropTypes.array.isRequired,
	seriesState: PropTypes.object.isRequired,
	taskWriter: PropTypes.object.isRequired,

	activityIndex: PropTypes.number.isRequired,
	divisionIndex: PropTypes.number.isRequired,
	primaryColumnKey: PropTypes.string.isRequired
};

module.exports = SeriesComponent;
