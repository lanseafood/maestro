'use strict';

const Step = require('./Step');
const subscriptionHelper = require('../helpers/subscriptionHelper');

module.exports = class Series {

	constructor(steps) {
		this.subscriberFns = {
			reload: [],
			appendStep: [],
			deleteStep: [],
			insertStep: [],
			transferStep: []
		};
		this.doConstruct(steps);
	}

	doConstruct(steps = []) {
		this.steps = steps;
	}

	getDefinition() {
		// FIXME remove
		// throw new Error('not available yet - below is extracted from ConcurrentStep but Concurrent Step is not yet updated');
		const def = [];
		for (const step of this.steps) {
			def.push(step.getDefinition());
		}
		return def;
	}

	// FIXME this is copied* directly from Step. Create "ReloadableModel" and make them extend it?
	// and that may be a better place than the subscriptionHelper.js file, except that maybe the
	// stateHandler logic needs it, too...?
	//
	// * copied, then refactored since Series has way more subscribable functions
	subscribe(subscriptionMethod, subscriberFn) {
		const unsubscribeFn = subscriptionHelper.subscribe(
			subscriberFn,
			this.subscriberFns[subscriptionMethod]
		);
		return unsubscribeFn;
	}

	reload(newSteps = []) {
		this.doConstruct(newSteps);
		subscriptionHelper.run(this.subscriberFns.reload, this);
	}

	/**
	 *
	 * @param {Step} step  Step model to push to this Series
	 */
	appendStep(step) {
		console.log('Series.appendStep');
		if (!(step instanceof Step)) {
			throw new Error('step must be instance of Step');
		}
		this.steps.push(step);
		subscriptionHelper.run(this.subscriberFns.appendStep, this);
	}

	deleteStep(stepIndex) {
		console.log('Series.deleteStep');
		this.steps.splice(stepIndex, 1);
		subscriptionHelper.run(this.subscriberFns.deleteStep, this);
	}

	insertStep(insertIndex, step) {
		console.log('Series.insertStep');
		console.log(this);
		this.steps.splice(insertIndex, 0, step);
		console.log(this);
		subscriptionHelper.run(this.subscriberFns.insertStep, this);
	}

	transferStep(removalIndex, destinationSeries, insertIndex) {
		console.log('Series.transferStep');
		const [stepToTransfer] = this.steps.splice(removalIndex, 1);

		// transferring step within this Series
		if (destinationSeries === this) {
			console.log('transferring step within series');
			const realInsertIndex = removalIndex < insertIndex ?
				insertIndex :
				insertIndex + 1;

			this.steps.splice(realInsertIndex, 0, stepToTransfer);

		} else {
			console.log('transferring step from one series to another');
			// transferring step from this Series to another Series
			destinationSeries.insertStep(insertIndex + 1, stepToTransfer);
		}

		// FIXME is this right name? or should this be registered as an deleteStep? Or both?
		subscriptionHelper.run(this.subscriberFns.transferStep, this);

	}

	moveStep(from, to) {

		const match = (prop) => (from[prop] === to[prop]);
		const newProc = this.state.procedure;

		const fromList = newProc
			.tasks[from.activityIndex]
			.concurrentSteps[from.divisionIndex]
			.subscenes[from.primaryColumnKey].steps;

		const toList = newProc
			.tasks[to.activityIndex]
			.concurrentSteps[to.divisionIndex]
			.subscenes[to.primaryColumnKey].steps;

		const [step] = fromList.splice(from.stepIndex, 1);

		if (match('activityIndex') && match('divisionIndex') && match('primaryColumnKey')) {
			// move step indices in array

			const insertIndex = from.stepIndex < to.stepIndex ?
				to.stepIndex :
				to.stepIndex + 1;

			toList.splice(insertIndex, 0, step);

		} else {
			// moving step from one array to another...

			// get the definition of the moving step
			// const stepDef = fromList[from.stepIndex].getDefinition();

			// delete from original location
			// fromList.splice(from.stepIndex, 1);

			// const newStep = toDivision.makeStep(to.primaryColumnKey, stepDef);

			toList.splice(to.stepIndex + 1, 0, step);

		}

		stateHandler.recordAndReportChange(newProc);

		stateHandler.saveChange(this.program, newProc, from.activityIndex);
		// saveChange(this.program, newProc, from.activityIndex);
		if (!match('activityIndex')) {
			stateHandler.saveChange(this.program, newProc, to.activityIndex);
			// saveChange(this.program, newProc, to.activityIndex);
		}

		this.setState({
			procedure: newProc
		});
	}

	/**
	 * Make a Step based upon the context of this concurrentStep
	 * @param {string}         actorIdGuess
	 * @param {Object|string}  stepDefinition
	 * @return {Step}          Resulting step object
	 */
	// FIXME should this be here rather than in ConcurrentStep ???
	// makeStep(actorIdGuess, stepDefinition) {
	// 	const actorInfo = getActorInfo(actorIdGuess, this.taskRoles);
	// 	return new Step(stepDefinition, actorInfo.idOrIds, this.taskRoles);
	// }

};
