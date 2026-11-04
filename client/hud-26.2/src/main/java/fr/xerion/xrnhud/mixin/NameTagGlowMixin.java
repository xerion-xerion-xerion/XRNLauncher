package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.feature.NameTagFeatureRenderer;
@Mixin(NameTagFeatureRenderer.class)
public abstract class NameTagGlowMixin {
 @Redirect(method="prepareText",at=@At(value="INVOKE",target="Lnet/minecraft/client/gui/Font;prepareText(Lnet/minecraft/util/FormattedCharSequence;FFIZZI)Lnet/minecraft/client/gui/Font$PreparedText;"),require=1)
 private static Font.PreparedText xrn$halo(Font font,net.minecraft.util.FormattedCharSequence text,float x,float y,int color,boolean shadow,boolean effect,int background,Font owner,NameTagFeatureRenderer.Submit submit){
  var original=font.prepareText(text,x,y,color,shadow,effect,background);String flat=submit.text().getString();
  if(!fr.xerion.xrnhud.NameTag.lueur||(color>>>24)<=200||submit.displayMode()!=Font.DisplayMode.NORMAL||!(flat.contains(fr.xerion.xrnhud.Logo.CARACTERE)||fr.xerion.xrnhud.NameTag.actif&&flat.contains(net.minecraft.client.Minecraft.getInstance().getGameProfile().name())))return original;
  Font.PreparedText[] halos=new Font.PreparedText[2];for(int i=0;i<2;i++)halos[i]=font.prepareText(text,x+(i==0?-.4f:i==1?.4f:0),y+(i==2?-.4f:i==3?.4f:0),0x20FFFFFF,false,false,0);
  return new Font.PreparedText(){public void visit(Font.GlyphVisitor visitor){for(var halo:halos)halo.visit(visitor);original.visit(visitor);}public net.minecraft.client.gui.navigation.ScreenRectangle bounds(){return original.bounds();}};
 }
}
