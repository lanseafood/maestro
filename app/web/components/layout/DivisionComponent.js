const React = require('react');
const PropTypes = require('prop-types');
const ReactTaskWriter = require('../../../writer/task/ReactTaskWriter');
const stateHandler = require('../../state/index');

class DivisionComponent extends React.Component {

	constructor(props) {
		super(props);
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		this.taskWriter = new ReactTaskWriter(
			activity,
			stateHandler.state.procedureWriter
		);
	}

	render() {
		// console.log(`rendering division ${this.props.divisionIndex}`);

		return this.taskWriter.writeDivision(
			this.props.division,
			this.props.activityUuid,
			this.props.divisionIndex
		);
	}

}

DivisionComponent.propTypes = {
	// procedure: PropTypes.object.isRequired,
	// activity: PropTypes.object.isRequired,
	// getProcedureWriter: PropTypes.func.isRequired,
	// activityIndex: PropTypes.number.isRequired,

	activityUuid: PropTypes.string.isRequired,
	division: PropTypes.object.isRequired,
	divisionIndex: PropTypes.number.isRequired
};

module.exports = DivisionComponent;
