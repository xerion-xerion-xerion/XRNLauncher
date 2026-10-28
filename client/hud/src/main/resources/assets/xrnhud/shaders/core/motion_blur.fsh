#version 330
uniform sampler2D CurrentSampler;
uniform sampler2D HistorySampler;
layout(std140) uniform BlurData {vec4 Blur;};
in vec2 texCoord;
out vec4 fragColor;
void main(){vec4 current=texture(CurrentSampler,texCoord);vec3 history=texture(HistorySampler,texCoord).rgb;fragColor=vec4(mix(current.rgb,history,Blur.x),current.a);}
