package fr.xerion.xrnhud;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/** Lightweight procedural dusk background; original Minecraft screens keep their behavior. */
public final class AccueilEcran extends Screen {
    static boolean classique;
    private final long opened=System.nanoTime();
    public AccueilEcran(){super(Text.literal("XRN Client"));}
    @Override protected void init(){
        int x=Math.max(16,width/2-100), y=height/2-12;
        addDrawableChild(ButtonWidget.builder(Text.literal("Jouer en solo"),b->client.setScreen(new SelectWorldScreen(this))).dimensions(x,y,200,22).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Multijoueur"),b->client.setScreen(new MultiplayerScreen(this))).dimensions(x,y+28,200,22).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Options"),b->client.setScreen(new OptionsScreen(this,client.options))).dimensions(x,y+56,96,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Quitter"),b->client.scheduleStop()).dimensions(x+104,y+56,96,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Accueil classique"),b->{classique=true;client.setScreen(new TitleScreen());}).dimensions(width-116,height-25,110,18).build());
    }
    @Override public void renderBackground(DrawContext c,int mx,int my,float delta){}
    @Override public void render(DrawContext c,int mx,int my,float delta){
        super.renderPanoramaBackground(c,delta);
        c.fillGradient(0,0,width,height,0x301C112D,0xB30D0A15);
        int titleY=height/2-78;
        int titleWidth=Math.round(textRenderer.getWidth("XRN")*2.5f),groupWidth=32+12+titleWidth;
        int left=(width-groupWidth)/2;
        Theme.marque(c,left,titleY,4);
        c.getMatrices().pushMatrix();c.getMatrices().translate(left+44,titleY);c.getMatrices().scale(2.5f,2.5f);
        Theme.texte(c,textRenderer,"XRN",0,0,Theme.TEXTE);c.getMatrices().popMatrix();
        Theme.texteCentre(c,textRenderer,"C L I E N T",left+44+titleWidth/2,titleY+25,Theme.ACCENT);
        Theme.texte(c,textRenderer,"Minecraft · XRN "+Hud.versionMod(),8,height-13,Theme.TEXTE_FAIBLE);
        super.render(c,mx,my,delta);
        Theme.boutons(c,textRenderer,children(),mx,my);
    }
    @Override public boolean shouldCloseOnEsc(){return false;}
}
