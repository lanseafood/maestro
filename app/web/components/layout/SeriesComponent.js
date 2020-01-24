const React = require('react');
const PropTypes = require('prop-types');
const uuidv4 = require('uuid/v4');

const maestroKey = require('../helpers/maestroKey');

const Step = require('./StepComponent');
const StepFirstDropComponent = require('./StepFirstDropComponent');

class SeriesComponent extends React.Component {

	render() {
		const startStep = this.props.taskWriter.preInsertSteps();

		return (
			<td key={uuidv4()} colSpan={this.props.colspan}>
				<StepFirstDropComponent
					activityIndex={this.props.activityIndex}
					divisionIndex={this.props.divisionIndex}
					primaryColumnKey={this.props.primaryColumnKey}
				/>
				<ol start={startStep}>
					{this.props.seriesState.map((step, index) => {
						const key = maestroKey.getKey(
							this.props.activityIndex,
							this.props.divisionIndex,
							this.props.primaryColumnKey,
							index
						);
						return (
							<Step
								key={key}
								stepState={step}
								columnKeys={this.props.columnKeys}
								taskWriter={this.props.taskWriter}

								activityIndex={this.props.activityIndex}
								divisionIndex={this.props.divisionIndex}
								primaryColumnKey={this.props.primaryColumnKey}
								stepIndex={index}
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
	seriesState: PropTypes.array.isRequired,
	taskWriter: PropTypes.object.isRequired,

	activityIndex: PropTypes.number.isRequired,
	divisionIndex: PropTypes.number.isRequired,
	primaryColumnKey: PropTypes.string.isRequired
};

module.exports = SeriesComponent;
