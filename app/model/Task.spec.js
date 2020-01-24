/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const expect = require('chai').expect;
const assert = require('chai').assert;

const YAML = require('js-yaml');

const Task = require('./Task');

const taskRequirementsDefinition = {
	file: 'some-task.yml',
	roles: { crewA: 'EV1', crewB: 'EV2' },
	color: '#7FB3D5'
};

/**
 * Positive testing for task
 */
describe('Task constructor - Positive Testing', function() {
	describe('Normal Input', () => {
		const yamlString = `
        title: Egress

        roles:
          - name: crewA
            duration:
              minutes: 25
          - name: crewB
            duration:
              minutes: 25

        steps:
            - EV1:
                - step: "Go Outside"
        `;
		var taskDefinition = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const task = new Task(taskRequirementsDefinition);
			task.addTaskDefinition(taskDefinition);

			expect(task.title).to.be.a('string');
			expect(task.title).to.equal('Egress');

			expect(task.concurrentSteps).to.be.an('array');
			expect(task.concurrentSteps).to.have.all.keys(0);

			// eslint-disable-next-line no-unused-expressions
			expect(task.concurrentSteps[0].subscenes.EV1.steps).to.exist;
			expect(task.concurrentSteps[0].subscenes.EV1.steps).to.be.an('array');
			expect(task.concurrentSteps[0].subscenes.EV1.steps).to.have.all.keys(0);

			assert.isArray(task.concurrentSteps[0].subscenes.EV1.steps[0].text);
			assert.strictEqual(task.concurrentSteps[0].subscenes.EV1.steps[0].text[0], 'Go Outside');

		});
	});
});

/**
 * Negative testing for Task
 */
describe('Task constructor - Negative Testing', function() {
	describe('No Title', () => {

		const yamlString = `
        duration: 00:25
        steps:
            - EV1:
                - step: "Go Outside"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should throw error if title doesn\'t exist', () => {

			expect(() => {
				const task = new Task(taskRequirementsDefinition);
				task.addTaskDefinition(fakeYamlObj);
			}).to.throw('Value undefined must be one of these types:\n  - string');

		});
	});

	describe('No Steps', () => {

		const yamlString = `
        title: Egress
        duration: 00:25
        `;
		var taskDefinition = YAML.safeLoad(yamlString);

		it('should throw error if steps don\'t exist', () => {

			expect(() => {
				const task = new Task(taskRequirementsDefinition);
				task.addTaskDefinition(taskDefinition);
			}).to.throw('Value undefined must be one of these types:\n  - array');

		});
	});
});
