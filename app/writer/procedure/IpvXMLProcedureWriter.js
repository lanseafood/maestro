'use strict';

const path = require('path');

const HtmlProcedureWriter = require('./HtmlProcedureWriter');
const IpvXMLTaskWriter = require('../task/IpvXMLTaskWriter');

module.exports = class IpvXMLProcedureWriter extends HtmlProcedureWriter {

	constructor(program, procedure) {
		super(program, procedure);
	}

	// implement with CSS
	// getRightTabPosition() {}
	// getPageSize() {}
	// getPageMargins() {}

	renderIntro() {

		// const timeline = new TimelineWriter(this.procedure);
		// timeline.create();

		// const svgFilename = `${this.procedure.filename}.summary.timeline.svg`;
		// timeline.writeSVG(path.join(
		// 	this.program.outputPath,
		// 	svgFilename
		// ));

		this.content += `<h2>${this.procedure.name}</h2>`;

	}

	renderTask(task) {

		const taskWriter = new IpvXMLTaskWriter(
			task,
			this
		);

		this.content += this.genHeader(task);
		this.content += '<table class="gridtable">';
		this.content += taskWriter.setTaskTableHeader();
		this.content += taskWriter.writeDivisions().join('');
		this.content += '</table>';

		// this.genFooter() <-- not done in HTML like DOCX
	}

};
