'use strict';

const Step = require('./Step');
const subscriptionHelper = require('../helpers/subscriptionHelper');

module.exports = class Series {

	/**
	 *
	 * @param {Array} seriesActors - Array in form ['EV1'] for a single actor or
	 *                               ['EV1 + EV2', 'EV1', 'EV2'] for a joint actor Series.
	 * @param {Array} steps          Optional array of Step objects
	 */
	constructor(seriesActors, steps = []) {
		this.subscriberFns = {
			appendStep: [],
			deleteStep: [],
			insertStep: [],
			transferStep: []
		};
		this.seriesActors = seriesActors;
		this.doConstruct(steps);
	}

	doConstruct(steps = []) {
		this.steps = steps;
	}

	getDefinition() {
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
		this.steps.splice(insertIndex, 0, step);
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

			// step was previously in another series which had different actors. Reset.
			stepToTransfer.setActors(destinationSeries.seriesActors);

			// transferring step from this Series to another Series
			destinationSeries.insertStep(insertIndex + 1, stepToTransfer);

			console.log(this);
			console.log(destinationSeries);

		}

		// FIXME is this right name? or should this be registered as an deleteStep? Or both?
		subscriptionHelper.run(this.subscriberFns.transferStep, this);

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
