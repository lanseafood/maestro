/**
 * High-level functions for eva-tasklist
 */

'use strict';

const program = require('commander');
const path = require('path');
const fs = require('fs');
const pjson = require('./package.json');

const ver = require('./app/helpers/versionHelper');
const consoleHelper = require('./app/helpers/consoleHelper');

const Procedure = require('./app/model/Procedure');
const EvaDocxProcedureWriter = require('./app/writer/procedure/EvaDocxProcedureWriter');
const SodfDocxProcedureWriter = require('./app/writer/procedure/SodfDocxProcedureWriter');
const EvaHtmlProcedureWriter = require('./app/writer/procedure/EvaHtmlProcedureWriter');

function increaseVerbosity(dummyValue, previous) {
	return previous + 1;
}

function pathMustExist(path, createIfMissing = false) {
	try {
		fs.statSync(path);
	} catch (e) {
		if (createIfMissing) {
			fs.mkdirSync(path); // catch here, too?
		} else {
			console.error(`Path ${path} does not exist`);
			process.exit();
		}
	}
	return true;
}

/**
 * Tests whether the specified path can be written to by this process
 *
 * @param   {string} pathToTest The path to test
 * @return  {boolean} True if path can be written to, false otherwise
 */
function canWrite(pathToTest) {

	//  Check whether the path exists
	if (!fs.existsSync(pathToTest)) {
		//  File doesn't exist - check permissions for the parent dir
		const p = path.parse(pathToTest);
		let dir = p.dir;

		if (dir === '') {
			dir = '.';
		}

		pathToTest = dir;
	}

	//  Test permissions
	try {
		fs.accessSync(pathToTest, fs.constants.W_OK);
		//  Yes
		return true;
	} catch (err) {
		//  No
		return false;
	}
}

/**
 * Validates the arguments...
 *
 * @param   {*} program   TBD
 */
function validateProgramArguments(program) {

	program.procedurePath = path.join(program.projectPath, 'procedures');
	program.tasksPath = path.join(program.projectPath, 'tasks');
	program.imagesPath = path.join(program.projectPath, 'images');
	program.outputPath = path.join(program.projectPath, 'build');
	program.gitPath = path.join(program.projectPath, '.git');

	pathMustExist(program.procedurePath);
	pathMustExist(program.tasksPath);

	// at this point tasks and procedures paths exist. Reasonably certain this
	// is an xOPS project. Allow forcing creation of outputPath with `true`.
	pathMustExist(program.outputPath, true);

	//  If this process can't write to the output location, emit an error and quit
	if (!canWrite(program.outputPath)) {
		console.error(`Can't write to output location: ${program.outputPath}`);
		process.exit();
	}

}

function doCompose() {
	fs.readdir(program.procedurePath, function(err, files) {
		if (err) {
			console.log(`Unable to scan procedures directory: ${err}`);
			process.exit();
		}
		files.forEach(function(file) {
			console.log(`Generating procedure from ${file}`);

			const procedureFile = path.join(program.procedurePath, file);

			// Parse the input file
			const procedure = new Procedure();
			const err = procedure.populateFromFile(procedureFile);

			// Check if an error occurred
			if (err) {
				consoleHelper.noExitError(`Error while processing procedure ${file}: ${err}`);
				if (err.validationErrors) {
					consoleHelper.noExitError('Validation Errors:');
					consoleHelper.noExitError(err.validationErrors);
				}
				return;
			}

			console.logIfVerbose(program, 2, 4);
			console.logIfVerbose(procedure, 1, 3);

			if (program.evaDocx) {
				console.log('Creating EVA format');
				const eva = new EvaDocxProcedureWriter(program, procedure);

				eva.renderIntro(function() {
					eva.renderTasks();
					eva.writeFile(path.join(
						program.outputPath,
						`${procedure.filename}.docx`
					));
				});
			}

			if (program.sodf) {
				console.log('Creating SODF format');
				const sodf = new SodfDocxProcedureWriter(program, procedure);
				sodf.renderTasks();
				sodf.writeFile(path.join(
					program.outputPath,
					`${procedure.filename}.sodf.docx`
				));
			}

			if (program.html) {
				console.log('Creating EVA HTML format');
				const evaHtml = new EvaHtmlProcedureWriter(program, procedure);
				evaHtml.renderIntro();
				evaHtml.renderTasks();
				evaHtml.writeFile(path.join(
					program.outputPath,
					`${procedure.filename}.eva.html`
				));
			}

			if (program.ipv) {
				console.log('Creating IPV XML format');
				const ipvXml = new IpvXMLProcedureWriter(program, procedure);
				ipvXml.renderIntro();
				ipvXml.renderTasks();
				ipvXml.writeFile(path.join(
					program.outputPath,
					`${procedure.filename}.ipv.xml`
				));
			}

		});
	});
}

/**
 * This function configures commander.js for this application's command line
 * arguments, and attemps to parse the arguments passed to this process.
 *
 * @param   {*} program     A commander.js object for this function to use
 * @param   {*} args        Command line argument array (e.g. process.argv)
 * @return  {*} TBD FIXME
 */
function buildProgramArguments(program, args) {

	program
		.version(ver.currentVersion, '--version')
		.name('maestro')
		.description(pjson.description)
		.option('-v, --verbose', 'Verbosity that can be increased from -v to -vvvv', increaseVerbosity, 0)
		.allowUnknownOption();

	console.logIfVerbose = function(msg, verbosityThreshold = 0, fullObjVerbosityThreshold = 4) {
		if (program.verbose >= verbosityThreshold) {
			if (program.verbose >= fullObjVerbosityThreshold) {
				msg = JSON.stringify(msg, null, 4);
			}
			console.log('');
			console.log(msg);
		}
	};

	const handleProjectPath = function(projectPath) {
		if (projectPath) {
			return path.resolve(projectPath);
		}
		return process.cwd();
	};

	program
		.command('compose [projectPath]')
		.description('Build products for a Maestro project')
		.option('-t, --template <.html>', 'specify a template to use')
		.option('--html', 'Generate HTML file', null)
		.option('--sodf', 'Generate SODF style procedure', null)
		.option('--ipv', 'Generate IPV XML style procedure', null)

		// note: this will generate an options.evaDocx property, not noEvaDocx
		.option('--no-eva-docx', 'Don\'t generate the default EVA DOCX file', null)
		.option('-c, --css <.css>', 'CSS to append to generated HTML', null)
		.action(function(projectPath, options) {
			console.logIfVerbose(options, 3);
			program.projectPath = handleProjectPath(projectPath);

			program.sodf = options.sodf;
			program.html = options.html;
			program.evaDocx = options.evaDocx;
			program.template = options.template || path.join(
				__dirname, 'templates', 'spacewalk.njk'
			);
			validateProgramArguments(program);
			doCompose();
		});

	program
		.command('conduct [projectPath]')
		.description('Serve Maestro web app')
		.option('-p, --port <num>', 'specify port on which to serve', 8000)
		.action(function(projectPath, options) {
			program.projectPath = handleProjectPath(projectPath);
			program.port = parseInt(options.port);
			if (!program.port || program.port < 1025) {
				const tooSmall = program.port < 1025 ? '\n  Please pick an integer over 1024' : '';
				const recommend = '\n  Recommended options: 3000, 8000, 8080, 9000';
				consoleHelper.error(`port ${program.port} is invalid.${tooSmall}${recommend}`);
			}
			validateProgramArguments(program);

			const express = require('express');
			const app = express();
			app.use(express.static('build'));

			const htmlFiles = fs.readdirSync(program.outputPath).filter((filename) => {
				return filename.endsWith('.html');
			});
			if (htmlFiles.length === 0) {
				consoleHelper.noExitError('No HTML files found in /build directory. Try running `maestro compose --html` first');
				process.exit();
			} else if (htmlFiles.length > 1) {
				consoleHelper.warn(`Multiple HTML files found in /build directory\nBeing lazy and using first one: ${htmlFiles[0]}`);
			}
			const htmlFile = path.join(program.outputPath, htmlFiles[0]);

			app.get('/', (req, res) => {
				res.sendFile(htmlFile);
			});

			app.listen(program.port, () => {
				consoleHelper.success(
					`Visit http://localhost:${program.port} in your web browser. Type ctrl-c here to exit`
				);
			});
		});

	//  Commander.js does an unhelpful thing if there are invalid options;
	//  Override the default behavior to do a more helpful thing.
	program.unknownOption = function() {
		//  An invalid option has been received. Print usage and exit.
		program.help();
	};

	try {
		program.parse(args);
	} catch (e) {
		if (e instanceof TypeError) {
			//  Commander.js will annoyingly throw a TypeError if an argument
			//  that requires a parameter is missing its parameter.
			program.help();
			console.log('\n');
			console.error(e);
		} else {
			throw e;
		}
	}

	return program;
}

module.exports = {

	/**
	 * Surrogate program entry point
	 *
	 * @param   {*} args Command line arguments
	 */
	run: function(args) {
		program.fullName = `Maestro v${pjson.version}`;
		program.repoURL = pjson.repository.url;

		console.log(`${program.fullName}\n`);

		// Use Commander to process command line arguments
		buildProgramArguments(program, args);
	},
	buildProgramArguments: buildProgramArguments,
	validateProgramArguments: validateProgramArguments
};
