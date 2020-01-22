/* Specify environment to include mocha globals, and directly callout enzyme globals */
/* eslint-env node, mocha */
/* eslint-disable-next-line no-unused-vars */
/* global shallow render mount */
/* eslint-disable require-jsdoc */

'use strict';

const React = require('react');
const assert = require('chai').assert;

const taskWriterGenerator = require('../../../../test/generators/taskWriterGenerator');
const stepModelGenerator = require('../../../../test/generators/stepModelGenerator');

const StepComponent = require('./StepComponent');

const baseStepText = 'Do some things';
function makeStep() {
	const activityIndex = 0;
	const taskWriter = taskWriterGenerator('simple/procedures/proc.yml', 'React', activityIndex);
	return (<StepComponent
		stepState={stepModelGenerator(baseStepText, 'crewA', 'EV1')}
		columnKeys={['EV1']}
		taskWriter={taskWriter}
		activityIndex={activityIndex}
		divisionIndex={2}
		primaryColumnKey={'EV1'}
		stepIndex={0}
	/>);
}

function looksLikeViewMode(wrapper, stepText = baseStepText) {
	assert.isFalse(wrapper.state().editMode, 'wrapper.state.editMode should be false');
	assert.lengthOf(wrapper.find('.edit-button'), 1, 'should have 1 edit button');
	assert.strictEqual(wrapper.find('div').at(1).text(), stepText);
}

function looksLikeEditMode(wrapper) {
	assert.isTrue(wrapper.state().editMode, 'wrapper.state.editMode should be true');
	assert.lengthOf(wrapper.find('textarea'), 1, 'should have one textarea (for now)');
}

const clickEventFns = {
	preventDefault: function() {},
	stopPropagation: function() {}
};

describe('StepComponent', () => {

	it('renders viewer with edit button in base state', () => {
		const wrapper = shallow(makeStep());
		looksLikeViewMode(wrapper);
	});

	it('renders editor with textarea in edit state', () => {
		const wrapper = shallow(makeStep());
		looksLikeViewMode(wrapper);

		wrapper.setState({ editMode: true });
		looksLikeEditMode(wrapper);

	});

	it('clicking edit button switches to edit mode & cancel switches back', () => {
		const wrapper = shallow(makeStep());
		looksLikeViewMode(wrapper);

		wrapper.find('.edit-button').at(0).simulate('click', clickEventFns);
		looksLikeEditMode(wrapper);

		wrapper.find('.cancel-button').at(0).simulate('click', clickEventFns);
		looksLikeViewMode(wrapper);
	});

	/* NOTE: Cannot handle save-button action here, since that requires modifying state higher up at
	         the app level
	it('clicking the save button will alter step contents', () => {
		const wrapper = mount(makeStep());
		wrapper.setState({ editMode: true });

		wrapper.find('textarea').at(0).simulate('change', { target: { value: 'step: New text' } });
		wrapper.find('.save-button').at(0).simulate('click', clickEventFns);
		looksLikeViewMode(wrapper);
	});
	*/

});
