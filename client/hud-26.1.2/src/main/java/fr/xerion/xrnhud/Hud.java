package fr.xerion.xrnhud;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.core.BlockPos;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.Level;

/**
 * Le HUD.
 *
 * <p>Volontairement minuscule : deux lignes, plus les blocs optionnels.
 * Le jeu doit rester un jeu, pas un tableau de bord. Tout ce qui est
 * affiche ici peut etre coupe, y compris le HUD lui-meme.
 */
final class Hud {

    static boolean visible = true;
    static boolean informations=true;
    static boolean touches = false;
    static boolean minuterie = false;
    static boolean compteur = false;
    /*  La signature du client, en bas a droite. On peut l effacer. */
    static boolean signature = false;

    /*  Nouveaux blocs du HUD : le materiel porte avec son usure, la
        liste des effets actifs avec leur duree restante, la boussole
        et le ping servent dans la ligne d'informations.              */
    static boolean armure = true;
    static boolean chrono = true;
    static boolean boussole = true;
    static boolean ping = true;

    /*  Lignes d'etat a la demande : la vitesse sert compter la
        distance parcourue, l'heure du jeu sert anticiper le cycle
        du monde, la memoire sert verifier ce que les mods mangent.   */
    static boolean vitesse = true;
    static boolean heureJeu = false;
    static boolean memoire = false;

    /*  Coin ou le bloc d'informations est pose.                          */
    static int position = 0;            /* 0 bas-g  1 bas-d  2 haut-g  3 haut-d */

    /*  Opacite du voile place derriere le menu, reglage du joueur. */
    static double voileMenu = 0.6;

    static final String[] POSITIONS = { "Bas gauche", "Bas droite", "Haut gauche", "Haut droite" };

    private static float opacite = 0f;

    /* --- mesure des images par seconde, maison et sans appel natif --- */
    private static int images = 0;
    private static long debutImages = System.nanoTime();
    private static int ips = 0;

    /* --- clics par seconde --- */
    private static boolean gaucheEnfonce, droiteEnfonce;
    private static int clicsGauche = 0;
    private static int clicsDroite = 0;
    private static int cpsGauche = 0;
    private static int cpsDroite = 0;
    private static long debutClics = System.nanoTime();

    /* --- vitesse horizontale : la distance lissee entre deux ticks --- */
    private static double ancienX = 0.0;
    private static double ancienZ = 0.0;
    private static float vitesseBlocs = 0f;
    private static boolean positionPrecedente = false;

    /* --- temps de session --- */
    private static long debutSession = 0L;
    private static String dernierMonde = "";

    private Hud() {}

    /* ------------------------------------------------------------------ */
    /*  Appele une fois par tick, jamais pendant le rendu.                  */
    /* ------------------------------------------------------------------ */

    private static final java.util.ArrayDeque<Long> leftClicks=new java.util.ArrayDeque<>(),rightClicks=new java.util.ArrayDeque<>();
    static void clic(int button){if(button==0)leftClicks.addLast(System.nanoTime());if(button==1)rightClicks.addLast(System.nanoTime());}
    static void compterClics(Minecraft cl) {
        long now=System.nanoTime(),cut=now-1_000_000_000L;
        while(!leftClicks.isEmpty()&&leftClicks.peekFirst()<cut)leftClicks.removeFirst();
        while(!rightClicks.isEmpty()&&rightClicks.peekFirst()<cut)rightClicks.removeFirst();
        cpsGauche=leftClicks.size();cpsDroite=rightClicks.size();
    }
    private static void ancienComptage(Minecraft cl) {
        boolean gauche = cl.screen == null && cl.options.keyAttack.isDown();
        boolean droite = cl.screen == null && cl.options.keyUse.isDown();
        if (gauche && !gaucheEnfonce) clicsGauche++;
        if (droite && !droiteEnfonce) clicsDroite++;
        gaucheEnfonce = gauche; droiteEnfonce = droite;

        long ecoule = System.nanoTime() - debutClics;
        if (ecoule >= 1_000_000_000L) {
            cpsGauche = (int) (clicsGauche * 1_000_000_000L / ecoule);
            cpsDroite = (int) (clicsDroite * 1_000_000_000L / ecoule);
            clicsGauche = 0;
            clicsDroite = 0;
            debutClics = System.nanoTime();
        }
    }

    static void suivreSession(Minecraft cl) {
        if (cl.player == null || cl.level == null) {
            debutSession = 0L;
            return;
        }
        String monde = cl.level.dimension() == null
                ? "" : cl.level.dimension().identifier().toString();
        if (!monde.equals(dernierMonde)) {
            dernierMonde = monde;
            debutSession = System.nanoTime();
        }
        if (debutSession == 0L) debutSession = System.nanoTime();
    }

    private static void mesurerIps() {
        images++;
        long ecoule = System.nanoTime() - debutImages;
        if (ecoule >= 1_000_000_000L) {
            ips = (int) (images * 1_000_000_000L / ecoule);
            images = 0;
            debutImages = System.nanoTime();
        }
    }

    /** La vitesse horizontale, en blocs par seconde : la distance
        entre deux ticks est capricieuse (une seule image peut faire
        un saut), donc on lisse. Un teleport n'est pas de la marche :
        au-dela de dix blocs d'un coup, on remet le compteur a zero. */
    static void mesurerVitesse(Minecraft cl) {
        if (cl.player == null) {
            positionPrecedente = false;
            vitesseBlocs = 0f;
            return;
        }
        double x = cl.player.getX();
        double z = cl.player.getZ();
        if (!positionPrecedente) {
            ancienX = x;
            ancienZ = z;
            positionPrecedente = true;
            return;
        }
        double distance = Math.hypot(x - ancienX, z - ancienZ);
        ancienX = x;
        ancienZ = z;
        if (distance > 10.0) {
            vitesseBlocs = 0f;
            return;
        }
        vitesseBlocs = Anime.vers(vitesseBlocs, (float) (distance * 20.0), 0.25f);
    }

    /* ------------------------------------------------------------------ */

    /* ------------------------------------------------------------------ */

    /** La signature du client, en bas a droite : le logo du launcher et
        la version. Si le launcher a passe sa version au jeu, elle
        s affiche aussi : on voit alors quel launcher a lance la partie. */
    private static void dessinerSignature(GuiGraphicsExtractor c, Minecraft cl) {
        if (!signature) return;
        Font t = cl.font;
        /*  La signature est le plus petit element du HUD : elle donne
            la version d'un coup d oeil, sans occuper l ecran. Le
            joueur peut l effacer completement depuis le menu.        */
        StringBuilder ligne = new StringBuilder(versionMod());
        String launcher = System.getProperty("XRNLauncherVersion", "");
        if (!launcher.isEmpty()) ligne.append(" · ").append(launcher);

        int largeur = t.width(ligne.toString());
        int x = cl.getWindow().getGuiScaledWidth() - largeur - 14;
        int y = cl.getWindow().getGuiScaledHeight() - 10;

        Theme.marque(c, x, y - 7, 1);
        c.text(t, ligne.toString(), x + 11, y, Theme.alpha(Theme.TEXTE_FAIBLE, 0.6f), false);
    }

    /** La version du mod, lue dans le manifest. Le menu l'affiche,
        elle est donc partagee avec lui (visibilite paquet). */
    static String versionMod() {
        try {
            return net.fabricmc.loader.api.FabricLoader.getInstance()
                    .getModContainer("xrnhud")
                    .map(m -> m.getMetadata().getVersion().getFriendlyString())
                    .orElse("?");
        } catch (Throwable t) {
            return "?";
        }
    }

    static void dessiner(GuiGraphicsExtractor c, DeltaTracker tick) {
        Minecraft cl = Minecraft.getInstance();


        boolean ecranPlein = cl.screen != null &&
                !(cl.screen instanceof MenuEcran) &&
                !(cl.screen instanceof EcranEdition);
        boolean jouable = !ecranPlein && cl.player != null && cl.level != null;

        /*  La signature du client, en bas a droite : le logo et la
            version. Elle est posee sur le jeu, donc visible meme si le
            HUD est eteint.                                              */
        if (cl.options.hideGui) return;
        if (jouable && visible) dessinerSignature(c, cl);

        if (!jouable) {
            opacite = Anime.vers(opacite, 0f, 0.3f);
            if (opacite < 0.02f) return;
        } else {
            mesurerIps();
            opacite = Anime.vers(opacite, visible ? 1f : 0f, 0.16f);
            if (opacite < 0.02f) return;
        }

        if (cl.options.hideGui || cl.player == null || cl.level == null) return;
        Balises.dessiner(c,cl);
        ModulesPlus.dessiner(c, cl, opacite);
        ModulesUtiles.dessiner(c, cl, opacite);
        Font t = cl.font;
        int largeur = cl.getWindow().getGuiScaledWidth();
        int hauteurEcran = cl.getWindow().getGuiScaledHeight();
        double a = Anime.borne(opacite);

        boolean aDroite = (position % 2) == 1;
        boolean enHaut = position >= 2;

        /*  Bloc d'informations, dans le coin choisi. */
        String premiere = ips + " FPS";
        GameType mode = cl.player == null ? null : cl.player.gameMode();
        if (mode != null) premiere += "  ·  " + libelleMode(mode);

        StringBuilder seconde = new StringBuilder();
        if (cl.player != null) {
            seconde.append(coordonnees(cl));
        }
        if (minuterie && debutSession != 0L) {
            if (seconde.length() > 0) seconde.append("  ·  ");
            seconde.append(duree(System.nanoTime() - debutSession));
        }
        if (compteur && !touches) {
            if (seconde.length() > 0) seconde.append("  ·  ");
            seconde.append(cpsGauche).append("/").append(cpsDroite).append(" clic/s");
        }
        double marque = Fonctions.distanceMarque(cl);
        if (marque >= 0) {
            if (seconde.length() > 0) seconde.append("  ·  ");
            seconde.append(String.format("%.0f m", marque));
        }
        if (boussole) {
            String cap = cardinal(cl);
            if (!cap.isEmpty()) {
                seconde.append("  ·  ").append(cap);
            }
        }
        int latence = ping ? latence(cl) : -1;
        if (latence > 0) {
            seconde.append("  ·  ").append(latence).append(" ms");
        }

        int largeurBloc = Math.max(t.width(premiere), t.width(seconde.toString()));
        int defautX = aDroite ? largeur - largeurBloc - 4 : 4;
        int defautY = enHaut ? 6 : hauteurEcran - 34;
        int x = defautX + Placement.XRN.dx;
        int y = defautY + Placement.XRN.dy;

        if(informations&&!Placement.XRN.hidden){
        x=Cadres.limiterX(x,largeurBloc,Placement.XRN);y=Cadres.limiterY(y,20,Placement.XRN);
        Cadres.debut(c,Placement.XRN,x,y);
        Theme.texte(c, t, premiere, x, y, Theme.alpha(Theme.TEXTE, a));
        if (seconde.length() > 0) {
            Theme.texte(c, t, seconde.toString(), x, y + 11, Theme.alpha(Theme.TEXTE, a));
        }
        Cadres.placer(Placement.XRN.id, defautX, defautY, x, y, largeurBloc, 20);
        Cadres.fin(c);}

        /*  Le pave des touches part dans le coin oppose : jamais de
            chevauchement, quel que soit le coin choisi pour le reste.  */
        if (touches && !Placement.TOUCHES.hidden) {
            int u = 16;
            int m = 2;
            int pw = u * 3 + m * 2;
            int ph = 2*(u+m)+10+14+(compteur?12:0);
            int defautPx = 6;
            int defautPy = 34;
            int px = defautPx + Placement.TOUCHES.dx;
            int py = defautPy + Placement.TOUCHES.dy;
            px=Cadres.limiterX(px,pw,Placement.TOUCHES);py=Cadres.limiterY(py,ph,Placement.TOUCHES);
            Cadres.debut(c,Placement.TOUCHES,px,py);
            dessinerTouches(c, cl, px, py, u, m, a);
            Cadres.placer(Placement.TOUCHES.id, defautPx, defautPy, px, py, pw, ph);Cadres.fin(c);
        }

        /*  Le materiel porte se pose au centre haut, tout seul : il
            n a pas de coin attitre, il peut etre bouge une fois
            pour toutes. Sans materiel il n existe pas. Un bloc pose
            renvoie sa hauteur, pour que la liste des effets s accroche
            dessous sans jamais s empiler.                              */
        int hautMateriel = armure && !Placement.EQUIPEMENT.hidden ? dessinerEquipement(c, cl, largeur, a) : 0;
        if (chrono && !Placement.POTIONS.hidden) {
            int dessus = hautMateriel > 0 ? 6 + hautMateriel + 5 : 6;
            dessinerEffets(c, cl, largeur, dessus, a);
        }

        /*  Lignes d'etat a la demande : chacune se deplace depuis
            l'editeur, comme le reste. Leurs positions par defaut
            s'empilent dans le coin haut gauche, sans rien ecraser.     */
        if (vitesse && cl.player != null) {
            blocLigne(c, t, "Vitesse", texteVitesse(), 4, 6, Placement.VITESSE, a);
        }
        if (heureJeu && cl.level != null) {
            blocLigne(c, t, "Heure", heureJeu(cl), 4, 17, Placement.HEURE, a);
        }
        if (memoire) {
            blocLigne(c, t, "Memoire", texteMemoire(), 4, 28, Placement.MEMOIRE, a);
        }
    }

    /** Une ligne d'etat : libelle affaibli, valeur claire, et le
        rectangle enregistre pour l'editeur.                           */
    private static void blocLigne(GuiGraphicsExtractor c, Font t, String libelle, String valeur,
                                  int defautX, int defautY, Placement.Element element, double a) {
        if(element.hidden)return;
        int fullW=t.width(libelle)+5+t.width(valeur);
        int x = Cadres.limiterX(defautX + element.dx,fullW,element);
        int y = Cadres.limiterY(defautY + element.dy,10,element);
        Cadres.debut(c,element,x,y);
        Theme.texte(c, t, libelle, x, y, Theme.alpha(Theme.TEXTE_FAIBLE, a));
        int ll = t.width(libelle);
        Theme.texte(c, t, valeur, x + ll + 5, y, Theme.alpha(Theme.TEXTE, a));
        int w = ll + 5 + t.width(valeur);
        Cadres.placer(element.id, defautX, defautY, x, y, w, 10);Cadres.fin(c);
    }

    /** La vitesse, en blocs par seconde. Le separateur decimal est
        remis a la main : le format du texte ne doit pas dependre de la
        langue de la machine sur laquelle le jeu tourne.               */
    private static String texteVitesse() {
        String s = String.format(java.util.Locale.ROOT, "%.1f", vitesseBlocs);
        return s.replace('.', ',') + " m/s";
    }

    /** Jour et heure du monde : zero tick vaut six heures du matin,
        c'est la convention du jeu.                                    */
    private static String heureJeu(Minecraft cl) {
        long jour = cl.level.getDefaultClockTime() / 24000L;
        long t = ((cl.level.getOverworldClockTime() % 24000L) + 24000L) % 24000L;
        long h = (t / 1000L + 6) % 24;
        long m = (t % 1000L) * 60L / 1000L;
        return "Jour " + (jour + 1) + "  " + String.format("%02d:%02d", h, m);
    }

    /** La memoire estimee du jeu : tas utilise sur tas maximum. */
    private static String texteMemoire() {
        Runtime r = Runtime.getRuntime();
        double utilise = (r.totalMemory() - r.freeMemory()) / (1073741824.0);
        double max = r.maxMemory() / (1073741824.0);
        return grandir(utilise) + " / " + grandir(max) + " Go";
    }

    /** Un nombre en gigaoctets, une decimal, virgule franche. */
    private static String grandir(double v) {
        String s = String.format(java.util.Locale.ROOT, "%.1f", v);
        return s.replace('.', ',');
    }

    private static void dessinerTouches(GuiGraphicsExtractor c, Minecraft cl,
                                        int x, int y, int u, int m, double a) {
        touche(c, cl, x+u+m, y, u, u, cl.options.keyUp, a);
        touche(c, cl, x, y+u+m, u, u, cl.options.keyLeft, a);
        touche(c, cl, x+u+m, y+u+m, u, u, cl.options.keyDown, a);
        touche(c, cl, x+2*(u+m), y+u+m, u, u, cl.options.keyRight, a);
        int width=3*u+2*m, spaceY=y+2*(u+m);
        Theme.rect(c,x,spaceY,width,7,Theme.alpha(cl.options.keyJump.isDown()?Theme.ACCENT_FORT:0x7017141E,a));
        Theme.rect(c,x+width/2-10,spaceY+3,20,1,Theme.alpha(Theme.TEXTE,a));
        int mouseY=spaceY+10, half=(width-2)/2;
        boutonSouris(c,cl,x,mouseY,half,"LMB",cl.options.keyAttack,a);
        boutonSouris(c,cl,x+half+2,mouseY,half,"RMB",cl.options.keyUse,a);
        if(compteur)Theme.texteCentre(c,cl.font,cpsGauche+" / "+cpsDroite+" CPS",x+width/2,mouseY+17,Theme.alpha(Theme.TEXTE_DOUX,a));
    }

    /*  Une touche : un pave plein, borde de violet, avec la lettre
        ecrite dedans. Sans la lettre, on ne voit pas ce qu on touche :
        les cases vides donnaient l impression d un element flou.      */
    private static void touche(GuiGraphicsExtractor c, Minecraft cl, int x, int y, int w, int h,
                              KeyMapping touche, double a) {
        boolean enfoncee = touche.isDown();
        int fond = enfoncee ? Theme.alpha(Theme.ACCENT, 0.85 * a) : Theme.alpha(0x6017141E, a);
        Theme.rect(c, x, y, w, h, fond);
        String lettre = touche.getTranslatedKeyMessage().getString();
        if (lettre.length() > 3) lettre = lettre.substring(0, 3);
        Theme.texteCentre(c, cl.font, lettre, x + w / 2,
                y + (h - cl.font.lineHeight) / 2,
                Theme.alpha(enfoncee ? Theme.TEXTE : Theme.ACCENT, a));
    }

    private static void boutonSouris(GuiGraphicsExtractor c, Minecraft cl, int x, int y, int w,
                                     String libelle, KeyMapping touche, double a) {
        boolean enfonce = touche.isDown();
        int fond = enfonce ? Theme.alpha(Theme.ACCENT, 0.85 * a) : Theme.alpha(0x6017141E, a);
        Theme.rect(c, x, y, w, 14, fond);
        Theme.texteCentre(c, cl.font, libelle, x + w / 2,
                y + (14 - cl.font.lineHeight) / 2,
                Theme.alpha(enfonce ? Theme.TEXTE : Theme.ACCENT, a));
    }

    /* ------------------------------------------------------------------ */
    /*  Materiel porte : main et les quatre pieces d'armure, chacune
        accompagnee de sa barre d'usure quand elle est abimee. La
        circulation de l'air entre les cases vient de la grille du
        pave des touches : meme rythme, meme lecture.                  */
    /* ------------------------------------------------------------------ */

    private static final EquipmentSlot[] PIECES = {
            EquipmentSlot.MAINHAND, EquipmentSlot.FEET, EquipmentSlot.LEGS,
            EquipmentSlot.CHEST, EquipmentSlot.HEAD
    };

    /** Dessine le materiel porte. Renvoie la hauteur du bloc, ou 0
        si rien n'a ete dessine (le joueur n'a ni arme ni armure). */
    private static int dessinerEquipement(GuiGraphicsExtractor c, Minecraft cl, int largeur, double a) {
        int cellule = 18;
        int relie = 3;

        ItemStack[] portees = new ItemStack[PIECES.length];
        boolean vide = true;
        for (int i = 0; i < PIECES.length; i++) {
            portees[i] = cl.player.getItemBySlot(PIECES[i]);
            if (!portees[i].isEmpty()) vide = false;
        }
        boolean editor=cl.screen instanceof EcranEdition;
        if(vide&&!editor)return 0;
        if(vide){net.minecraft.world.item.Item[] sample={net.minecraft.world.item.Items.DIAMOND_SWORD,net.minecraft.world.item.Items.DIAMOND_BOOTS,net.minecraft.world.item.Items.DIAMOND_LEGGINGS,net.minecraft.world.item.Items.DIAMOND_CHESTPLATE,net.minecraft.world.item.Items.DIAMOND_HELMET};for(int i=0;i<portees.length;i++)portees[i]=new ItemStack(sample[i]);}
        boolean damaged=false;for(ItemStack s:portees)if(s.isDamageableItem()&&s.getDamageValue()>0)damaged=true;
        int actualHeight=damaged?22:18;

        int largeurBloc = cellule * PIECES.length + relie * (PIECES.length - 1);
        int defautX = (largeur - largeurBloc) / 2;
        int defautY = 6;
        int x0 = Cadres.limiterX(defautX + Placement.EQUIPEMENT.dx,largeurBloc,Placement.EQUIPEMENT);
        int y0 = Cadres.limiterY(defautY + Placement.EQUIPEMENT.dy,actualHeight,Placement.EQUIPEMENT);
        Cadres.debut(c,Placement.EQUIPEMENT,x0,y0);
        Font t = cl.font;
        double hauteurLigne = t.lineHeight;

        for (int i = 0; i < PIECES.length; i++) {
            int x = x0 + i * (cellule + relie);
            Theme.cadre(c, x, y0, cellule, cellule,
                    Theme.alpha(Theme.PANNEAU, 0.75 * a),
                    Theme.alpha(Theme.BORDURE, a));
            if (portees[i].isEmpty()) continue;
            c.item(portees[i], x + 1, y0 + 1);

            /*  L'usure, la meme barre que dans l'inventaire : la
                couleur vient du jeu, la position vient de nous. */
            if (portees[i].getMaxDamage() > 0 && portees[i].getDamageValue() > 0) {
                int etape = portees[i].getBarWidth();
                Theme.rect(c, x + 1, y0 + cellule + 2, 16, 2, Theme.alpha(0xFF101216, a));
                int rempli = Math.max(1, Math.round(16 * etape / 13f));
                Theme.rect(c, x + 1, y0 + cellule + 2, rempli, 2,
                        Theme.alpha(portees[i].getBarColor(), a));
            }

            if (portees[i].getCount() > 1) {
                String quantite = String.valueOf(portees[i].getCount());
                Theme.texte(c, t, quantite, x + cellule - t.width(quantite),
                        y0 + cellule - (int) hauteurLigne + 2,
                        Theme.alpha(Theme.TEXTE, a));
            }
        }

        Cadres.placer(Placement.EQUIPEMENT.id, defautX, defautY, x0, y0, largeurBloc, actualHeight);Cadres.fin(c);
        return actualHeight;
    }

    /* ------------------------------------------------------------------ */
    /*  Effets actifs : pastille de couleur, nom, et ce qu'il lui
        reste de temps. Ce que le jeu cache ici : le temps restant,
        c'est ce qui manque le plus quand on evade un effet.           */
    /* ------------------------------------------------------------------ */

    private static void dessinerEffets(GuiGraphicsExtractor c, Minecraft cl, int largeur,
                                       int dessus, double a) {
        Collection<MobEffectInstance> actifs = cl.player.getActiveEffects();
        if (actifs.isEmpty()) return;

        Font t = cl.font;
        double fonte = t.lineHeight;

        /*  Seuls les effets que le jeu affiche lui-meme : les effets
            techniques invisibles restent hors du HUD.                  */
        List<MobEffectInstance> listes = new ArrayList<>();
        for (MobEffectInstance e : actifs) {
            if (e.showIcon()) listes.add(e);
        }
        if (listes.isEmpty()) return;
        listes.sort(Comparator.comparingInt(e ->
                e.isInfiniteDuration() ? Integer.MAX_VALUE : e.getDuration()));

        int maximumLignes = 7;
        int lignes = Math.min(listes.size(), maximumLignes);

        int largeurBloc = 60;
        for (int i = 0; i < lignes; i++) {
            String nom = nomEffet(listes.get(i));
            String reste = listes.get(i).isInfiniteDuration() ? "sans fin" : duree(listes.get(i).getDuration() * 50L);
            int pleine = 8 + t.width(nom) + 6 + t.width(reste);
            if (pleine > largeurBloc) largeurBloc = pleine;
        }
        int hauteurBloc = lignes * 12 - 2;
        if (listes.size() > maximumLignes) hauteurBloc += 12;

        int defautX = (largeur - largeurBloc) / 2;
        int defautY = dessus;
        int x0 = Cadres.limiterX(defautX + Placement.POTIONS.dx,largeurBloc,Placement.POTIONS);
        int y0 = Cadres.limiterY(defautY + Placement.POTIONS.dy,hauteurBloc,Placement.POTIONS);
        Cadres.debut(c,Placement.POTIONS,x0,y0);

        int y = y0;
        for (int i = 0; i < lignes; i++) {
            MobEffectInstance e = listes.get(i);
            String nom = nomEffet(e);
            String reste = e.isInfiniteDuration() ? "sans fin" : duree(e.getDuration() * 50L);
            Theme.rect(c, x0, y + (int) ((fonte - 4) / 2), 4, 4,
                    Theme.alpha(e.getEffect().value().getColor(), a));
            Theme.texte(c, t, nom, x0 + 8, y, Theme.alpha(Theme.TEXTE_DOUX, a));
            Theme.texte(c, t, reste, x0 + largeurBloc - t.width(reste), y,
                    Theme.alpha(Theme.TEXTE_FAIBLE, a));
            y += 12;
        }
        if (listes.size() > maximumLignes) {
            String reste = "+" + (listes.size() - maximumLignes) + " autres";
            Theme.texte(c, t, reste, x0 + largeurBloc - t.width(reste), y,
                    Theme.alpha(Theme.TEXTE_FAIBLE, 0.7 * a));
        }

        Cadres.placer(Placement.POTIONS.id, defautX, defautY, x0, y0, largeurBloc, hauteurBloc);Cadres.fin(c);
    }

    /** Le nom d'un effet, suivi de son rang marche par marche, comme
        dans l'inventaire : la Vitesse II est la deuxieme marche. */
    private static String nomEffet(MobEffectInstance e) {
        try {
            String nom = e.getEffect().value().getDisplayName().getString();
            int rang = e.getAmplifier();
            if (rang >= 0 && rang < ROMAINS.length) nom += " " + ROMAINS[rang];
            return nom;
        } catch (Throwable erreur) {
            return "?";
        }
    }

    private static final String[] ROMAINS = {
            "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"
    };

    /** Cardinal depuis l'orientation du joueur. Le nord du jeu
        regarde Y moins : un cap de 180 degres regarde le nord. */
    private static String cardinal(Minecraft cl) {
        if (cl.player == null) return "";
        float ligne = (((cl.player.getYRot() % 360f) + 360f) % 360f);
        int coin = Math.round(ligne / 45f) % 8;
        return COINS[coin];
    }

    private static final String[] COINS = {
            "S", "SO", "O", "NO", "N", "NE", "E", "SE"
    };

    /** La latence du serveur, en millisecondes. Moins une en mono :
        la ligne n est servie qu en multi.                           */
    private static int latence(Minecraft cl) {
        if (cl.getConnection() == null || cl.player == null) return -1;
        try {
            PlayerInfo entree = cl.getConnection().getPlayerInfo(cl.player.getUUID());
            return entree == null ? -1 : entree.getLatency();
        } catch (Throwable erreur) {
            return -1;
        }
    }

    private static String coordonnees(Minecraft cl) {
        if (cl.player == null) return "";
        return (int) Math.floor(cl.player.getX()) + " / "
             + (int) Math.floor(cl.player.getY()) + " / "
             + (int) Math.floor(cl.player.getZ());
    }

    /** Le nom du biome, lu dans le registre du monde. */
    private static String biome(Minecraft cl, Level monde) {
        if (cl.player == null || monde == null) return "";
        try {
            BlockPos pos = BlockPos.containing(cl.player.getX(), cl.player.getY(), cl.player.getZ());
            return monde.getBiome(pos).unwrapKey()
                       .map(cle -> cle.identifier().getPath())
                       .orElse("?");
        } catch (Throwable erreur) {
            return "?";
        }
    }

    /** Duree ecoulée depuis le debut de la session, en clair. */
    private static String duree(long nanosecondes) {
        long secondes = nanosecondes / 1_000_000_000L;
        long h = secondes / 3600;
        long m = (secondes % 3600) / 60;
        long s = secondes % 60;
        if (h > 0) return String.format("%d h %02d", h, m);
        return String.format("%02d:%02d", m, s);
    }

    static String libelleMode(GameType g) {
        if (g == null) return "";
        return switch (g) {
            case CREATIVE -> "Creatif";
            case ADVENTURE -> "Aventure";
            case SPECTATOR -> "Spectateur";
            default -> "Survie";
        };
    }
}