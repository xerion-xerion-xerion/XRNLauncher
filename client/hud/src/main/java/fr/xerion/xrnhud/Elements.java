package fr.xerion.xrnhud;

import java.util.function.BooleanSupplier;

import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.util.Identifier;

/**
 * Les elements du HUD de Minecraft que l on peut eteindre.
 *
 * <p>Meme principe que pour le reticule : on enveloppe l element au lieu
 * de le supprimer, pour pouvoir le rallumer aussitot sans relancer.
 */
final class Elements {

    static boolean coeurs = true;
    static boolean faim = true;
    static boolean effets = true;
    static boolean boss = true;
    static boolean objetTenu = true;
    static boolean scoreboard = true;

    private static boolean pose = false;

    private Elements() {}

    static void installer() {
        if (pose) return;
        pose = true;
        envelopper(VanillaHudElements.HEALTH_BAR, () -> coeurs);
        envelopper(VanillaHudElements.FOOD_BAR, () -> faim);
        envelopper(VanillaHudElements.STATUS_EFFECTS, () -> effets);
        envelopper(VanillaHudElements.BOSS_BAR, () -> boss);
        envelopper(VanillaHudElements.HELD_ITEM_TOOLTIP, () -> objetTenu);
    }

    private static void envelopper(Identifier cible, BooleanSupplier actif) {
        HudElementRegistry.replaceElement(cible, original -> (context, tick) -> {
            if (actif.getAsBoolean()) {
                original.render(context, tick);
            }
        });
    }
}
