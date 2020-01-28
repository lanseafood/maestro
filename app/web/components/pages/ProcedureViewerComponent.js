const React = require('react');
const PropTypes = require('prop-types');
const { DndProvider } = require('react-dnd');
const Backend = require('react-dnd-html5-backend').default;

const stateHandler = require('../../state/index');

// const ActivitySelectorMenu = require('./../layout/ActivitySelectorMenu');
const ActivityComponent = require('../layout/ActivityComponent');
class ProcedureViewerComponent extends React.Component {
	render() {

		// <ActivitySelectorMenu activities={this.props.procedure.tasks} />

		return (
			<React.Fragment>
				<DndProvider backend={Backend}>
					{stateHandler.state.procedure.tasks.map((task) => {
						return (
							<ActivityComponent
								key={task.uuid}
								// activity={task}
								activityUuid={task.uuid}
								// procedure={stateHandler.state.procedure}
							/>
						);
					})}
				</DndProvider>
			</React.Fragment>
		);

	}
}

ProcedureViewerComponent.propTypes = {
	procedureFile: PropTypes.string.isRequired
};

module.exports = ProcedureViewerComponent;
