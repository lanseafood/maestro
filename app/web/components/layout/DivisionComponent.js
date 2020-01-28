const React = require('react');
const PropTypes = require('prop-types');
const ReactTaskWriter = require('../../../writer/task/ReactTaskWriter');
const stateHandler = require('../../state/index');
const DivisionControlsComponent = require('./DivisionControlsComponent');

class DivisionComponent extends React.PureComponent {

	constructor(props) {
		super(props);
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);
		console.log('constructing DivisionComponent');

		this.taskWriter = new ReactTaskWriter(
			activity,
			stateHandler.state.procedureWriter
		);
	}

	render() {
		console.log(`rendering division ${this.props.divisionUuid}`);

		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);
		const divisionIndex = activity.getDivisionIndexByUuid(this.props.divisionUuid);
		const division = activity.concurrentSteps[divisionIndex];

		return (
			<React.Fragment>
				<DivisionControlsComponent
					activityUuid={this.props.activityUuid}
					divisionUuid={division.uuid}
				/>
				{this.taskWriter.writeDivision(
					division,
					this.props.activityUuid,
					this.props.divisionUuid
				)}
			</React.Fragment>
		);
	}

}

DivisionComponent.propTypes = {
	// procedure: PropTypes.object.isRequired,
	// activity: PropTypes.object.isRequired,
	// getProcedureWriter: PropTypes.func.isRequired,
	// activityIndex: PropTypes.number.isRequired,

	activityUuid: PropTypes.string.isRequired,
	// division: PropTypes.object.isRequired,
	// divisionIndex: PropTypes.number.isRequired
	divisionUuid: PropTypes.string.isRequired
};

module.exports = DivisionComponent;
