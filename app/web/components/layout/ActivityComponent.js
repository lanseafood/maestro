const React = require('react');
const PropTypes = require('prop-types');

const DivisionComponent = require('./DivisionComponent');

const filters = require('../../../helpers/filters');
const maestroKey = require('../helpers/maestroKey');

class ActivityComponent extends React.Component {

	// FIXME: largely copied from a procedure writer class, setTaskTableHeader()
	getTableHeaderCells() {

		const columnKeys = this.props.activity.getColumns();
		const columnNames = [];

		for (const colKey of columnKeys) {
			columnNames.push(
				this.props.procedure.ColumnsHandler.getDisplayTextFromColumnKey(colKey)
			);
		}

		return columnNames.map((name) => (
			<th
				key={filters.uniqueHtmlId(`table-header-${name}`)}
				style={{ width: `${100 / columnKeys.length}%` }}>{name}</th>
		));
	}

	render() {

		return (
			<div className='activityWrapper'>
				<h2
					id={filters.uniqueHtmlId(this.props.activity.title)}
					data-level="procedure"
					data-task={this.props.activity.title}
				>
					{this.props.procedure.name} - {' '}
					{this.props.activity.title} {' '}
					({this.props.getProcedureWriter().getTaskDurationDisplay(this.props.activity)})
				</h2>
				<table className="gridtable">
					<thead>
						<tr>
							{this.getTableHeaderCells()}
						</tr>
					</thead>
					<tbody>
						{this.props.activity.concurrentSteps.map((division, index) => {
							return (
								<DivisionComponent
									key={maestroKey.getKey(this.props.activityIndex, index)}
									procedure={this.props.procedure}
									activity={this.props.activity}
									activityIndex={this.props.activityIndex}
									division={division}
									divisionIndex={index}
									getProcedureWriter={this.props.getProcedureWriter}
								/>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	}

}

ActivityComponent.propTypes = {
	procedure: PropTypes.object.isRequired,
	activity: PropTypes.object.isRequired,
	getProcedureWriter: PropTypes.func.isRequired,
	activityIndex: PropTypes.number.isRequired
};

module.exports = ActivityComponent;
