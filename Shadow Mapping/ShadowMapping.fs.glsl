precision mediump float;

uniform vec4 meshColor;

uniform vec2 shadowClipNearFar;
uniform samplerCube pointShadowTexture;
uniform vec3 pointLightPosition;

varying vec3 fPos;
varying vec3 fNorm;

void main()
{
	vec3 dd = (fPos - pointLightPosition);
	float wsSqMg = dd.x * dd.x + dd.y * dd.y + dd.z * dd.z;
	vec3 ds = textureCube(pointShadowTexture, (fPos - pointLightPosition)).rgb;
	float ssSqMg = ds.r * (shadowClipNearFar.y - shadowClipNearFar.x) + shadowClipNearFar.x;

	if (fNorm.x > 777.0) {
		discard;
	}

	if ((ssSqMg + 0.1) < wsSqMg) {
		gl_FragColor = vec4(meshColor.rgb * 0.5, meshColor.a);
	} else {
		gl_FragColor = meshColor;
	}
}