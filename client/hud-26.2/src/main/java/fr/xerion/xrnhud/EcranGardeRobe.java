package fr.xerion.xrnhud;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
/** Wardrobe with the module browser's scale and theme, and an actual player preview. */
public class EcranGardeRobe extends Screen {
 private record Hit(int x,int y,int w,int h,Runnable action){boolean has(double mx,double my){return mx>=x&&mx<x+w&&my>=y&&my<y+h;}}
 private final List<Hit> hits=new ArrayList<>();private final Screen parent;
 private String selected;private float angle=180,uiScale=1;private int px,py,pw,ph,ax,ay,aw,ah,sx,sy,sw;
 private boolean ownedOnly,dragging,slider;private double startX;private float startAngle;
 private final long opened=System.nanoTime();
 public EcranGardeRobe(){this(null);}public EcranGardeRobe(Screen parent){super(Component.literal("Garde-robe"));this.parent=parent;selected=Droits.CATALOGUE.stream().anyMatch(item->item.id.equals(Droits.equipe()))?Droits.equipe():Droits.CATALOGUE.get(0).id;}
 @Override public boolean isPauseScreen(){return false;}
 @Override public void onClose(){minecraft.gui.setScreen(parent);}
 @Override public void extractBackground(GuiGraphicsExtractor c,int mx,int my,float delta){if(minecraft.level!=null){super.extractBlurredBackground(c);c.fill(0,0,width,height,Theme.nuance(0x550B0812));}}
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
  uiScale=(float)Math.min(1,2.0/minecraft.getWindow().getGuiScale());int vw=Math.round(width/uiScale),vh=Math.round(height/uiScale);mx=Math.round(mx/uiScale);my=Math.round(my/uiScale);
  pw=Math.min(vw-18,Math.min(730,(int)(vw*.9)));ph=Math.min(vh-18,Math.min(410,(int)(vh*.87)));px=(vw-pw)/2;py=(vh-ph)/2;
  int nav=pw>=560?96:78,bodyY=py+38;ax=px+nav+20;ay=bodyY+2;aw=Math.max(120,(pw-nav-42)/2);ah=ph-85;int right=ax+aw+18,rw=px+pw-right-14;
  sx=ax+18;sw=aw-36;sy=ay+ah-16;
  if(dragging)angle=slider?Math.max(0,Math.min(345,15+(mx-sx)*330f/sw)):Math.max(15,Math.min(345,startAngle+(float)(mx-startX)*1.1f));
  c.pose().pushMatrix();c.pose().scale(uiScale,uiScale);hits.clear();
  Theme.arrondi(c,px,py,pw,ph,Theme.nuance(0xF516141B),Theme.nuance(0xFF40354F));Theme.marque(c,px+12,py+11,1);Theme.texte(c,font,"GARDE-ROBE",px+28,py+11,Theme.TEXTE);button(c,"×",px+pw-25,py+6,19,19,this::onClose,true);
  Theme.rect(c,px+9,py+31,pw-18,1,Theme.BORDURE);Theme.rect(c,px+nav+8,bodyY,1,ph-76,Theme.BORDURE);
  button(c,"Collection",px+9,bodyY,nav-7,22,()->ownedOnly=false,true);button(c,"Mes capes",px+9,bodyY+28,nav-7,22,()->ownedOnly=true,true);Theme.rect(c,px+9,bodyY+(ownedOnly?28:0),2,22,Theme.ACCENT);
  Theme.arrondi(c,ax,ay,aw,ah,Theme.nuance(0xFF211B29),Theme.nuance(0xFF3B3048));Theme.texteCentre(c,font,"Votre personnage",ax+aw/2,ay+10,Theme.TEXTE_DOUX);
  Theme.arrondi(c,sx,sy,sw,3,Theme.nuance(0xFF403548),0);int knob=sx+Math.round(sw*(angle-15)/330);Theme.arrondi(c,sx,sy,Math.max(1,knob-sx),3,Theme.ACCENT,0);Theme.arrondi(c,knob-3,sy-2,6,7,Theme.TEXTE,0);
  int count=(int)Droits.CATALOGUE.stream().filter(item->!ownedOnly||Droits.possede(item.id)).count();
  int rowH=Math.max(18,Math.min(43,(ph-132)/Math.max(1,count)-5));int cy=bodyY;
  for(var item:Droits.CATALOGUE){if(ownedOnly&&!Droits.possede(item.id))continue;final String id=item.id;boolean active=id.equals(selected);Theme.arrondi(c,right,cy,rw,rowH,active?Theme.nuance(0xFF30243D):Theme.nuance(0xFF211D28),active?Theme.ACCENT:Theme.nuance(0xFF40354B));
   Theme.texte(c,font,item.nom,right+10,cy+(rowH>=34?8:(rowH-8)/2),Theme.TEXTE);if(rowH>=34)Theme.texte(c,font,Droits.possede(id)?(Droits.equipe().equals(id)?"Equipee":"Dans votre collection"):"Apercu",right+10,cy+24,Theme.TEXTE_DOUX);hits.add(new Hit(right,cy,rw,rowH,()->selected=id));cy+=rowH+5;
  }
  int bottom=py+ph-69;boolean own=Droits.possede(selected),equipped=Droits.equipe().equals(selected);
  button(c,own?(equipped?"Retirer":"Equiper"):"Bientot disponible",right,bottom,rw,23,()->Droits.equiper(equipped?"":selected),own);
  if(rw>=140)Theme.texte(c,font,selected.equals("cape_space")?"Cape animee · Espace":"Cape fixe",right,bottom-17,Theme.TEXTE_DOUX);
  Theme.rect(c,px+9,py+ph-31,pw-18,1,Theme.BORDURE);button(c,"Retour",px+10,py+ph-24,66,17,this::onClose,true);if(pw>=450)Theme.texte(c,font,"Glissez sur le personnage pour tourner",px+nav+21,py+ph-19,Theme.TEXTE_FAIBLE);
  c.pose().popMatrix();
  ApercuJoueur.dessiner(c,Math.round((ax+3)*uiScale),Math.round((ay+22)*uiScale),Math.round((aw-6)*uiScale),Math.round((ah-47)*uiScale),angle,selected);
 }
 private void button(GuiGraphicsExtractor c,String title,int x,int y,int w,int h,Runnable action,boolean enabled){Theme.arrondi(c,x,y,w,h,enabled?Theme.nuance(0xFF2A2333):Theme.nuance(0xFF211D26),Theme.nuance(0xFF4B3D58));Theme.texteCentre(c,font,title,x+w/2,y+(h-8)/2,enabled?Theme.TEXTE:Theme.TEXTE_FAIBLE);if(enabled)hits.add(new Hit(x,y,w,h,action));}
 @Override public boolean mouseClicked(MouseButtonEvent e,boolean twice){double mx=e.x()/uiScale,my=e.y()/uiScale;if(mx>=sx-5&&mx<=sx+sw+5&&my>=sy-7&&my<=sy+10){dragging=true;slider=true;return true;}if(mx>=ax&&mx<=ax+aw&&my>=ay+20&&my<=ay+ah-30){dragging=true;slider=false;startX=mx;startAngle=angle;return true;}for(Hit h:hits)if(h.has(mx,my)){h.action.run();return true;}return super.mouseClicked(e,twice);}
 @Override public boolean mouseReleased(MouseButtonEvent e){if(dragging){dragging=false;return true;}return super.mouseReleased(e);}
}
