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
 * @return {*}
 */
function renderButton() {
	return (
		<div style={editButtonsContainerStyle} className='modify-step-button-container'>
			<button
				onClick={this.handleEditButtonClick}
				className='edit-button'
			>
				edit
			</button>
			<button
				onClick={this.handleDeleteButtonClick}
				className='delete-button'
			>
				delete
			</button>
		</div>
	);
}

/**
 * @return {*}
 */
const StepViewerComponent = ({ stepState, columnKeys, taskWriter }) => {
	stepState.columnKeys = columnKeys;

	const options = { level: 0 };

	const [{ isDragging }, drag] = useDrag({
		item: { type: ItemTypes.STEP },
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging()
		})
	});

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.STEP,
		canDrop: () => true,
		drop: () => console.log('dropped'),
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop()
		})
	});

	return (
		<li
			style={{
				...liStyle,
				opacity: isDragging ? 0.5 : 1
			}}
			className={`li-level-${options.level} step-component`}
			ref={drag}
		>
			{renderButton()}
			{taskWriter.insertStep(stepState)}
			<div
				ref={drop}
				style={{
					height: '5px',
					backgroundColor: isOver ? 'green' : '#DDDDDD'
				}}
			/>
		</li>
	);
};

StepViewerComponent.propTypes = {
	stepState: PropTypes.object.isRequired,
	columnKeys: PropTypes.array.isRequired,
	taskWriter: PropTypes.object.isRequired
};

module.exports = StepViewerComponent;
