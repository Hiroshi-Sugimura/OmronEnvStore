//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27.
//	Last updated: 2021.09.25
//	Entry Point
//	他，部品化しにくい，まだされていない関数など
//////////////////////////////////////////////////////////////////////
'use strict'

window.__devtron = { require: require, process: process }

const { ipcRenderer } = require('electron');
const log = require('electron-log');
const { exists } = require('original-fs');

////////////////////////////////////////////////////////////////////////////////
// HTMLがロードされたら実行，とりあえずここに全部突っ込む
window.addEventListener('DOMContentLoaded', onLoad);


function onLoad() {
	console.log('## onLoad');

	// タブ制御
	let configTab  = document.getElementById('config');

	// 内部変数
	let config;        // コンフィグファイルの内容
	let weather;       // 天気情報（OpenWeatherMap）
	let roomEnv;       // 宅内情報（netatmo）
	let halData;       // HALのデータ
	let halProfile;    // HALのプロファイル
	let facilitiesEL;   // デバイスリスト EL
	let facilitiesESM;  // スマメ情報
	let facilitiesHue;  // デバイスリスト Hue
	let controlELHTML = ''; // コントロールタブにだすELのテキスト
	let controlHueHTML = ''; // コントロールタブにだすHueのテキスト

	// HTML内部とリンク，タブ制御
	let divHALhome      = document.getElementById('divHALhome');  // HALタブ連携してる，homeとinfoでAltする
	let divHALhome_info = document.getElementById('divHALhome_info');  // HALタブ連携無し
	let divCtrl         = document.getElementById('divControl_content');	// control
	let divDetails      = document.getElementById('divDetails_content');	// details

	// toast
	let divToast        = document.getElementById('divToast');
	let toastMessages   = [];

	// TOP
	let divWeather = document.getElementById('divWeather');
	let divRoomEnv = document.getElementById('divRoomEnv');

	// Questionnaire
	let btnQuestionnaireSubmit = document.getElementById('btnQuestionnaireSubmit');

	// config
	let inHeight     = document.getElementById('inHeight');  // 身長
	let inWeight     = document.getElementById('inWeight');  // 体重
	let btnWeightSet = document.getElementById('btnWeightSet');  // 身長・体重のセット
	let divHALconfig       = document.getElementById('divHALconfig_content');  // HAL連携設定
	let inEllogExpireDays  = document.getElementById('inEllogExpireDays');
	let inResultExpireDays = document.getElementById('inResultExpireDays');
	let inIPv4 = document.getElementById('inIPv4');
	let inIPv6 = document.getElementById('inIPv6');
	let divobservationInterval = document.getElementById('divobservationInterval');
	let divobservationDevs     = document.getElementById('divobservationDevs');

	let inESMUse      = document.getElementById('inESMUse'); // electric smart meter
	let inDonglePass  = document.getElementById('inDonglePass');
	let selDonglePass = document.getElementById('selDonglePass');
	let inDongleType  = document.getElementById('inDongleType');
	let inESMId       = document.getElementById('inESMId');
	let inESMPassword = document.getElementById('inESMPassword');

	let huePushDialog = document.getElementById('huePushDialog');  // hue
	let inHueUse      = document.getElementById('inHueUse');
	let inHueKey      = document.getElementById('inHueKey');

	let configSaveBtn = document.getElementById('configSaveBtn');

	let owmHelpDialog        = document.getElementById('owmHelpDialog');
	let divWeatherConfigInfo = document.getElementById('divWeatherConfigInfo');  // open weather map
	let inOwmAPIKey          = document.getElementById('inOwmAPIKey');  // open weather map
	let inZipCode            = document.getElementById('inZipCode');

	let inNetatmoID   = document.getElementById('inNetatmoID');  // netatmo
	let inNetatmoSecret   = document.getElementById('inNetatmoSecret');
	let inNetatmoUsername = document.getElementById('inNetatmoUsername');
	let inNetatmoPassword = document.getElementById('inNetatmoPassword');

	// debug
	let myIPaddr = document.getElementById('myIPaddr');
	let toIP = document.getElementById('toIP');
	let eltestSEOJ = document.getElementById('eltestSEOJ');
	let eltestDEOJ = document.getElementById('eltestDEOJ');
	let eltestESV = document.getElementById('eltestESV');
	let eltestEPC = document.getElementById('eltestEPC');
	let eltestDETAILs = document.getElementById('eltestDETAILs');
	let elsend = document.getElementById('elsend');
	let multicastSearch = document.getElementById('multicastSearch');
	let txtELLog = document.getElementById('txtELLog');
	let txtHueLog = document.getElementById('txtHueLog');
	let txtErrLog = document.getElementById('txtErrLog');

	let syncBtn = document.getElementById('syncBtn');

	let getHalApiTokenCallback = () => { };
	let setHalApiTokenCallback = () => { };
	let getHalUserProfileCallback = () => { };


	//////////////////////////////////////////////////////////////////
	// MainProcessからのメッセージ振り分け
	ipcRenderer.on('to-renderer', (event, arg) => {
		// console.dir(arg);
		let c = JSON.parse(arg);    // arg = {cmd, arg} の形式でくる

		switch (c.cmd) {
			case "fclHAL": // HAL情報
			renewHALcontents( c.arg );
			break;

			case "fclEL":
			txtELLog.value = JSON.stringify(c.arg, null, '  ');
			facilitiesEL = c.arg; // 機器情報確保
			renewFacilitiesEL();
			renewFacilities();
			break;

			case "fclESM":
			txtELLog.value = JSON.stringify(c.arg, null, '  ');
			facilitiesESM = c.arg; // 機器情報確保
			console.dir( facilitiesESM );
			// renewFacilitiesEL();
			// renewFacilities();
			break;

			case "fclHue":
			txtHueLog.value = JSON.stringify(c.arg, null, '  ');
			facilitiesHue = c.arg; // 機器情報確保
			renewFacilitiesHue();
			renewFacilities();
			break;

			case "myIPaddr":
			myIPaddr.innerHTML = 'My IP address list: ' + c.arg;
			break;

			case "config":
			console.dir(c.arg);
			renewConfig(c.arg);
			break;

			case "configSaved": // 設定保存の応答
			if (c.arg.error) {
				alert(c.arg.error);
			}
			configSaveBtn.disabled = false;
			configSaveBtn.textContent = '保存';
			// window.alert('設定を保存しました。');
			addToast( 'INF', '設定を保存しました。');
			break;

			case "HueLinked": // HueとLinkできた
			huePushDialog.close();
			inHueKey.value = c.arg;
			break;

			case "newOwm": // OpenWeatherMapのデータをもらった
			console.dir( c.arg );
			weather = c.arg;
			renewWeather();
			break;

			case "newNetatmo": // Netatmoのデータをもらった
			console.dir( c.arg );
			roomEnv = c.arg;
			renewNetatmo();
			break;

			case "renewHAL": // HALのデータをもらった
			console.dir( c.arg );
			halData = c.arg;
			window.renewHAL( c.arg.MajorResults, c.arg.MinorResults, c.arg.MinorkeyMeans);
			break;

			case "Synced": // 同期処理終了
			if (c.arg.error) {
				alert(c.arg.error);
			}
			syncBtn.disabled = false;
			syncBtn.textContent = '同期開始';
			// 同期成功したなら最新のHALもらう
			ipcRenderer.send('to-main', JSON.stringify({ cmd: "renewHAL" }));
			break;

			case "getHalApiTokenResponse": // HAL API トークン取得の応答
			getHalApiTokenCallback(c.arg);
			break;

			case "setHalApiTokenResponse": // HAL API トークン設定の応答
			setHalApiTokenCallback(c.arg);
			break;

			case "deleteHalApiTokenResponse": // HAL API トークン設定削除の応答
			deleteHalApiTokenCallback();
			break;

			case "getHalUserProfileResponse": // HAL ユーザープロファイル取得の応答
			getHalUserProfileCallback(c.arg);
			break;

			case "INF":
			console.dir(c.arg);
			addToast( 'INF', c.arg );
			break;

			case "ERR":
			console.dir(c.arg);
			addToast( 'ERR', c.arg );
			break;

			default:
			txtErrLog.value = JSON.stringify(c, null, '  ');
			console.log('-- unknown cmd:', c.cmd);
			console.dir(c.arg);
			break;
		}
	});

	////////////////////////////////////////////////////////////////////////////////
	// mainからの情報で，htmlを変更する

	// トーストする文字列をキューイングする
	let addToast = function( type, message ) {
		let t = '';

		switch( type ) {
			case 'INF':
			t = '<section class="inf_toast"> <img src="./img/loadingRed.gif">' + message + '</section>';
			break;

			case 'ERR':
			t = '<section class="err_toast"> <img src="./img/loadingRed.gif">' + message + '</section>';
			break;
		}

		toastMessages.push(t);
		redrawToast();

		setTimeout( () => {
			toastMessages.pop();
			redrawToast();
		}, 3000);
	};

	// トーストは表示タイミングで位置合わせをする
	let redrawToast = function() {
		let disp = "";
		// console.dir( toastMessages );

		// 表示位置
		let dispTop = 100;
		toastMessages.forEach( (elem)=>{
			let t = '<div class="toast" style="top:' + dispTop + 'px">' + elem + '</div>';
			disp += t;
			dispTop += 150;
			// console.log( dispTop );
		});
		divToast.innerHTML = disp;
	};


	// OpenWeatherMap
	let renewWeather = function() {
		if( inOwmAPIKey.value == '' || weather == {} ) {
			divWeather.innerHTML = '<p><strong>ConfigからOpenWeatherMapの情報を入力すると表示されます。</strong><br>' +
				'<a href="#h2owmConfig" onclick="document.getElementById(\'configTab\').checked">設定はこちら</a>';
			return;
		}

		try{
			let weatherDoc;
			weatherDoc = "<p>" +
				"天気: " + weather.weather[0].main + "<br>" +
					"場所: " + weather.name + ", " + weather.sys.country + "<br>" +
						"気温: " + weather.main.temp + " (最高:" +weather.main.temp_max + ", 最低:" + weather.main.temp_min +")℃" + "<br>" +
							"気圧: " + weather.main.pressure + " hPa<br>" +
								"湿度: " +weather.main.humidity  + " %<br>" +
									"風:" +weather.wind.speed + " m/s<br>" +
										"風向:" +weather.wind.deg + " degree (北を0とし，風が吹いてくる方角を示す)<br>" +
											"雲量:" +weather.clouds.all + " %</p>";
			divWeather.innerHTML = weatherDoc;
			divWeatherConfigInfo.innerHTML = '';
		}catch(e) {
			// console.log('renewWeather()');
			addToast( 'Error', 'OpenWeatherMap連携エラー<br>' + weather.message );
			console.log(weather);
			console.dir(e);
			divWeather.innerHTML = '<p> <strong class="error">Error: 設定を認識しましたが通信に失敗しました。もう一度APIを設定しなおしてください。通信結果: ' + weather.message + '</strong> </p>';
			divWeatherConfigInfo.innerHTML = '<p> <strong class="error">Error: 設定を認識しましたが通信に失敗しました。もう一度APIを設定しなおしてください。</strong> </p>';
		}
	};

	let renewNetatmo = function() {
		if( roomEnv == {} ) {
			divRoomEnv.innerHTML = "ConfigからNetatmoの情報を入力すると表示されます。";
			return;
		}
		// console.dir( roomEnv );
		let roomEnvDoc;
		roomEnvDoc = "<p>" +
			"ステーション:" + roomEnv[0].station_name + "<br>" +
				"気圧:" + roomEnv[0].dashboard_data.AbsolutePressure + " mb (hPa)<br>" +
					"CO2:" + roomEnv[0].dashboard_data.CO2 + " ppm<br>" +
						"湿度:" + roomEnv[0].dashboard_data.Humidity + " %<br>" +
							"温度:" + roomEnv[0].dashboard_data.Temperature  + " ℃<br>" +
								"ノイズ:" + roomEnv[0].dashboard_data.Noise + " dB<br>";
		divRoomEnv.innerHTML = roomEnvDoc;
	}

	////////////////////////////////////////////////////////////////////////////////
	// HAL関係（HALタブとconfigタブのHAL連携部分）
	let renewHALcontents = function ( HALtoken ) {
		console.log( 'renewHALcontents(): HALtoken: ', HALtoken );

		if( HALtoken && HALtoken != 'null') {
			divHALhome_info.style.display = 'none';  // 連携してるので案内を非表示

			divHALconfig.innerHTML = ' \
			  <p><strong>連携設定完了しています。</strong><br> \
				HALと連携を解除するには登録解除ボタンを押してください。APIトークンは削除されますが、再度HALにログインして、Profileメニューから確認できます。<br> \
				<input type="password" id="halApiToken" style="width:100%;"></p> \
				<p><button type="button" id="deleteHalApiTokenBtn">登録解除</button></p> \
			  </form>';

			let deleteHalApiTokenBtn = document.getElementById('deleteHalApiTokenBtn');

			// HAL API トークン設定削除ボタンが押されたときの処理
			deleteHalApiTokenBtn.addEventListener('click', function () {
				ipcRenderer.send('to-main', JSON.stringify({ cmd: "deleteHalApiToken", arg: null }));
			});

		}else{
			divHALhome_info.style.display = 'inline';  // 連携してないので案内を表示

			divHALconfig.innerHTML = ' \
			  <form> \
				<p> \
				  <label for="api_token" style="display:block;">API トークン</label> \
				  <input type="password" id="halApiToken" style="width:100%;"> \
				</p> \
				<p id="setHalApiTokenErr" style="color:red;"></p> \
				<p><button type="button" id="setHalApiTokenBtn">登録</button></p> \
			  </form>';

			let setHalApiTokenBtn = document.getElementById('setHalApiTokenBtn');

			// HAL API トークン設定ボタンが押されたときの処理
			setHalApiTokenBtn.addEventListener('click', function () {
				let err_el = document.getElementById('setHalApiTokenErr');
				err_el.textContent = '';
				setHalApiTokenBtn.disabled = true;

				HALtoken = document.getElementById('halApiToken').value;
				let err = '';
				if (!HALtoken) {
					err = 'API トークンを入力してください。';
				} else if (!/^[\x21-\x7e]+$/.test(HALtoken)) {
					err = 'API トークンに不適切な文字が含まれています。';
				}

				if (err) {
					err_el.textContent = err;
					setHalApiTokenBtn.disabled = false;
					return;
				}

				let HAL_REQUEST_TIMEOUT = 5000;

				let timer = setTimeout(() => {
					err_el.textContent = 'TIMEOUT: HAL の応答がありませんでした。';
					setHalApiTokenBtn.disabled = false;
					setHalApiTokenCallback = () => { };
				}, HAL_REQUEST_TIMEOUT);

				setHalApiTokenCallback = (res) => {
					if (timer) {
						clearTimeout(timer);
					}
					if (res.error) {
						err_el.textContent = res.error;
					} else {
						document.getElementById('hal-control-box').style.display = 'block';  // 同期ボタン表示
						addToast('Info', 'HAL 連携が成功しました。');
						configSave();

						// 同期もする
						syncBtn.disabled = true;
						syncBtn.textContent = '同期中…';
						ipcRenderer.send('to-main', JSON.stringify({ cmd: "Sync", arg: {} }));
						renewHALcontents(HALtoken);
					}
					setHalApiTokenBtn.disabled = false;
					setHalApiTokenCallback = () => { };
				};

				ipcRenderer.send('to-main', JSON.stringify({ cmd: "setHalApiTokenRequest", arg: HALtoken }));
			});

		}
	};

	////////////////////////////////////////////////////////////////////////////////
	// controlタブ関係
	// mainからの情報で，htmlを変更する
	let renewFacilities = function () { //facilitiesEL = json = arg; // 機器情報確保

		// -------------------------------------------------
		// controlタブ
		divCtrl.innerHTML = controlELHTML + controlHueHTML;

		// -------------------------------------------------
		// detailsタブ
		let IPs = facilitiesEL.IPs;
		let detailDoc = "";  // Detailsのタブ内に書かれる文字
		IPs.forEach((ip) => {
			detailDoc += "<h4>" + ip + "</h4>";
			detailDoc += "<center><table border=1>";

			let EOJs = facilitiesEL[ip].EOJs;
			EOJs.forEach((eoj) => {
				let obj = eoj.split(/\(|\)/);  // (と)で分割

				// icon
				detailDoc += "<tr><td><img src=\"./img/" + obj[1].substring(0, 2) + ".png\" width=50 /><br />" + obj[0] + "</td>";
				detailDoc += '<td class="edt">\n<dl>';

				// EDT
				let EPCs = facilitiesEL[ip][eoj].EPCs;

				EPCs.forEach((epc) => {
					detailDoc += "<dt>" + epc + "</dt><dd>" + facilitiesEL[ip][eoj][epc] + "</dd>\n";
				});
				detailDoc += '</dl></td></tr>';
			});
			detailDoc += "</table></center>";
		});
		divDetails.innerHTML = detailDoc;
	};



	// mainからの情報で，EL関係のhtmlを変更する
	let renewFacilitiesEL = function () { //facilitiesHue = json = arg; // 機器情報確保
		if (!facilitiesEL) return; // 機器情報なければやらない

		let IPs = facilitiesEL.IPs;

		// -------------------------------------------------
		// controlタブ
		controlELHTML = '<h2>ECHONET Lite</h2><div class="LinearLayoutParent">';  // Controlのタブ内に書かれる文字
		// console.log('-- EL');
		IPs.forEach((ip) => {
			let EOJs = facilitiesEL[ip].EOJs;
			EOJs.forEach((eoj) => {
				let obj = eoj.split(/\(|\)/);  // マルかっこで分割
				if (obj[1] === '0ef001') { return; } // Node Profileはコントローラとしては無視, eachではcontinueではなくreturn

				controlELHTML += "<div class='LinearLayoutChild'> <section>" + createControlButton(ip, eoj) + "</section> </div>";  // ボタン設置
			});
		});

		controlELHTML += '</div>'
	}


	// mainからの情報で，hue関係のhtmlを変更する
	let renewFacilitiesHue = function () { //facilitiesHue = json = arg; // 機器情報確保
		if (!facilitiesHue) return; // 機器情報なければやらない

		// console.log('renewFacilitiesHue');
		// console.dir( facilitiesHue );
		controlHueHTML = '<h2>Philips hue</h2> <div class="LinearLayoutParent">';

		for (const [key, value] of Object.entries(facilitiesHue))
		{
			let ip = key, devices = value.devices;
			// console.log('-- hue');
			// console.dir(devices);

			for (const [key, value] of Object.entries(devices)) {
				// key is light number
				// value is details
				let devName = key + ':' + value.name;
				let makerCode = value.manufacturername;
				controlHueHTML += "<div class='LinearLayoutChild'> <section>";

				if (value.state) {
					let operatingStatus = value.state.on;
					if (operatingStatus == true) {
						controlHueHTML += "<img src=\"./img/hue_on.png\" width=100 /><br>" + devName + "<br>" + makerCode + "<br>" + ip + "<br>" +
							'<button onclick="HuePowButton(this)" value="' + key + ',off">OFF</button><br>';
					} else {
						controlHueHTML += "<img src=\"./img/hue_off.png\" width=100 /><br>" + devName + "<br>" + makerCode + "<br>" + ip + "<br>" +
							'<button onclick="HuePowButton(this)" value="' + key + ',on">ON</button><br>';
					}
				}
				controlHueHTML += "</section> </div>";  // ボタン設置
			}
		}

		controlHueHTML += "</div>";
	}


	////////////////////////////////////////////////////////////////////////////////
	// Each control interface
	let createControlButton = function (ip, eoj) {
		let ret = "";
		let obj = eoj.split(/\(|\)/);  // マルかっこで分割
		if (obj[1] === '0ef001') { return; } // Node Profileはコントローラとしては無視, eachではcontinueではなくreturn

		let operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
		let instLocation    = facilitiesEL[ip][eoj]["設置場所(81)"] || "不明";
		let makerCode = facilitiesEL[ip][eoj]["メーカコード(8A)"];

		if (makerCode == undefined) { // 機器オブジェクトになくて，ノードプロファイルにある読む場合
			makerCode = facilitiesEL[ip]["ノードプロファイル01(0ef001)"]["メーカコード(8A)"];
		}

		if (makerCode != undefined) {
			makerCode = makerCode.split('(')[0];  // メーカ名だけにする
		}

		// 画像
		// オブジェクトによって処理（インタフェース）を変える
		switch (obj[1].substring(0, 4)) {
			case "0011": // 温度センサ
			operatingStatus = facilitiesEL[ip][eoj]["温度計測値(E0)"];

			ret = "<img src=\"./img/0011.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";

			if (operatingStatus != undefined) {
				ret += operatingStatus + "<br>";
			}
			break;

			case "0130": // エアコン
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

			if (operatingStatus === 'ON(30)') {
				ret = "<img src=\"./img/0130_30.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			} else {
				ret = "<img src=\"./img/0130_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "0133": // 換気扇
			ret = "<img src=\"./img/0133.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "0135": // 空気清浄機
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
			if (operatingStatus === 'ON(30)') {
				ret = "<img src=\"./img/0135_30.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			} else {
				ret = "<img src=\"./img/0135_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "015a": // レンジフード
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
			if (operatingStatus === 'ON(30)') {
				ret = "<img src=\"./img/015a_30.png\" width=100 /><br>レンジフード<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			} else {
				ret = "<img src=\"./img/015a_31.png\" width=100 /><br>レンジフード<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "0260": // 日よけ・ブラインド
			operatingStatus = facilitiesEL[ip][eoj]["開閉（張出し／収納）動作設定(E0)"];
			ret = "<img src=\"./img/0260.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			if (operatingStatus === '開(41)') {
				ret += "開 → <button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,42\">閉</button><br>";
			} else {
				ret += "閉 → <button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,41\">開</button><br>";
			}
			break;

			case "0263": // シャッター
			ret = "<img src=\"./img/0263.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;


			case "026b": // 電気温水器
			ret = "<img src=\"./img/026b.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "026f": // 電気錠
			operatingStatus = facilitiesEL[ip][eoj]["施錠設定1(E0)"];
			if (operatingStatus === '施錠(41)') {
				ret = "<img src=\"./img/026f_41.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,42\">解錠</button><br>";
			} else {
				ret = "<img src=\"./img/026f_42.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",E0,41\">施錠</button><br>";
			}
			break;

			case "0272": // 瞬間式給湯器
			ret = "<img src=\"./img/0272.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "0279": // 太陽光発電
			ret = "<img src=\"./img/0279.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "027b": // 床暖房
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
			if( operatingStatus === 'ON(30)' ) {
				ret = "<img src=\"./img/027b_30.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			}else{
				ret = "<img src=\"./img/027b_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onClick=\"ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "027c": // 燃料発電
			ret = "<img src=\"./img/027c.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "027d": // 蓄電池
			ret = "<img src=\"./img/027d.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;


			case "0280": // 電力量メータ
			// let amountGus = facilitiesEL[ip][eoj]["積算ガス消費量計測値(E0)"];
			ret = "<img src=\"./img/0280.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			// if (amountGus != undefined) {
				// ret += (amountGus.split('m')[0] * 0.001) + "[m<sup>3</sup>]<br>";
			// }
			break;

			case "0281": // 水流量メータ
			let amountWater = facilitiesEL[ip][eoj]["積算水流量計測値(E0)"];
			let unitAmountWater = facilitiesEL[ip][eoj]["積算水流量計測値単位(E1)"] != undefined ? facilitiesEL[ip][eoj]["積算水流量計測値単位(E1)"] : '0.0001(No data)';
			ret = "<img src=\"./img/0281.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			if (amountWater != undefined) {
				ret += (amountWater.split('m')[0] * unitAmountWater.split('(')[0]) + "[m<sup>3</sup>]<br>";
			}
			break;

			case "0282": // ガスメータ
			let amountGus = facilitiesEL[ip][eoj]["積算ガス消費量計測値(E0)"];
			ret = "<img src=\"./img/0282.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			if (amountGus != undefined) {
				ret += (amountGus.split('m')[0] * 0.001) + "[m<sup>3</sup>]<br>";
			}
			break;

			case "0287": // 分電盤メータリング
			operatingStatus = facilitiesEL[ip][eoj]["瞬時電力計測値(E7)"];
			ret = "<img src=\"./img/0288.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			if (operatingStatus != undefined) {
				ret += operatingStatus + "<br>";
			}
			break;

			case "0288": // 低圧スマート電力メータ
			operatingStatus = facilitiesEL[ip][eoj]["瞬時電力計測値(E7)"];
			ret = "<img src=\"./img/0288.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			if (operatingStatus != undefined) {
				ret += operatingStatus + "<br>";
			}
			break;

			case "028d": // スマート電力サブメーター
			ret = "<img src=\"./img/028d.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "0290": // 一般照明
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

			if (operatingStatus === 'ON(30)') {
				ret = "<img src=\"./img/0290_30.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			} else {
				ret = "<img src=\"./img/0290_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "0291": // 単機能照明
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

			if( operatingStatus === 'ON(30)' ) {
				ret = "<img src=\"./img/0291_30.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			}else{
				ret = "<img src=\"./img/0291_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "02a1": // 電気自動車充電器
			ret = "<img src=\"./img/02a1.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "02a6": // ハイブリッド給湯機
			ret = "<img src=\"./img/02a6.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;


			case "0273": // 浴室暖房乾燥機
			ret = "<img src=\"./img/0273.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "027e": // 電気自動車充放電気
			ret = "<img src=\"./img/02a1.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "02a3": // 照明システム
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];
			let scineNow = facilitiesEL[ip][eoj]["シーン制御設定(C0)"];
			let scineNum = facilitiesEL[ip][eoj]["シーン制御設定可能数(C1)"];

			if (scineNum == undefined) {				// シーンの個数が取れていないので取りに行く
				// console.log( scineNum );
				ipcRenderer.send('to-main', JSON.stringify({ cmd: "Elsend", arg: { ip: ip, sendmsg: '1081000005ff01' + obj[1] + '6201c100' } }));
			}

			if (operatingStatus === 'ON(30)') {
				ret = "<img src=\"./img/02a3_30.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">Scine:" + scineNum + " / OFF</button><br>";
			} else {
				ret = "<img src=\"./img/02a3_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}

			for (let i = 1; i <= 4; i += 1) { // シーンボタン，scineNumを使うべきだが，20とか数値が返ってくるので
				ret += "<button onclick=\"window.ELLightingScineButton(this);\" value=\"" + ip + "," + obj[1] + ",C0,0" + i + "\">" + i + "</button> ";
			}
			break;

			case "03b7": // 冷蔵庫
			ret = "<img src=\"./img/03b7.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "03b8": // 電子レンジ
			ret = "<img src=\"./img/03b8.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "03d3": // 洗濯機
			ret = "<img src=\"./img/03d3.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;

			case "03cb": // 掃除機
			ret = "<img src=\"./img/03cb.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;


			case "05fd": // スイッチ JEMA/HA
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

			if( operatingStatus === 'ON(30)' ) {
				ret = "<img src=\"./img/05fd_30.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			}else{
				ret = "<img src=\"./img/05fd_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			case "05ff": // コントローラ
			ret = "<img src=\"./img/05ff.png\" width=100 /><br>" +  obj[0] + "<br>" + makerCode + "<br>"  + ip + "<br>";
			ret += "場所:" + instLocation +"<br>";
			break;


			case "0602": // テレビ
			operatingStatus = facilitiesEL[ip][eoj]["動作状態(80)"];

			if (operatingStatus === 'ON(30)') {
				ret = "<img src=\"./img/0602_30.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,31\">OFF</button><br>";
			} else {
				ret = "<img src=\"./img/0602_31.png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
				ret += "場所:" + instLocation +"<br>";
				ret += "<button onclick=\"window.ELpowButton(this);\" value=\"" + ip + "," + obj[1] + ",80,30\">ON</button><br>";
			}
			break;

			default:
			console.log('default case for', obj[1].substring(0, 4) );
			ret = "<img src=\"./img/" + obj[1].substring(0, 2) + ".png\" width=100 /><br>" + obj[0] + "<br>" + makerCode + "<br>" + ip + "<br>";
			//console.log('default:', ip, eoj);
			//console.dir(facilitiesEL[ip][eoj]);
			break;
		}

		return ret;
	};


	// Configタブ更新
	let renewConfig = async function (json) {
		inHeight.value = json.height;
		inWeight.value = json.weight;
		inEllogExpireDays.value = json.ellogExpireDays;
		inResultExpireDays.value = json.resultExpireDays;
		inIPv4.value = json.network.IPv4 == ''? 'auto' : json.network.IPv4;
		inIPv6.value = json.network.IPv6 == ''? 'auto' : json.network.IPv6;
		divobservationInterval.innerHTML = '<p> Interval: ' + json.observationInterval + '</p>';
		divobservationDevs.value = JSON.stringify( json.observationDevs,undefined,2 );

		// スマートメータ設定
		inESMUse.checked    = json.ESM.enable;
		inDonglePass.value  = json.ESM.donglePass;

		let dp = '';
		await ( async function (){
			dp = '<select id="selDonglePass">';
			if( json.ESM.donglePassCandidates != [] ) {
				await json.ESM.donglePassCandidates.forEach( (port) => {
					dp += '<option value="' + port + '">' + port + '</option>';
				} );
			}else{
				dp += '<option value="">Nothing</option>';
			}
			dp += '</select>';
		})();
		// console.dir( json.ESM.donglePassCandidates );
		selDonglePass.innerHTML = dp;
		inDongleType.value  = json.ESM.dongleType;
		inESMId.value       = json.ESM.id;
		inESMPassword.value = json.ESM.password;

		// hue設定
		if (json.hueKey == '') {
			inHueUse.checked = false;
		} else {
			inHueUse.checked = true;
		}
		inHueKey.value = json.hueKey;

		// hue設定
		if (json.hueKey == '') {
			inHueUse.checked = false;
		} else {
			inHueUse.checked = true;
		}
		inHueKey.value = json.hueKey;

		// open weather map設定
		if( json.owmAPIKey == '' || json.zipCode == '' ) {
			inOwmUse.checked = false;
		}else{
			inOwmUse.checked = true;
		}
		inOwmAPIKey.value = json.owmAPIKey;
		inZipCode.value   = json.zipCode;

		// netatmo設定
		if( json.netatmo == null || json.netatmo.id == null || json.netatmo.id == '' || json.netatmo.secret == '' || json.netatmo.username == '' || json.netatmo.password == '') {
			inNetatmoUse.checked = false;
		}else{
			inNetatmoUse.checked = true;
		}
		inNetatmoID.value       = json.netatmo.id       ? json.netatmo.id : '';
		inNetatmoSecret.value   = json.netatmo.secret   ? json.netatmo.secret : '';
		inNetatmoUsername.value = json.netatmo.username ? json.netatmo.username : '';
		inNetatmoPassword.value = json.netatmo.password ? json.netatmo.password : '';
	};

	// コンフィグファイルの保存
	let configSave = function () {
		// 身長，体重
		let height = inHeight.value;
		let weight = inWeight.value;

		// 家電操作ログ保存日数
		let ellogExpireDays = inEllogExpireDays.value;
		if (ellogExpireDays) {
			if (/[^\d]/.test(ellogExpireDays)) {
				// window.alert('家電操作ログの保存期間は数値のみで指定してください。');
				addToast( 'Error', '家電操作ログの保存期間は数値のみで指定してください。');
				return;
			}
			ellogExpireDays = parseInt(ellogExpireDays, 10);
			if (ellogExpireDays < 0 || ellogExpireDays > 9999) {
				// window.alert('家電操作ログの保存期間は 0 ～ 9999 の範囲でで指定してください。');
				addToast( 'Error', '家電操作ログの保存期間は 0 ～ 9999 の範囲でで指定してください。');
				return;
			}
		} else {
			// window.alert('家電操作ログの保存期間の設定は必須です。');
			addToast( 'Error', '家電操作ログの保存期間の設定は必須です。');
			return;
		}

		// 成績データ保存日数
		let resultExpireDays = inResultExpireDays.value;
		if (resultExpireDays) {
			if (/[^\d]/.test(resultExpireDays)) {
				// window.alert('成績データの保存期間は数値のみで指定してください。');
				addToast('Error', '成績データの保存期間は数値のみで指定してください。');
				return;
			}
			resultExpireDays = parseInt(resultExpireDays, 10);
			if (resultExpireDays < 0 || resultExpireDays > 9999) {
				// window.alert('成績データの保存期間は 0 ～ 9999 の範囲でで指定してください。');
				addToast('Error', '成績データの保存期間は 0 ～ 9999 の範囲でで指定してください。');
				return;
			}
		} else {
			// window.alert('成績データの保存期間の設定は必須です。');
			addToast( 'Error', '成績データの保存期間の設定は必須です。');
			return;
		}

		// IPv4
		let IPv4 = inIPv4.value;

		// IPv6
		let IPv6 = inIPv6.value;

		// Observation Devices
		let observationDevs = divobservationDevs.value;

		// Hue Key
		let hueKey = inHueKey.value;

		let data = {
			height: height,
			weight: weight,
			ellogExpireDays: ellogExpireDays,
			resultExpireDays: resultExpireDays,
			IPv4: IPv4,
			IPv6: IPv6,
			observationDevs: observationDevs,
			hueKey: hueKey
		};

		configSaveBtn.disabled = true;
		configSaveBtn.textContent = '保存中…';
		ipcRenderer.send('to-main', JSON.stringify({ cmd: "configSave", arg: data }));
	};


	////////////////////////////////////////////////////////////////////////////////////////////////////
	// GUIイベント，関数で閉じてしまっているので，Global変数のWindowからアクセスできるようにしておく
	// 電源ボタンが押された
	window.ELSendTest = function () {
		let msg = "10810000" + eltestSEOJ.value + eltestDEOJ.value + eltestESV.value + "01" + eltestEPC.value + eltestDETAILs.value;
		ipcRenderer.send('to-main', JSON.stringify({ cmd: "Elsend", arg: { ip: toIP.value, sendmsg: msg } }));
	};

	// 電源ボタンが押された
	window.ELpowButton = function (btn) {
		let cmd = btn.value.split(",");
		let msg = "1081000005ff01" + cmd[1] + "6101" + cmd[2] + "01" + cmd[3];
		ipcRenderer.send('to-main', JSON.stringify({ cmd: "Elsend", arg: { ip: cmd[0], sendmsg: msg } }));
	};

	// 色変化
	let colorButton = function (btn) {
		let cmd = btn.name.split(",");
		let col = btn.value;
		let msg = cmd[0] + " " + "1081000005ff01" + cmd[1] + "6101c003" + col.substring(1, 7);

		ipcRenderer.send('to-main', JSON.stringify({ cmd: 'ELsend', arg: msg }));
	};

	window.ELLightingScineButton = function (btn) {
		let cmd = btn.value.split(",");
		let msg = "1081000005ff01" + cmd[1] + "6101" + cmd[2] + "01" + cmd[3];
		ipcRenderer.send('to-main', JSON.stringify({ cmd: "Elsend", arg: { ip: cmd[0], sendmsg: msg } }));
	};


	// 電力スマートメータ連携チェック
	window.esmUseCheck = function(checkBox) {
		if( checkBox.checked == false ) {
			ipcRenderer.send('to-main', JSON.stringify( {cmd: "ESMnotUse" } ) );
			return; // falseなら外すだけ
		}

		// true にした時のチェック
		if( inDonglePass.value == '' || inDongleType.value == '' || inESMId.value == '' || inESMPassword.value == '' ) { // 情報不足で有効にしたら解説ダイアログ
			checkBox.checked = false;
			esmHelpDialog.showModal();
		}else{  // 全情報あり
			ipcRenderer.send('to-main', JSON.stringify( {cmd: "ESMUse", arg: {donglePass: inDonglePass.value, dongleType: inDongleType.value, id:inESMId.value, password:inESMPassword.value} } ) );
		}
	};


	// Hue
	window.HuePowButton = function (btn) {
		let cmd = btn.value.split(",");

		let sendurl = "/lights/" + cmd[0] + "/state";

		switch (cmd[1]) {
			case 'on':
			ipcRenderer.send('to-main', JSON.stringify({ cmd: "Huesend", arg: { url: sendurl, json: '{"on":true}' } }));
			break;
			case 'off':
			ipcRenderer.send('to-main', JSON.stringify({ cmd: "Huesend", arg: { url: sendurl, json: '{"on":false}' } }));
			break;
			default:
			console.error('unknown cmd');
			console.error(cmd[1]);
		}
	};

	window.hueUseCheck = function (checkBox) {
		if( checkBox.checked == false ) {
			return; // falseなら外すだけ
		}

		if(inHueKey.value == '') { // キー無しで有効にしたらLinkボタンが必要
			ipcRenderer.send('to-main', JSON.stringify({ cmd: "HueUse", arg: { key: '' } }));
			huePushDialog.showModal();
		}else{ // キー指定ありで有効にしたら，そのキーで開始
			ipcRenderer.send('to-main', JSON.stringify({ cmd: "HueUse", arg: { key: inHueKey.value } }));
		}
	};

	// Open Weather Map
	window.owmUseCheck = function(checkBox) {
		if( checkBox.checked == false ) {
			return; // falseなら外すだけ
		}

		// true にした時のチェック
		if( inOwmAPIKey.value == '' || inZipCode.value == '' ) { // 情報不足で有効にしたら解説ダイアログ
			checkBox.checked = false;
			owmHelpDialog.showModal();
		}else{  // 全情報あり
			ipcRenderer.send('to-main', JSON.stringify( {cmd: "OwmUse", arg: {owmAPIKey: inOwmAPIKey.value, zipCode: inZipCode.value} } ) );
		}
	};

	// Netatmo
	window.netatmoUseCheck = function(checkBox) {
		if( checkBox.checked == false ) {
			return; // falseなら外すだけ
		}

		if( inNetatmoID.value == '' || inNetatmoSecret.value == '' || inNetatmoUsername.value == '' || inNetatmoPassword.value == '' ) { // 情報不足で有効にしたら解説ダイアログ
			checkBox.checked = false;
			netatmoHelpDialog.showModal();
		}else{  // キー指定ありで有効にしたら，そのキーで開始
			ipcRenderer.send('to-main',
							 JSON.stringify({
								 cmd: "NetatmoUse",
								 arg: {
									 netatmo: {
										 id: inNetatmoID.value,
										 secret: inNetatmoSecret.value,
										 username: inNetatmoUsername.value,
										 password: inNetatmoPassword.value
									 }
								 }
							 }));
		}
	};

	//////////////////////////////////////////////////////////////////////
	// ボタン
	// マルチキャストボタン
	multicastSearch.addEventListener('click', function () {
		ipcRenderer.send('to-main', JSON.stringify({ cmd: 'Search' }));
	});

	// HAL同期ボタンが押されたときの処理
	syncBtn.addEventListener('click', function () {
		syncBtn.disabled = true;
		syncBtn.textContent = '同期中…';
		ipcRenderer.send('to-main', JSON.stringify({ cmd: "Sync", arg: {} }));
	});

	// 身長、体重セットボタンが押されたときの処理
	btnWeightSet.addEventListener('click', configSave );

	// 設定ボタンが押されたときの処理
	configSaveBtn.addEventListener('click', configSave );



	let deleteHalApiTokenCallback = function(res) {
		document.getElementById('hal-control-box').style.display = 'none';  // 同期ボタン非表示
		// window.alert('HAL 連携設定を削除しました。');
		addToast( 'Info', 'HAL 連携設定を削除しました。');
		renewHALcontents( null );
	};

	// アンケート回答の投稿ボタンを押したときの処理
	btnQuestionnaireSubmit.addEventListener('click', function () {
		let submitData = window.getQuestionnaire();

		if( submitData != null ) {
			// HAL にアンケート回答が POST される。
			ipcRenderer.send('to-main', JSON.stringify({ cmd: "submitQuestionnaire", arg:submitData }));
		}
	} );


	// --------------------------------------------------------------
	// 初期化 (起動時の処理)
	// --------------------------------------------------------------
	(async () => {
		// ローカルに保存された HAL API トークンを取得
		let HALtoken = await getHalApiToken();
		renewHALcontents( HALtoken );
		document.getElementById('halApiToken').value = HALtoken;

		// 取得したトークンが有効かどうかを確認するために HAL ユーザープロファイルを取得
		if (HALtoken) {
			try {
				let profile = await getHalUserProfile();
				halProfile = profile;
				window.renewHALProfile(halProfile);
				console.log(JSON.stringify(profile, null, '  '));
				document.getElementById('hal-control-box').style.display = 'block';  // 同期ボタン表示
			} catch (error) {
				console.error( error );
				document.getElementById('setHalApiTokenErr').textContent = error.message;
			}
		}
	})();


	// ローカルに保存された HAL API トークンを取得
	function getHalApiToken() {
		return new Promise((resolve) => {
			getHalApiTokenCallback = (HALtoken) => {
				getHalApiTokenCallback = () => { };
				resolve(HALtoken);
			};
			ipcRenderer.send('to-main', JSON.stringify({ cmd: 'getHalApiTokenRequest', arg: {} }));
		});
	}

	function getHalUserProfile() {
		return new Promise((resolve, reject) => {
			getHalUserProfileCallback = (res) => {
				getHalUserProfileCallback = () => { };
				if (res.error) {
					reject(res.error);
				} else {
					resolve(res.profile);
				}
			};
			ipcRenderer.send('to-main', JSON.stringify({ cmd: 'getHalUserProfileRequest', arg: {} }));
		});
	}

	// URLを外部ブラウザで開く
	window.URLopen = function(url) {
		const {shell} = require('electron');
		shell.openExternal(url);
	}

	// この関数の最後に呼ぶ
	// 準備できたことをmainプロセスに伝える
	ipcRenderer.send('to-main', JSON.stringify({ cmd: "already" }));
};
