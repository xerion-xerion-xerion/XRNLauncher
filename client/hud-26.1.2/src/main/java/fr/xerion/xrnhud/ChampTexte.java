package fr.xerion.xrnhud;
/** Native editing behavior with centered text inside the custom field. */
final class ChampTexte extends net.minecraft.client.gui.components.EditBox {
 private final net.minecraft.client.gui.Font police;
 ChampTexte(net.minecraft.client.gui.Font font,int x,int y,int w,int h,net.minecraft.network.chat.Component label){super(font,x,y,w,h,label);police=font;setBordered(false);}
 @Override public void extractWidgetRenderState(net.minecraft.client.gui.GuiGraphicsExtractor c,int mx,int my,float delta){
  c.pose().pushMatrix();c.pose().translate(0,Math.max(0,(getHeight()-police.lineHeight)/2));super.extractWidgetRenderState(c,mx,my,delta);c.pose().popMatrix();
 }
}
