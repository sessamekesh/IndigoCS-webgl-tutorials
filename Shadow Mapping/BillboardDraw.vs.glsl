precision mediump float;

attribute vec2 screenPos;
attribute vec2 texCoord;

varying vec2 fUV;

void main()
{
	fUV = texCoord;
	gl_Position = vec4(screenPos, 0.0, 1.0);
}