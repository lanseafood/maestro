/* Specify environment to include mocha globals, and directly callout enzyme globals */
/* eslint-env node, mocha */
/* eslint-disable-next-line no-unused-vars */
/* global shallow render mount */

'use strict';

const React = require('react');
const assert = require('chai').assert;

const Header = require('./Header');

describe('Header Component', () => {

	// NOTE: This is a trivial test created when first starting to test React components
	it('renders the header with an H1', () => {
		const wrapper = shallow(<Header />);
		assert.lengthOf(wrapper.find('h1'), 1);
	});

});
