const React = require('react');
const PropTypes = require('prop-types');
const uuidv4 = require('uuid/v4');

const maestroKey = require('../helpers/maestroKey');

const StepComponent = require('./StepComponent');
const StepDropLocationComponent = require('./StepDropLocationComponent');
const stateHandler = require('../../state/index');

const seriesPathsMatch = (path1, path2) => {
	const match = (prop) => (path1[prop] === path2[prop]);
	return (
		match('activityIndex') &&
		match('divisionIndex') &&
		match('primaryColumnKey')
	);
};

class SeriesComponent extends React.Component {

	state = {
		seriesState: false
	}

	constructor(props) {
		super(props);

		this.unsubscribeFns = {
			appendStep: null,
			deleteStep: null,
			insertStep: null,
			transferStep: null
		};

		for (const seriesModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[seriesModelMethod] = this.props.seriesState.subscribe(
				seriesModelMethod, // transferStep, appendStep, etc
				(newState) => { // perform this func when the Series method is run
					this.setState({ seriesState: newState });
				}
			);
		}

	}

	getSeriesPath = () => {
		return {
			activityIndex: this.props.activityIndex,
			divisionIndex: this.props.divisionIndex,
			primaryColumnKey: this.props.primaryColumnKey
		};
	};

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

		// for the end-of-series drop location, which is not attached to a StepComponent but instead
		// attached to the bottom of the SeriesComponent, there will not be a stepIndex. Instead it
		// will explicitly define the stepIndex as false. Set it to the end of the Series.
		if (to.stepIndex === false) {
			to.stepIndex = this.props.seriesState.steps.length;
		}

		this.props.seriesState.transferStep(from.stepIndex, destinationSeries, to.stepIndex);

		stateHandler.saveChange(stateHandler.state.program,
			stateHandler.state.procedure, this.props.activityIndex);

	}

	canDropAtEndOfSeries = (item, monitor) => {
		const dragItem = monitor.getItem(); // .getItem() modified in useDrag.begin() above
		const dropSeriesPath = this.getSeriesPath();

		// if the activity-->division-->series are the same, only return true if the dragged
		// item isn't the last item (can't stick it after itself)
		return seriesPathsMatch(dragItem, dropSeriesPath) ?
			(dragItem.stepIndex !== this.props.seriesState.steps.length - 1) :
			true;

	}

	dropOccurredAtEndOfSeries = () => {
		const dropLocation = { ...this.getSeriesPath(), stepIndex: false };
		return dropLocation;
	}

	render() {
		// const startStep = this.props.taskWriter.preInsertSteps();

		return (
			<td key={uuidv4()} colSpan={this.props.colspan}>
				<div style={{ position: 'relative' }}>
					<ol>
						{/*
						FIXME start={startStep} removed from <ol> above -- need to fix step nums
						*/}
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
					<StepDropLocationComponent
						canDropFn={this.canDropAtEndOfSeries}
						dropFn={this.dropOccurredAtEndOfSeries}
						position='bottom'
					/>
				</div>
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
