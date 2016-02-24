precision mediump float;

uniform vec3 pointLightPosition;
uniform vec2 shadowClipNearFar;

varying vec3 fPos;
varying vec3 fNorm;

void main()
{
	vec3 dd = fPos - pointLightPosition;
	float sqLen = (dd.x * dd.x + dd.y * dd.y + dd.z * dd.z);
	sqLen = (sqLen - shadowClipNearFar.x) / (shadowClipNearFar.y - shadowClipNearFar.x);
	gl_FragColor = vec4(sqLen, sqLen, sqLen, 1.0);
}