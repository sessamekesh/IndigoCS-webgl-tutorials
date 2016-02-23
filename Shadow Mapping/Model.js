'use strict';

var Model = function (gl, vertices, indices, normals, color) {
	this.vbo = gl.createBuffer();
	this.ibo = gl.createBuffer();
	this.nbo = gl.createBuffer();
	this.nPoints = indices.length;

	this.world = mat4.create();
	this.color = color;

	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

var ShaderProgram = function (gl, vsText, fsText) {
	var vs = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vs, vsText);
	gl.compileShader(vs);
	if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
		this.error = 'Error compiling vertex shader: ' +  gl.getShaderInfoLog(vs);
		return;
	}

	var fs = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fs, fsText);
	gl.compileShader(fs);
	if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
		this.error = 'Error compiling fragment shader: ' + gl.getShaderInfoLog(fs);
		return;
	}

	this.program = gl.createProgram();
	gl.attachShader(this.program, vs);
	gl.attachShader(this.program, fs);
	gl.linkProgram(this.program);
	if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
		this.error = 'Error linking program: ' + gl.getProgramInfoLog(this.program);
		this.program = null;
		return;
	}

	gl.validateProgram(this.program);
	if (!gl.getProgramParameter(this.program, gl.VALIDATE_STATUS)) {
		this.error = 'Error validating program: ' + gl.getProgramInfoLog(this.program);
		this.program = null;
		return;
	}
};

var FPSCamera = function (position, lookAt, up) {
	this.fwd = vec3.create();
	this.up = vec3.create();
	this.right = vec3.create();

	this.position = position;

	vec3.subtract(this.fwd, lookAt, this.position);
	vec3.cross(this.right, this.fwd, up);
	vec3.cross(this.up, this.right, this.fwd);

	vec3.normalize(this.fwd, this.fwd);
	vec3.normalize(this.right, this.right);
	vec3.normalize(this.up, this.up);
};

FPSCamera.prototype._realign = function() {
	vec3.cross(this.right, this.fwd, this.up);
	vec3.cross(this.up, this.right, this.fwd);

	vec3.normalize(this.fwd, this.fwd);
	vec3.normalize(this.right, this.right);
	vec3.normalize(this.up, this.up);
};

FPSCamera.prototype.GetViewMatrix = function () {
	var tr = mat4.create();
	var lookAt = vec3.create();
	vec3.add(lookAt, this.position, this.fwd);
	mat4.lookAt(tr, this.position, lookAt, this.up);
	return tr;
};

FPSCamera.prototype.rotateUp = function (rad) {
	var upMatrix = mat4.create();
	mat4.rotate(upMatrix, upMatrix, rad, vec3.fromValues(1, 0, 0));
	vec3.transformMat4(this.fwd, this.fwd, upMatrix);
	this._realign();
};

FPSCamera.prototype.rotateRight = function (rad) {
	var rightMatrix = mat4.create();
	mat4.rotate(rightMatrix, rightMatrix, rad, vec3.fromValues(0, 0, 1));
	vec3.transformMat4(this.fwd, this.fwd, rightMatrix);
	this._realign();
};

FPSCamera.prototype.moveForward = function (dist) {
	vec3.scaleAndAdd(this.position, this.position, this.fwd, dist);
};

FPSCamera.prototype.moveRight = function (dist) {
	vec3.scaleAndAdd(this.position, this.position, this.right, dist);
};

FPSCamera.prototype.moveUp = function (dist) {
	vec3.scaleAndAdd(this.position, this.position, this.up, dist);
};