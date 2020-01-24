const React = require('react');
const PropTypes = require('prop-types');
const { DndProvider } = require('react-dnd');
const Backend = require('react-dnd-html5-backend').default;

// const ActivitySelectorMenu = require('./../layout/ActivitySelectorMenu');
const ActivityComponent = require('../layout/ActivityComponent');
class ProcedureViewerComponent extends React.Component {
	render() {

		// <ActivitySelectorMenu activities={this.props.procedure.tasks} />

		return (
			<React.Fragment>
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
			</React.Fragment>
		);

	}
}

ProcedureViewerComponent.propTypes = {
	procedure: PropTypes.object.isRequired,
	getProcedureWriter: PropTypes.func.isRequired
};

module.exports = ProcedureViewerComponent;
