precision mediump float;

uniform sampler2D texToDraw;

varying vec2 fUV;

void main()
{
	gl_FragColor = texture2D(texToDraw, fUV);
}