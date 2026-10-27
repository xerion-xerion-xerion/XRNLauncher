package fr.xerion.xrnhud;

import java.util.ArrayList;
import java.util.List;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import net.minecraft.client.render.RenderLayers;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.texture.TextureManager;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/**
 * La garde-robe.
 *
 * <p>Un ecran a part entiere, et non un onglet de plus dans le menu :
 * un cosmetique se juge sur le personnage, pas sur une ligne de
 * texte. A gauche, le personnage, en vrai, avec ce qu il porte. A
 * droite, ce qu on possede, et ce qu on peut mettre.
 *
 * <p>Le personnage affiche est le joueur local. C est le seul dont on
 * sait qu il possede ce qu il porte : le serveur ne dit rien des
 * droits des autres joueurs.
 */
public class EcranGardeRobe extends Screen {

    private static final org.slf4j.Logger LOGGER = org.slf4j.LoggerFactory.getLogger("XRN HUD");

    private static final int LARGEUR = 380;
    private static final int HAUTEUR = 236;
    private static final int APERCU_L = 132;
    private static final int APERCU_H = 200;

    /*  Les cosmetiques possedes, regroupes par type. */
    private final List<Droits.Cosmetique> liste = new ArrayList<>();

    /*  Les cartes, calculees a chaque image, pour que le clic sache
        sur quoi il est tombe. */
    private record Carte(int x, int y, int w, int h, Droits.Cosmetique cosmetique) {}

    private final List<Carte> cartes = new ArrayList<>();
    private int survole = -1;

    /*  L'angle de rotation de l apercu : le personnage tourne
        lentement, comme sur un转动 presenter. */
    private float rotation = 0f;

    public EcranGardeRobe() {
        super(Text.literal("Garde-robe"));
        liste.addAll(Droits.acquis());
    }

    @Override
    public boolean shouldPause() {
        return false;
    }

    @Override
    public void render(DrawContext c, int mouseX, int mouseY, float delta) {
        super.render(c, mouseX, mouseY, delta);
        rotation += delta * 22f;

        int l = this.width, h = this.height;
        int x = (l - LARGEUR) / 2;
        int y = (h - HAUTEUR) / 2;

        /*  Le fond de l ecran, et la carte. */
        c.fill(0, 0, l, h, Theme.alpha(0xC0070510, 0.86f));
        Theme.cadre(c, x, y, LARGEUR, HAUTEUR,
                Theme.alpha(Theme.PANNEAU, 0.98f), Theme.alpha(Theme.BORDURE, 0.9f));

        TextRenderer tr = MinecraftClient.getInstance().textRenderer;
        Theme.texte(c, tr, "GARDE-ROBE", x + 16, y + 12, Theme.alpha(Theme.ACCENT, 1f));

        /*  L apercu : le personnage, avec ce qu il porte. */
        int ax = x + 14, ay = y + 30;
        /*  Le fond de l apercu est clair : le personnage est dessine
            avec la lumiere du monde, et sur un fond noir il disparait. */
        Theme.cadre(c, ax, ay, APERCU_L, APERCU_H,
                Theme.alpha(0x2E2842, 0.95f), Theme.alpha(Theme.BORDURE, 0.6f));

        /*  Le visuel du cosmetique : ce qu on survole, sinon ce qu on
            porte. C est l image reelle que le jeu affiche sur le
            personnage ; le personnage, lui, se voit en jeu.             */
        String porte = Droits.equipe();
        String montre = porte;
        if (survole >= 0 && survole < liste.size()) montre = liste.get(survole).id;
        if (!montre.isEmpty()) {
            for (Droits.Cosmetique co : liste) {
                if (!co.id.equals(montre)) continue;
                if (dessinerApercu(c, co, ax + 12, ay + 14, APERCU_L - 24)) break;
            }
        }
        Theme.texte(c, tr, montre.equals(porte) ? "Tu le portes en jeu" : "Apercu",
                ax + 10, ay + APERCU_H - 16, Theme.alpha(Theme.TEXTE_FAIBLE, 1f));

        /*  Ce qu on porte, et ce qu on pourrait porter. */
        int dx = ax + APERCU_L + 14;
        int dw = LARGEUR - (dx - x) - 16;
        Theme.texte(c, tr, "PORTE", dx, ay, Theme.alpha(Theme.TEXTE_DOUX, 1f));

        Theme.texte(c, tr, porte.isEmpty() ? "Aucun cosmetique" : Droits.nom(porte),
                dx, ay + 12, Theme.alpha(Theme.TEXTE, 1f));

        /*  La liste, en cartes. */
        cartes.clear();
        int cy = ay + 30;
        for (int i = 0; i < liste.size(); i++) {
            Droits.Cosmetique co = liste.get(i);
            int ch = 34;
            boolean surv = survole == i;
            Theme.cadre(c, dx, cy, dw, ch,
                    Theme.alpha(surv ? Theme.ACCENT : 0x171129, 0.55f),
                    Theme.alpha(porte.equals(co.id) ? Theme.ACCENT : Theme.BORDURE, 0.9f));

            /*  L icone : la vraie image du cosmetique quand on l a,
                sinon une pastille aux couleurs du produit.              */
            int ix = dx + 6, iy = cy + 7;
            if (!dessinerApercu(c, co, ix, iy, 20)) {
                c.fill(ix, iy, ix + 20, iy + 20, Theme.alpha(0x000000, 0.3f));
                c.fill(ix + 1, iy + 1, ix + 19, iy + 19, hex(co.couleur));
            }

            Theme.texte(c, tr, co.nom, ix + 28, cy + 8, Theme.alpha(Theme.TEXTE, 1f));
            Theme.texte(c, tr, porte.equals(co.id) ? "Equipe" : "Porter",
                    ix + 28, cy + 19, Theme.alpha(Theme.TEXTE_FAIBLE, 1f));

            cartes.add(new Carte(dx, cy, dw, ch, co));
            cy += ch + 6;
        }

        if (liste.isEmpty()) {
            Theme.texte(c, tr, "Aucun cosmetique pour le moment.", dx, cy,
                    Theme.alpha(Theme.TEXTE_FAIBLE, 1f));
            Theme.texte(c, tr, "La boutique du launcher en propose.", dx, cy + 11,
                    Theme.alpha(Theme.TEXTE_FAIBLE, 1f));
        }

        /*  Le survol. */
        survole = -1;
        for (int i = 0; i < cartes.size(); i++) {
            Carte ca = cartes.get(i);
            if (mouseX >= ca.x() && mouseX < ca.x() + ca.w()
                    && mouseY >= ca.y() && mouseY < ca.y() + ca.h()) {
                survole = i;
                break;
            }
        }

        Theme.texte(c, tr, "Echap pour fermer", x + LARGEUR - 92, y + HAUTEUR - 16,
                Theme.alpha(Theme.TEXTE_FAIBLE, 1f));
    }

    /**
     * Dessine l image du cosmetique depuis sa miniature.
     *
     * <p>On montre le vrai visuel, pas un symbole : une cape se juge
     * sur son image.
     */
    private boolean dessinerApercu(DrawContext c, Droits.Cosmetique co, int x, int y, int taille) {
        /*  Les miniatures stylees, au lieu des textures brutes. */
        Identifier preview = Identifier.of("xrnhud", "textures/preview/" + co.id + ".png");
        return dessinerTexture(c, preview, 0, 0, 128, 128, x, y, taille, taille);
    }

    /*  L ancien apercu 3D est retire : la camera du jeu n est pas
        pilotable proprement depuis un ecran, et le rendu restait
        derriere le modele. L image reelle du cosmetique suffit.      */

    /**
     * Dessine une zone d une texture du mod.
     */
    private boolean dessinerTexture(DrawContext c, Identifier texture, int u, int v,
                                    int l, int h, int x, int y, int largeur, int hauteur) {
        try {
            c.drawTexture(net.minecraft.client.gl.RenderPipelines.GUI_TEXTURED, texture,
                    x, y, (float) u, (float) v, largeur, hauteur, l, h);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        int mx = (int) click.x();
        int my = (int) click.y();
        for (Carte ca : cartes) {
            if (mx >= ca.x() && mx < ca.x() + ca.w() && my >= ca.y() && my < ca.y() + ca.h()) {
                String id = ca.cosmetique().id;
                Droits.equiper(Droits.equipe().equals(id) ? "" : id);
                return true;
            }
        }
        return super.mouseClicked(click, doubled);
    }

    /** La couleur d une pastille, depuis une chaine hexadecimale. */
    private static int hex(String couleur) {
        try {
            return 0xFF000000 | Integer.parseInt(String.valueOf(couleur).replace("#", ""), 16);
        } catch (Exception e) {
            return 0xFF7B5CFF;
        }
    }
}
