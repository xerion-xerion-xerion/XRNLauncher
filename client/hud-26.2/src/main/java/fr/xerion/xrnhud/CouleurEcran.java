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
 private final Screen parent;private final IntConsumer chosen;private float hue,saturation,value,uiScale=1;private boolean settingHex;private int gx,gy,drag;private EditBox hex;
 CouleurEcran(Screen parent,int color,IntConsumer chosen){super(Component.literal("Choisir une couleur"));this.parent=parent;this.chosen=chosen;float[] hsv=java.awt.Color.RGBtoHSB(color>>16&255,color>>8&255,color&255,null);hue=hsv[0];saturation=hsv[1];value=hsv[2];}
 private int rgb(){return java.awt.Color.HSBtoRGB(hue,saturation,value);}
 @Override protected void init(){uiScale=(float)Math.min(1,Math.min((width-16)/350.0,(height-16)/218.0));gx=Math.round(width/uiScale)/2-151;gy=Math.round(height/uiScale)/2-82;
  hex=new ChampTexte(font,gx+221,gy+58,81,20,Component.literal("Couleur hexadecimale"));hex.setMaxLength(7);hex.setValue(String.format("#%06X",rgb()&0xFFFFFF));hex.setBordered(false);addRenderableWidget(hex);hex.setResponder(input->{if(settingHex||!input.matches("#[a-fA-F0-9]{6}"))return;int color=Integer.parseInt(input.substring(1),16);float[] hsv=java.awt.Color.RGBtoHSB(color>>16&255,color>>8&255,color&255,null);hue=hsv[0];saturation=hsv[1];value=hsv[2];});
  addRenderableWidget(Button.builder(Component.literal("Valider"),b->{if(hex.getValue().matches("#[a-fA-F0-9]{6}")){chosen.accept(0xFF000000|Integer.parseInt(hex.getValue().substring(1),16));Placement.sauver();onClose();}}).bounds(gx+218,gy+124,84,20).build());
  addRenderableWidget(Button.builder(Component.literal("Annuler"),b->onClose()).bounds(gx,gy+124,80,20).build());
 }
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
  mx=Math.round(mx/uiScale);my=Math.round(my/uiScale);c.pose().pushMatrix();c.pose().scale(uiScale,uiScale);
  Theme.arrondi(c,gx-14,gy-31,330,190,0xFA18151F,0xFF655176);Theme.texte(c,font,"CHOISIR UNE COULEUR",gx,gy-21,Theme.TEXTE);
  int level=Math.round(value*255),tint=0xFF000000|level<<16|level<<8|level;
  c.blit(net.minecraft.client.renderer.RenderPipelines.GUI_TEXTURED,net.minecraft.resources.Identifier.fromNamespaceAndPath("xrnhud","textures/gui/color-wheel.png"),gx+16,gy,0f,0f,108,108,256,256,256,256,tint);
  for(int yy=0;yy<108;yy++)Theme.rect(c,gx+200,gy+yy,12,1,java.awt.Color.HSBtoRGB(hue,saturation,1-yy/107f));
  int hx=gx+70+Math.round((float)Math.cos(hue*Math.PI*2)*saturation*54),hy=gy+54+Math.round((float)Math.sin(hue*Math.PI*2)*saturation*54);
  Theme.arrondi(c,hx-3,hy-3,7,7,0xFF17131D,0xFFFFFFFF);Theme.cadre(c,gx+198,gy+Math.round((1-value)*107)-2,16,5,0,0xFFFFFFFF);
  Theme.arrondi(c,gx+221,gy,81,46,rgb(),0xFFC4AEFF);Theme.texte(c,font,"#RRGGBB",gx+221,gy+86,hex.getValue().matches("#[a-fA-F0-9]{6}")?Theme.TEXTE_DOUX:Theme.ROUGE);
  Theme.champs(c,children());super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);c.pose().popMatrix();
 }
 private boolean pointer(double x,double y,boolean begin){
  if(begin)drag=Math.hypot(x-(gx+70),y-(gy+54))<=56?1:x>=gx+198&&x<=gx+214&&y>=gy&&y<=gy+108?2:0;
  if(drag==0)return false;
  if(drag==1){hue=(float)((Math.atan2(y-(gy+54),x-(gx+70))/(Math.PI*2)+1)%1);saturation=(float)Math.clamp(Math.hypot(x-(gx+70),y-(gy+54))/54,0,1);}else value=1-(float)Math.clamp((y-gy)/107,0,1);
  settingHex=true;hex.setValue(String.format("#%06X",rgb()&0xFFFFFF));settingHex=false;return true;
 }
 @Override public boolean mouseClicked(MouseButtonEvent e,boolean twice){return e.button()==0&&pointer(e.x()/uiScale,e.y()/uiScale,true)||super.mouseClicked(new MouseButtonEvent(e.x()/uiScale,e.y()/uiScale,e.buttonInfo()),twice);}
 @Override public boolean mouseDragged(MouseButtonEvent e,double dx,double dy){return drag!=0&&pointer(e.x()/uiScale,e.y()/uiScale,false)||super.mouseDragged(new MouseButtonEvent(e.x()/uiScale,e.y()/uiScale,e.buttonInfo()),dx/uiScale,dy/uiScale);}
 @Override public boolean mouseReleased(MouseButtonEvent e){drag=0;return super.mouseReleased(new MouseButtonEvent(e.x()/uiScale,e.y()/uiScale,e.buttonInfo()));}
 @Override public void onClose(){minecraft.gui.setScreen(parent);}
 @Override public boolean isPauseScreen(){return false;}
}
