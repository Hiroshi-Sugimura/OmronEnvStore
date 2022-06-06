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

const configDir   = path.join(userHome, appname);
const configFile  = path.join(configDir, 'config.json');
const persistFile = path.join(configDir, 'persist.json');

process.env["NODE_CONFIG_DIR"] = configDir; // コンフィグファイル置き場

//////////////////////////////////////////////////////////////////////
// 追加ライブラリ
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const { sqlite3 } = require('./models/localDBModels');   // DBデータと連携
const { Op } = require("sequelize");

const omron = require('usb-2jcie-bu');
const cron = require('node-cron');
require('date-utils');


// electronのmain window
let mainWindow = null;


//////////////////////////////////////////////////////////////////////
// config

// configファイルがなければ作る，あれば読む
// デフォルトの値にmargeする
let config = {
};


// 設定ファイルを読む
let readConfigFile = function () {
	// フォルダがなければ作る
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir);
	}
	try {
		let f = fs.readFileSync(configFile, 'utf8');
		Object.assign(config, JSON.parse(f));
	} catch (e) {
		// file not exists or file is empty
		fs.writeFile(configFile, '', (err) => {
			if (err) throw err;
			// console.log('正常に書き込みが完了しました');
		});
	}

	// network config
	if (config.network) {  // ネットワーク設定の指定あり
		if (config.network.IPver !== 0 || config.network.IPver !== 4 || config.network.IPver !== 6) {
			config.network.IPver = 0;
		}
	}
};

// 起動時に一回readしておく
readConfigFile();

// write config
let writeConfigFile = function () {
	fs.writeFile(configFile, JSON.stringify(config), (err) => {
		if (err) throw err;

		// console.log('正常に書き込みが完了しました');
		sendIPCMessage( "configSaved", '' );  // 保存したので画面に通知
	});
};


let interfaces = os.networkInterfaces();
let localaddresses = [];
for (let k in interfaces) {
	for (let k2 in interfaces[k]) {
		let address = interfaces[k][k2];
		if (address.family == 'IPv4' && !address.internal) {
			localaddresses.push(address.address);
		}
	}
};

console.log('ipver:', config.network.IPver, 'ipv4:', config.network.IPv4, 'ipv6:', config.network.IPv6 );


//////////////////////////////////////////////////////////////////////
// 終了時の状態の保存

// デフォルトの値にmargeする
let persist = {

};

// 終了時の状態の保存
let savePersistFile = function () {
	persist.elData = elData;
	persist.elObservedDevs = elObservedDevs;
	persist.arpTable = arpTable;
	persist.hueData = hueData;
	persist.owmData = owmData;
	persist.netatmoData = netatmoData;
	persist.halProfile = halProfile;
	persist.halData = halData;

	fs.writeFile( persistFile, JSON.stringify(persist), (err) => {
		if (err) throw err;
		// console.log('正常に書き込みが完了しました');
	});
};

// 終了時の状態の復元
let loadPersistFile = function () {
	// フォルダがなければ作る
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir);
	}
	try{
		let f = fs.readFileSync( persistFile, 'utf8');
		Object.assign(persist, JSON.parse( f ) );
	}catch( e ) {
		// file not exists or file is empty
		fs.writeFile( persistFile, '', (err) => {
			if (err) throw err;
			// console.log('正常に書き込みが完了しました');
		});
	}
	elData      = persist.elData || {};
};

// 起動時に一回readしておく
loadPersistFile();

// スマートメータのためにポートリストも取っておく
( async () => {
	config.ESM.donglePassCandidates = [];
	let ports = await mainESM.renewPortList();
	ports.forEach( (p)=>{
		config.ESM.donglePassCandidates.push(p.path);
	});
})();


//////////////////////////////////////////////////////////////////////
// local function
//////////////////////////////////////////////////////////////////////
// キーでソートしてからJSONにする
// 単純にJSONで比較するとオブジェクトの格納順序の違いだけで比較結果がイコールにならない
let objectSort = function (obj) {
	let keys = Object.keys(obj).sort();
	let map = {};
	keys.forEach(function(key){
		map[key] = obj[key];
	});

	return map;
};

// 現在時刻
function getNow() {
	let now = new Date();

	// 日付
	let date = [
		now.getFullYear().toString(),
		('0' + (now.getMonth() + 1)).slice(-2),
		('0' + now.getDate()).slice(-2)
		].join('-');

	// 時刻
	let time = [
		('0' + now.getHours()).slice(-2),
		('0' + now.getMinutes()).slice(-2),
		('0' + now.getSeconds()).slice(-2)
		].join(':');

	return date + ' ' + time;
}

// 今日の日付 ("YYYY-MM-DD")
let getToday = function() {
	let now = new Date();
	let today = [
		now.getFullYear().toString(),
		('0' + (now.getMonth() + 1)).slice(-2),
		('0' + now.getDate()).slice(-2)
		].join('-');
	return today;
};



//////////////////////////////////////////////////////////////////////
// Omron管理
omron.start(  (sensorData) => {
	console.log( '----------------------------' );
	let dt = new Date();
	console.log( dt );
	console.dir( sensorData );
});


// 2秒毎にチェック
cron.schedule('*/2 * * * * *', () => {
	omron.requestData();
});



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
		case "already": // 準備出来たらRenderer更新して，INF，Reloadもこれがよばれる
		sendIPCMessage( "myIPaddr", localaddresses );
		console.dir(config);
		sendIPCMessage( 'config', config );

		mainEL.conv.refer( objectSort(elData) , function (devs) {
			sendIPCMessage( "fclEL", objectSort(devs) );
		});

		sendIPCMessage( "fclHue", hueData );
		sendIPCMessage( "newOwm", owmData );
		sendIPCMessage( "newNetatmo", netatmoData );
		sendIPCMessage( "renewHAL", halData );

		mainEL.api.sendOPC1( '224.0.23.0', [0x0e,0xf0,0x01], [0x0e,0xf0,0x01], 0x60, 0x80, [0x30]);// 立ち上がったのでONの宣言
		mainEL.api.search();
		break;

		//----------------------------------
		// 設定保存
		case 'configSave':
		console.log('configSave start:');
		config.height = c.arg.height;
		config.weight = c.arg.weight;
		config.ellogExpireDays = c.arg.ellogExpireDays;
		config.resultExpireDays = c.arg.resultExpireDays;
		writeConfigFile();
		break;

		default:
		console.log("## get error cmd : " + arg);
		break;
	}
});


//////////////////////////////////////////////////////////////////////
// foreground
// ここがEntrypointと考えても良い
async function createWindow() {
	// 何はともあれDBの準備，SQLite の初期化の完了を待つ
	await sqlite3.sync().then(() => console.log("Local lifelog DB is ready."));

	// HALのDBを準備して最終データを取得しておく
	mainHALlocal.initialize( config );
	halData = await mainHALlocal.getLastData();

	mainWindow = new BrowserWindow({
		width: 1024, height: 768,
		webPreferences: { nodeIntegration: false, worldSafeExecuteJavaScript: true, preload: path.join(__dirname, 'public', 'js', 'index.js') }
	});
	menuInitialize();
	mainWindow.loadURL('file://' + __dirname + '/public/index.htm');

	if (isDevelopment) { // 開発モードならDebugGUIひらく
		mainWindow.webContents.openDevTools()
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});


	// 定期的に機器情報を取得のため送信
	if (config) { // 設定ファイルがあれば読む
		if (config.observationInterval && config.observationInterval != 0) { // 監視設定があれば
			startObservationDevs(config.observationInterval);
		}
	}

	// 起動したので機能スタート
	ELStart();
	ArpStart();
	HueStart();
	OwmStart();
	NetatmoStart();
	// IkeaStart();
	ESMStart();

	// SQLite のデータベースのレコードの削除処理
	await mainHALlocal.truncatelogs();

	// 家電操作ログのアップロードを開始
	await mainHALsync.startUploadEldata();
};


app.on('ready', createWindow);

// アプリケーションがアクティブになった時の処理
// （Macだと、Dockがクリックされた時）
app.on("activate", () => {
	// メインウィンドウが消えている場合は再度メインウィンドウを作成する
	if (mainWindow === null) {
		createWindow();
	}
});

app.on('window-all-closed', () => {
	writeConfigFile();
	savePersistFile();
	mainEL.stopObservation();
	app.quit();	// macだろうとプロセスはkillしちゃう
});


// menu
const menuItems = [{
	label: appname,
	submenu: [
		{
			label: 'Preferences...',
			accelerator: isMac ? 'Command+,' : 'Control+,',
			click: function () { shell.showItemInFolder(configDir); }
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
