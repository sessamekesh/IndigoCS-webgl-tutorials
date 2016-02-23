precision mediump float;

uniform vec4 meshColor;

uniform samplerCube pointShadowTexture;
uniform vec3 pointLightPosition;

varying vec3 fPos;
varying vec3 fNorm;

void main()
{
	// if (textureCube(pointShadowTexture, fPos).z > length(fPos - pointLightPosition)) {
	// 	gl_FragColor = meshColor * 0.5;
	// } else {
	// 	gl_FragColor = meshColor;
	// }
	//gl_FragColor = vec4(vec3(0.1, 0.1, 0.1) * length(fPos - pointLightPosition), 1.0);
	gl_FragColor = vec4(textureCube(pointShadowTexture, (fPos - pointLightPosition)).rgb, 1.0);
}