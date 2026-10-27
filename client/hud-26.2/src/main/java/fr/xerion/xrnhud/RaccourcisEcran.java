package fr.xerion.xrnhud;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

final class RaccourcisEcran extends Screen {
    private final Screen parent;
    private EditBox message,address,deathMessage;
    private boolean textOn,connectOn,killOn,deathOn;
    private String erreur="";
    RaccourcisEcran(Screen parent){super(Component.literal("Raccourcis"));this.parent=parent;killOn=Raccourcis.surKill;deathOn=Raccourcis.surMort;textOn=Raccourcis.autoText;connectOn=Raccourcis.autoConnect;}
    @Override protected void init(){
        int x=width/2-170,y=Math.max(30,height/2-132);
        message=new ChampTexte(font,x,y+42,320,20,Component.literal("Texte rapide"));message.setMaxLength(256);message.setValue(Raccourcis.message);message.setBordered(false);addRenderableWidget(message);
        deathMessage=new ChampTexte(font,x,y+104,320,20,Component.literal("Texte apres une mort"));deathMessage.setMaxLength(256);deathMessage.setValue(Raccourcis.messageMort);deathMessage.setBordered(false);addRenderableWidget(deathMessage);
        addRenderableWidget(Button.builder(Component.literal("Elimination : "+(killOn?"oui":"non")),b->{killOn=!killOn;b.setMessage(Component.literal("Elimination : "+(killOn?"oui":"non")));}).bounds(x,y+75,154,20).build());
        addRenderableWidget(Button.builder(Component.literal("Mort : "+(deathOn?"oui":"non")),b->{deathOn=!deathOn;b.setMessage(Component.literal("Mort : "+(deathOn?"oui":"non")));}).bounds(x+164,y+75,156,20).build());
        address=new ChampTexte(font,x,y+194,320,20,Component.literal("Serveur au demarrage"));address.setMaxLength(255);address.setValue(Raccourcis.adresse);address.setHint(Component.literal("exemple.fr:25565"));address.setBordered(false);addRenderableWidget(address);
        addRenderableWidget(Button.builder(Component.literal(textOn?"Auto Text : actif":"Auto Text : inactif"),b->{textOn=!textOn;b.setMessage(Component.literal(textOn?"Auto Text : actif":"Auto Text : inactif"));}).bounds(x,y+16,170,20).build());
        addRenderableWidget(Button.builder(Component.literal(connectOn?"Auto Connect : actif":"Auto Connect : inactif"),b->{connectOn=!connectOn;b.setMessage(Component.literal(connectOn?"Auto Connect : actif":"Auto Connect : inactif"));}).bounds(x,y+169,170,20).build());
        addRenderableWidget(Button.builder(Component.literal("Enregistrer"),b->{
            if(connectOn&&!Raccourcis.adresseValide(address.getValue())){erreur="Adresse du serveur invalide";return;}
            Raccourcis.messageMort=Raccourcis.nettoyer(deathMessage.getValue(),256);Raccourcis.message=Raccourcis.nettoyer(message.getValue(),256);Raccourcis.adresse=Raccourcis.nettoyer(address.getValue(),255);Raccourcis.surKill=killOn;Raccourcis.surMort=deathOn;Raccourcis.autoText=textOn;Raccourcis.autoConnect=connectOn;Placement.sauver();onClose();
        }).bounds(x+230,y+238,110,20).build());
        addRenderableWidget(Button.builder(Component.literal("Annuler"),b->onClose()).bounds(x,y+238,90,20).build());
    }
    @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
        int x=width/2-170,y=Math.max(30,height/2-132);Theme.arrondi(c,x-10,y-12,360,292,0xF218151F,0xFF61506F);
        Theme.texte(c,font,"RACCOURCIS",x,y-6,Theme.TEXTE);
        Theme.texte(c,font,"Touche manuelle (optionnelle) : "+Raccourcis.touche(),x,y+136,Theme.TEXTE_DOUX);
        Theme.texte(c,font,"Detection des morts et eliminations annoncees · delai 2 s",x,y+148,Theme.TEXTE_FAIBLE);
        Theme.texte(c,font,"Connexion une seule fois au demarrage du jeu",x,y+218,Theme.TEXTE_DOUX);
        if(!erreur.isEmpty())Theme.texte(c,font,erreur,x,y+228,Theme.ROUGE);
        Theme.champs(c,children());super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);
    }
    @Override public void onClose(){minecraft.gui.setScreen(parent);}
    @Override public boolean isPauseScreen(){return false;}
}
