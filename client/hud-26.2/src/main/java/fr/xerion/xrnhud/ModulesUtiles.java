package fr.xerion.xrnhud;

import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

/** Small, local survival tools. Values are sampled on ticks, never on frames. */
final class ModulesUtiles {
    static boolean inventaire = false;
    static boolean durabilite = true;
    static boolean nether = false;
    static boolean pause = false;
    private static final long HEURE = 3_600_000_000_000L;
    private static long debut = 0;
    private static int ticks;
    private static int places;
    private static String avertissement = "";
    private static String conversion = "";
    private static final EquipmentSlot[] MATERIEL = {
        EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND, EquipmentSlot.HEAD,
        EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET
    };

    private ModulesUtiles() {}

    static void tick(Minecraft cl) {
        if (cl.player == null || cl.level == null) {
            debut = 0; ticks = 0; places = 0; avertissement = ""; conversion = "";
            return;
        }
        if (debut == 0) debut = System.nanoTime();
        if (++ticks % 10 != 0) return;
        places = 0;
        if (inventaire) {
            for (int i = 0; i < 36; i++) if (cl.player.getInventory().getItem(i).isEmpty()) places++;
        }
        avertissement = "";
        if (durabilite) {
            int plusBas = 101;
            for (EquipmentSlot slot : MATERIEL) {
                ItemStack stack = cl.player.getItemBySlot(slot);
                if (stack.isEmpty() || !stack.isDamageableItem() || stack.getMaxDamage() <= 0) continue;
                int restant = (int) (100L * (stack.getMaxDamage() - stack.getDamageValue()) / stack.getMaxDamage());
                if (restant <= 15 && restant < plusBas) {
                    plusBas = restant;
                    avertissement = stack.getHoverName().getString() + " : " + restant + " %";
                }
            }
        }
        conversion = "";
        if (nether) {
            boolean normal = cl.level.dimension().equals(Level.OVERWORLD);
            boolean enfer = cl.level.dimension().equals(Level.NETHER);
            if (normal || enfer) {
                double facteur = normal ? .125 : 8;
                conversion = (normal ? "Nether" : "Surface") + "  X "
                    + (long) Math.floor(cl.player.getX() * facteur) + " / Z "
                    + (long) Math.floor(cl.player.getZ() * facteur);
            }
        }
    }

    static String position(Minecraft cl) {
        if (cl.player == null || cl.level == null) return "";
        return "X " + cl.player.getBlockX() + " / Y " + cl.player.getBlockY()
            + " / Z " + cl.player.getBlockZ() + " (" + cl.level.dimension().identifier() + ")";
    }

    static void reporterPause() { debut = System.nanoTime(); }

    static void dessiner(GuiGraphicsExtractor c, Minecraft cl, float alpha) {
        List<String> lignes = new ArrayList<>();
        if (inventaire) lignes.add("Inventaire  " + places + " / 36 places libres");
        if (nether && !conversion.isEmpty()) lignes.add(conversion);
        if (durabilite && !avertissement.isEmpty()) lignes.add("Usure  " + avertissement);
        if (pause && debut != 0 && System.nanoTime() - debut >= HEURE) lignes.add("60 min de jeu : une pause ?");
        if (lignes.isEmpty()||Placement.UTILITAIRES.hidden) return;
        int largeur = 0;
        for (String ligne : lignes) largeur = Math.max(largeur, cl.font.width(ligne));
        int w = Math.min(largeur + 12, cl.getWindow().getGuiScaledWidth() - 12);
        int h = lignes.size() * 12 + 8;
        int dx = 96, dy = 48;
        int x = Math.max(0, Math.min(cl.getWindow().getGuiScaledWidth() - w, dx + Placement.UTILITAIRES.dx));
        int y = Math.max(0, Math.min(cl.getWindow().getGuiScaledHeight() - h, dy + Placement.UTILITAIRES.dy));
        x=Cadres.limiterX(x,w,Placement.UTILITAIRES);y=Cadres.limiterY(y,h,Placement.UTILITAIRES);
        Cadres.debut(c,Placement.UTILITAIRES,x,y);
        Theme.cadre(c, x, y, w, h, Theme.alpha(Theme.PANNEAU_BAS, .88 * alpha), Theme.alpha(Theme.BORDURE, alpha));
        Theme.rect(c, x, y, 2, h, Theme.alpha(Theme.ACCENT, alpha));
        c.enableScissor(x + 4, y, x + w - 2, y + h);
        for (int i = 0; i < lignes.size(); i++) {
            String ligne = lignes.get(i);
            Theme.texte(c, cl.font, ligne, x + 6, y + 5 + i * 12,
                Theme.alpha(ligne.startsWith("Usure") ? Theme.ROUGE : Theme.TEXTE, alpha));
        }
        c.disableScissor();
        Cadres.placer(Placement.UTILITAIRES.id, dx, dy, x, y, w, h);Cadres.fin(c);
    }

    static void charger(JsonObject o) {
        if (o.has("inventaireLibre")) inventaire = o.get("inventaireLibre").getAsBoolean();
        if (o.has("alerteDurabilite")) durabilite = o.get("alerteDurabilite").getAsBoolean();
        if (o.has("conversionNether")) nether = o.get("conversionNether").getAsBoolean();
        if (o.has("rappelPause")) pause = o.get("rappelPause").getAsBoolean();
    }

    static void sauver(JsonObject o) {
        o.addProperty("inventaireLibre", inventaire);
        o.addProperty("alerteDurabilite", durabilite);
        o.addProperty("conversionNether", nether);
        o.addProperty("rappelPause", pause);
    }
}
