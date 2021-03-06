/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;
const YAML = require('js-yaml');

const ConcurrentStep = require('./ConcurrentStep');
const TaskRole = require('./TaskRole');

const taskRoles = {
	crewA: new TaskRole(
		{
			name: 'crewA',
			description: 'Person who does XYZ',
			duration: { minutes: 20 }
		},
		{
			file: 'some-task.yml',
			roles: { crewA: 'EV1', crewB: 'EV2' },
			color: '#7FB3D5'
		}
	),
	crewB: new TaskRole(
		{
			name: 'crewB',
			description: 'Person who does ABC',
			duration: { minutes: 20 }
		},
		{
			file: 'some-task.yml',
			roles: { crewA: 'EV1', crewB: 'EV2' },
			color: '#7FB3D5'
		}
	)
};

/**
 * Positive testing for concurrentStep
 */
describe('ConcurrentStep constructor - Positive Testing', function() {
	describe('Normal Input - non-simo', () => {
		const yamlString = `
            EV1:
                - step: "Go Outside"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, taskRoles);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1).to.exist;
			expect(concurrentStep.subscenes.EV1).to.be.an('array');
			expect(concurrentStep.subscenes.EV1).to.have.all.keys(0);

			assert.isArray(concurrentStep.subscenes.EV1[0].text);
			assert.strictEqual(concurrentStep.subscenes.EV1[0].text[0], 'Go Outside');
		});
	});

	describe('Role-based Input - non-simo', () => {
		const yamlString = `
            crewA:
                - step: "Go Outside"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, taskRoles);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1).to.exist;
			expect(concurrentStep.subscenes.EV1).to.be.an('array');
			expect(concurrentStep.subscenes.EV1).to.have.all.keys(0);

			assert.isArray(concurrentStep.subscenes.EV1[0].text);
			assert.strictEqual(concurrentStep.subscenes.EV1[0].text[0], 'Go Outside');
		});
	});

	describe('Normal Input - simo', () => {
		const yamlString = `
            simo:
                EV1: "Go Outside"
                EV2:
                    - step: "Stay Inside"
                    - step: "Watch EV1"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, taskRoles);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1).to.exist;
			expect(concurrentStep.subscenes.EV1).to.be.an('array');
			expect(concurrentStep.subscenes.EV1).to.have.all.keys(0);
			assert.isArray(concurrentStep.subscenes.EV1[0].text);
			assert.strictEqual(concurrentStep.subscenes.EV1[0].text[0], 'Go Outside');

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV2).to.exist;
			expect(concurrentStep.subscenes.EV2).to.be.an('array');
			expect(concurrentStep.subscenes.EV2).to.have.all.keys(0, 1);

			assert.isArray(concurrentStep.subscenes.EV2[0].text);
			assert.strictEqual(concurrentStep.subscenes.EV2[0].text[0], 'Stay Inside');
			assert.isArray(concurrentStep.subscenes.EV2[1].text);
			assert.strictEqual(concurrentStep.subscenes.EV2[1].text[0], 'Watch EV1');
		});
	});

	describe('Role-based Input - simo', () => {
		const yamlString = `
            simo:
                crewA: "Go Outside"
                crewB:
                    - step: "Stay Inside"
                    - step: "Watch {{role:crewA}}"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, taskRoles);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1).to.exist;
			expect(concurrentStep.subscenes.EV1).to.be.an('array');
			expect(concurrentStep.subscenes.EV1).to.have.all.keys(0);
			assert.isArray(concurrentStep.subscenes.EV1[0].text);
			assert.strictEqual(concurrentStep.subscenes.EV1[0].text[0], 'Go Outside');

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV2).to.exist;
			expect(concurrentStep.subscenes.EV2).to.be.an('array');
			expect(concurrentStep.subscenes.EV2).to.have.all.keys(0, 1);
			assert.isArray(concurrentStep.subscenes.EV2[0].text);
			assert.strictEqual(concurrentStep.subscenes.EV2[0].text[0], 'Stay Inside');
			assert.isArray(concurrentStep.subscenes.EV2[1].text);
			assert.strictEqual(concurrentStep.subscenes.EV2[1].text[0], 'Watch EV1');
		});
	});
});
