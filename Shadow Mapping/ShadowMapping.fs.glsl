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
	float wsSqMg = sqrt(dd.x * dd.x + dd.y * dd.y + dd.z * dd.z);
	vec3 ds = textureCube(pointShadowTexture, (fPos - pointLightPosition)).rgb;
	float ssSqMg = ds.r * (shadowClipNearFar.y - shadowClipNearFar.x) + shadowClipNearFar.x;
	vec3 normLightDir = normalize(pointLightPosition - fPos);

	if (fNorm.x > 777.0) {
		discard;
	}

	float lightIntensity = 0.6;

	if ((ssSqMg + 0.13) > wsSqMg) {
		lightIntensity = lightIntensity + (1.0 - lightIntensity) * max(dot(fNorm, normLightDir), 0.0);
	}

	gl_FragColor = vec4(meshColor.rgb * lightIntensity, meshColor.a);
}