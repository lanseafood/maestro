const React = require('react');
const PropTypes = require('prop-types');

class ActivityComponent extends React.Component {

	render() {

		// this.props.activities

		return (
			<div>
				<AdjacentActivityLink direction='previous' />
				<ActivityDropdown />
				<AdjacentActivityLink direction='next' />
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
