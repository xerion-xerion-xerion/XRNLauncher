package fr.xerion.xrnhud;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;

/** Lightweight procedural dusk background; original Minecraft screens keep their behavior. */
public final class AccueilEcran extends Screen {
    static boolean classique;
    private final long opened=System.nanoTime();
    public AccueilEcran(){super(Component.literal("XRN Client"));}
    @Override protected void init(){
        int x=Math.max(16,width/2-100), y=height/2-12;
        addRenderableWidget(Button.builder(Component.literal("Jouer en solo"),b->minecraft.setScreen(new SelectWorldScreen(this))).bounds(x,y,200,22).build());
        addRenderableWidget(Button.builder(Component.literal("Multijoueur"),b->minecraft.setScreen(new JoinMultiplayerScreen(this))).bounds(x,y+28,200,22).build());
        addRenderableWidget(Button.builder(Component.literal("Options"),b->minecraft.setScreen(new OptionsScreen(this,minecraft.options,false))).bounds(x,y+56,96,20).build());
        addRenderableWidget(Button.builder(Component.literal("Quitter"),b->minecraft.stop()).bounds(x+104,y+56,96,20).build());
        addRenderableWidget(Button.builder(Component.literal("Accueil classique"),b->{classique=true;minecraft.setScreen(new TitleScreen());}).bounds(width-116,height-25,110,18).build());
    }
    @Override public void extractBackground(GuiGraphicsExtractor c,int mx,int my,float delta){}
    @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
        super.extractPanorama(c,delta);
        c.fillGradient(0,0,width,height,0x301C112D,0xB30D0A15);
        int titleY=height/2-78;
        int titleWidth=Math.round(font.width("XRN")*2.5f),groupWidth=32+12+titleWidth;
        int left=(width-groupWidth)/2;
        Theme.marque(c,left,titleY,4);
        c.pose().pushMatrix();c.pose().translate(left+44,titleY);c.pose().scale(2.5f,2.5f);
        Theme.texte(c,font,"XRN",0,0,Theme.TEXTE);c.pose().popMatrix();
        Theme.texteCentre(c,font,"C L I E N T",left+44+titleWidth/2,titleY+25,Theme.ACCENT);
        Theme.texte(c,font,"Minecraft · XRN "+Hud.versionMod(),8,height-13,Theme.TEXTE_FAIBLE);
        super.extractRenderState(c,mx,my,delta);
        Theme.boutons(c,font,children(),mx,my);
    }
    @Override public boolean shouldCloseOnEsc(){return false;}
}
