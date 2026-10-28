package fr.xerion.xrnhud;

import com.google.gson.JsonObject;

/**
 * Les reglages du mod, memorises sur la machine.
 *
 * <p>Sans cela, tout ce qu on coche dans le menu disparait a la
 * fermeture du jeu : le pleinbright, le logo, les elements du HUD, le
 * reticule... Les regles du jeu, elles, sont deja memorisees par le
 * jeu lui-meme.
 *
 * <p>Les reglages sont ranges dans le meme fichier que les positions
 * des elements du HUD, dans le dossier config du jeu : un seul fichier
 * a lire, un seul a ecrire.
 */
final class Reglages {

    /*  Le joueur a-t-il tranche pour le mode Boost FPS ? Si oui, le
        launcher ne peut plus l activer ou le desactiver a sa guise. */
    private static boolean boostEcrit = false;

    private Reglages() {}

    /** Applique les reglages lus. Un fichier illisible ne doit pas
        empêcher le jeu de demarrer : on garde alors les valeurs par
        defaut. */
    static void appliquer(JsonObject o) {
        if (o == null) return;
        MotionBlur.load(o);FreeLook.load(o);Ciel.charger(o);NameTag.charger(o);Visuels.charger(o);Raccourcis.charger(o);
        ModulesPlus.charger(o);
        ModulesUtiles.charger(o);
        Performance.charger(o);
        boostEcrit = o.has("boostChoisi") && o.get("boostChoisi").getAsBoolean();
        try {
            if (o.has("fullbright")) Fonctions.fullbright = o.get("fullbright").getAsBoolean();
            if (o.has("logo")) Logo.actif = o.get("logo").getAsBoolean();
            if (o.has("boost")) Performance.actif = o.get("boost").getAsBoolean();

            if(o.has("informations"))Hud.informations=o.get("informations").getAsBoolean();
            if (o.has("hudVisible")) Hud.visible = o.get("hudVisible").getAsBoolean();
            if (o.has("touches")) Hud.touches = o.get("touches").getAsBoolean();
            if (o.has("minuterie")) Hud.minuterie = o.get("minuterie").getAsBoolean();
            if (o.has("compteur")) Hud.compteur = o.get("compteur").getAsBoolean();
            if (o.has("boussole")) Hud.boussole = o.get("boussole").getAsBoolean();
            if (o.has("ping")) Hud.ping = o.get("ping").getAsBoolean();
            if (o.has("armure")) Hud.armure = o.get("armure").getAsBoolean();
            if (o.has("chrono")) Hud.chrono = o.get("chrono").getAsBoolean();
            if (o.has("vitesse")) Hud.vitesse = o.get("vitesse").getAsBoolean();
            if (o.has("heureJeu")) Hud.heureJeu = o.get("heureJeu").getAsBoolean();
            if (o.has("memoire")) Hud.memoire = o.get("memoire").getAsBoolean();
              if (o.has("signature")) Hud.signature = o.get("signature").getAsBoolean();
              if (o.has("musique")) Musique.visible = o.get("musique").getAsBoolean();
              if (o.has("connus")) Connus.charger(o.get("connus").getAsString());
            if (o.has("equipe")) Droits.memoriserEquipe(o.get("equipe").getAsString());
            if (o.has("position")) Hud.position = o.get("position").getAsInt();
            if (o.has("voile")) Hud.voileMenu = o.get("voile").getAsDouble();

            if (o.has("coeurs")) Elements.coeurs = o.get("coeurs").getAsBoolean();
            if (o.has("faim")) Elements.faim = o.get("faim").getAsBoolean();
            if (o.has("effets")) Elements.effets = o.get("effets").getAsBoolean();
            if (o.has("boss")) Elements.boss = o.get("boss").getAsBoolean();
            if (o.has("objetTenu")) Elements.objetTenu = o.get("objetTenu").getAsBoolean();
            if (o.has("scoreboard")) Elements.scoreboard = o.get("scoreboard").getAsBoolean();

            if (o.has("reticuleMode")) {
                int n = o.get("reticuleMode").getAsInt();
                Reticule.Mode[] modes = Reticule.Mode.values();
                if (n >= 0 && n < modes.length) Reticule.mode = modes[n];
            }
            if (o.has("reticuleCouleur")) Reticule.couleur = (int) o.get("reticuleCouleur").getAsLong();
            if (o.has("reticuleEpaisseur")) Reticule.epaisseur = o.get("reticuleEpaisseur").getAsInt();
        } catch (Throwable t) {
            /*  Reglages illisibles : on garde les valeurs par defaut. */
        }
    }

    /**
     * Le joueur a-t-il deja tranche pour le mode Boost FPS ?
     *
     * <p>Le launcher peut le demander au lancement du jeu. Mais si le
     * joueur a deja coche, ou decoche, la case dans le menu, c'est son
     * choix qui compte.
     */
    static boolean boostEcrit() {
        return boostEcrit;
    }

    /** Note que le joueur a tranche pour le mode Boost FPS. */
    static void boostNote() {
        boostEcrit = true;
    }

    /** Ecrit les reglages. */
    static void ecrire(JsonObject o) { MotionBlur.save(o);FreeLook.save(o);Ciel.sauver(o);NameTag.sauver(o); Visuels.sauver(o);Raccourcis.sauver(o); ModulesPlus.sauver(o); ModulesUtiles.sauver(o); Performance.sauvegarder(o);        o.addProperty("fullbright", Fonctions.fullbright);
        o.addProperty("logo", Logo.actif);
        o.addProperty("boost", Performance.actif);
        o.addProperty("boostChoisi", boostEcrit);

        o.addProperty("informations",Hud.informations);
        o.addProperty("hudVisible", Hud.visible);
        o.addProperty("touches", Hud.touches);
        o.addProperty("minuterie", Hud.minuterie);
        o.addProperty("compteur", Hud.compteur);
        o.addProperty("boussole", Hud.boussole);
        o.addProperty("ping", Hud.ping);
        o.addProperty("armure", Hud.armure);
        o.addProperty("chrono", Hud.chrono);
        o.addProperty("vitesse", Hud.vitesse);
        o.addProperty("heureJeu", Hud.heureJeu);
        o.addProperty("memoire", Hud.memoire);
        o.addProperty("signature", Hud.signature);
        o.addProperty("musique", Musique.visible);
        o.addProperty("connus", Connus.liste());
        o.addProperty("equipe", Droits.equipe());
        o.addProperty("position", Hud.position);
        o.addProperty("voile", Hud.voileMenu);

        o.addProperty("coeurs", Elements.coeurs);
        o.addProperty("faim", Elements.faim);
        o.addProperty("effets", Elements.effets);
        o.addProperty("boss", Elements.boss);
        o.addProperty("objetTenu", Elements.objetTenu);
        o.addProperty("scoreboard", Elements.scoreboard);

        o.addProperty("reticuleMode", Reticule.mode.ordinal());
        o.addProperty("reticuleCouleur", (long) Reticule.couleur);
        o.addProperty("reticuleEpaisseur", Reticule.epaisseur);
    }
}
