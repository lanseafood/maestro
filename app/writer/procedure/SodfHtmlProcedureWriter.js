'use strict';

const path = require('path');
const fs = require('fs');

const nunjucks = require('../../model/nunjucksEnvironment');
const consoleHelper = require('../../helpers/consoleHelper');

const ProcedureWriter = require('./ProcedureWriter');
const SodfHtmlTaskWriter = require('../task/SodfHtmlTaskWriter');

module.exports = class SodfHtmlProcedureWriter extends ProcedureWriter {

	constructor(program, procedure) {
		super(program, procedure);

		// these two are copied from HtmlProcedureWriter
		this.getDocMeta();
		this.content = '';

		this.lastActor = false;
		this.lastLocation = false;
	}

	renderIntro() {
		this.content += 'Insert objectives, tools, parts, materials...';
	}

	wrapDocument() {
		return nunjucks.render('sodf/document.html', {
			title: this.program.fullName,
			content: this.content,
			footer: this.genFooter()
		});
	}

	genHeader(task) {
		return nunjucks.render('sodf/task-header.html', {
			procedureName: this.procedure.name,
			taskTitle: task.title,
			duration: this.getTaskDurationDisplay(task)
		});
	}

	// ! FIXME? This is a direct copy from HtmlProcedureWriter
	writeFile(filepath) {
		const relativeFilepath = path.relative(process.cwd(), filepath);
		fs.writeFileSync(filepath, this.wrapDocument());
		consoleHelper.success(`SUCCESS: ${relativeFilepath} written!`);
	}

	genFooter() {
		return nunjucks.render('sodf/procedure-footer.html', {
			programName: this.program.fullName,
			programURL: this.program.repoURL,
			procedureName: this.procedure.name,
			gitDate: this.program.getGitDate(),
			gitHash: this.program.getGitHash(),
			gitUncommitted: this.program.getGitUncommittedChanges()
		});
	}

	renderTask(task) {

		const taskWriter = new SodfHtmlTaskWriter(
			task,
			this
		);

		this.content += this.genHeader(task);
		this.content += '<table class="gridtable">';
		this.content += taskWriter.writeDivisions().join('');
		this.content += '</table>';
	}

};
