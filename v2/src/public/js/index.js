//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.06.07 (MIT License)
//	Based on Futomi HATANO 2021.11.11 (MIT License)
//	Last updated: 2022.06.07
//////////////////////////////////////////////////////////////////////
'use strict'

window.__devtron = { require: require, process: process }

const { ipcRenderer } = require('electron');
const log = require('electron-log');


////////////////////////////////////////////////////////////////////////////////
// HTMLがロードされたら実行，とりあえずここに全部突っ込む
window.addEventListener('DOMContentLoaded', onLoad);


function onLoad() {
	console.log('## onLoad');

	// 接続・未接続の button 要素
	document.getElementById('connected').hidden = true;
	document.getElementById('disconnected').hidden = false;


	// URLを外部ブラウザで開く
	window.URLopen = function(url) {
		const {shell} = require('electron');
		shell.openExternal(url);
	}


	//////////////////////////////////////////////////////////////////
	// MainProcessからのメッセージ振り分け
	ipcRenderer.on('to-renderer', (event, arg) => {
		// console.dir(arg);
		let c = JSON.parse(arg);    // arg = {cmd, arg} の形式でくる

		switch (c.cmd) {
			case "omron": // omron情報、接続してる
			document.getElementById('connected').hidden = false;
			document.getElementById('disconnected').hidden = true;
			renewScreen( c.arg );
			break;

			case "omronDisconnected":  // 切断
			document.getElementById('connected').hidden = true;
			document.getElementById('disconnected').hidden = false;
			break;
		}
	});


	// 画面に反映
	let renewScreen = function ( arg ) {
		// document.getElementById('timestamp').textContent = arg.date;
		showTimestamp();
		document.getElementById('temperature').textContent = arg.temperature;
		document.getElementById('humidity').textContent = arg.humidity;
		document.getElementById('anbient_light').textContent = arg.anbient_light;
		document.getElementById('pressure').textContent = arg.pressure;
		document.getElementById('noise').textContent = arg.noise;
		document.getElementById('etvoc').textContent = arg.etvoc;
		document.getElementById('eco2').textContent = arg.eco2;
		document.getElementById('discomfort_index').textContent = arg.discomfort_index;
		document.getElementById('heat_stroke').textContent = arg.heat_stroke;

		// 不快指数の色分け
		let discomfort_index_color = '';
		let discomfort_index_desc = '';
		if (discomfort_index < 70) {
			discomfort_index_color = 'has-background-primary-light';
			discomfort_index_desc = '快い';
		} else if (discomfort_index < 75) {
			discomfort_index_color = 'has-background-success-light';
			discomfort_index_desc = '暑くない';
		} else if (discomfort_index < 80) {
			discomfort_index_color = 'has-background-warning-light';
			discomfort_index_desc = 'やや暑い';
		} else if (discomfort_index < 85) {
			discomfort_index_color = 'has-background-warning';
			discomfort_index_desc = '暑くて汗が出る';
		} else {
			discomfort_index_color = 'has-background-danger	';
			discomfort_index_desc = '暑くてたまらない';
		}
		const discomfort_index_cont_el = document.getElementById('discomfort_index_cont');
		for (let token_data of discomfort_index_cont_el.classList.entries()) {
			const token = token_data[1];
			if (token.startsWith('has-background-')) {
				if (token !== discomfort_index_color) {
					discomfort_index_cont_el.classList.remove(token);
				}
				break;
			}
		}
		discomfort_index_cont_el.classList.add(discomfort_index_color);

		const discomfort_index_desc_el = document.getElementById('discomfort_index_desc');
		discomfort_index_desc_el.textContent = discomfort_index_desc;

		// 熱中症警戒度の色分け
		let heat_stroke_color = '';
		let heat_stroke_desc = '';
		if (heat_stroke < 25) {
			heat_stroke_color = 'has-background-success-light';
			heat_stroke_desc = '注意';
		} else if (heat_stroke < 28) {
			heat_stroke_color = 'has-background-warning-light';
			heat_stroke_desc = '警戒';
		} else if (heat_stroke < 31) {
			heat_stroke_color = 'has-background-warning';
			heat_stroke_desc = '厳重警戒';
		} else {
			heat_stroke_color = 'has-background-danger	';
			heat_stroke_desc = '危険';
		}
		const heat_stroke_cont_el = document.getElementById('heat_stroke_cont');
		for (let token_data of heat_stroke_cont_el.classList.entries()) {
			const token = token_data[1];
			if (token.startsWith('has-background-')) {
				if (token !== heat_stroke_color) {
					heat_stroke_cont_el.classList.remove(token);
				}
				break;
			}
		}
		heat_stroke_cont_el.classList.add(heat_stroke_color);

		const heat_stroke_desc_el = document.getElementById('heat_stroke_desc');
		heat_stroke_desc_el.textContent = heat_stroke_desc;
	};

	let showTimestamp = function () {
		const dt = new Date();
		const time = [
			('0' + dt.getHours().toString()).slice(-2),
			('0' + dt.getMinutes().toString()).slice(-2),
			('0' + dt.getSeconds().toString()).slice(-2)
			].join(':');
		const el = document.getElementById('timestamp');
		el.textContent = time;
	};

	// この関数の最後に呼ぶ
	// 準備できたことをmainプロセスに伝える
	ipcRenderer.send('to-main', JSON.stringify({ cmd: "already" }));
};


