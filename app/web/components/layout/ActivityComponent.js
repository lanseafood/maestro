const React = require('react');
const PropTypes = require('prop-types');

const DivisionComponent = require('./DivisionComponent');
const DivisionControlsComponent = require('./DivisionControlsComponent');

const stateHandler = require('../../state/index');

const filters = require('../../../helpers/filters');
const maestroKey = require('../helpers/maestroKey');

class ActivityComponent extends React.Component {

	state = {
		activityState: false
	}

	constructor(props) {
		super(props);

		this.unsubscribeFns = {
			deleteDivision: null,
			insertDivision: null
		};

		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		for (const activityModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[activityModelMethod] = activity.subscribe(
				activityModelMethod, // insertDivision, deleteDivision, etc
				(newState) => { // perform this func when the Activity method is run
					console.log(`Running subscribed method for Task.${activityModelMethod}`);
					this.setState({ activityState: newState });
				}
			);
		}

	}

	componentWillUnmount() {
		for (const activityModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[activityModelMethod](); // run each unsubscribe function
		}
	}

	// FIXME: largely copied from a procedure writer class, setTaskTableHeader()
	getTableHeaderCells() {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		const columnKeys = activity.getColumns();
		const columnNames = [];

		for (const colKey of columnKeys) {
			columnNames.push(
				stateHandler.state.procedure.ColumnsHandler.getDisplayTextFromColumnKey(colKey)
			);
		}

		return columnNames.map((name) => (
			<th
				key={filters.uniqueHtmlId(`table-header-${name}`)}
				style={{ width: `${100 / columnKeys.length}%` }}>{name}</th>
		));
	}

	deleteDivision = (divisionIndex) => {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);
		activity.deleteDivision(divisionIndex);
	}

	insertDivision = (divisionIndex) => {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);
		activity.insertDivision(divisionIndex);
	}

	render() {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		// console.log(`rendering activity ${this.props.activityIndex}`);
		const procWriter = stateHandler.state.procedureWriter;
		return (
			<div className='activityWrapper'>
				<h2
					id={filters.uniqueHtmlId(activity.title)}
					data-level="procedure"
					data-task={activity.title}
				>
					{stateHandler.state.procedure.name} - {' '}
					{activity.title} {' '}
					({procWriter.getTaskDurationDisplay(activity)})
				</h2>
				<table className="gridtable">
					<thead>
						<tr>
							{this.getTableHeaderCells()}
						</tr>
					</thead>
					<tbody>
						{activity.concurrentSteps.map((division, index) => {
							return (
								<React.Fragment
									key={maestroKey.getKey(this.props.activityUuid, index) + '-wrapper'}
								>
									<DivisionControlsComponent
										// activityIndex={this.props.activityIndex}
										activityUuid={this.props.activityUuid}
										divisionIndex={index}
										deleteDivision={this.deleteDivision}
										insertDivision={this.insertDivision}
									/>
									<DivisionComponent
										key={maestroKey.getKey(this.props.activityUuid, index)}
										// procedure={stateHandler.state.procedure}
										// activity={activity}
										// activityIndex={this.props.activityIndex}
										activityUuid={this.props.activityUuid}
										division={division}
										divisionIndex={index}
									/>
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	}

}

ActivityComponent.propTypes = {
	// procedure: PropTypes.object.isRequired,
	// activity: PropTypes.object.isRequired,
	// getProcedureWriter: PropTypes.func.isRequired,
	// activityIndex: PropTypes.number.isRequired
	activityUuid: PropTypes.string.isRequired
};

module.exports = ActivityComponent;
