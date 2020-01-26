const React = require('react');
const { useDrag, useDrop } = require('react-dnd');

const ItemTypes = require('../../../model/ItemTypes');
const PropTypes = require('prop-types');

const liStyle = {
	position: 'relative'
};

const editButtonsContainerStyle = {
	position: 'absolute',
	backgroundColor: '#eee',
	right: '3px',
	top: '-25px'
};

/**
 * @param {Function} editFn    Function to be run when clicking edit button
 * @param {Function} deleteFn  Function to be run when clicking delete button
 * @return {Object}            React component
 */
function renderButtons(editFn, deleteFn) {
	return (
		<div style={editButtonsContainerStyle} className='modify-step-button-container'>
			<button
				onClick={editFn}
				className='edit-button'
			>
				edit
			</button>
			<button
				onClick={deleteFn}
				className='delete-button'
			>
				delete
			</button>
		</div>
	);
}

const StepViewerComponent = ({
	stepState, columnKeys, taskWriter,

	activityIndex, divisionIndex, primaryColumnKey, stepIndex,

	handleEditButtonClick, handleDeleteButtonClick, handleMoveStep
}) => {

	// why does this need to be set here? Is this why actors inappropriately shown in react? FIXME.
	stepState.props.columnKeys = columnKeys;

	const options = { level: 0 };

	const getStepPath = () => {
		return { activityIndex, divisionIndex, primaryColumnKey, stepIndex };
	};

	const seriesPathsMatch = (path1, path2) => {
		const match = (prop) => (path1[prop] === path2[prop]);
		return (
			match('activityIndex') &&
			match('divisionIndex') &&
			match('primaryColumnKey')
		);
	};

	const [{ isDragging }, drag] = useDrag({
		item: { type: ItemTypes.STEP },

		// Replace the value of monitor.getItem() in useDrop.canDrop() to compare dragging-step to
		// drop-location-step
		begin: () => {
			return getStepPath();
		},

		// monitor.getDropResult() set by useDrop.drop()
		end: (item, monitor) => {
			if (monitor.didDrop()) {
				const droppedAt = monitor.getDropResult();
				const draggedFrom = getStepPath();
				handleMoveStep(draggedFrom, droppedAt);
			}
		},
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging()
		})
	});

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.STEP,
		canDrop: (item, monitor) => {
			const dragItem = monitor.getItem(); // .getItem() modified in useDrag.begin() above
			const thisDropItem = getStepPath();
			return !seriesPathsMatch(dragItem, thisDropItem) ||
				(dragItem.stepIndex !== thisDropItem.stepIndex && dragItem.stepIndex !== thisDropItem.stepIndex - 1);
		},

		// returns step path for use in useDrag.end()
		drop: () => {
			const dropAt = getStepPath();
			dropAt.stepIndex--; // getStepPath gets the index of the step. Drop one index earlier.
			return dropAt;
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop()
			// dropContextDraggingItem: monitor.getItem()
		})
	});

	const opacity = isOver ? 0.6 : 0.2;
	let backgroundColor,
		display = 'none';

	if (canDrop) {
		display = 'block';
		backgroundColor = 'green'; // was #dddddd
	}

	// FIXME write a feature request issue for this
	// Would like to do this, but not working since display=none initially so not possible to be
	// over it. Need to start with display=none because otherwise these dropzones get in the way
	// of grabbing the dropables (since they overlap)
	// else if (isOver) { // <-- this is !canDrop && isOver
	// }
	// if there is currently an item being dragged
	// } else if (dropContextDraggingItem) {
	// 	backgroundColor = 'red';
	// 	display = 'block';
	// }

	// const backgroundColor = canDrop ?
	// 	(isOver ? 'green' : 'green') : // was #dddddd
	// 	(isOver ? 'red' : 'black');

	// const display = (backgroundColor === 'black') ? 'none' : 'block';

	return (
		<li
			style={{
				...liStyle,
				opacity: isDragging ? 0.5 : 1
			}}
			className={`li-level-${options.level} step-component`}
			ref={drag}
		>
			{renderButtons(handleEditButtonClick, handleDeleteButtonClick)}
			{taskWriter.insertStep(stepState)}
			<div
				ref={drop}
				style={{
					position: 'absolute',
					height: '20px',
					width: '100%',
					top: '-12px',
					backgroundColor,
					display,
					opacity
				}}
			/>
		</li>
	);
};

StepViewerComponent.propTypes = {
	stepState: PropTypes.object.isRequired,
	columnKeys: PropTypes.array.isRequired,
	taskWriter: PropTypes.object.isRequired,

	activityIndex: PropTypes.number.isRequired,
	divisionIndex: PropTypes.number.isRequired,
	primaryColumnKey: PropTypes.string.isRequired,
	stepIndex: PropTypes.number.isRequired,

	handleEditButtonClick: PropTypes.func.isRequired,
	handleDeleteButtonClick: PropTypes.func.isRequired,
	handleMoveStep: PropTypes.func.isRequired
};

module.exports = StepViewerComponent;
