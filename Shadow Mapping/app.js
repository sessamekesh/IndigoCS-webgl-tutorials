'use strict';

var Demo;

function Init() {
	var canvas = document.getElementById('gl-surface');
	var gl = canvas.getContext('webgl');
	if (!gl) {
		console.log('Failed to get WebGL context - trying experimental context');
		gl = canvas.getContext('experimental-webgl');
	}
	if (!gl) {
		alert('Your browser does not support WebGL - please use a different browser\nGoogleChrome works great!');
		return;
	}

	Demo = new LightMapDemo(gl);
	Demo.Load(function (err) {
		if (err) {
			alert('Could not load demo - see console log');
			console.error('FAILED TO LOAD LightMapDemo!', err);
		} else {
			Demo.Begin();
		}
	});
};