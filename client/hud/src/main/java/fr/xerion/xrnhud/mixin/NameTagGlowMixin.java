package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
@Mixin(net.minecraft.client.render.command.LabelCommandRenderer.class)
public abstract class NameTagGlowMixin {
 @Redirect(method="render",at=@At(value="INVOKE",target="Lnet/minecraft/client/font/TextRenderer;draw(Lnet/minecraft/text/Text;FFIZLorg/joml/Matrix4f;Lnet/minecraft/client/render/VertexConsumerProvider;Lnet/minecraft/client/font/TextRenderer$TextLayerType;II)V"),require=1)
 private void xrn$halo(net.minecraft.client.font.TextRenderer font,net.minecraft.text.Text text,float x,float y,int color,boolean shadow,org.joml.Matrix4f matrix,net.minecraft.client.render.VertexConsumerProvider buffers,net.minecraft.client.font.TextRenderer.TextLayerType layer,int background,int light){
  String flat=text.getString();
  if(fr.xerion.xrnhud.NameTag.lueur&&(color>>>24)>200&&layer==net.minecraft.client.font.TextRenderer.TextLayerType.NORMAL&&(flat.contains(fr.xerion.xrnhud.Logo.CARACTERE)||fr.xerion.xrnhud.NameTag.actif&&flat.contains(net.minecraft.client.MinecraftClient.getInstance().getGameProfile().name()))){
   for(int i=0;i<2;i++){float dx=i==0?-.4f:i==1?.4f:0,dy=i==2?-.4f:i==3?.4f:0;font.draw(text,x+dx,y+dy,0x20FFFFFF,false,matrix,buffers,layer,0,15728880);}
  }
  font.draw(text,x,y,color,shadow,matrix,buffers,layer,background,light);
 }
}
