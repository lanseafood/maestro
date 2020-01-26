const React = require('react');
const { useDrop } = require('react-dnd');

const ItemTypes = require('../../../model/ItemTypes');
const PropTypes = require('prop-types');

// FIXME this whole file has lots of duplication with StepViewerComponent

const StepDropLocationComponent = ({
	// seriesState, activityIndex, divisionIndex, primaryColumnKey,

	position, // top or bottom

	canDropFn, dropFn

}) => {

	// const getSeriesPath = () => {
	// 	return { activityIndex, divisionIndex, primaryColumnKey };
	// };

	// const seriesPathsMatch = (path1, path2) => {
	// 	const match = (prop) => (path1[prop] === path2[prop]);
	// 	return (
	// 		match('activityIndex') &&
	// 		match('divisionIndex') &&
	// 		match('primaryColumnKey')
	// 	);
	// };

	// FIXME duplicated
	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.STEP,
		canDrop: canDropFn,
		drop: dropFn,
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop()
		})
	});

	// FIXME DUPLICATED
	const opacity = isOver ? 0.6 : 0.2;
	let backgroundColor,
		display = 'none';

	if (canDrop) {
		display = 'block';
		backgroundColor = 'green'; // was #dddddd
	}

	const elemStyle = {
		position: 'absolute',
		height: '20px',
		width: '100%',
		backgroundColor,
		display,
		opacity
	};

	if (position === 'top') {
		elemStyle.top = '-12px';
	} else {
		elemStyle.bottom = '0px';
	}

	return (
		<div
			ref={drop}
			style={elemStyle}
		/>
	);
};

StepDropLocationComponent.propTypes = {
	// seriesState: PropTypes.object.isRequired,

	// activityIndex: PropTypes.number.isRequired,
	// divisionIndex: PropTypes.number.isRequired,
	// primaryColumnKey: PropTypes.string.isRequired,

	position: PropTypes.string.isRequired,
	canDropFn: PropTypes.func.isRequired,
	dropFn: PropTypes.func.isRequired
};

module.exports = StepDropLocationComponent;
