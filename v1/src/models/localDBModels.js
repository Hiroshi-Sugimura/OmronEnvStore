//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.06.06
//  Last updated: 2022.06.06
//////////////////////////////////////////////////////////////////////
// Require all the stuff
const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || "development";

const path = require('path');

const appname = 'HEMS-Logger';
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
const configDir = path.join(userHome, appname);

// Setup sequelize db connection
const sqlite3 = new Sequelize(
	'database', '', '', {
		"dialect": "sqlite",
		"storage": path.join(configDir, "lifelog.db"),
		"logging": false
	} );

// freezeTableNameはモデルに渡した名前を実テーブルにマッピングする際に複数形に変換してしまうのを抑制する
// timestamps: falseを入れておかないと，createdAt, updatedAtが勝手に追加されるみたい

//////////////////////////////////////////////////////////////////////
// omronData
const omronModel = sqlite3.define('omron', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	srcip: {
		type: Sequelize.STRING
	},
	srcmac: {
		type: Sequelize.STRING
	},
	seoj: {
		type: Sequelize.STRING
	},
	deoj: {
		type: Sequelize.STRING
	},
	esv: {
		type: Sequelize.STRING
	},
	epc: {
		type: Sequelize.STRING
	},
	edt: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});

module.exports = { sqlite3, omronModel };
