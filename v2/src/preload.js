//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.06.07 (MIT License)
//	Based on Futomi HATANO 2021.11.11 (MIT License)
//	Last updated: 2022.06.07
//////////////////////////////////////////////////////////////////////
'use strict'

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
	//======================================================
	// renderer to main
	// rendererが準備できた
	already: async () => {
		ipcRenderer.invoke('already', '');
	},

	//======================================================
	// main to renderer
	on: ( channel, callback ) => {
		console.log( 'on', channel );
		ipcRenderer.on( channel, (event, args ) => {
			console.log( 'ipc.on', channel, args );
			callback( channel, args );
		});
	}

});


