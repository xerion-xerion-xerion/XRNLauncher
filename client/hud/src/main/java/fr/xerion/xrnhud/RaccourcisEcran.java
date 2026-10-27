package fr.xerion.xrnhud;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

final class RaccourcisEcran extends Screen {
    private final Screen parent;
    private TextFieldWidget message,address,deathMessage;
    private boolean textOn,connectOn,killOn,deathOn;
    private String erreur="";
    RaccourcisEcran(Screen parent){super(Text.literal("Raccourcis"));this.parent=parent;killOn=Raccourcis.surKill;deathOn=Raccourcis.surMort;textOn=Raccourcis.autoText;connectOn=Raccourcis.autoConnect;}
    @Override protected void init(){
        int x=width/2-170,y=Math.max(30,height/2-132);
        message=new ChampTexte(textRenderer,x,y+42,320,20,Text.literal("Texte rapide"));message.setMaxLength(256);message.setText(Raccourcis.message);message.setDrawsBackground(false);addDrawableChild(message);
        deathMessage=new ChampTexte(textRenderer,x,y+104,320,20,Text.literal("Texte apres une mort"));deathMessage.setMaxLength(256);deathMessage.setText(Raccourcis.messageMort);deathMessage.setDrawsBackground(false);addDrawableChild(deathMessage);
        addDrawableChild(ButtonWidget.builder(Text.literal("Elimination : "+(killOn?"oui":"non")),b->{killOn=!killOn;b.setMessage(Text.literal("Elimination : "+(killOn?"oui":"non")));}).dimensions(x,y+75,154,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Mort : "+(deathOn?"oui":"non")),b->{deathOn=!deathOn;b.setMessage(Text.literal("Mort : "+(deathOn?"oui":"non")));}).dimensions(x+164,y+75,156,20).build());
        address=new ChampTexte(textRenderer,x,y+194,320,20,Text.literal("Serveur au demarrage"));address.setMaxLength(255);address.setText(Raccourcis.adresse);address.setPlaceholder(Text.literal("exemple.fr:25565"));address.setDrawsBackground(false);addDrawableChild(address);
        addDrawableChild(ButtonWidget.builder(Text.literal(textOn?"Auto Text : actif":"Auto Text : inactif"),b->{textOn=!textOn;b.setMessage(Text.literal(textOn?"Auto Text : actif":"Auto Text : inactif"));}).dimensions(x,y+16,170,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal(connectOn?"Auto Connect : actif":"Auto Connect : inactif"),b->{connectOn=!connectOn;b.setMessage(Text.literal(connectOn?"Auto Connect : actif":"Auto Connect : inactif"));}).dimensions(x,y+169,170,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Enregistrer"),b->{
            if(connectOn&&!Raccourcis.adresseValide(address.getText())){erreur="Adresse du serveur invalide";return;}
            Raccourcis.messageMort=Raccourcis.nettoyer(deathMessage.getText(),256);Raccourcis.message=Raccourcis.nettoyer(message.getText(),256);Raccourcis.adresse=Raccourcis.nettoyer(address.getText(),255);Raccourcis.surKill=killOn;Raccourcis.surMort=deathOn;Raccourcis.autoText=textOn;Raccourcis.autoConnect=connectOn;Placement.sauver();close();
        }).dimensions(x+230,y+238,110,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Annuler"),b->close()).dimensions(x,y+238,90,20).build());
    }
    @Override public void render(DrawContext c,int mx,int my,float delta){
        int x=width/2-170,y=Math.max(30,height/2-132);Theme.arrondi(c,x-10,y-12,360,292,0xF218151F,0xFF61506F);
        Theme.texte(c,textRenderer,"RACCOURCIS",x,y-6,Theme.TEXTE);
        Theme.texte(c,textRenderer,"Touche manuelle (optionnelle) : "+Raccourcis.touche(),x,y+136,Theme.TEXTE_DOUX);
        Theme.texte(c,textRenderer,"Detection des morts et eliminations annoncees · delai 2 s",x,y+148,Theme.TEXTE_FAIBLE);
        Theme.texte(c,textRenderer,"Connexion une seule fois au demarrage du jeu",x,y+218,Theme.TEXTE_DOUX);
        if(!erreur.isEmpty())Theme.texte(c,textRenderer,erreur,x,y+228,Theme.ROUGE);
        Theme.champs(c,children());super.render(c,mx,my,delta);Theme.boutons(c,textRenderer,children(),mx,my);
    }
    @Override public void close(){client.setScreen(parent);}
    @Override public boolean shouldPause(){return false;}
}
