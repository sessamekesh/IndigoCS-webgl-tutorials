'use strict';

//
// Constructor
//
var LightMapDemo = function (gl) {
	this.gl = gl;

	this.animationFrameHandle = null;
};

//
// Public methods (follow interface for Scene)
//
LightMapDemo.prototype.Load = function (cb) {
	var me = this;
	async.parallel({
		Models: function (callback) {
			async.map({
				RoomModel: '/Room.json'
			}, LoadJSONResource, callback);
		},
		ShaderCode: function (callback) {
			async.map({
				'VSText': '/ShadowMapping.vs.glsl',
				'FSText': '/ShadowMapping.fs.glsl',
				'DepthFSText': '/DepthBufferView.fs.glsl',
				'BBVSText': '/BillboardDraw.vs.glsl',
				'BBFSText': '/BillboardDraw.fs.glsl'
			}, LoadTextResource, callback);
		}
	}, function (loadErrors, loadObject) {
		if (loadErrors) {
			cb(loadErrors);
			return;
		}

		//
		// Create model objects
		//
		for (var i = 0; i < loadObject.Models.RoomModel.meshes.length; i++) {
			var mesh = loadObject.Models.RoomModel.meshes[i];
			switch (mesh.name) {
				case 'MonkeyMesh':
					me.MonkeyMesh = new Model(me.gl, mesh.vertices, [].concat.apply([], mesh.faces), mesh.normals, vec4.fromValues(0.8, 0.8, 1, 1));
					var rotation = quat.create();
					quat.setAxisAngle(
						rotation,
						vec3.fromValues(0, 0, -1),
						glMatrix.toRadian(94.87)
					);
					mat4.rotate(me.MonkeyMesh.world, me.MonkeyMesh.world, glMatrix.toRadian(94.87), vec3.fromValues(0, 0, -1));
					mat4.translate(me.MonkeyMesh.world, me.MonkeyMesh.world, vec3.fromValues(2.079, -0.985, 1.757));
					mat4.scale(me.MonkeyMesh.world, me.MonkeyMesh.world, vec3.fromValues(0.408, 0.408, 0.408));
					break;
				case 'TableMesh':
					me.TableMesh = new Model(me.gl, mesh.vertices, [].concat.apply([], mesh.faces), mesh.normals, vec4.fromValues(1, 0, 1, 1));
					mat4.rotate(me.TableMesh.world, me.TableMesh.world, glMatrix.toRadian(0), vec3.fromValues(0, 1, 0));
					mat4.translate(me.TableMesh.world, me.TableMesh.world, vec3.fromValues(1.57116, -0.79374, 0.49672));
					mat4.scale(me.TableMesh.world, me.TableMesh.world, vec3.fromValues(1, 1, 1));
					break;
				case 'SofaMesh':
					me.SofaMesh = new Model(me.gl, mesh.vertices, [].concat.apply([], mesh.faces), mesh.normals, vec4.fromValues(0, 1, 1, 1));
					mat4.rotate(me.SofaMesh.world, me.SofaMesh.world, glMatrix.toRadian(0), vec3.fromValues(0, 1, 0));
					mat4.translate(me.SofaMesh.world, me.SofaMesh.world, vec3.fromValues(-3.28768, 0, 0.36448));
					mat4.scale(me.SofaMesh.world, me.SofaMesh.world, vec3.fromValues(0.362, 0.362, 0.362));
					break;
				case 'LightBulbMesh':
					me.lightPosition = vec3.fromValues(0, 0, 2.98971);

					me.LightMesh = new Model(me.gl, mesh.vertices, [].concat.apply([], mesh.faces), mesh.normals, vec4.fromValues(1, 1, 1, 1));
					mat4.translate(me.LightMesh.world, me.LightMesh.world, me.lightPosition);
					mat4.scale(me.LightMesh.world, me.LightMesh.world, vec3.fromValues(0.405, 0.405, 0.405));
					break;
				case 'WallsMesh':
					me.WallsMesh = new Model(me.gl, mesh.vertices, [].concat.apply([], mesh.faces), mesh.normals, vec4.fromValues(0.3, 0.3, 0.3, 1));
					mat4.translate(me.MonkeyMesh.world, me.MonkeyMesh.world, vec3.fromValues(0, 0, 0));
					mat4.scale(me.WallsMesh.world, me.WallsMesh.world, vec3.fromValues(5, 5, 1));
					break;
			}
		}
		if (!(me.MonkeyMesh && me.TableMesh && me.SofaMesh && me.LightMesh && me.WallsMesh)) {
			cb('Failed to load all models!');
			return;
		}
		me.BillboardMesh = {
			vbo: me.gl.createBuffer(),
			uvbo: me.gl.createBuffer()
		};
		me.gl.bindBuffer(me.gl.ARRAY_BUFFER, me.BillboardMesh.vbo);
		me.gl.bufferData(me.gl.ARRAY_BUFFER, new Float32Array([-1, 1,  -1, -1,  1, -1,    -1, 1,  1, -1,  1, 1]), me.gl.STATIC_DRAW);
		me.gl.bindBuffer(me.gl.ARRAY_BUFFER, me.BillboardMesh.uvbo);
		me.gl.bufferData(me.gl.ARRAY_BUFFER, new Float32Array([0, 1,  0, 0,  1, 0,   0, 1,  1, 0,  1, 1]), me.gl.STATIC_DRAW);
		me.gl.bindBuffer(me.gl.ARRAY_BUFFER, null);

		//
		// Create Framebuffers and Textures
		//
		me.cubeMapTextures = [
			me.gl.createTexture(),
			me.gl.createTexture(),
			me.gl.createTexture(),
			me.gl.createTexture(),
			me.gl.createTexture(),
			me.gl.createTexture()
		];
		me.shadowMapCube = me.gl.createTexture();
		me.gl.bindTexture(me.gl.TEXTURE_CUBE_MAP, me.shadowMapCube);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_MIN_FILTER, me.gl.LINEAR);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_MAG_FILTER, me.gl.LINEAR);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_WRAP_S, me.gl.CLAMP_TO_EDGE);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_WRAP_T, me.gl.CLAMP_TO_EDGE);
		for (var i = 0; i < 6; i++) {
			me.gl.texImage2D(me.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, me.gl.RGBA, 1024, 1024, 0, me.gl.RGBA, me.gl.UNSIGNED_BYTE, null);
		}

		for (var i = 0; i < me.cubeMapTextures.length; i++) {
			me.gl.bindTexture(me.gl.TEXTURE_2D, me.cubeMapTextures[i]);
			me.gl.texParameteri(me.gl.TEXTURE_2D, me.gl.TEXTURE_MIN_FILTER, me.gl.LINEAR_MIPMAP_NEAREST);
			me.gl.texParameteri(me.gl.TEXTURE_2D, me.gl.TEXTURE_MAG_FILTER, me.gl.LINEAR);

			me.gl.texImage2D(me.gl.TEXTURE_2D, 0, me.gl.RGBA, 1024, 1024, 0, me.gl.RGBA, me.gl.UNSIGNED_BYTE, null);
			me.gl.generateMipmap(me.gl.TEXTURE_2D);
		}

		me.cubeMapFramebuffer = me.gl.createFramebuffer();
		me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, me.cubeMapFramebuffer);

		me.cubeMapDepthBuffer = me.gl.createRenderbuffer();
		me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, me.cubeMapDepthBuffer);
		me.gl.renderbufferStorage(me.gl.RENDERBUFFER, me.gl.DEPTH_COMPONENT16, 1024, 1024);

		me.gl.bindTexture(me.gl.TEXTURE_2D, null);
		me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, null);
		me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, null);

		//
		// Create shader object and uniforms
		//
		me.ShaderProgram = new ShaderProgram(me.gl, loadObject.ShaderCode.VSText, loadObject.ShaderCode.FSText);
		if (me.ShaderProgram.error) {
			cb(me.ShaderProgram.error);
			return;
		} else {
			me.ShaderProgram = me.ShaderProgram.program;
		}

		me.DepthProgram = new ShaderProgram(me.gl, loadObject.ShaderCode.VSText, loadObject.ShaderCode.DepthFSText);
		if (me.DepthProgram.error) {
			cb(me.DepthProgram.error);
			return;
		} else {
			me.DepthProgram = me.DepthProgram.program;
		}

		me.BillboardProgram = new ShaderProgram(me.gl, loadObject.ShaderCode.BBVSText, loadObject.ShaderCode.BBFSText);
		if (me.BillboardProgram.error) {
			cb(me.BillboardProgram.error);
			return;
		} else {
			me.BillboardProgram = me.BillboardProgram.program;
		}

		//
		// Attribute and Uniform Locations
		//
		me.ShaderProgram.uniforms = {
			mWorld: me.gl.getUniformLocation(me.ShaderProgram, 'mWorld'),
			mView: me.gl.getUniformLocation(me.ShaderProgram, 'mView'),
			mProj: me.gl.getUniformLocation(me.ShaderProgram, 'mProj'),

			meshColor: me.gl.getUniformLocation(me.ShaderProgram, 'meshColor'),
			pointShadowTexture: me.gl.getUniformLocation(me.ShaderProgram, 'pointShadowTexture'),
			pointLightPosition: me.gl.getUniformLocation(me.ShaderProgram, 'pointLightPosition')
		};
		me.ShaderProgram.attribs = {
			vPos: me.gl.getAttribLocation(me.ShaderProgram, 'vPos'),
			vNorm: me.gl.getAttribLocation(me.ShaderProgram, 'vNorm')
		};

		me.DepthProgram.uniforms = {
			mWorld: me.gl.getUniformLocation(me.DepthProgram, 'mWorld'),
			mView: me.gl.getUniformLocation(me.DepthProgram, 'mView'),
			mProj: me.gl.getUniformLocation(me.DepthProgram, 'mProj')
		};
		me.DepthProgram.attribs = {
			vPos: me.gl.getAttribLocation(me.DepthProgram, 'vPos'),
			vNorm: me.gl.getAttribLocation(me.DepthProgram, 'vNorm')
		};

		me.BillboardProgram.uniforms = {
			texToDraw: me.gl.getUniformLocation(me.BillboardProgram, 'texToDraw')
		};
		me.BillboardProgram.attribs = {
			screenPos: me.gl.getAttribLocation(me.BillboardProgram, 'screenPos'),
			texCoord: me.gl.getAttribLocation(me.BillboardProgram, 'texCoord')
		};

		//
		// Set Initial Values for Per-Frame Uniforms
		//
		me.perFrameUniforms = {
			mProj: mat4.create(),
		};
		mat4.perspective(me.perFrameUniforms.mProj, glMatrix.toRadian(90), 16 / 9, 0.35, 15.0);

		//
		// Logical Values
		//
		me.camera = new FPSCamera(vec3.fromValues(0, 0, 1.85), vec3.fromValues(-0.3, -1, 1.85), vec3.fromValues(0, 0, 1));
		me.PressedKeys = {
			Up: false,
			Right: false,
			Left: false,
			Down: false,
			RotLeft: false,
			RotRight: false,
			MovUp: false,
			MovDown: false
		};

		// Shadow Map Cameras
		var shadowMapTransforms = [
			vec3.fromValues( 1, 0, 0),   // Positive X
			vec3.fromValues(-1, 0, 0),   // Negative X
			
			vec3.fromValues(0,  1, 0),    // Positive Y
			vec3.fromValues(0, -1, 0),    // Negative Y
			
			vec3.fromValues(0, 0,  1), // Positive Z
			vec3.fromValues(0, 0, -1) // Negative Z
		];
		me.shadowCameras = [
			// Positive X
			new FPSCamera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(1, 0, 0)),
				vec3.fromValues(0.0, -1.0, 0.0)
			),
			// Negative X
			new FPSCamera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(-1, 0, 0)),
				vec3.fromValues(0.0, -1.0, 0.0)
			),
			// Positive Y
			new FPSCamera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, 1, 0)),
				vec3.fromValues(0.0, 0.0, 1.0)
			),
			// Negative Y
			new FPSCamera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, -1, 0)),
				vec3.fromValues(0.0, 0.0, -1.0)
			),
			// Positive Z
			new FPSCamera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, 0, 1)),
				vec3.fromValues(0, -1, 0) // TODO KAM: Not sure this is right
			),
			// Negative Z
			new FPSCamera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, 0, -1)),
				vec3.fromValues(0, 1, 0) // TODO KAM: Not sure this is right
			),
		];
		me.shadowProjMatrix = mat4.create();
		mat4.perspective(me.shadowProjMatrix, glMatrix.toRadian(90), 16 / 9, 0.35, 12.0);

		cb();
	});
};

LightMapDemo.prototype.Unload = function () {
	me.MonkeyMesh = null;
	me.TableMesh = null;
	me.SofaMesh = null;
	me.LightMesh = null;
	me.WallsMesh = null;

	me.ShaderProgram = null;
};

LightMapDemo.prototype.Begin = function () {
	var me = this;

	//
	// Attach event handlers
	//
	this.__Window_Resize = me._OnResizeWindow.bind(me);
	AddEvent(window, 'resize', this.__Window_Resize);
	this.__Window_KeyDown = me._OnKeyPress.bind(me);
	AddEvent(window, 'keydown', this.__Window_KeyDown);
	this.__Window_KeyUp = me._OnKeyRelease.bind(me);
	AddEvent(window, 'keyup', this.__Window_KeyUp);

	//
	// Begin game loop
	// 
	var previousframe = performance.now();
	var loop = function (currentframe) {
		me._Update(currentframe - previousframe);
		previousframe = currentframe;

		me.gl.clearColor(0.0, 0.0, 0.0, 1.0);
		me.gl.clear(me.gl.COLOR_BUFFER_BIT | me.gl.DEPTH_BUFFER_BIT);

		me._RenderShadowMap();
		me._Render();
		me.animationFrameHandle = requestAnimationFrame(loop);
	};
	me.animationFrameHandle = requestAnimationFrame(loop);
	me._OnResizeWindow();
};

LightMapDemo.prototype.End = function () {
	//
	// End game loop
	//
	if (this.animationFrameHandle) {
		cancelAnimationFrame(this.animationFrameHandle);
	}

	//
	// Detach event listeners
	// 
	this.__Window_Resize && RemoveEvent(window, 'resize', this.__Window_Resize);
	this.__Window_Resize = null;
	this.__Window_KeyDown && RemoveEvent(window, 'keydown', this.__Window_KeyDown);
	this.__Window_KeyDown = null;
	this.__Window_KeyUp && RemoveEvent(window, 'keyup', this.__Window_KeyUp);
	this.__Window_KeyUp = null;
};

//
// Private methods (used by LightMapDemo)
//
LightMapDemo.prototype._Update = function (dt) {
	var rotateSpeed = 1.5;
	var moveSpeed = 3.5;

	if (this.PressedKeys.Up && !this.PressedKeys.Down) {
		this.camera.moveForward(dt / 1000 * moveSpeed);
	}

	if (this.PressedKeys.Down && !this.PressedKeys.Up) {
		this.camera.moveForward(-dt / 1000 * moveSpeed);
	}

	if (this.PressedKeys.Right && !this.PressedKeys.Left) {
		this.camera.moveRight(dt / 1000 * moveSpeed);
	}

	if (this.PressedKeys.Left && !this.PressedKeys.Right) {
		this.camera.moveRight(-dt / 1000 * moveSpeed);
	}

	if (this.PressedKeys.RotRight && !this.PressedKeys.RotLeft) {
		this.camera.rotateRight(-dt / 1000 * rotateSpeed);
	}

	if (this.PressedKeys.RotLeft && !this.PressedKeys.RotRight) {
		this.camera.rotateRight(dt / 1000 * rotateSpeed);
	}

	if (this.PressedKeys.MovUp && !this.PressedKeys.MovDown) {
		this.camera.moveUp(dt / 1000 * moveSpeed);
	}

	if (this.PressedKeys.MovDown && !this.PressedKeys.MovUp) {
		this.camera.moveUp(-dt / 1000 * moveSpeed);
	}
};

LightMapDemo.prototype._RenderShadowMap = function () {
	var gl = this.gl;

	gl.useProgram(this.DepthProgram);
	gl.uniformMatrix4fv(this.DepthProgram.uniforms.mProj, gl.FALSE, this.shadowProjMatrix);

	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.cubeMapFramebuffer);
	gl.bindRenderbuffer(gl.RENDERBUFFER, this.cubeMapDepthBuffer);
	for (var i = 0; i < this.shadowCameras.length; i++) {
		gl.uniformMatrix4fv(this.DepthProgram.uniforms.mView, gl.FALSE, this.shadowCameras[i].GetViewMatrix());

		//gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.cubeMapTextures[i], 0);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, this.shadowMapCube, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.cubeMapDepthBuffer);

		gl.viewport(0, 0, 1024, 1024);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Draw Walls
		gl.uniformMatrix4fv(this.DepthProgram.uniforms.mWorld, gl.FALSE, this.WallsMesh.world);
		gl.uniform4fv(this.DepthProgram.uniforms.meshColor, this.WallsMesh.color);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.WallsMesh.vbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.WallsMesh.nbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.WallsMesh.ibo);
		gl.drawElements(gl.TRIANGLES, this.WallsMesh.nPoints, gl.UNSIGNED_SHORT, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		// Draw The Monkey
		gl.uniformMatrix4fv(this.DepthProgram.uniforms.mWorld, gl.FALSE, this.MonkeyMesh.world);
		gl.uniform4fv(this.DepthProgram.uniforms.meshColor, this.MonkeyMesh.color);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.MonkeyMesh.vbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.MonkeyMesh.nbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.MonkeyMesh.ibo);
		gl.drawElements(gl.TRIANGLES, this.MonkeyMesh.nPoints, gl.UNSIGNED_SHORT, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		// Draw Table
		gl.uniformMatrix4fv(this.DepthProgram.uniforms.mWorld, gl.FALSE, this.TableMesh.world);
		gl.uniform4fv(this.DepthProgram.uniforms.meshColor, this.TableMesh.color);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.TableMesh.vbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.TableMesh.nbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.TableMesh.ibo);
		gl.drawElements(gl.TRIANGLES, this.TableMesh.nPoints, gl.UNSIGNED_SHORT, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		// Draw Sofa
		gl.uniformMatrix4fv(this.DepthProgram.uniforms.mWorld, gl.FALSE, this.SofaMesh.world);
		gl.uniform4fv(this.DepthProgram.uniforms.meshColor, this.SofaMesh.color);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.SofaMesh.vbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.SofaMesh.nbo);
		gl.vertexAttribPointer(this.DepthProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
		gl.enableVertexAttribArray(this.DepthProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.SofaMesh.ibo);
		gl.drawElements(gl.TRIANGLES, this.SofaMesh.nPoints, gl.UNSIGNED_SHORT, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		// Finish generating this cube map
		//gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);
		//gl.generateMipmap(gl.TEXTURE_2D);
		//gl.bindTexture(gl.TEXTURE_2D, null);
	}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
};

LightMapDemo.prototype._Render = function () {
	var gl = this.gl;

	// Clear Back Buffer, Set Per-Frame Uniforms
	gl.disable(gl.BLEND);
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);

	// 
	// DRAW ACTUAL IMAGE
	// 
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(this.ShaderProgram);
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mProj, gl.FALSE, this.perFrameUniforms.mProj);
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mView, gl.FALSE, this.camera.GetViewMatrix());
	gl.uniform3fv(this.ShaderProgram.uniforms.pointLightPosition, mat4.getTranslation([0, 0, 0], this.LightMesh.world));
	gl.uniform1i(this.ShaderProgram.uniforms.pointShadowTexture, 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);

	// Draw Light
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mWorld, gl.FALSE, this.LightMesh.world);
	gl.uniform4fv(this.ShaderProgram.uniforms.meshColor, this.LightMesh.color);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.LightMesh.vbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.LightMesh.nbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vNorm, 3, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.LightMesh.ibo);
	gl.drawElements(gl.TRIANGLES, this.LightMesh.nPoints, gl.UNSIGNED_SHORT, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	// Draw Monkey
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mWorld, gl.FALSE, this.MonkeyMesh.world);
	gl.uniform4fv(this.ShaderProgram.uniforms.meshColor, this.MonkeyMesh.color);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.MonkeyMesh.vbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.MonkeyMesh.nbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.MonkeyMesh.ibo);
	gl.drawElements(gl.TRIANGLES, this.MonkeyMesh.nPoints, gl.UNSIGNED_SHORT, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	// Draw Walls
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mWorld, gl.FALSE, this.WallsMesh.world);
	gl.uniform4fv(this.ShaderProgram.uniforms.meshColor, this.WallsMesh.color);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.WallsMesh.vbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.WallsMesh.nbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.WallsMesh.ibo);
	gl.drawElements(gl.TRIANGLES, this.WallsMesh.nPoints, gl.UNSIGNED_SHORT, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	// Draw Table
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mWorld, gl.FALSE, this.TableMesh.world);
	gl.uniform4fv(this.ShaderProgram.uniforms.meshColor, this.TableMesh.color);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.TableMesh.vbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.TableMesh.nbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.TableMesh.ibo);
	gl.drawElements(gl.TRIANGLES, this.TableMesh.nPoints, gl.UNSIGNED_SHORT, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	// Draw Sofa
	gl.uniformMatrix4fv(this.ShaderProgram.uniforms.mWorld, gl.FALSE, this.SofaMesh.world);
	gl.uniform4fv(this.ShaderProgram.uniforms.meshColor, this.SofaMesh.color);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.SofaMesh.vbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vPos, 3, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.SofaMesh.nbo);
	gl.vertexAttribPointer(this.ShaderProgram.attribs.vNorm, 3, gl.FLOAT, gl.TRUE, 0, 0);
	gl.enableVertexAttribArray(this.ShaderProgram.attribs.vPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.SofaMesh.ibo);
	gl.drawElements(gl.TRIANGLES, this.SofaMesh.nPoints, gl.UNSIGNED_SHORT, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	//
	// DRAW SHADOW MAP
	//
	gl.useProgram(this.BillboardProgram);
	gl.uniform1i(this.BillboardProgram.uniforms.texToDraw, 0);
	gl.activeTexture(gl.TEXTURE0);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.BillboardMesh.vbo);
	gl.vertexAttribPointer(this.BillboardProgram.attribs.screenPos, 2, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.BillboardProgram.attribs.screenPos);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.BillboardMesh.uvbo);
	gl.vertexAttribPointer(this.BillboardProgram.attribs.texCoord, 2, gl.FLOAT, gl.FALSE, 0, 0);
	gl.enableVertexAttribArray(this.BillboardProgram.attribs.texCoord);

	// // +X
	// gl.viewport(gl.canvas.width / 2, gl.canvas.height * 3 / 4, gl.canvas.width / 4, gl.canvas.height / 4);
	// gl.bindTexture(gl.TEXTURE_2D, this.cubeMapTextures[0]);
	// gl.drawArrays(gl.TRIANGLES, 0, 6);

	// // -X
	// gl.viewport(gl.canvas.width * 3 / 4, gl.canvas.height * 3 / 4, gl.canvas.width / 4, gl.canvas.height / 4);
	// gl.bindTexture(gl.TEXTURE_2D, this.cubeMapTextures[1]);
	// gl.drawArrays(gl.TRIANGLES, 0, 6);

	// // +Y
	// gl.viewport(gl.canvas.width / 2, gl.canvas.height / 2, gl.canvas.width / 4, gl.canvas.height / 4);
	// gl.bindTexture(gl.TEXTURE_2D, this.cubeMapTextures[2]);
	// gl.drawArrays(gl.TRIANGLES, 0, 6);

	// // -Y
	// gl.viewport(gl.canvas.width * 3 / 4, gl.canvas.height / 2, gl.canvas.width / 4, gl.canvas.height / 4);
	// gl.bindTexture(gl.TEXTURE_2D, this.cubeMapTextures[3]);
	// gl.drawArrays(gl.TRIANGLES, 0, 6);

	// // +Z
	// gl.viewport(gl.canvas.width / 2, gl.canvas.height * 1 / 4, gl.canvas.width / 4, gl.canvas.height / 4);
	// gl.bindTexture(gl.TEXTURE_2D, this.cubeMapTextures[4]);
	// gl.drawArrays(gl.TRIANGLES, 0, 6);

	// // -Z
	// gl.viewport(gl.canvas.width * 3 / 4, gl.canvas.height * 1 / 4, gl.canvas.width / 4, gl.canvas.height / 4);
	// gl.bindTexture(gl.TEXTURE_2D, this.cubeMapTextures[5]);
	// gl.drawArrays(gl.TRIANGLES, 0, 6);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	//
	// END RENDER LOOP
	//
	gl.useProgram(null);
};

//
// Event Listeners (also private)
//
LightMapDemo.prototype._OnResizeWindow = function () {
	var gl = this.gl;

	var targetHeight = window.innerWidth * 9 / 16;

	if (window.innerHeight > targetHeight) {
		// Canvas too tall - center vertically
		gl.canvas.width = window.innerWidth;
		gl.canvas.height = targetHeight;
		gl.canvas.style.top = (window.innerHeight - targetHeight) / 2 + 'px';
		gl.canvas.style.left = '0px'
	} else {
		// Canvas too wide - center horizontally
		gl.canvas.style.left = (window.innerWidth - (window.innerHeight * 16 / 9)) / 2 + 'px';
		gl.canvas.style.top = '0px'
		gl.canvas.height = window.innerHeight;
		gl.canvas.width = window.innerHeight * 16 / 9;
	}

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
};

LightMapDemo.prototype._OnKeyPress = function (e) {
	switch (e.code) {
		case 'KeyW':
			this.PressedKeys.Up = true;
			break;
		case 'KeyA':
			this.PressedKeys.Left = true;
			break;
		case 'KeyD':
			this.PressedKeys.Right = true;
			break;
		case 'KeyS':
			this.PressedKeys.Down = true;
			break;
		case 'ArrowRight':
			this.PressedKeys.RotRight = true;
			break;
		case 'ArrowLeft':
			this.PressedKeys.RotLeft = true;
			break;
		case 'ArrowUp':
			this.PressedKeys.MovUp = true;
			break;
		case 'ArrowDown':
			this.PressedKeys.MovDown = true;
			break;
	}
};

LightMapDemo.prototype._OnKeyRelease = function (e) {
	switch (e.code) {
		case 'KeyW':
			this.PressedKeys.Up = false;
			break;
		case 'KeyA':
			this.PressedKeys.Left = false;
			break;
		case 'KeyD':
			this.PressedKeys.Right = false;
			break;
		case 'KeyS':
			this.PressedKeys.Down = false;
			break;
		case 'ArrowRight':
			this.PressedKeys.RotRight = false;
			break;
		case 'ArrowLeft':
			this.PressedKeys.RotLeft = false;
			break;
		case 'ArrowUp':
			this.PressedKeys.MovUp = false;
			break;
		case 'ArrowDown':
			this.PressedKeys.MovDown = false;
			break;
	}
};

LightMapDemo.prototype._OnMouseMove = function (e) {

};