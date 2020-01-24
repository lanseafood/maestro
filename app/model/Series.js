'use strict';

const Step = require('./Step');
const subscriptionHelper = require('../helpers/subscriptionHelper');

module.exports = class Series {

	constructor(steps) {
		this.subscriberFns = {
			reload: [],
			appendStep: [],
			deleteStep: []
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
		if (!(step instanceof Step)) {
			throw new Error('step must be instance of Step');
		}
		this.steps.push(step);
		subscriptionHelper.run(this.subscriberFns.appendStep, this);
	}

	deleteStep(stepIndex) {
		console.log(this);
		this.steps.splice(stepIndex, 1);
		subscriptionHelper.run(this.subscriberFns.deleteStep, this);
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
