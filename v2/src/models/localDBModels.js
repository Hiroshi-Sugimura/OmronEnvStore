//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.06.06
//  Last updated: 2022.06.06
//////////////////////////////////////////////////////////////////////
// Require all the stuff
const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || "development";

const path = require('path');

const appname = 'OmronEnvStore';
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
const configDir = path.join(userHome, appname);

// Setup sequelize db connection
const sqlite3 = new Sequelize(
	'database', '', '', {
		"dialect": "sqlite",
		"storage": path.join(configDir, "OmronEnv.db"),
		"logging": false
	} );

// freezeTableNameはモデルに渡した名前を実テーブルにマッピングする際に複数形に変換してしまうのを抑制する
// timestamps: falseを入れておかないと，createdAt, updatedAtが勝手に追加されるみたい。たいていの場合はtrueでいいけどね

//////////////////////////////////////////////////////////////////////
// omronData
const omronModel = sqlite3.define('omron', {
	id: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	date: {
		type: Sequelize.DATE,
		allowNull: false
	},
	temperature: {
		type: Sequelize.FLOAT
	},
	humidity: {
		type: Sequelize.FLOAT
	},
	anbient_light: {
		type: Sequelize.INTEGER
	},
	pressure: {
		type: Sequelize.FLOAT
	},
	noise: {
		type: Sequelize.FLOAT
	},
	etvoc: {
		type: Sequelize.INTEGER
	},
	eco2: {
		type: Sequelize.INTEGER
	},
	discomfort_index: {
		type: Sequelize.FLOAT
	},
	heat_stroke: {
		type: Sequelize.FLOAT
	}
}, {
	freezeTableName: true,
	timestamps: true
});

module.exports = { sqlite3, omronModel };
