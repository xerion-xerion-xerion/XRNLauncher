package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
@Mixin(net.minecraft.client.renderer.feature.NameTagFeatureRenderer.class)
public abstract class NameTagGlowMixin {
 @Redirect(method="renderTranslucent",at=@At(value="INVOKE",target="Lnet/minecraft/client/gui/Font;drawInBatch(Lnet/minecraft/network/chat/Component;FFIZLorg/joml/Matrix4fc;Lnet/minecraft/client/renderer/MultiBufferSource;Lnet/minecraft/client/gui/Font$DisplayMode;II)V"),require=1)
 private void xrn$halo(net.minecraft.client.gui.Font font,net.minecraft.network.chat.Component text,float x,float y,int color,boolean shadow,org.joml.Matrix4fc matrix,net.minecraft.client.renderer.MultiBufferSource buffers,net.minecraft.client.gui.Font.DisplayMode layer,int background,int light){
  String flat=text.getString();
  if(fr.xerion.xrnhud.NameTag.lueur&&(color>>>24)>200&&layer==net.minecraft.client.gui.Font.DisplayMode.NORMAL&&(flat.contains(fr.xerion.xrnhud.Logo.CARACTERE)||fr.xerion.xrnhud.NameTag.actif&&flat.contains(net.minecraft.client.Minecraft.getInstance().getGameProfile().name()))){
   for(int i=0;i<2;i++){float dx=i==0?-.4f:i==1?.4f:0,dy=i==2?-.4f:i==3?.4f:0;font.drawInBatch(text,x+dx,y+dy,0x20FFFFFF,false,matrix,buffers,layer,0,15728880);}
  }
  font.drawInBatch(text,x,y,color,shadow,matrix,buffers,layer,background,light);
 }
}
