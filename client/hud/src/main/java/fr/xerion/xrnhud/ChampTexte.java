package fr.xerion.xrnhud;
/** Native editing behavior with centered text inside the custom field. */
final class ChampTexte extends net.minecraft.client.gui.widget.TextFieldWidget {
 private final net.minecraft.client.font.TextRenderer police;
 ChampTexte(net.minecraft.client.font.TextRenderer font,int x,int y,int w,int h,net.minecraft.text.Text label){super(font,x,y,w,h,label);police=font;setDrawsBackground(false);}
 @Override public void renderWidget(net.minecraft.client.gui.DrawContext c,int mx,int my,float delta){
  c.getMatrices().pushMatrix();c.getMatrices().translate(0,Math.max(0,(getHeight()-police.fontHeight)/2));super.renderWidget(c,mx,my,delta);c.getMatrices().popMatrix();
 }
}
