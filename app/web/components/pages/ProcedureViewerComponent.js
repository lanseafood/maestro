const React = require('react');
const PropTypes = require('prop-types');
const { DndProvider } = require('react-dnd');
const Backend = require('react-dnd-html5-backend').default;

const ActivityComponent = require('../layout/ActivityComponent');

class ProcedureViewerComponent extends React.Component {
	render() {

		return (
			<DndProvider backend={Backend}>
				{this.props.procedure.tasks.map((task, index) => (
					<ActivityComponent
						key={task.filename}
						activity={task}
						activityIndex={index}
						procedure={this.props.procedure}
						getProcedureWriter={this.props.getProcedureWriter}
					/>
				))}
			</DndProvider>
		);

	}
}

ProcedureViewerComponent.propTypes = {
	// These don't appear to be able to be marked required since procedure does exist on load.
	// Certainly they are required for actual usage of this component. This is will get fixed when
	// a proper router is used.
	procedure: PropTypes.object,
	getProcedureWriter: PropTypes.func.isRequired
};

module.exports = ProcedureViewerComponent;
