package fr.xerion.xrnhud;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
/** Wardrobe with the module browser's scale and theme, and an actual player preview. */
public class EcranGardeRobe extends Screen {
 private record Hit(int x,int y,int w,int h,Runnable action){boolean has(double mx,double my){return mx>=x&&mx<x+w&&my>=y&&my<y+h;}}
 private final List<Hit> hits=new ArrayList<>();private final Screen parent;
 private String selected;private float angle=180,uiScale=1;private int px,py,pw,ph,ax,ay,aw,ah,sx,sy,sw;
 private double listScroll,targetScroll;private int maxScroll,listX,listY,listW,listH;private long lastFrame=System.nanoTime();
 private boolean ownedOnly,dragging,slider;private double startX;private float startAngle;
 private final long opened=System.nanoTime();
 public EcranGardeRobe(){this(null);}public EcranGardeRobe(Screen parent){super(Text.literal("Garde-robe"));this.parent=parent;selected=Droits.CATALOGUE.stream().anyMatch(item->item.id.equals(Droits.equipe()))?Droits.equipe():Droits.CATALOGUE.get(0).id;}
 @Override public boolean shouldPause(){return false;}
 @Override public void close(){client.setScreen(parent);}
 @Override public void renderBackground(DrawContext c,int mx,int my,float delta){if(client.world!=null){super.applyBlur(c);c.fill(0,0,width,height,Theme.nuance(0x550B0812));}}
 @Override public void render(DrawContext c,int mx,int my,float delta){
  uiScale=(float)Math.min(1,2.0/client.getWindow().getScaleFactor());int vw=Math.round(width/uiScale),vh=Math.round(height/uiScale);mx=Math.round(mx/uiScale);my=Math.round(my/uiScale);
  pw=Math.min(vw-18,Math.min(730,(int)(vw*.9)));ph=Math.min(vh-18,Math.min(410,(int)(vh*.87)));px=(vw-pw)/2;py=(vh-ph)/2;
  int nav=pw>=560?96:78,bodyY=py+38;ax=px+nav+20;ay=bodyY+2;aw=Math.max(120,(pw-nav-42)/2);ah=ph-85;int right=ax+aw+18,rw=px+pw-right-14;
  sx=ax+18;sw=aw-36;sy=ay+ah-16;
  if(dragging)angle=slider?Math.max(0,Math.min(345,15+(mx-sx)*330f/sw)):Math.max(15,Math.min(345,startAngle+(float)(mx-startX)*1.1f));
  c.getMatrices().pushMatrix();c.getMatrices().scale(uiScale,uiScale);hits.clear();
  Theme.arrondi(c,px,py,pw,ph,Theme.nuance(0xF516141B),Theme.nuance(0xFF40354F));Theme.marque(c,px+12,py+11,1);Theme.texte(c,textRenderer,"GARDE-ROBE",px+28,py+11,Theme.TEXTE);button(c,"×",px+pw-25,py+6,19,19,this::close,true);
  Theme.rect(c,px+9,py+31,pw-18,1,Theme.BORDURE);Theme.rect(c,px+nav+8,bodyY,1,ph-76,Theme.BORDURE);
  button(c,"Collection",px+9,bodyY,nav-7,22,()->{ownedOnly=false;listScroll=targetScroll=0;},true);button(c,"Mes capes",px+9,bodyY+28,nav-7,22,()->{ownedOnly=true;listScroll=targetScroll=0;},true);Theme.rect(c,px+9,bodyY+(ownedOnly?28:0),2,22,Theme.ACCENT);
  Theme.arrondi(c,ax,ay,aw,ah,Theme.nuance(0xFF211B29),Theme.nuance(0xFF3B3048));Theme.texteCentre(c,textRenderer,"Votre personnage",ax+aw/2,ay+10,Theme.TEXTE_DOUX);
  Theme.arrondi(c,sx,sy,sw,3,Theme.nuance(0xFF403548),0);int knob=sx+Math.round(sw*(angle-15)/330);Theme.arrondi(c,sx,sy,Math.max(1,knob-sx),3,Theme.ACCENT,0);Theme.arrondi(c,knob-3,sy-2,6,7,Theme.TEXTE,0);
  int count=(int)Droits.CATALOGUE.stream().filter(item->!ownedOnly||Droits.possede(item.id)).count();
  int bottom=py+ph-69,rowH=38;listX=right;listY=bodyY;listW=rw;listH=Math.max(24,bottom-26-bodyY);maxScroll=Math.max(0,count*(rowH+6)-6-listH);targetScroll=Math.clamp(targetScroll,0,maxScroll);
  long now=System.nanoTime();listScroll+=(targetScroll-listScroll)*(1-Math.exp(-18*Math.min(.1,(now-lastFrame)/1e9)));lastFrame=now;int cy=bodyY-(int)Math.round(listScroll);
  c.enableScissor(right,bodyY,right+rw,bodyY+listH);
  for(var item:Droits.CATALOGUE){if(ownedOnly&&!Droits.possede(item.id))continue;final String id=item.id;boolean active=id.equals(selected);
   if(cy+rowH>bodyY&&cy<bodyY+listH){Theme.arrondi(c,right,cy,rw-6,rowH,active?Theme.nuance(0xFF30243D):Theme.nuance(0xFF211D28),active?Theme.ACCENT:Theme.nuance(0xFF40354B));
    Theme.texte(c,textRenderer,item.nom,right+10,cy+7,Theme.TEXTE);Theme.texte(c,textRenderer,Droits.possede(id)?(Droits.equipe().equals(id)?"Equipee":"Dans votre collection"):"Apercu",right+10,cy+23,Theme.TEXTE_DOUX);
    int top=Math.max(cy,bodyY),end=Math.min(cy+rowH,bodyY+listH);hits.add(new Hit(right,top,rw-6,end-top,()->selected=id));}cy+=rowH+6;
  }c.disableScissor();if(maxScroll>0){int thumb=Math.max(15,listH*listH/(listH+maxScroll));Theme.rect(c,right+rw-3,bodyY,2,listH,Theme.BORDURE);Theme.rect(c,right+rw-3,bodyY+(int)Math.round((listH-thumb)*listScroll/maxScroll),2,thumb,Theme.ACCENT);}
  boolean own=Droits.possede(selected),equipped=Droits.equipe().equals(selected);
  button(c,own?(equipped?"Retirer":"Equiper"):"Bientot disponible",right,bottom,rw,23,()->Droits.equiper(equipped?"":selected),own);
  if(rw>=140)Theme.texte(c,textRenderer,selected.equals("cape_space")?"Cape animee · Espace":"Cape fixe",right,bottom-17,Theme.TEXTE_DOUX);
  Theme.rect(c,px+9,py+ph-31,pw-18,1,Theme.BORDURE);button(c,"Retour",px+10,py+ph-24,66,17,this::close,true);if(pw>=450)Theme.texte(c,textRenderer,"Glissez sur le personnage pour tourner",px+nav+21,py+ph-19,Theme.TEXTE_FAIBLE);
  c.getMatrices().popMatrix();
  ApercuJoueur.dessiner(c,Math.round((ax+3)*uiScale),Math.round((ay+22)*uiScale),Math.round((aw-6)*uiScale),Math.round((ah-47)*uiScale),angle,selected);
 }
 private void button(DrawContext c,String title,int x,int y,int w,int h,Runnable action,boolean enabled){Theme.arrondi(c,x,y,w,h,enabled?Theme.nuance(0xFF2A2333):Theme.nuance(0xFF211D26),Theme.nuance(0xFF4B3D58));Theme.texteCentre(c,textRenderer,title,x+w/2,y+(h-8)/2,enabled?Theme.TEXTE:Theme.TEXTE_FAIBLE);if(enabled)hits.add(new Hit(x,y,w,h,action));}
 @Override public boolean mouseClicked(Click e,boolean twice){double mx=e.x()/uiScale,my=e.y()/uiScale;if(mx>=sx-5&&mx<=sx+sw+5&&my>=sy-7&&my<=sy+10){dragging=true;slider=true;return true;}if(mx>=ax&&mx<=ax+aw&&my>=ay+20&&my<=ay+ah-30){dragging=true;slider=false;startX=mx;startAngle=angle;return true;}for(Hit h:hits)if(h.has(mx,my)){h.action.run();return true;}return super.mouseClicked(e,twice);}
 @Override public boolean mouseScrolled(double x,double y,double horizontal,double vertical){x/=uiScale;y/=uiScale;if(x<listX||x>=listX+listW||y<listY||y>=listY+listH)return false;targetScroll=Math.clamp(targetScroll-vertical*36,0,maxScroll);return true;}
 @Override public boolean mouseReleased(Click e){if(dragging){dragging=false;return true;}return super.mouseReleased(e);}
}
