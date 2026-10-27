package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.network.chat.Component;
import java.util.function.IntConsumer;
/** HSV palette with continuous pointer selection and editable RGB hex. */
final class CouleurEcran extends Screen {
 private final Screen parent;private final IntConsumer chosen;private float hue,saturation,value;private boolean settingHex;private int gx,gy,drag;private EditBox hex;
 CouleurEcran(Screen parent,int color,IntConsumer chosen){super(Component.literal("Choisir une couleur"));this.parent=parent;this.chosen=chosen;float[] hsv=java.awt.Color.RGBtoHSB(color>>16&255,color>>8&255,color&255,null);hue=hsv[0];saturation=hsv[1];value=hsv[2];}
 private int rgb(){return java.awt.Color.HSBtoRGB(hue,saturation,value);}
 @Override protected void init(){gx=width/2-151;gy=height/2-82;
  hex=new ChampTexte(font,gx+221,gy+58,81,20,Component.literal("Couleur hexadecimale"));hex.setMaxLength(7);hex.setValue(String.format("#%06X",rgb()&0xFFFFFF));hex.setBordered(false);addRenderableWidget(hex);hex.setResponder(input->{if(settingHex||!input.matches("#[a-fA-F0-9]{6}"))return;int color=Integer.parseInt(input.substring(1),16);float[] hsv=java.awt.Color.RGBtoHSB(color>>16&255,color>>8&255,color&255,null);hue=hsv[0];saturation=hsv[1];value=hsv[2];});
  addRenderableWidget(Button.builder(Component.literal("Valider"),b->{if(hex.getValue().matches("#[a-fA-F0-9]{6}")){chosen.accept(0xFF000000|Integer.parseInt(hex.getValue().substring(1),16));Placement.sauver();onClose();}}).bounds(gx+218,gy+124,84,20).build());
  addRenderableWidget(Button.builder(Component.literal("Annuler"),b->onClose()).bounds(gx,gy+124,80,20).build());
 }
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
  Theme.arrondi(c,gx-14,gy-31,330,190,0xFA18151F,0xFF655176);Theme.texte(c,font,"CHOISIR UNE COULEUR",gx,gy-21,Theme.TEXTE);
  for(int y=0;y<108;y+=2)for(int x=0;x<192;x+=2)Theme.rect(c,gx+x,gy+y,2,2,java.awt.Color.HSBtoRGB(hue,x/191f,1-y/107f));
  for(int y=0;y<108;y++)Theme.rect(c,gx+200,gy+y,12,1,java.awt.Color.HSBtoRGB(y/107f,1,1));
  Theme.cadre(c,gx+Math.round(saturation*191)-3,gy+Math.round((1-value)*107)-3,7,7,0,0xFFFFFFFF);
  Theme.cadre(c,gx+198,gy+Math.round(hue*107)-2,16,5,0,0xFFFFFFFF);
  Theme.arrondi(c,gx+221,gy,81,46,rgb(),0xFFC4AEFF);Theme.texte(c,font,"#RRGGBB",gx+221,gy+86,hex.getValue().matches("#[a-fA-F0-9]{6}")?Theme.TEXTE_DOUX:Theme.ROUGE);
  Theme.champs(c,children());super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);
 }
 private boolean pointer(double x,double y,boolean begin){
  if(begin)drag=x>=gx&&x<=gx+192&&y>=gy&&y<=gy+108?1:x>=gx+198&&x<=gx+214&&y>=gy&&y<=gy+108?2:0;
  if(drag==0)return false;
  if(drag==1){saturation=(float)Math.clamp((x-gx)/191,0,1);value=1-(float)Math.clamp((y-gy)/107,0,1);}else hue=(float)Math.clamp((y-gy)/107,0,1);
  settingHex=true;hex.setValue(String.format("#%06X",rgb()&0xFFFFFF));settingHex=false;return true;
 }
 @Override public boolean mouseClicked(MouseButtonEvent e,boolean twice){return e.button()==0&&pointer(e.x(),e.y(),true)||super.mouseClicked(e,twice);}
 @Override public boolean mouseDragged(MouseButtonEvent e,double dx,double dy){return drag!=0&&pointer(e.x(),e.y(),false)||super.mouseDragged(e,dx,dy);}
 @Override public boolean mouseReleased(MouseButtonEvent e){drag=0;return super.mouseReleased(e);}
 @Override public void onClose(){minecraft.gui.setScreen(parent);}
 @Override public boolean isPauseScreen(){return false;}
}
