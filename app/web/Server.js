'use strict';

const path = require('path');
const fs = require('fs');

const express = require('express');
const nunjucks = require('../model/nunjucksEnvironment');

const consoleHelper = require('../helpers/consoleHelper');

module.exports = class Server {

	constructor(program) {

		this.program = program;
		this.procedureFiles = program.getProjectProcedureFiles();

		this.app = express();
		this.port = 8000;

		this.staticResources = [
			// Serve project resources
			{ webPath: 'images', localBase: program.projectPath, localRelative: 'images' },
			{ webPath: 'procedures', localBase: program.projectPath, localRelative: 'procedures' },
			{ webPath: 'tasks', localBase: program.projectPath, localRelative: 'tasks' },

			// Serve application resources
			{ webPath: 'maestro', localBase: __dirname, localRelative: '../../build' },
			{
				webPath: 'maestro-views',
				localBase: __dirname,
				localRelative: '../writer/nunjucks-templates'
			},
			{ webPath: '', localBase: __dirname, localRelative: '../../build' }
		];

		this.app.use(express.json());
	}

	setPort(newPort) {
		newPort = parseInt(newPort);
		if (!newPort || newPort < 1025) {
			const tooSmall = newPort < 1025 ?
				'\n  Please pick an integer over 1024' :
				'';
			const recommend = '\n  Recommended options: 3000, 8000, 8080, 9000';
			consoleHelper.error(`port ${newPort} is invalid.${tooSmall}${recommend}`);
		}
		this.port = newPort;
		return this;
	}

	setupStatic() {
		for (const resource of this.staticResources) {
			this.app.use(
				`/${resource.webPath}`,
				express.static(path.join(
					resource.localBase,
					resource.localRelative
				))
			);
		}
		return this;
	}

	handleFileUpdates = (req, res) => {
		switch (req.params) {
			case 'tasks':

				break;
			case 'procedures':

				break;
			default:
				break;
		}

		if (['tasks', 'procedures'].indexOf(req.params.filetype) === -1) {
			throw new Error('file type editing can only be performed on tasks and procedures');
		}

		if (req.params.filename.indexOf('..') !== -1) {
			throw new Error('file names cannot move up a directory by including ..');
		}

		const filepath = path.join(
			this.program.projectPath,
			req.params.filetype,
			req.params.filename
		);

		console.log(`saving new content to ${filepath}`);
		// console.log(req.body);

		fs.writeFile(filepath, req.body.yaml, (err) => {
			if (err) {
				console.log(err);
				res.send({ success: false, msg: 'error writing file' });
			} else {
				res.send({ success: true, msg: 'file written' });
			}
		});
	}

	serve() {
		this.app.get('/', (req, res) => {
			// res.sendFile(this.baseHtmlFile);
			res.send(nunjucks.render('maestro-conduct.html', {
				title: 'Maestro',
				procedureFiles: this.procedureFiles
			}));
		});

		this.app.listen(this.port, () => {
			consoleHelper.success(
				`Visit http://localhost:${this.port} in your web browser. Type ctrl-c here to exit`
			);
		});
	}
};
