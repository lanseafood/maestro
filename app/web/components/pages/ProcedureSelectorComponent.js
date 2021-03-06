const React = require('react');
const PropTypes = require('prop-types');

const btnStyle = {
	padding: '5px 9px',
	cursor: 'pointer'
};

class ProcedureSelectorComponent extends React.Component {

	onClick = (proc) => {
		window.maestro.app.loadProcedure(proc)
			.then(() => {
				this.props.setProcedure(window.maestro.app.procedure);
			});
	};

	render() {
		return this.props.procedureChoices.map((proc) => (
			<button
				key={proc}
				onClick={this.onClick.bind(this, proc)}
				style={btnStyle}
			>
				{proc}
			</button>
		));
	}
}

ProcedureSelectorComponent.propTypes = {
	procedure: PropTypes.object,
	procedureChoices: PropTypes.array.isRequired,
	setProcedure: PropTypes.func.isRequired
};

module.exports = ProcedureSelectorComponent;
