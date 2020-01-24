const React = require('react');
const { useDrop } = require('react-dnd');

const ItemTypes = require('../../../model/ItemTypes');
const PropTypes = require('prop-types');

// FIXME this whole file has lots of duplication with StepViewerComponent

const StepFirstDropComponent = ({ activityIndex, divisionIndex, primaryColumnKey }) => {

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
			// item isn't the first item (can't stick it before itself)
			return seriesPathsMatch(dragItem, dropSeriesPath) ? (dragItem.stepIndex > 0) : true;
		},
		drop: () => {
			const dropLocation = { ...getSeriesPath(), stepIndex: -1 };
			return dropLocation;
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop()
		})
	});

	// FIXME DUPLICATED
	const backgroundColor = canDrop ?
		(isOver ? 'green' : 'green') : // was #dddddd
		(isOver ? 'red' : 'transparent');

	return (
		<div
			ref={drop}
			style={{
				// position: 'absolute',
				marginBottom: '-20px',
				height: '20px',
				width: '100%',
				top: '-10px'
			}}
		>
			<div
				style={{
					backgroundColor,
					opacity: isOver ? 0.6 : 0.2,
					height: '100%',
					width: '100%',
					margin: '5px 0'
				}}
			/>
		</div>
	);
};

StepFirstDropComponent.propTypes = {
	activityIndex: PropTypes.number.isRequired,
	divisionIndex: PropTypes.number.isRequired,
	primaryColumnKey: PropTypes.string.isRequired
};

module.exports = StepFirstDropComponent;
