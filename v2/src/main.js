//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//  Last updated: 2021.09.25
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const path = require('path');
const os = require('os');
const fs = require('fs');



//////////////////////////////////////////////////////////////////////
// 基本設定，electronのファイル読み込み対策，developmentで変更できるようにした（けどつかってない）
const appname  = 'OmronEnvStore';
const appDir   = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
const isWin    = process.platform == "win32" ? true : false;
const isMac    = process.platform == "darwin" ? true : false;
const userHome = process.env[ isWin ? "USERPROFILE" : "HOME"];
const isDevelopment = process.env.NODE_ENV == 'development'


//////////////////////////////////////////////////////////////////////
// 追加ライブラリ
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const Store = require('electron-store');
const { sqlite3, omronModel } = require('./models/localDBModels');   // DBデータと連携
const { Op } = require("sequelize");

const omron = require('usb-2jcie-bu');
const cron = require('node-cron');
require('date-utils');


// electron設定とmain window
app.disableHardwareAcceleration();
let mainWindow = null;


//////////////////////////////////////////////////////////////////////
// config
// configファイルのデフォルトの値、schemaによるdefaults optionはうまく動かない
/*
const configSchema = {
	omron: {
		comPort: {
			type: 'string',
			default: "auto"
		},
		ledColor: {
			type: 'string',
			default: "green"
		},
	}
	window: {
		width: {
			type: 'number',
			default: 1024
		},
		height: {
			type: 'number',
			default: 768
		}
	}
};
*/

const config = {
	omron: {
		comPort: "auto",
		ledColor: "green"
	},
	window: {
		width: 1024,
		height: 768
	}
};

// const store = new Store({configSchema});
const store = new Store();

function readConfigFile() {
	config.omron = store.get( 'omron', config.omron);
	config.window = store.get( 'window', config.window);
	console.log(config);
}

function writeConfigFile() {
	store.set( 'omron', config.omron );
	store.set( 'window.width', mainWindow.getSize()[0]);
	store.set( 'window.height', mainWindow.getSize()[1]);
};



//////////////////////////////////////////////////////////////////////
// Omron管理
let omronStart = function () {
	// 2秒毎にチェック
	cron.schedule('*/2 * * * * *', () => {
		omron.start(  (sensorData, error) => {
			if( error ) {
				if( error == 'INF: port is closed.' ) {
					sendIPCMessage( 'omronDisconnected', null );
				}
				// console.error( error );
				return;
			}
			// console.log( '----------------------------' );
			let dt = new Date();
			// console.log( dt );
			// console.dir( sensorData );
			sendIPCMessage( 'omron', sensorData );
			omronModel.create( {date: dt, temperature: sensorData.temperature, humidity: sensorData.humidity,
				anbient_light: sensorData.anbient_light, pressure: sensorData.pressure, noise: sensorData.noise,
				etvoc: sensorData.etvoc, eco2: sensorData.eco2, discomfort_index: sensorData.discomfort_index,
				heat_stroke: sensorData.heat_stroke} );
		});

		omron.requestData();
	});
};



//////////////////////////////////////////////////////////////////////
// Communication for Electron's Renderer process
//////////////////////////////////////////////////////////////////////
// IPC 受信から非同期で実行
ipcMain.on('to-main', function (event, arg) {
	// メッセージが来たとき
	console.log('---  sended from Renderer.');
	console.log(arg);

	let c = JSON.parse(arg);

	switch (c.cmd) {
		//----------------------------------
		// 設定保存
		case 'configSave':
		console.log('configSave start:');
		writeConfigFile();
		break;

		default:
		console.log("## get error cmd : " + arg);
		break;
	}
});


ipcMain.handle( 'already', async (event, arg) => {
	console.log('already', arg);
	omronStart();
});


//////////////////////////////////////////////////////////////////////
// foreground
// ここがEntrypointと考えても良い
async function createWindow() {
	// 何はともあれDBの準備，SQLite の初期化の完了を待つ
	await sqlite3.sync().then(() => console.log("Local DB is ready."));

	// 画面の起動
	mainWindow = new BrowserWindow({
		width: store.get('window.width'),
		height: store.get('window.height'),
		webPreferences: {
			nodeIntegration: false, // default:false
			contextIsolation: true, // default:true
			worldSafeExecuteJavaScript: true,
			preload: path.join(__dirname, 'preload.js')
		}
	});
	menuInitialize();
	mainWindow.loadURL( path.join(__dirname, 'public', 'index.htm') );

	if (isDevelopment) { // 開発モードならDebugGUIひらく
		mainWindow.webContents.openDevTools()
	}


	// window closeする処理にひっかけて直前処理
	mainWindow.on('close', async () => {
		console.log('# close');
		await writeConfigFile();
	});

	// window closeした後にひっかけて直後処理
	mainWindow.on('closed', async () => {
		console.log( '# closed' );
		mainWindow = null;
	});
};

app.on('ready', async () => {
	console.log('# ready');
	await readConfigFile();
	createWindow();
});

// アプリケーションがアクティブになった時の処理
// （Macだと、Dockがクリックされた時）
app.on("activate", () => {
	console.log('# activate');
	// メインウィンドウが消えている場合は再度メインウィンドウを作成する
	if (mainWindow === null) {
		createWindow();
	}
});

// window全部閉じたらappも終了する
app.on('window-all-closed', async () => {
	console.log('# window-all-close');
	app.quit();	// macだろうとプロセスはkillしちゃう
});

// menu
const menuItems = [{
	label: appname,
	submenu: [
		{
			label: 'Preferences...',
			click: function () { shell.showItemInFolder( app.getPath('userData') ); }
			// click: function () { store.openInEditor(); }
		},
		{
			label: 'Open Config.json',
			accelerator: isMac ? 'Command+,' : 'Control+,',
			click: async function () { await writeConfigFile(); store.openInEditor(); }
		},
		{
			label: 'Quit',
			accelerator: isMac ? 'Command+Q' : 'Alt+F4',
			click: function () { app.quit(); }
		}]
}, {
	label: 'View',
	submenu: [
		{
			label: 'Reload',
			accelerator: isMac ? 'Command+R' : 'Control+R',
			click(item, focusedWindow) {
				if (focusedWindow) focusedWindow.reload()
			}
		},
		{
			label: 'Toggle Full Screen',
			accelerator: isMac ? 'Ctrl+Command+F' : 'F11',
			click: function () { mainWindow.setFullScreen(!mainWindow.isFullScreen()); }
		},
		{
			label: 'Toggle Developer Tools',
			accelerator: isMac ? 'Ctrl+Command+I' : 'Control+Shift+I',
			click: function () { mainWindow.toggleDevTools(); }
		}
		]
}];


function menuInitialize() {
	let menu = Menu.buildFromTemplate(menuItems);
	Menu.setApplicationMenu(menu);
	mainWindow.setMenu(menu);
}


// IPC通信の定式
let sendIPCMessage = function( cmdStr, argStr ) {
	if( mainWindow != null && mainWindow.webContents != null ) {
		mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: cmdStr, arg: argStr} ) );
	}
};


//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
