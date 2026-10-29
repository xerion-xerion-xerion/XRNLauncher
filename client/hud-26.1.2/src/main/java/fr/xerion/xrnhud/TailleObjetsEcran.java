package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.network.chat.Component;
final class TailleObjetsEcran extends Screen {
 private final Screen parent;private String selected="minecraft:golden_apple";private EditBox id;
 TailleObjetsEcran(Screen p){super(Component.literal("Taille des objets"));parent=p;}
 private void button(String text,int x,int y,int w,Runnable action){addRenderableWidget(Button.builder(Component.literal(text),b->{action.run();Placement.sauver();if(minecraft.screen==this)rebuildWidgets();}).bounds(x,y,w,22).build());}
 private void choisir(String value){selected=value;}
 protected void init(){int x=width/2-170,y=height/2-128;
  id=new ChampTexte(font,x+6,y+22,328,20,Component.literal("Identifiant de l'objet"));id.setBordered(false);id.setMaxLength(160);id.setValue(selected);id.setResponder(value->selected=value.trim());addRenderableWidget(id);
  button("Objet en main",x,y+54,164,()->{if(minecraft.player!=null){String held=TailleObjets.id(minecraft.player.getMainHandItem());if(!held.isEmpty())choisir(held);}});
  button("Epee de Netherite",x+176,y+54,164,()->choisir("minecraft:netherite_sword"));
  button("Pomme doree",x,y+84,164,()->choisir("minecraft:golden_apple"));button("Pomme enchantee",x+176,y+84,164,()->choisir("minecraft:enchanted_golden_apple"));
  button("−",x,y+116,42,()->{TailleObjets.modifier(selected,TailleObjets.taille(selected)-.1f);TailleObjets.actif=true;});
  button("+",x+130,y+116,42,()->{TailleObjets.modifier(selected,TailleObjets.taille(selected)+.1f);TailleObjets.actif=true;});button("Taille normale",x+184,y+116,156,()->TailleObjets.modifier(selected,1));
  button("En main : "+(TailleObjets.enMain?"oui":"non"),x,y+150,164,()->TailleObjets.enMain=!TailleObjets.enMain);button("Inventaire : "+(TailleObjets.inventaire?"oui":"non"),x+176,y+150,164,()->TailleObjets.inventaire=!TailleObjets.inventaire);
  button("Module : "+(TailleObjets.actif?"actif":"inactif"),x,y+182,164,()->TailleObjets.actif=!TailleObjets.actif);button("Retour",x+240,y+226,100,this::onClose);
 }
 public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float d){int x=width/2-170,y=height/2-128;Theme.arrondi(c,x-12,y-20,364,282,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,font,"TAILLE DES OBJETS",x,y-8,Theme.TEXTE);Theme.champs(c,children());super.extractRenderState(c,mx,my,d);Theme.boutons(c,font,children(),mx,my);Theme.texteCentre(c,font,String.format(java.util.Locale.ROOT,"%.1f ×",TailleObjets.taille(selected)),x+86,y+123,Theme.ACCENT);Theme.texte(c,font,"Un reglage visuel different pour chaque objet.",x,y+214,Theme.TEXTE_DOUX);}
 public void onClose(){minecraft.setScreen(parent);}public boolean isPauseScreen(){return false;}
}
