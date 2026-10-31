package fr.xerion.xrnhud;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.BooleanSupplier;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

/** Compact module browser. Rendering and hit testing share the same rectangles. */
public class MenuEcran extends Screen {
    private record Module(String name, String detail, BooleanSupplier enabled, Runnable toggle, int icon) {}
    private record Hit(int x, int y, int w, int h, Runnable action) {
        boolean contains(double mx, double my) { return mx >= x && mx < x+w && my >= y && my < y+h; }
    }
    private final List<Module> modules = new ArrayList<>();
    private final List<Hit> hits = new ArrayList<>();
    private TextFieldWidget search;
    private int px, py, pw, ph, bodyY, bodyH, scroll, maxScroll;
    private boolean settings;
    private int category;
    private float frameEase;
    private final java.util.Map<String,Float> animations=new java.util.HashMap<>();
    private float uiScale=1;
    private int virtualWidth,virtualHeight,navWidth,contentX,contentWidth;
    private final long opened=System.nanoTime();
    private long lastFrame=System.nanoTime();
    private double targetScroll, smoothScroll;
    private long closing;
    private static float fenetreX=.5f,fenetreY=.5f;
    private int baseY;private boolean dragging;private double dragX,dragY;
    static void chargerFenetre(com.google.gson.JsonObject o){if(o.has("menuWindowX"))fenetreX=Math.clamp(o.get("menuWindowX").getAsFloat(),0,1);if(o.has("menuWindowY"))fenetreY=Math.clamp(o.get("menuWindowY").getAsFloat(),0,1);}
    static void sauverFenetre(com.google.gson.JsonObject o){o.addProperty("menuWindowX",fenetreX);o.addProperty("menuWindowY",fenetreY);}
    static void recentrer(){fenetreX=fenetreY=.5f;}


    public MenuEcran() { super(Text.literal("XRN Client")); }
    @Override public boolean shouldPause() { return false; }
    @Override public void renderBackground(DrawContext c, int x, int y, float delta) {
        if(client.world!=null){super.applyBlur(c);c.fill(0,0,client.getWindow().getScaledWidth(),client.getWindow().getScaledHeight(),Theme.nuance(0x550B0812));}
    }
    boolean enFermeture() { return closing!=0; }
    void rouvrir() { closing=0; }
    void fermer() { close(); }
    @Override public void close() { Placement.sauver();if(closing==0)closing=System.nanoTime(); }

    @Override protected void init() {
        uiScale=(float)Math.min(1,2.0/client.getWindow().getScaleFactor());
        virtualWidth=Math.round(width/uiScale);virtualHeight=Math.round(height/uiScale);
        pw = Math.min(virtualWidth-18, Math.max(220, Math.min(730, (int)(virtualWidth * .87))));
        ph = Math.min(virtualHeight-18, Math.max(164, Math.min(410, (int)(virtualHeight * .84))));
        px = Math.clamp(Math.round((virtualWidth-pw)*fenetreX),8,Math.max(8,virtualWidth-pw-8)); baseY=Math.clamp(Math.round((virtualHeight-ph)*fenetreY),8,Math.max(8,virtualHeight-ph-8));py=baseY;
        navWidth=pw>=400?100:84;contentX=px+navWidth+16;contentWidth=pw-navWidth-26;
        bodyY = py+38; bodyH = ph-68;
        int searchWidth = pw >= 300 ? 117 : 80;
        search = new ChampTexte(textRenderer, px+pw-searchWidth-29, py+7, searchWidth, 16, Text.literal("Rechercher"));
        search.setDrawsBackground(false);
        search.setPlaceholder(Text.literal(Langue.t("Rechercher…")));
        search.setMaxLength(40); search.setChangedListener(value -> {scroll=0;targetScroll=0;smoothScroll=0;});
        addDrawableChild(search);
        modules.clear();
        modules.add(new Module("FPS Plus","Textures conservees",()->Performance.actif,()->{Reglages.boostNote();Performance.basculer();},0));
        modules.add(new Module("Fullbright","Éclairage maximal, même dans le noir",()->Fonctions.fullbright,()->Fonctions.fullbright=!Fonctions.fullbright,0));
        modules.add(new Module("Ciel XRN","Ciels animes et ambiance sonore",()->Ciel.actif,()->Ciel.actif=!Ciel.actif,0));
        modules.add(new Module("Name Tag","Couleurs, degrade et badges",()->NameTag.actif,()->NameTag.actif=!NameTag.actif,0));
        modules.add(new Module("Scoreboard","Tableau du serveur",()->Elements.scoreboard,()->Elements.scoreboard=!Elements.scoreboard,5));
        modules.add(new Module("Inventory HUD","27 cases de votre inventaire",()->ModulesPlus.sac,()->ModulesPlus.sac=!ModulesPlus.sac,5));
        modules.add(new Module("Hitboxes","Couleur et epaisseur",()->Visuels.hitboxes,()->Visuels.hitboxes=!Visuels.hitboxes,0));
        modules.add(new Module("Contours blocs","Couleur et epaisseur",()->Visuels.contours,()->Visuels.contours=!Visuels.contours,0));
        modules.add(new Module("Balises","Points par monde · B",()->Balises.visible,()->Balises.visible=!Balises.visible,0));
        modules.add(new Module("Auto Text","Apres elimination ou mort",()->Raccourcis.autoText,()->Raccourcis.autoText=!Raccourcis.autoText,5));
        modules.add(new Module("Auto Connect","Serveur au demarrage",()->Raccourcis.autoConnect,()->{if(!Raccourcis.adresseValide(Raccourcis.adresse))client.setScreen(new RaccourcisEcran(this));else Raccourcis.autoConnect=!Raccourcis.autoConnect;},0));

        modules.add(new Module("Totem Count","Inventaire et main gauche",()->ModulesPlus.totems,()->{ModulesPlus.totems=!ModulesPlus.totems;ModulesPlus.TOTEMS.hidden=false;},2));
        modules.add(new Module("Day Counter","Jours du monde",()->ModulesPlus.jours,()->{ModulesPlus.jours=!ModulesPlus.jours;ModulesPlus.JOURS.hidden=false;},3));
        modules.add(new Module("Ping","Latence du serveur",()->ModulesPlus.latence,()->{ModulesPlus.latence=!ModulesPlus.latence;ModulesPlus.PING.hidden=false;},0));
        modules.add(new Module("Player List","Joueurs et latence",()->ModulesPlus.joueurs,()->{ModulesPlus.joueurs=!ModulesPlus.joueurs;ModulesPlus.JOUEURS.hidden=false;},5));
        modules.add(new Module("Shader Monitor","Etat Iris si installe",()->ModulesPlus.shaders,()->{ModulesPlus.shaders=!ModulesPlus.shaders;ModulesPlus.SHADERS.hidden=false;},0));
        modules.add(new Module("Memoire","Utilisation de la JVM",()->Hud.memoire,()->{Hud.memoire=!Hud.memoire;Placement.MEMOIRE.hidden=false;},5));

        modules.add(new Module("Taille des objets","En main et inventaire",()->TailleObjets.actif,()->TailleObjets.actif=!TailleObjets.actif,0));
        modules.add(new Module("Motion Blur","Flou de mouvement reglable",()->MotionBlur.enabled,()->MotionBlur.setEnabled(!MotionBlur.enabled),0));
        modules.add(new Module("Free Look","Maintenir V · touche configurable",()->FreeLook.enabled,()->FreeLook.enabled=!FreeLook.enabled,0));
        modules.add(new Module("Informations", "Coordonnees et FPS", ()->Hud.informations, ()->Hud.informations=!Hud.informations, 0));
        modules.add(new Module("Touches", "Clavier et souris", ()->Hud.touches, ()->{Hud.touches=!Hud.touches;Placement.TOUCHES.hidden=false;}, 1));
        modules.add(new Module("Armure", "Equipement et usure", ()->Hud.armure, ()->{Hud.armure=!Hud.armure;Placement.EQUIPEMENT.hidden=false;}, 2));
        modules.add(new Module("Effets", "Potions et durees", ()->Hud.chrono, ()->{Hud.chrono=!Hud.chrono;Placement.POTIONS.hidden=false;}, 3));
        modules.add(new Module("Musique", "Lecture Windows", ()->Musique.visible, ()->{Musique.visible=!Musique.visible;Placement.MUSIQUE.hidden=false;}, 4));
        modules.add(new Module("Clics", "Compteur gauche / droit", ()->Hud.compteur, ()->Hud.compteur=!Hud.compteur, 1));
        modules.add(new Module("Inventaire", "Places libres", ()->ModulesUtiles.inventaire, ()->ModulesUtiles.inventaire=!ModulesUtiles.inventaire, 5));
        modules.add(new Module("Durabilite", "Alerte a 15 %", ()->ModulesUtiles.durabilite, ()->ModulesUtiles.durabilite=!ModulesUtiles.durabilite, 2));
        modules.add(new Module("Nether", "Conversion X / Z", ()->ModulesUtiles.nether, ()->ModulesUtiles.nether=!ModulesUtiles.nether, 0));
        modules.add(new Module("Session", "Temps de jeu", ()->Hud.minuterie, ()->Hud.minuterie=!Hud.minuterie, 3));
        modules.add(new Module("Rappel de pause", "Apres une heure", ()->ModulesUtiles.pause, ()->ModulesUtiles.pause=!ModulesUtiles.pause, 3));
        modules.add(new Module("Vitesse", "Blocs par seconde", ()->Hud.vitesse, ()->{Hud.vitesse=!Hud.vitesse;Placement.VITESSE.hidden=false;}, 0));
    }

    @Override public void render(DrawContext c, int mx, int my, float delta) {
        long now=System.nanoTime();
        if(closing!=0&&now-closing>=140_000_000L){super.close();return;}
        mx=Math.round(mx/uiScale);my=Math.round(my/uiScale);
        c.getMatrices().pushMatrix();c.getMatrices().scale(uiScale,uiScale);
        double dt=Math.min(.1,(now-lastFrame)/1_000_000_000.0);lastFrame=now;
        smoothScroll+=(targetScroll-smoothScroll)*(1-Math.exp(-18*dt));frameEase=(float)(1-Math.exp(-20*dt));
        scroll=(int)Math.round(smoothScroll);
        py=baseY+Math.round(14*(closing==0?1-Anime.sortie((now-opened)/240_000_000f):Anime.sortie((now-closing)/140_000_000f)));
        bodyY=py+38;search.setY(py+7);
        hits.clear();
        Theme.arrondi(c,px,py,pw,ph,Theme.nuance(0xF516141B),Theme.nuance(0xFF40354F));
        Theme.marque(c,px+10,py+10,1);
        if (pw >= 260) Theme.texte(c,textRenderer,"XRN CLIENT",px+24,py+10,Theme.TEXTE);
        button(c,"×",px+pw-23,py+5,18,18,this::close,mx,my);
        String[] tabs={"Tous les mods","HUD","Visuels","Outils","Apparence","Reglages","Garde-robe","Langue"};
        int navStep=Math.max(13,Math.min(24,bodyH/tabs.length)),navHeight=Math.max(12,navStep-3);
        for(int i=0;i<tabs.length;i++){final int index=i;boolean active=i==5?settings:!settings&&category==i;
            int ty=bodyY+i*navStep;
            button(c,tabs[i],px+9,ty,navWidth-4,navHeight,()->{if(index==7){Langue.choisir(Langue.actuelle().equals("fr")?"en":"fr");client.setScreen(new MenuEcran());return;}if(index==6){client.setScreen(new EcranGardeRobe(this));return;}settings=index==5;if(!settings)category=index;scroll=0;targetScroll=0;smoothScroll=0;},mx,my);
            if(active)Theme.rect(c,px+9,ty,2,navHeight,Theme.ACCENT);
        }
        Theme.rect(c,px+8,py+30,pw-16,1,Theme.BORDURE);
        Theme.rect(c,px+navWidth+10,bodyY,1,bodyH,Theme.BORDURE);
        search.setVisible(!settings);
        if (settings) renderSettings(c,mx,my);
        else renderModules(c,mx,my);
        Theme.rect(c,px+8,py+ph-28,pw-16,1,Theme.BORDURE);
        button(c,"Editer le HUD",px+10,py+ph-22,104,16,()->{
            Placement.sauver();client.setScreen(new EcranEdition());
        },mx,my);
        if(pw>=360)button(c,"Balises",px+122,py+ph-22,72,16,()->client.setScreen(new BalisesEcran(this)),mx,my);
        if(pw>=480)button(c,"Personnaliser",px+202,py+ph-22,104,16,()->client.setScreen(new ApparenceEcran(this)),mx,my);
        if (pw >= 650) Theme.texte(c,textRenderer,"Maj droite / Echap",px+pw-111,py+ph-18,Theme.TEXTE_FAIBLE);
        Theme.champs(c,children());
        super.render(c,mx,my,delta);
        c.getMatrices().popMatrix();
    }

    private void renderModules(DrawContext c,int mx,int my) {
        String query=search.getText().trim().toLowerCase(Locale.ROOT);
        List<Module> filtered=modules.stream().filter(m->Langue.t(m.name).toLowerCase(Locale.ROOT).contains(query)&&(category==0||groupe(m.name)==category)).toList();
        int columns=contentWidth>=430?3:(contentWidth>=250?2:1), gap=9, cw=(contentWidth-(columns-1)*gap)/columns, ch=96;
        maxScroll=Math.max(0,((filtered.size()+columns-1)/columns)*(ch+gap)-bodyH);
        scroll=Math.max(0,Math.min(scroll,maxScroll));targetScroll=Math.max(0,Math.min(targetScroll,maxScroll));
        c.enableScissor(contentX,bodyY,contentX+contentWidth,bodyY+bodyH);
        for(int i=0;i<filtered.size();i++) {
            Module m=filtered.get(i);int x=contentX+(i%columns)*(cw+gap), y=bodyY+(i/columns)*(ch+gap)-scroll;
            if(y+ch<=bodyY||y>=bodyY+bodyH)continue;
            Placement.Element element=element(m.name);
            boolean on=m.enabled.getAsBoolean()&&(element==null||!element.hidden),hover=mx>=x&&mx<x+cw&&my>=Math.max(y,bodyY)&&my<Math.min(y+ch,bodyY+bodyH);
            Theme.arrondi(c,x,y,cw,ch,hover?Theme.nuance(0xFF292332):Theme.nuance(0xFF1E1B24),on?Theme.nuance(0xFF68517E):Theme.nuance(0xFF39323F));
            Theme.texteCentre(c,textRenderer,fit(m.name,cw-35),x+cw/2,y+8,on?Theme.TEXTE:Theme.TEXTE_DOUX);
            Icones.draw(c,m.name,x+cw/2-12,y+26,on?Theme.nuance(0xFFD9C5FF):Theme.nuance(0xFFA89EBA));
            Theme.texteCentre(c,textRenderer,fit(m.detail,cw-18),x+cw/2,y+64,Theme.TEXTE_DOUX);
            Theme.texte(c,textRenderer,on?"Actif":"Inactif",x+9,y+ch-16,on?Theme.ACCENT:Theme.TEXTE_FAIBLE);
            float progress=animations.getOrDefault(m.name,on?1f:0f);progress+=((on?1:0)-progress)*frameEase;animations.put(m.name,progress);
            Theme.interrupteur(c,x+cw-35,y+ch-18,progress,1);
            Runnable configure=configuration(m.name);
            if(configure!=null&&y>=bodyY&&y+21<bodyY+bodyH){button(c,"",x+cw-26,y+4,22,20,configure,mx,my);Theme.engrenage(c,x+cw-24,y+5,Theme.TEXTE_DOUX);}
            // Only the visible part may receive input.
            int top=Math.max(y,bodyY),bottom=Math.min(y+ch,bodyY+bodyH);
            hits.add(new Hit(x,top,cw,bottom-top,()->{if(element!=null&&element.hidden){element.hidden=false;}else m.toggle.run();Placement.sauver();}));
        }
        if(filtered.isEmpty())Theme.texteCentre(c,textRenderer,"Aucun module",px+pw/2,bodyY+20,Theme.TEXTE_DOUX);
        c.disableScissor();
        if(maxScroll>0) {
            int thumb=Math.max(12,bodyH*bodyH/(bodyH+maxScroll));
            Theme.rect(c,px+pw-5,bodyY,2,bodyH,Theme.nuance(0xFF322A3B));
            Theme.rect(c,px+pw-5,bodyY+(bodyH-thumb)*scroll/maxScroll,2,thumb,Theme.ACCENT_FORT);
        }
    }

    private int groupe(String name){return switch(name){case "Name Tag","Ciel XRN"->4;case "Fullbright","Taille des objets","Motion Blur","Hitboxes","Contours blocs","Shader Monitor"->2;case "Free Look","FPS Plus","Balises","Auto Text","Auto Connect","Nether","Rappel de pause"->3;default->1;};}
    private Runnable configuration(String name){return switch(name){
        case "Taille des objets"->()->client.setScreen(new TailleObjetsEcran(this));
        case "Motion Blur"->()->client.setScreen(new MotionBlurEcran(this));
        case "Ciel XRN"->()->client.setScreen(new CielEcran(this));
        case "Name Tag"->()->client.setScreen(new NameTagEcran(this));
        case "Hitboxes","Contours blocs"->()->client.setScreen(new VisuelsEcran(this));
        case "Balises"->()->client.setScreen(new BalisesEcran(this));
        case "Auto Text","Auto Connect"->()->client.setScreen(new RaccourcisEcran(this));default->null;};}
    private Placement.Element element(String name){return switch(name){
        case "Inventory HUD"->ModulesPlus.SAC;case "Scoreboard"->Placement.SCOREBOARD;case "Informations"->Placement.XRN;case "Touches"->Placement.TOUCHES;case "Armure"->Placement.EQUIPEMENT;case "Effets"->Placement.POTIONS;case "Musique"->Placement.MUSIQUE;case "Vitesse"->Placement.VITESSE;case "Memoire"->Placement.MEMOIRE;
        case "Totem Count"->ModulesPlus.TOTEMS;case "Day Counter"->ModulesPlus.JOURS;case "Ping"->ModulesPlus.PING;case "Player List"->ModulesPlus.JOUEURS;case "Shader Monitor"->ModulesPlus.SHADERS;
        case "Inventaire","Durabilite","Nether","Rappel de pause"->Placement.UTILITAIRES;default->null;};}

    private void renderSettings(DrawContext c,int mx,int my) {
        int x=contentX,w=contentWidth;maxScroll=Math.max(0,224-bodyH);targetScroll=Math.clamp(targetScroll,0,maxScroll);scroll=Math.clamp(scroll,0,maxScroll);int y=bodyY+3-scroll;
        c.enableScissor(contentX,bodyY,contentX+contentWidth,bodyY+bodyH);
        setting(c,"Profil FPS Plus",Performance.actif?"Actif":"Inactif",x,y,w,()->{Reglages.boostNote();Performance.basculer();},mx,my);
        setting(c,"Distance d'affichage",Options.distance()+" chunks",x,y+28,w,()->Options.distance(Options.distance()>=16?4:Options.distance()+2),mx,my);
        setting(c,"Boussole",Hud.boussole?"Visible":"Masquee",x,y+56,w,()->Hud.boussole=!Hud.boussole,mx,my);
        setting(c,"Contours et hitboxes","Configurer",x,y+84,w,()->client.setScreen(new VisuelsEcran(this)),mx,my);
        setting(c,"Balises","Gerer",x,y+112,w,()->client.setScreen(new BalisesEcran(this)),mx,my);
        setting(c,"Auto Text / Auto Connect","Configurer",x,y+140,w,()->client.setScreen(new RaccourcisEcran(this)),mx,my);
        setting(c,"Couleur / position du menu","Configurer",x,y+196,w,()->client.setScreen(new ApparenceEcran(this)),mx,my);
        setting(c,"Ancien profil : textures","Restaurer",x,y+168,w,Performance::reparerTextures,mx,my);
        c.disableScissor();
        if(maxScroll>0){int thumb=Math.max(12,bodyH*bodyH/(bodyH+maxScroll));Theme.rect(c,px+pw-5,bodyY,2,bodyH,Theme.BORDURE);Theme.rect(c,px+pw-5,bodyY+(bodyH-thumb)*scroll/maxScroll,2,thumb,Theme.ACCENT);}
    }

    private void setting(DrawContext c,String name,String value,int x,int y,int w,Runnable action,int mx,int my) {
        if(y<bodyY||y+23>bodyY+bodyH)return;
        boolean hover=mx>=x&&mx<x+w&&my>=y&&my<y+23;
        Theme.rect(c,x,y,w,23,hover?Theme.nuance(0xFF2A2332):Theme.nuance(0xFF201B26));
        Theme.texte(c,textRenderer,fit(name,w-95),x+7,y+7,Theme.TEXTE);
        Theme.texte(c,textRenderer,Langue.t(value),x+w-7-textRenderer.getWidth(Langue.t(value)),y+7,Theme.ACCENT);
        hits.add(new Hit(x,y,w,23,()->{action.run();Placement.sauver();}));
    }
    private void tab(DrawContext c,String text,int x,int y,boolean active,Runnable action,int mx,int my) {
        button(c,text,x,y,67,17,action,mx,my);
        if(active)Theme.rect(c,x,y+16,67,1,Theme.ACCENT);
    }
    private void button(DrawContext c,String text,int x,int y,int w,int h,Runnable action,int mx,int my) {
        boolean hover=mx>=x&&mx<x+w&&my>=y&&my<y+h;
        Theme.arrondi(c,x,y,w,h,hover?Theme.nuance(0xFF3B2F49):Theme.nuance(0xFF282130),0);
        Theme.texteCentre(c,textRenderer,fit(text,w-8),x+w/2,y+(h-textRenderer.fontHeight)/2+1,Theme.TEXTE);
        hits.add(new Hit(x,y,w,h,action));
    }
    private String fit(String text,int width) {
        text=Langue.t(text);
        if(textRenderer.getWidth(text)<=width)return text;
        while(!text.isEmpty()&&textRenderer.getWidth(text+"…")>width)text=text.substring(0,text.length()-1);
        return text+"…";
    }
    private static void icon(DrawContext c,int x,int y,int type,int color){
        if(type==1){for(int i=0;i<3;i++)Theme.cadre(c,x+i*3,y+5,2,2,0,color);Theme.cadre(c,x+3,y+2,2,2,0,color);}
        else if(type==2){Theme.cadre(c,x+1,y,7,7,0,color);Theme.rect(c,x+3,y+7,3,1,color);Theme.rect(c,x+4,y+8,1,1,color);}
        else if(type==3){Theme.cadre(c,x,y,9,9,0,color);Theme.rect(c,x+4,y+2,1,4,color);Theme.rect(c,x+4,y+5,3,1,color);}
        else if(type==4){Theme.rect(c,x+2,y,1,7,color);Theme.rect(c,x+3,y,5,1,color);Theme.rect(c,x+7,y,1,7,color);Theme.rect(c,x,y+6,3,2,color);Theme.rect(c,x+5,y+6,3,2,color);}
        else if(type==5){for(int row=0;row<3;row++)for(int col=0;col<3;col++)Theme.cadre(c,x+col*3,y+row*3,2,2,0,color);}
        else{Theme.cadre(c,x+1,y+1,7,7,0,color);Theme.rect(c,x+4,y,1,9,color);Theme.rect(c,x,y+4,9,1,color);}
    }
    @Override public boolean mouseClicked(Click click,boolean twice) {
        click=new Click(click.x()/uiScale,click.y()/uiScale,click.buttonInfo());
        if(click.button()==0&&click.x()>=px&&click.x()<px+pw-25&&click.y()>=py&&click.y()<py+27&&!search.isMouseOver(click.x(),click.y())){dragging=true;dragX=click.x()-px;dragY=click.y()-py;search.setFocused(false);return true;}
        for(Hit hit:hits)if(hit.contains(click.x(),click.y())){hit.action.run();return true;}
        return super.mouseClicked(click,twice);
    }
    @Override public boolean mouseReleased(Click click) {
        if(dragging){dragging=false;Placement.sauver();return true;}
        return super.mouseReleased(new Click(click.x()/uiScale,click.y()/uiScale,click.buttonInfo()));
    }
    @Override public boolean mouseDragged(Click click,double dx,double dy) {
        if(dragging){double x=click.x()/uiScale,y=click.y()/uiScale;px=(int)Math.clamp(x-dragX,8,Math.max(8,virtualWidth-pw-8));baseY=(int)Math.clamp(y-dragY,8,Math.max(8,virtualHeight-ph-8));py=baseY;contentX=px+navWidth+16;search.setX(px+pw-search.getWidth()-29);search.setY(py+7);fenetreX=px/(float)Math.max(1,virtualWidth-pw);fenetreY=baseY/(float)Math.max(1,virtualHeight-ph);hits.clear();return true;}
        return super.mouseDragged(new Click(click.x()/uiScale,click.y()/uiScale,click.buttonInfo()),dx/uiScale,dy/uiScale);
    }
    @Override public void mouseMoved(double x,double y) { super.mouseMoved(x/uiScale,y/uiScale); }
    @Override public boolean mouseScrolled(double x,double y,double h,double v) {
        x/=uiScale;y/=uiScale;
        if(x<contentX||x>contentX+contentWidth||y<bodyY||y>bodyY+bodyH)return false;
        targetScroll=Math.max(0,Math.min(maxScroll,targetScroll-v*32));return true;
    }
}
