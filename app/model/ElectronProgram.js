'use strict';

const path = require('path');

const Program = require('./Program');
const Procedure = require('./Procedure');

module.exports = class ElectronProgram extends Program {

	constructor(reactAppComponent) {
		super();
		this.isElectron = true;
		this.reactAppComponent = reactAppComponent; // bind react App component to this
		this.reactAppComponent.setProgram(this); // bind this to react App component
	}

	loadProcedure(procedureFilepath) {
		console.log('running load program');
		const projectPath = path.dirname(path.dirname(procedureFilepath));
		this.setPathsFromProject(projectPath);

		this.procedure = new Procedure();
		this.procedure.addProcedureDefinitionFromFile(procedureFilepath);

		this.reactAppComponent.setProcedure(this.procedure);
	}

	getHtmlImagePath(filename) {

		// needed to retrieve local files from electron browser
		const pathParts = this.imagesPath
			.replace(/\\+/g, '/') // convert \ or \\ to / to make Windows consistent with *nix
			.split('/');

		// Take the first part off the front. On Windows this will be the drive, e.g. "C:". On *nix
		// it will be an empty string prior the first slash of an absolute path (""/my/abs/path)
		const first = pathParts.shift();

		pathParts.push(filename); // add file name to array to be url encoded

		// urlencode the segments individually
		const urlEncoded = pathParts.map((part) => {
			return encodeURIComponent(part);
		});

		// put the empty string or "C:" back on the front
		urlEncoded.unshift(first);

		return `file://${urlEncoded.join('/')}`;

	}

};
