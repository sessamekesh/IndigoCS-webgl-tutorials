precision mediump float;

varying vec3 fPos;
varying vec3 fNorm;

void main()
{
	gl_FragColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
}