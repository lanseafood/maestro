const React = require('react');
const { useDrop } = require('react-dnd');

const ItemTypes = require('../../../model/ItemTypes');
const PropTypes = require('prop-types');

// FIXME this whole file has lots of duplication with StepViewerComponent

const StepFirstDropComponent = ({
	seriesState, activityIndex, divisionIndex, primaryColumnKey }) => {

	const getSeriesPath = () => {
		return { activityIndex, divisionIndex, primaryColumnKey };
	};

	const seriesPathsMatch = (path1, path2) => {
		const match = (prop) => (path1[prop] === path2[prop]);
		return (
			match('activityIndex') &&
			match('divisionIndex') &&
			match('primaryColumnKey')
		);
	};

	// FIXME duplicated
	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.STEP,
		canDrop: (item, monitor) => {
			const dragItem = monitor.getItem(); // .getItem() modified in useDrag.begin() above
			const dropSeriesPath = getSeriesPath();

			// if the activity-->division-->series are the same, only return true if the dragged
			// item isn't the last item (can't stick it after itself)
			return seriesPathsMatch(dragItem, dropSeriesPath) ?
				(dragItem.stepIndex !== seriesState.steps.length - 1) :
				true;
		},
		drop: () => {
			const dropLocation = { ...getSeriesPath(), stepIndex: false };
			return dropLocation;
		},
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

	return (
		<div
			ref={drop}
			style={{
				position: 'absolute',
				height: '20px',
				width: '100%',
				bottom: '0px',
				backgroundColor,
				display,
				opacity
			}}
		/>
	);
};

StepFirstDropComponent.propTypes = {
	seriesState: PropTypes.object.isRequired,

	activityIndex: PropTypes.number.isRequired,
	divisionIndex: PropTypes.number.isRequired,
	primaryColumnKey: PropTypes.string.isRequired
};

module.exports = StepFirstDropComponent;
