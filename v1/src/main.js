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
const appname  = 'HEMS-Logger';
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
const { sqlite3, elrawModel, eldataModel, esmdataModel, esmrawModel, huerawModel, arpModel, owmModel, netatmoModel, IOT_QuestionnaireAnswersModel, IOT_MajorResultsModel, IOT_MinorResultsModel, IOT_MinorkeyMeansModel, MinorkeyMeansValues } = require('./models/localDBModels');   // DBデータと連携
const { Op } = require("sequelize");
const mainArp     = require('./mainArp');     // arpの管理
const mainEL      = require('./mainEL');      // ELの管理
const mainESM     = require('./mainESM'); // スマートメータの管理
const mainHue     = require('./mainHue');     // hueの管理
// const mainIkea    = require('./mainIkea');    // Ikeaの管理
const mainNetatmo = require('./mainNetatmo'); // netatmoの管理
const mainOwm     = require('./mainOwm');     // open weather mapの管理
const mainHALlocal = require('./mainHALlocal');    // HAL，独立で動く部分
const mainHALsync  = require('./mainHALsync');    // HAL，連携する部分


// electronのmain window
let mainWindow = null;


// 管理しているデバイスやサービスのリストにユーザが名前を付けたい
// [{ type: '', id: '', ip: '', mac: '', alias, '' }]
let managedThings = [];

// 監視しているデバイスのリスト
// [{id:, obj, epc}]
let elObservedDevs = [];

// 管理しているデバイスやサービスのデータ詳細
let elData = {};
let arpTable = [];
let hueData = {};
let owmData = {};
let netatmoData = {};
// let ikeaData = {};
let halProfile = {};
let halData = {};


//////////////////////////////////////////////////////////////////////
// config

// configファイルがなければ作る，あれば読む
// デフォルトの値にmargeする
let config = {
	"height": "",
	"weight": "",
	"ellogExpireDays": 30,
	"resultExpireDays": 365,
	"network": {
		"IPver": 0,
		"IPv4": "",
		"IPv6": ""
	},
	"hueKey": "",
	"owmAPIKey": "",
	"zipCode": "",
	"netatmo": {
		"id": "",
		"secret": "",
		"username": "",
		"password": ""
	},
	"ESM": {
		"enable": 'false',
		"donglePass": '',
		"donglePassCandidates": [],
		"dongleType": '',
		"id":'',
		"password":'',
		"EPANDESC":{},
		"connected": false,
		"debug": false
	},
	"observationInterval": 0,
	"observationDevs": ''
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
	elData: {},
	elObservedDevs: [],
	arpTable: [],
	hueData: {},
	owmData: {},
	netatmoData: {},
	halProfile: {},
	halData: {}
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
	elObservedDevs = persist.elObservedDevs || [];
	arpTable    = persist.arpTable || [];
	hueData     = persist.hueData || {};
	owmData     = persist.owmData || {};
	netatmoData = persist.netatmoData || {};
	halProfile  = persist.halProfile || {};
	halData     = persist.halData || {};
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
// EL管理
let ELStart = function() {
	// mainEL初期設定
	mainEL.observationDevs = elObservedDevs;

	mainEL.start(config.network,
				 (rinfo, els, err) => {  // els received, 受信のたびに呼ばれる
					 // database
					 // 確認
					 let rawdata = mainEL.api.getSeparatedString_ELDATA(els);

					 mainEL.conv.elsAnarysis(els, function( eljson ) {
						 // console.log("----");
						 for (const [key, value] of Object.entries(eljson.EDT) )
						 {
							 eldataModel.create({ srcip: rinfo.address, srcmac:mainArp.toMAC(rinfo.address), seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
						 }
					 } );
					 elrawModel.create({ srcip: rinfo.address, srcmac:mainArp.toMAC(rinfo.address), dstip:localaddresses[0], dstmac:mainArp.toMAC(localaddresses[0]), rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });
				 },
				 (facilities) => {  // change facilities, 全体監視して変更があったときに全体データとして呼ばれる
					 elData = facilities;
					 elObservedDevs = mainEL.observationDevs;
					 mainEL.conv.refer( objectSort(facilities) , function (devs) {
						 sendIPCMessage( "fclEL", objectSort(devs) );
					 });
				 });
};


//////////////////////////////////////////////////////////////////////
// スマートメータ管理
let ESMStart = function() {
	if( config.ESM.enable == 'false' ) return;
	if( config.ESM.donglePass == '' ) return;

	console.log('-- ESMStart');
	console.dir( config.ESM.debug = true );

	mainESM.start( config.ESM,
				   ( sm, rinfo, els, err ) => {
					   if( err ) {
						   sendIPCMessage( "ERR", '' + err + '<br>スマートメータの設定をもう一度確認し、一度アプリを再起動してみてください。' );
						   return;
					   }
					   if( !els ) return;  // elsが入っていないときは処理しない

					   console.dir( els );
					   config.ESM.EPANDESC = mainESM.config.EPANDESC;  // 接続できたので接続情報を確保
					   config.ESM.connected = true;  // 接続できたフラグ

					   let rawdata = mainEL.api.getSeparatedString_ELDATA(els);
					   mainEL.conv.elsAnarysis(els, function( eljson ) {
						   for (const [key, value] of Object.entries(eljson.EDT) )
						   {
							   esmdataModel.create({ srcip: rinfo.address, seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
						   }
						   config.ESM.connected = true;
					   });
					   esmrawModel.create({ srcip: rinfo.address, rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });
				   },
				   (facilities) => {
					   mainEL.conv.refer( objectSort(facilities) , function (devs) {
						   // console.dir( objectSort(devs) );
						   sendIPCMessage( "fclESM", objectSort(devs) );
					   });
				   });

};

//////////////////////////////////////////////////////////////////////
// arp管理
let ArpStart = function () {
	if( config.owmAPIKey != '' ) {
		mainArp.start( (table) => {
			arpTable = table;
			arpModel.create({ detail: JSON.stringify(arpTable) });
		});
	}
};


//////////////////////////////////////////////////////////////////////
// hue管理

let HueStart = function () {
	// keyがあればHue利用開始，なければ実行しない。
	if( config.hueKey == undefined && config.hueKey == '' ) {
		console.log('-- Skipped, HueStart() key:', config.hueKey);
		return;
	}

	mainHue.start( config.hueKey, 3000,
				   (key) => {  // Linked callback
					   config.hueKey = key;
					   sendIPCMessage( "HueLinked", key );
				   },
				   (json) => {  // changed callback
					   if( json != '' ) {
						   hueData = JSON.parse(json);
						   sendIPCMessage( "fclHue", hueData );
						   huerawModel.create({ detail: json });
					   }
				   });
};


//////////////////////////////////////////////////////////////////////
// OpenWeatherMapの処理

let OwmStart = function () {
	if( config.owmAPIKey != '' ) {
		mainOwm.start( config.owmAPIKey, config.zipCode, (body) => {
			owmData = body;
			// console.log('owmData:', owmData);
			if( owmData != {} ) {
				sendIPCMessage( "newOwm", owmData );
				owmModel.create({ detail: JSON.stringify(owmData) }); // dbに入れる
			}

			sendIPCMessage( "newOwm", owmData );
			owmModel.create({ detail: JSON.stringify(owmData) });// dbに入れる
		});
	}
};


//////////////////////////////////////////////////////////////////////
// netatmo start

let NetatmoStart = function () {
	if( config.netatmo.id != '' && config.netatmo.secret != '' && config.netatmo.username != '' && config.netatmo.password != '') {// configがあればnetatmo利用開始，なければ実行しない。
		mainNetatmo.start( config.netatmo, (err, devices) => {
			if(err) {
				console.error(err);
				return;
			}

			netatmoData = devices;
			sendIPCMessage( "newNetatmo", netatmoData );
			netatmoModel.create({ detail: JSON.stringify(netatmoData) });// dbに入れる
		});
	}
};



//////////////////////////////////////////////////////////////////////
// ikea start
/*
let IkeaStart = function () {
	mainIkea.start( key, identity, psk, ( facilities ) => {
		if( mainWindow != null ) {
			if( mainWindow.webContents != null ) {
				sendIPCMessage( "fclIKEA", facilities  );
			}
		}
	} );
};
*/



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
		// EL操作
		case 'Search':
		mainEL.api.search();
		break;

		case 'Elsend':   // Rendererからの ECHONET Liteコントロール
		// 送信は自分のログも残しておく
		let datetime = new Date().toISOString();
		let rawdata = c.arg.sendmsg;
		let els = mainEL.api.parseString( c.arg.sendmsg );

		mainEL.conv.elsAnarysis(els, function( eljson ) {
			for (const [key, value] of Object.entries(eljson.EDT) )
			{
				eldataModel.create({ srcip: localaddresses[0], srcmac:mainArp.toMAC(localaddresses[0]), seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
			}
		});
		elrawModel.create({ srcip: localaddresses[0], srcmac:mainArp.toMAC(localaddresses[0]), dstip: c.arg.ip, dstmac:mainArp.toMAC(c.arg.ip), rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });
		mainEL.api.sendString( c.arg.ip, c.arg.sendmsg );
		break;


		//----------------------------------
		case 'ESMUse':   // スマートメータ利用開始
		console.log('esm start:', c.arg);
		// 他の設定もあるので config.ESM = c.arg への置き換えは不可
		config.ESM.enable = true;
		config.ESM.donglePass = c.arg.donglePass;
		config.ESM.dongleType = c.arg.dongleType;
		config.ESM.id = c.arg.id;
		config.ESM.password = c.arg.password;
		config.ESM.connected = false;  // 再設定のために，接続経験なしにする
		config.ESM.EPANDESC = {};  // 再設定のために，接続経験なしにする
		ESMStart();
		writeConfigFile();
		break;

		case 'ESMnotUse':   // スマートメータ利用停止
		config.ESM.enable = false;
		mainESM.release();
		writeConfigFile();
		break;

		//----------------------------------
		case 'Huesend':  // Hue関係のコントロール
		mainHue.api.setState( mainHue.api.bridge.ipaddress, c.arg.url, c.arg.json );
		break;

		//----------------------------------
		case 'HueUse':   // Hue利用開始
		console.log('hue start:', c.arg.key);
		HueStart();
		break;

		//----------------------------------
		case 'OwmUse':// OpenWeatherMap利用開始
		console.log('OpenWeatherMap start:', c.arg.owmAPIKey, 'zipCode:', c.arg.zipCode);
		config.owmAPIKey = c.arg.owmAPIKey;
		config.zipCode = c.arg.zipCode;
		OwmStart();
		break;

		//----------------------------------
		case 'NetatmoUse':// OpenWeatherMap利用開始
		console.log('Netatmo start:');
		console.dir(c.arg);
		config.netatmo = c.arg.netatmo;
		NetatmoStart();
		break;

		//----------------------------------
		case 'renewHAL':// 最新のHAL要求受付
		console.log('renewHAL:');
		halData = mainHALlocal.getLastData();
		sendIPCMessage( "renewHAL", halData );
		break;

		case "submitQuestionnaire": // HALアンケートが来た
		console.log('submitQuestionnaire:');
		mainHALlocal.submitQuestionnaire(c.arg,
										 () => { sendIPCMessage( 'INF', 'アンケートを保存しました。' ); },
										 () => { sendIPCMessage( 'INF', 'Error: ' + error.message    ); });
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

		//----------------------------------
		// 同期開始
		case 'Sync':
		console.log('Sync start:');
		mainHALsync.startSync( (result) => {
			sendIPCMessage( "Synced", result );
		});
		break;

		//----------------------------------
		// ローカルの HAL API トークン取得
		case 'getHalApiTokenRequest':
		console.log('getHalApiTokenRequest start:');
		sendIPCMessage( "getHalApiTokenResponse", mainHALsync.halApiToken );
		break;

		//----------------------------------
		// HAL API トークン設定
		case 'setHalApiTokenRequest':
		console.log('setHalApiTokenRequest start:');
		mainHALsync.setHalApiTokenRequest( c.arg, (result) => {
			sendIPCMessage( "setHalApiTokenResponse", result );
		});
		break;

		//----------------------------------
		// HAL API トークン設定削除
		case 'deleteHalApiToken':
		console.log('deleteHalApiToken:');
		mainHALsync.deleteHalApiToken( () => {
			sendIPCMessage( "deleteHalApiTokenResponse", null );
			halProfile = mainHALsync.halProfile;
		});
		break;


		//----------------------------------
		// HAL ユーザープロファイル取得
		case 'getHalUserProfileRequest':
		console.log('getHalUserProfileRequest start:');
		mainHALsync.getHalUserProfileRequest( (result) => {
			sendIPCMessage( "getHalUserProfileResponse", result );
			halProfile = mainHALsync.halProfile;
		});
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
