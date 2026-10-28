package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
final class TailleObjetsEcran extends Screen {
 private final Screen parent;private String selected="minecraft:golden_apple";private TextFieldWidget id;
 TailleObjetsEcran(Screen p){super(Text.literal("Taille des objets"));parent=p;}
 private void button(String text,int x,int y,int w,Runnable action){addDrawableChild(ButtonWidget.builder(Text.literal(text),b->{action.run();Placement.sauver();if(client.currentScreen==this)clearAndInit();}).dimensions(x,y,w,22).build());}
 private void choisir(String value){selected=value;}
 protected void init(){int x=width/2-170,y=height/2-128;
  id=new ChampTexte(textRenderer,x+6,y+22,328,20,Text.literal("Identifiant de l'objet"));id.setDrawsBackground(false);id.setMaxLength(160);id.setText(selected);id.setChangedListener(value->selected=value.trim());addDrawableChild(id);
  button("Objet en main",x,y+54,164,()->{if(client.player!=null){String held=TailleObjets.id(client.player.getMainHandStack());if(!held.isEmpty())choisir(held);}});
  button("Epee de Netherite",x+176,y+54,164,()->choisir("minecraft:netherite_sword"));
  button("Pomme doree",x,y+84,164,()->choisir("minecraft:golden_apple"));button("Pomme enchantee",x+176,y+84,164,()->choisir("minecraft:enchanted_golden_apple"));
  button("−",x,y+116,42,()->{TailleObjets.modifier(selected,TailleObjets.taille(selected)-.1f);TailleObjets.actif=true;});
  button("+",x+130,y+116,42,()->{TailleObjets.modifier(selected,TailleObjets.taille(selected)+.1f);TailleObjets.actif=true;});button("Taille normale",x+184,y+116,156,()->TailleObjets.modifier(selected,1));
  button("En main : "+(TailleObjets.enMain?"oui":"non"),x,y+150,164,()->TailleObjets.enMain=!TailleObjets.enMain);button("Inventaire : "+(TailleObjets.inventaire?"oui":"non"),x+176,y+150,164,()->TailleObjets.inventaire=!TailleObjets.inventaire);
  button("Module : "+(TailleObjets.actif?"actif":"inactif"),x,y+182,164,()->TailleObjets.actif=!TailleObjets.actif);button("Retour",x+240,y+226,100,this::close);
 }
 public void render(DrawContext c,int mx,int my,float d){int x=width/2-170,y=height/2-128;Theme.arrondi(c,x-12,y-20,364,282,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,textRenderer,"TAILLE DES OBJETS",x,y-8,Theme.TEXTE);Theme.champs(c,children());super.render(c,mx,my,d);Theme.boutons(c,textRenderer,children(),mx,my);Theme.texteCentre(c,textRenderer,String.format(java.util.Locale.ROOT,"%.1f ×",TailleObjets.taille(selected)),x+86,y+123,Theme.ACCENT);Theme.texte(c,textRenderer,"Un reglage visuel different pour chaque objet.",x,y+214,Theme.TEXTE_DOUX);}
 public void close(){client.setScreen(parent);}public boolean shouldPause(){return false;}
}
