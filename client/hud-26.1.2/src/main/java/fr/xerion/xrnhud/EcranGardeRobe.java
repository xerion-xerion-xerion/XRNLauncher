package fr.xerion.xrnhud;
import java.util.*;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.network.chat.Component;
/** Searchable cape gallery with a separate, manually rotated player preview. */
public class EcranGardeRobe extends Screen {
 private record Hit(int x,int y,int w,int h,Runnable action){boolean has(double mx,double my){return mx>=x&&mx<x+w&&my>=y&&my<y+h;}}
 private final List<Hit> hits=new ArrayList<>();private final Screen parent;private EditBox search;
 private String selected;private float angle=180,uiScale=1;private int px,py,pw,ph,ax,ay,aw,ah,sx,sy,sw;
 private double listScroll,targetScroll;private int maxScroll,listX,listY,listW,listH;private long lastFrame=System.nanoTime();
 private boolean ownedOnly,dragging,slider;private double startX;private float startAngle;
 public EcranGardeRobe(){this(null);}public EcranGardeRobe(Screen parent){super(Component.literal("Garde-robe"));this.parent=parent;PrimeClient.rafraichir();selected=Droits.CATALOGUE.stream().anyMatch(item->item.id.equals(Droits.equipe()))?Droits.equipe():Droits.CATALOGUE.get(0).id;}
 @Override public boolean isPauseScreen(){return false;}
 @Override public void onClose(){minecraft.setScreen(parent);}
 @Override protected void init(){uiScale=(float)Math.min(1,2.0/minecraft.getWindow().getGuiScale());search=new ChampTexte(font,0,0,150,16,Component.literal(Langue.t("Rechercher")));search.setBordered(false);search.setHint(Component.literal(Langue.t("Rechercher…")));search.setMaxLength(40);search.setResponder(v->listScroll=targetScroll=0);addRenderableWidget(search);}
 @Override public void extractBackground(GuiGraphicsExtractor c,int mx,int my,float delta){if(minecraft.level!=null){super.extractBlurredBackground(c);c.fill(0,0,width,height,Theme.nuance(0x550B0812));}}
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
  int vw=Math.round(width/uiScale),vh=Math.round(height/uiScale);mx=Math.round(mx/uiScale);my=Math.round(my/uiScale);
  pw=Math.min(vw-18,Math.min(790,(int)(vw*.91)));ph=Math.min(vh-18,Math.min(440,(int)(vh*.88)));px=(vw-pw)/2;py=(vh-ph)/2;
  int nav=pw>=560?96:76,bodyY=py+39;listX=px+nav+20;listY=bodyY+29;listW=Math.max(105,(pw-nav-40)*55/100);listH=ph-106;
  ax=listX+listW+14;ay=bodyY;aw=px+pw-14-ax;ah=ph-106;sx=ax+14;sw=aw-28;sy=ay+ah-15;
  if(dragging)angle=slider?Math.clamp(15+(mx-sx)*330f/sw,15,345):Math.clamp(startAngle+(float)(mx-startX)*1.1f,15,345);
  c.pose().pushMatrix();c.pose().scale(uiScale,uiScale);hits.clear();
  Theme.arrondi(c,px,py,pw,ph,Theme.nuance(0xF516141B),Theme.nuance(0xFF40354F));Theme.marque(c,px+12,py+11,1);Theme.texte(c,font,"GARDE-ROBE",px+28,py+11,Theme.TEXTE);button(c,"×",px+pw-25,py+6,19,19,this::onClose,true);
  Theme.rect(c,px+9,py+31,pw-18,1,Theme.BORDURE);Theme.rect(c,px+nav+8,bodyY,1,ph-76,Theme.BORDURE);
  button(c,"Collection",px+9,bodyY,nav-7,22,()->{ownedOnly=false;listScroll=targetScroll=0;},true);button(c,"Mes capes",px+9,bodyY+28,nav-7,22,()->{ownedOnly=true;listScroll=targetScroll=0;},true);Theme.rect(c,px+9,bodyY+(ownedOnly?28:0),2,22,Theme.ACCENT);
  Theme.texte(c,font,"Capes flottantes",px+13,bodyY+74,Theme.TEXTE_DOUX);button(c,CapeMouvement.actif?"Actif":"Inactif",px+9,bodyY+88,nav-7,22,()->{CapeMouvement.actif=!CapeMouvement.actif;Placement.sauver();},true);
  if(!CapeMouvement.externe())button(c,"Force "+Math.round(CapeMouvement.intensite*100)+" %",px+9,bodyY+116,nav-7,22,()->{CapeMouvement.intensite=CapeMouvement.intensite>=1.59f?.6f:Math.min(1.6f,CapeMouvement.intensite+.2f);Placement.sauver();},CapeMouvement.actif);
  search.setX(listX+6);search.setY(bodyY+5);search.setWidth(Math.max(50,listW-12));Theme.champs(c,children());
  String query=search.getValue().toLowerCase(Locale.ROOT);var items=Droits.CATALOGUE.stream().filter(item->(!ownedOnly||Droits.possede(item.id))&&Langue.t(item.nom).toLowerCase(Locale.ROOT).contains(query)).toList();int columns=listW>=260?3:listW>=150?2:1,gap=7,cw=(listW-6-(columns-1)*gap)/columns,ch=98;
  maxScroll=Math.max(0,((items.size()+columns-1)/columns)*(ch+gap)-gap-listH);targetScroll=Math.clamp(targetScroll,0,maxScroll);long now=System.nanoTime();listScroll+=(targetScroll-listScroll)*(1-Math.exp(-18*Math.min(.1,(now-lastFrame)/1e9)));lastFrame=now;
  c.enableScissor(listX,listY,listX+listW,listY+listH);
  for(int i=0;i<items.size();i++){var item=items.get(i);String id=item.id;int x=listX+(i%columns)*(cw+gap),y=listY+(i/columns)*(ch+gap)-(int)Math.round(listScroll);if(y+ch<=listY||y>=listY+listH)continue;
   boolean active=id.equals(selected);Theme.arrondi(c,x,y,cw,ch,active?Theme.nuance(0xFF30243D):Theme.nuance(0xFF211D28),active?Theme.ACCENT:Theme.nuance(0xFF40354B));var texture=Droits.texture(id);
   if(texture!=null){int tw=Math.min(43,cw-18),th=tw*16/10;int tx=x+(cw-tw)/2,ty=y+8;Theme.rect(c,tx+3,ty+3,tw,th,0x55000000);c.blit(net.minecraft.client.renderer.RenderPipelines.GUI_TEXTURED,texture,tx,ty,16f,16f,tw,th,160,256,1024,512);}
   String label=Langue.t(item.nom);while(!label.isEmpty()&&font.width(label)>cw-10)label=label.substring(0,label.length()-1);Theme.texteCentre(c,font,label,x+cw/2,y+ch-16,Theme.TEXTE);if(Droits.equipe().equals(id))Theme.rect(c,x+5,y+5,4,4,Theme.ACCENT);if(!Droits.possede(id))Theme.cadenas(c,x+cw-15,y+7,Theme.TEXTE_DOUX);
   hits.add(new Hit(x,Math.max(y,listY),cw,Math.min(y+ch,listY+listH)-Math.max(y,listY),()->selected=id));
  }c.disableScissor();if(maxScroll>0){int thumb=Math.max(15,listH*listH/(listH+maxScroll));Theme.rect(c,listX+listW-2,listY,2,listH,Theme.BORDURE);Theme.rect(c,listX+listW-2,listY+(int)Math.round((listH-thumb)*listScroll/maxScroll),2,thumb,Theme.ACCENT);}
  Theme.arrondi(c,ax,ay,aw,ah,Theme.nuance(0xFF1B1722),0);Theme.texteCentre(c,font,"Votre personnage",ax+aw/2,ay+9,Theme.TEXTE_DOUX);Theme.rect(c,sx,sy,sw,2,Theme.nuance(0xFF403548));int knob=sx+Math.round(sw*(angle-15)/330);Theme.rect(c,sx,sy,Math.max(1,knob-sx),2,Theme.ACCENT);Theme.arrondi(c,knob-3,sy-2,6,6,Theme.TEXTE,0);
  String name=Droits.CATALOGUE.stream().filter(item->item.id.equals(selected)).map(item->item.nom).findFirst().orElse("");Theme.texteCentre(c,font,name,ax+aw/2,ay+ah+8,Theme.TEXTE);
  boolean own=Droits.possede(selected),equipped=Droits.equipe().equals(selected);button(c,own?(equipped?"Retirer":"Equiper"):"Apercu",ax,py+ph-60,aw,23,()->Droits.equiper(equipped?"":selected),own);
  Theme.rect(c,px+9,py+ph-31,pw-18,1,Theme.BORDURE);button(c,"Retour",px+10,py+ph-24,66,17,this::onClose,true);if(pw>=450)Theme.texte(c,font,"Apercu fixe · Glissez pour tourner",px+nav+21,py+ph-19,Theme.TEXTE_FAIBLE);
  super.extractRenderState(c,mx,my,delta);c.pose().popMatrix();ApercuJoueur.dessiner(c,Math.round((ax+3)*uiScale),Math.round((ay+22)*uiScale),Math.round((aw-6)*uiScale),Math.round((ah-43)*uiScale),angle,selected);
 }
 private void button(GuiGraphicsExtractor c,String title,int x,int y,int w,int h,Runnable action,boolean enabled){Theme.arrondi(c,x,y,w,h,enabled?Theme.nuance(0xFF2A2333):Theme.nuance(0xFF211D26),Theme.nuance(0xFF4B3D58));Theme.texteCentre(c,font,title,x+w/2,y+(h-8)/2,enabled?Theme.TEXTE:Theme.TEXTE_FAIBLE);if(enabled)hits.add(new Hit(x,y,w,h,action));}
 @Override public boolean mouseClicked(MouseButtonEvent e,boolean twice){double mx=e.x()/uiScale,my=e.y()/uiScale;if(search.isMouseOver(mx,my))return super.mouseClicked(new MouseButtonEvent(mx,my,e.buttonInfo()),twice);if(mx>=sx-5&&mx<=sx+sw+5&&my>=sy-7&&my<=sy+10){dragging=true;slider=true;return true;}if(mx>=ax&&mx<=ax+aw&&my>=ay+20&&my<=ay+ah-30){dragging=true;slider=false;startX=mx;startAngle=angle;return true;}for(Hit h:hits)if(h.has(mx,my)){h.action.run();return true;}return super.mouseClicked(new MouseButtonEvent(mx,my,e.buttonInfo()),twice);}
 @Override public boolean mouseScrolled(double x,double y,double horizontal,double vertical){x/=uiScale;y/=uiScale;if(x<listX||x>=listX+listW||y<listY||y>=listY+listH)return false;targetScroll=Math.clamp(targetScroll-vertical*36,0,maxScroll);return true;}
 @Override public boolean mouseReleased(MouseButtonEvent e){if(dragging){dragging=false;return true;}return super.mouseReleased(e);}
}
